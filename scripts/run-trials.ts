#!/usr/bin/env bun

/**
 * Parallel trials runner for measuring agent reliability
 *
 * @remarks
 * Runs multiple trials per prompt across agent × search provider combinations to measure
 * pass@k (capability) and pass^k (reliability) metrics.
 *
 * ## Execution Model
 *
 * Uses Docker containers like run.ts for isolated execution:
 * - **Agents**: claude-code, gemini, droid, codex (or subset via --agent)
 * - **Search Providers**: builtin, you (or subset via --search-provider)
 * - **Trial Types**: default (k=5), capability (k=10), regression (k=3)
 *
 * Each combination runs in its own Docker container with isolated environment:
 * ```bash
 * docker compose run --rm \
 *   -e SEARCH_PROVIDER=you \
 *   claude-code \
 *   bunx @plaited/agent-eval-harness trials ...
 * ```
 *
 * ## Output Format
 *
 * Results written to `data/results/YYYY-MM-DD/{agent}/{provider}.jsonl`:
 * ```
 * 2026-02-18/claude-code/builtin.jsonl
 * 2026-02-18/gemini/you.jsonl
 * ```
 *
 * Each record contains:
 * - `id`: Prompt identifier
 * - `passRate`: Fraction of trials that passed
 * - `passAtK`: Probability of at least one success in k trials
 * - `passExpK`: Probability of k consecutive successes
 * - `trials`: Array of individual trial results
 *
 * ## Metrics
 *
 * - **pass@k**: Capability metric (can the agent solve this task?)
 * - **pass^k**: Reliability metric (does it always succeed?)
 * - **Flakiness**: pass@k - pass^k (high = inconsistent)
 *
 * Usage:
 *   bun scripts/run-trials.ts                              # All agents/providers, k=5, full dataset (151 prompts)
 *   bun scripts/run-trials.ts --count 5                    # 5 random prompts, k=5 (quick smoke test)
 *   bun scripts/run-trials.ts --trial-type capability      # All agents, k=10
 *   bun scripts/run-trials.ts --trial-type regression      # All agents, k=3
 *   bun scripts/run-trials.ts -k 1                         # Single-run equivalent (full dataset)
 *   bun scripts/run-trials.ts --agent gemini               # Single agent, all providers
 *   bun scripts/run-trials.ts --search-provider you        # All agents, MCP only
 *   bun scripts/run-trials.ts -j 4                         # 4 containers in parallel
 *   bun scripts/run-trials.ts --prompt-concurrency 8       # 8 prompts per container
 *   bun scripts/run-trials.ts -j 2 --prompt-concurrency 4  # Custom both levels
 *
 * @public
 */

import { MCP_SERVERS, type McpServerKey } from "../mcp-servers.ts";
import type { Agent, RunConfig, SearchProvider } from "./shared/shared.types.ts";
import { ALL_AGENTS } from "./shared/shared.constants.ts";
import { limitConcurrency } from "./shared/concurrency-limiter.ts";
import { runDockerScenario } from "./shared/docker-runner.ts";
import { createStatusHeartbeat, printResultsSummary, handleExit } from "./shared/reporting.ts";

type TrialType = "default" | "capability" | "regression";

type TrialsOptions = {
  agents: Agent[];
  trialType: TrialType;
  searchProviders: SearchProvider[];
  count?: number;
  k?: number;
  concurrency: number;
  promptConcurrency: number;
  dryRun?: boolean;
};

/**
 * Parse command-line arguments for trials execution
 *
 * @param args - Command-line arguments
 * @returns Parsed options
 *
 * @public
 */
