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
 * Results written to `data/results/trials/YYYY-MM-DD/{agent}/{provider}.jsonl`:
 * ```
 * trials/2026-01-29/claude-code/builtin.jsonl
 * trials/2026-01-29/gemini/you.jsonl
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
 *   bun scripts/run-trials.ts                              # All agents/providers, k=5 (default: unlimited containers, sequential prompts)
 *   bun scripts/run-trials.ts --trial-type capability      # All agents, k=10
 *   bun scripts/run-trials.ts --agent gemini               # Single agent, all providers
 *   bun scripts/run-trials.ts --search-provider you        # All agents, MCP only
 *   bun scripts/run-trials.ts -k 7                         # Custom k value
 *   bun scripts/run-trials.ts -j 4                         # 4 containers in parallel
 *   bun scripts/run-trials.ts --prompt-concurrency 8       # 8 prompts per container
 *   bun scripts/run-trials.ts -j 2 --prompt-concurrency 4  # Custom both levels
 *
 * @public
 */

import { spawn } from "node:child_process";
import { MCP_SERVERS, type McpServerKey } from "../mcp-servers.ts";
import { playCompletionSound } from "./utils.ts";
import { limitConcurrency } from "./lib/concurrency-limiter.ts";

type Agent = "claude-code" | "gemini" | "droid" | "codex";
type TrialType = "default" | "capability" | "regression";
type SearchProvider = McpServerKey | "builtin";

type TrialsOptions = {
  agents: Agent[];
  trialType: TrialType;
  searchProviders: SearchProvider[];
  k?: number;
  concurrency?: number;
  promptConcurrency?: number;
  dryRun?: boolean;
};

const ALL_AGENTS: Agent[] = ["claude-code", "gemini", "droid", "codex"];

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
      const arg = args[i + 1]!;
      const value = Number.parseInt(arg, 10);
      if (Number.isNaN(value) || value < 0) {
        throw new Error(`Invalid concurrency: ${arg}. Must be a non-negative integer (0 for unlimited)`);
      }
      concurrency = value === 0 ? Infinity : value;
      i++;
    } else if (args[i] === "--prompt-concurrency" && i + 1 < args.length) {
      const arg = args[i + 1]!;
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
 * @returns Prompt dataset path
 *
 * @internal
 */
const getPromptPath = (searchProvider: SearchProvider): string => {
  return searchProvider === "builtin"
    ? "/eval/data/prompts/trials/prompts.jsonl"
    : `/eval/data/prompts/trials/prompts-${searchProvider}.jsonl`;
};

/**
 * Run trials for a single agent-provider combination using Docker
 *
 * @param agent - Agent name
 * @param searchProvider - Search provider
 * @param trialType - Type of trial
 * @param k - Number of trials per prompt
 * @param scenarioId - Scenario number for progress tracking
 * @param totalScenarios - Total number of scenarios
 * @returns Promise resolving to exit code
 *
 * @internal
 */
const runTrials = (
  agent: Agent,
  searchProvider: SearchProvider,
  trialType: TrialType,
  k: number,
  promptConcurrency: number,
  scenarioId: number,
  totalScenarios: number,
): Promise<number> => {
  return new Promise((resolve) => {
    const label = `[${scenarioId}/${totalScenarios}] ${agent}-${searchProvider}`;
    const dataset = getPromptPath(searchProvider);
    const schema = `/eval/agent-schemas/${agent}.json`;
    const grader = "/eval/scripts/inline-grader.ts";

    const startTime = Date.now();

    console.log(`\n${"=".repeat(80)}`);
    console.log(`${label} - STARTING (k=${k}, prompt-concurrency=${promptConcurrency})`);
    console.log(`${"=".repeat(80)}\n`);

    // Build output path with trial type suffix
    const runDate = new Date().toISOString().split("T")[0];
    const typeSuffix = trialType === "default" ? "" : `-${trialType}`;
    const outputPath = `/eval/data/results/trials/${runDate}/${agent}/${searchProvider}${typeSuffix}.jsonl`;

    // Build trials command to run inside Docker container with explicit output path
    const trialsCmd = [
      "bunx",
      "@plaited/agent-eval-harness",
      "trials",
      dataset,
      "--schema",
      schema,
      "-k",
      k.toString(),
      "-j",
      promptConcurrency.toString(),
      "--grader",
      grader,
      "-o",
      outputPath,
      "--progress",
      "--cwd",
      "/workspace",
      "--workspace-dir",
      "/workspace/runs",
    ];

    // Run via Docker compose with environment variables
    // Pass trial type as TRIAL_TYPE env var for entrypoint to detect
    const envVars = ["-e", `SEARCH_PROVIDER=${searchProvider}`, "-e", `PROMPT_CONCURRENCY=${promptConcurrency}`];
    if (trialType !== "default") {
      envVars.push("-e", `TRIAL_TYPE=${trialType}`);
    }

    const proc = spawn("docker", ["compose", "run", "--rm", ...envVars, agent, ...trialsCmd], {
      stdio: "pipe", // Capture output for selective logging
    });

    let currentPrompt = "";
    let hasError = false;

    // Show important progress indicators
    proc.stdout?.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        // Track current prompt
        const promptMatch = line.match(/\[(\d+)\/(\d+)\]/);
        if (promptMatch) {
          currentPrompt = `${promptMatch[1]}/${promptMatch[2]}`;
        }

        // Show key progress events
        if (
          line.includes("Running") ||
          line.includes("Done!") ||
          line.includes("TIMEOUT") ||
          line.includes("ERROR") ||
          line.match(/✓|✗/) !== null
        ) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          const prefix = currentPrompt ? `[${currentPrompt}] ` : "";
          console.log(`  ${label} ${prefix}(${elapsed}s): ${line.trim()}`);

          if (line.includes("ERROR") && !line.includes("MCP ERROR")) {
            hasError = true;
          }
        }
      }
    });

    proc.stderr?.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.includes("ERROR") && !line.includes("MCP ERROR")) {
          // Fatal errors (non-MCP)
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.error(`  ${label} (${elapsed}s): ⚠️  FATAL: ${line.trim()}`);
          hasError = true;
        } else if (line.includes("MCP ERROR")) {
          // MCP errors are often warnings (tool may continue)
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.warn(`  ${label} (${elapsed}s): ⚠️  WARNING: ${line.trim()}`);
        }
      }
    });

    proc.on("close", (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const status = code === 0 ? "✓ COMPLETED" : "✗ FAILED";
      const errorNote = hasError && code === 0 ? " (had warnings)" : "";

      console.log(`\n${"=".repeat(80)}`);
      console.log(`${label} - ${status}${errorNote} (${elapsed}s, exit code: ${code})`);
      console.log(`${"=".repeat(80)}\n`);

      resolve(code ?? 1);
    });

    proc.on("error", (err) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`\n${"=".repeat(80)}`);
      console.error(`${label} - ✗ ERROR (${elapsed}s)`);
      console.error(`  ${err.message}`);
      console.error(`${"=".repeat(80)}\n`);
      resolve(1);
    });
  });
};

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
    console.log(`${options.dryRun ? "[DRY RUN] " : ""}Pass@k Trials Configuration`);
    console.log(`${"=".repeat(80)}`);
    console.log(`Trial type: ${options.trialType} (k=${k})`);
    console.log(`Agents: ${options.agents.join(", ")}`);
    console.log(`Search providers: ${options.searchProviders.join(", ")}`);
    console.log(`Container concurrency: ${concurrencyLabel}, Prompt concurrency: ${options.promptConcurrency}`);
    console.log(`Execution: Docker containers (isolated)`);
    console.log(`${"=".repeat(80)}\n`);

    // Build execution matrix
    type RunConfig = { agent: Agent; searchProvider: SearchProvider };
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
        const dataset = getPromptPath(run.searchProvider);
        const typeSuffix = options.trialType === "default" ? "" : `-${options.trialType}`;
        const outputPath = `/eval/data/results/trials/${runDate}/${run.agent}/${run.searchProvider}${typeSuffix}.jsonl`;
        console.log(`  [${i + 1}/${runs.length}] ${run.agent}-${run.searchProvider}:`);
        console.log(`    Dataset: ${dataset}`);
        console.log(`    Output: ${outputPath}`);
        console.log(`    Trials per prompt: ${k}`);
        console.log(`    Prompt concurrency: ${options.promptConcurrency}`);
        console.log(
          `    Docker: docker compose run --rm -e SEARCH_PROVIDER=${run.searchProvider} -e PROMPT_CONCURRENCY=${options.promptConcurrency}${options.trialType !== "default" ? ` -e TRIAL_TYPE=${options.trialType}` : ""} ${run.agent} bunx @plaited/agent-eval-harness trials ... -j ${options.promptConcurrency} -o ${outputPath}\n`,
        );
      }
      console.log("[DRY RUN] No trials were executed.");
      process.exit(0);
    }

    // Track completion
    const completed = new Set<number>();
    const startTime = Date.now();

    // Status heartbeat every 60 seconds (trials are longer)
    const statusInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = runs.length - completed.size;

      if (remaining > 0) {
        console.log(`\n⏱️  Status update (${elapsed}s elapsed):`);
        console.log(`   Completed: ${completed.size}/${runs.length}`);

        const activeLimit = options.concurrency === Infinity ? remaining : Math.min(options.concurrency!, remaining);
        const queued = Math.max(0, remaining - activeLimit);
        console.log(`   Active containers: ${activeLimit}, Queued: ${queued}`);

        const stillRunning = runs
          .map((run, index) =>
            completed.has(index + 1) ? null : `[${index + 1}/${runs.length}] ${run.agent}-${run.searchProvider}`,
          )
          .filter((x) => x !== null);

        if (stillRunning.length > 0) {
          console.log(`   Running/Queued: ${stillRunning.join(", ")}`);
        }
        console.log("");
      }
    }, 60000);

    // Run all scenarios with controlled concurrency
    const results = await limitConcurrency(
      runs.map(
        ({ agent, searchProvider }, index) =>
          () =>
            runTrials(
              agent,
              searchProvider,
              options.trialType,
              k,
              options.promptConcurrency!,
              index + 1,
              runs.length,
            ).then((result) => {
              completed.add(index + 1);
              return result;
            }),
      ),
      options.concurrency!,
    );

    clearInterval(statusInterval);

    // Report results summary
    console.log(`\n${"=".repeat(80)}`);
    console.log("FINAL RESULTS SUMMARY");
    console.log("=".repeat(80));

    const failures: Array<{ label: string; exitCode: number }> = [];
    const successes: string[] = [];

    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const exitCode = results[i];

      if (!run || exitCode === undefined) {
        continue;
      }

      const label = `[${i + 1}/${runs.length}] ${run.agent}-${run.searchProvider}`;

      if (exitCode === 0) {
        successes.push(label);
        console.log(`✓ ${label}`);
      } else {
        failures.push({ label, exitCode });
        console.log(`✗ ${label} (exit code: ${exitCode})`);
      }
    }

    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const minutes = Math.floor(Number(totalElapsed) / 60);
    const seconds = (Number(totalElapsed) % 60).toFixed(0);
    const timeDisplay = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    console.log(`\n${"=".repeat(80)}`);
    console.log(`Success: ${successes.length}/${runs.length}`);
    console.log(`Failed: ${failures.length}/${runs.length}`);
    console.log(`Total time: ${timeDisplay} (${totalElapsed}s)`);
    console.log(`Trials per prompt: k=${k}`);
    console.log("=".repeat(80));

    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\nTotal time: ${totalTime} minutes`);

    if (failures.length > 0) {
      console.error(`\n⚠️  Failed scenarios (${failures.length}):`);
      failures.forEach(({ label, exitCode }) => {
        const errorType = exitCode === 143 || exitCode === 124 ? "TIMEOUT" : "ERROR";
        console.error(`  - ${label}: ${errorType} (exit code ${exitCode})`);
      });
      console.error("\n💡 Tip: Check output above for specific error details (authentication, MCP issues, etc.)");
      await playCompletionSound(false);
      process.exit(1);
    } else {
      console.log("\n✅ All trial scenarios completed successfully!");
      await playCompletionSound(true);
      process.exit(0);
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
};

main();