const parseArgs = (args: string[]): TrialsOptions => {
  const agents: Agent[] = [];
  const searchProviders: SearchProvider[] = [];
  let trialType: TrialType = "default";
  let count: number | undefined;
  let k: number | undefined;
  let concurrency: number | undefined;
  let promptConcurrency: number | undefined;
  let dryRun = false;

  const validProviders = ["builtin", ...Object.keys(MCP_SERVERS)];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agent" && i + 1 < args.length) {
      const agentArg = args[i + 1];
      if (!ALL_AGENTS.includes(agentArg as Agent)) {
        throw new Error(`Invalid agent: ${agentArg}. Must be one of: ${ALL_AGENTS.join(", ")}`);
      }
      agents.push(agentArg as Agent);
      i++;
    } else if (args[i] === "--search-provider" && i + 1 < args.length) {
      const providerArg = args[i + 1];
      if (!validProviders.includes(providerArg as string)) {
        throw new Error(`Invalid search provider: ${providerArg}. Must be one of: ${validProviders.join(", ")}`);
      }
      searchProviders.push(providerArg as SearchProvider);
      i++;
    } else if (args[i] === "--trial-type" && i + 1 < args.length) {
      const typeArg = args[i + 1];
      if (typeArg !== "default" && typeArg !== "capability" && typeArg !== "regression") {
        throw new Error(`Invalid trial type: ${typeArg}. Must be "default", "capability", or "regression"`);
      }
      trialType = typeArg as TrialType;
      i++;
    } else if (args[i] === "--count" && i + 1 < args.length) {
      const countArg = args[i + 1];
      if (!countArg) {
        throw new Error("Missing value for --count flag");
      }
      count = Number.parseInt(countArg, 10);
      if (Number.isNaN(count) || count < 1) {
        throw new Error(`Invalid count: ${countArg}. Must be a positive integer`);
      }
      i++;
    } else if (args[i] === "-k" && i + 1 < args.length) {
      const kArg = args[i + 1];
      if (!kArg) {
        throw new Error("Missing value for -k flag");
      }
      k = Number.parseInt(kArg, 10);
      if (Number.isNaN(k) || k < 1) {
        throw new Error(`Invalid k value: ${kArg}. Must be a positive integer`);
      }
      i++;
    } else if ((args[i] === "-j" || args[i] === "--concurrency") && i + 1 < args.length) {
      const arg = args[i + 1] as string;
      const value = Number.parseInt(arg, 10);
      if (Number.isNaN(value) || value < 0) {
        throw new Error(`Invalid concurrency: ${arg}. Must be a non-negative integer (0 for unlimited)`);
      }
      concurrency = value === 0 ? Infinity : value;
      i++;
    } else if (args[i] === "--prompt-concurrency" && i + 1 < args.length) {
      const arg = args[i + 1] as string;
      const value = Number.parseInt(arg, 10);
      if (Number.isNaN(value) || value < 1) {
        throw new Error(`Invalid prompt-concurrency: ${arg}. Must be a positive integer`);
      }
      promptConcurrency = value;
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  // Defaults: all agents, all providers
  const mcpProviders = Object.keys(MCP_SERVERS) as McpServerKey[];

  return {
    agents: agents.length > 0 ? agents : ALL_AGENTS,
    trialType,
    count,
    searchProviders: searchProviders.length > 0 ? searchProviders : ["builtin", ...mcpProviders],
    k,
    concurrency: concurrency ?? Infinity, // Default unlimited (I/O-bound workload)
    promptConcurrency: promptConcurrency ?? 1, // Default 1: stream-mode agents OOM at higher values (see issue #45)
    dryRun,
  };
};

/**
 * Get k value for trial type
 *
 * @param trialType - Type of trial (default, capability, regression)
 * @param override - Optional override value
 * @returns Number of trials to run
 *
 * @internal
 */
const getKValue = (trialType: TrialType, override?: number): number => {
  if (override) return override;

  switch (trialType) {
    case "capability":
      return 10;
    case "regression":
      return 3;
    default:
      return 5;
  }
};

/**
 * Get prompt dataset path for trials
 *
 * @param searchProvider - Search provider (builtin or MCP server key)
 * @returns Prompt dataset path (always uses full dataset)
 *
 * @internal
 */
const getPromptPath = (searchProvider: SearchProvider): string => {
  return searchProvider === "builtin"
    ? `/eval/data/prompts/prompts.jsonl`
    : `/eval/data/prompts/prompts-${searchProvider}.jsonl`;
};

/** Stdout filter for trials — includes "Running" lines for trial progress */
const trialsStdoutFilter = (line: string): boolean =>
  line.includes("Running") ||
  line.includes("Done!") ||
  line.includes("TIMEOUT") ||
  line.includes("ERROR") ||
  line.match(/✓|✗/) !== null;

/**
 * Main entry point
 *
 * @internal
 */
const main = async () => {
  const args = process.argv.slice(2);

  try {
    const options = parseArgs(args);
    const k = getKValue(options.trialType, options.k);

    const concurrencyLabel = options.concurrency === Infinity ? "unlimited" : options.concurrency;
    const datasetLabel = options.count ? `Sampling ${options.count} from full dataset` : "full (151 prompts)";
    console.log(`${options.dryRun ? "[DRY RUN] " : ""}Pass@k Trials Configuration`);
    console.log(`${"=".repeat(80)}`);
    console.log(`Trial type: ${options.trialType} (k=${k})`);
    console.log(`Dataset: ${datasetLabel}`);
    console.log(`Agents: ${options.agents.join(", ")}`);
    console.log(`Search providers: ${options.searchProviders.join(", ")}`);
    console.log(`Container concurrency: ${concurrencyLabel}, Prompt concurrency: ${options.promptConcurrency}`);
    console.log(`Execution: Docker containers (isolated)`);
    console.log(`${"=".repeat(80)}\n`);

    // Build execution matrix
    const runs: RunConfig[] = [];
    for (const agent of options.agents) {
      for (const provider of options.searchProviders) {
        runs.push({ agent, searchProvider: provider });
      }
    }

    console.log(
      `${options.dryRun ? "[DRY RUN] Would run" : "Running"} ${runs.length} trial scenarios (concurrency: ${concurrencyLabel})\n`,
    );

    if (options.dryRun) {
      console.log("[DRY RUN] Execution plan:");
      const runDate = new Date().toISOString().split("T")[0];
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        if (!run) continue;
        const datasetPath = getPromptPath(run.searchProvider);
        const typeSuffix = options.trialType === "default" ? "" : `-${options.trialType}`;
        const outputPath = `/eval/data/results/${runDate}/${run.agent}/${run.searchProvider}${typeSuffix}.jsonl`;
        console.log(`  [${i + 1}/${runs.length}] ${run.agent}-${run.searchProvider}:`);
        console.log(`    Dataset: ${datasetPath}`);
        console.log(`    Output: ${outputPath}`);
        console.log(`    Trials per prompt: ${k}`);
        console.log(`    Prompt concurrency: ${options.promptConcurrency}`);
        const countEnv = options.count ? ` -e PROMPT_COUNT=${options.count}` : "";
        console.log(
          `    Docker: docker compose run --rm -e SEARCH_PROVIDER=${run.searchProvider} -e PROMPT_CONCURRENCY=${options.promptConcurrency}${options.trialType !== "default" ? ` -e TRIAL_TYPE=${options.trialType}` : ""}${countEnv} ${run.agent} bunx @plaited/agent-eval-harness trials ... -j ${options.promptConcurrency} -o ${outputPath}\n`,
        );
      }
      console.log("[DRY RUN] No trials were executed.");
      process.exit(0);
    }

    // Track completion
    const completed = new Set<number>();
    const startTime = Date.now();

    const statusInterval = createStatusHeartbeat({
      runs,
      completed,
      concurrency: options.concurrency,
      intervalMs: 60000,
      startTime,
    });

    // Run all scenarios with controlled concurrency
    const results = await limitConcurrency(
      runs.map(({ agent, searchProvider }, index) => () => {
        const runDate = new Date().toISOString().split("T")[0];
        const datasetPath = getPromptPath(searchProvider);
        const schema = `/eval/agent-schemas/${agent}.json`;
        const grader = "/eval/scripts/inline-grader.ts";
        const typeSuffix = options.trialType === "default" ? "" : `-${options.trialType}`;
        const outputPath = `/eval/data/results/${runDate}/${agent}/${searchProvider}${typeSuffix}.jsonl`;

        const trialsCmd = [
          "bunx",
          "@plaited/agent-eval-harness",
          "trials",
          datasetPath,
          "--schema",
          schema,
          "-k",
          k.toString(),
          "--grader",
          grader,
          "-o",
          outputPath,
          "--progress",
          "--cwd",
          "/workspace",
        ];
        if (options.promptConcurrency > 1) {
          trialsCmd.push("-j", options.promptConcurrency.toString());
          trialsCmd.push("--workspace-dir", "/workspace/runs");
        }

        const envVars = [
          "-e",
          `SEARCH_PROVIDER=${searchProvider}`,
          "-e",
          `PROMPT_CONCURRENCY=${options.promptConcurrency}`,
        ];
        if (options.trialType !== "default") {
          envVars.push("-e", `TRIAL_TYPE=${options.trialType}`);
        }
        if (options.count) {
          envVars.push("-e", `PROMPT_COUNT=${options.count}`);
        }

        return runDockerScenario({
          agent,
          searchProvider,
          envVars,
          command: trialsCmd,
          label: `[${index + 1}/${runs.length}] ${agent}-${searchProvider}`,
          startBanner: `(k=${k}, prompt-concurrency=${options.promptConcurrency})`,
          stdoutFilter: trialsStdoutFilter,
        }).then((result) => {
          completed.add(index + 1);
          return result.exitCode;
        });
      }),
      options.concurrency,
    );

    clearInterval(statusInterval);

    const { failures } = printResultsSummary({
      runs,
      results,
      startTime,
      extraLines: [`Trials per prompt: k=${k}`],
    });

    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\nTotal time: ${totalTime} minutes`);

    await handleExit(failures, "All trial scenarios completed successfully!");
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
};

main();
