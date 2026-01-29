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
 * Like run.ts, creates an agent × search provider matrix and runs all combinations in parallel:
 * - **Agents**: claude-code, gemini, droid, codex (or subset via --agent)
 * - **Search Providers**: builtin, you (or subset via --search-provider)
 * - **Trial Types**: default (k=5), capability (k=10), regression (k=3)
 *
 * Each combination runs k trials per prompt to measure consistency and reliability.
 *
 * ## Output Format
 *
 * Results written to `data/results/trials/`:
 * ```
 * trials/[agent]-[provider]-[type].jsonl    # Per-agent trial results
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
 *   bun scripts/run-trials.ts                              # All agents/providers, k=5
 *   bun scripts/run-trials.ts --type capability            # All agents, k=10
 *   bun scripts/run-trials.ts --agent gemini               # Single agent, all providers
 *   bun scripts/run-trials.ts --search-provider you        # All agents, MCP only
 *   bun scripts/run-trials.ts -k 7                         # Custom k value
 *
 * @public
 */

import { spawn } from "node:child_process";
import { MCP_SERVERS, type McpServerKey } from "../mcp-servers.ts";

type Agent = "claude-code" | "gemini" | "droid" | "codex";
type TrialType = "default" | "capability" | "regression";
type SearchProvider = McpServerKey | "builtin";

type TrialsOptions = {
  agents: Agent[];
  trialType: TrialType;
  searchProviders: SearchProvider[];
  k?: number;
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
    } else if (args[i] === "--type" && i + 1 < args.length) {
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
 * Get output file path for trials results
 *
 * @param agent - Agent name
 * @param searchProvider - Search provider (builtin or MCP server key)
 * @param trialType - Type of trial
 * @returns Output file path
 *
 * @internal
 */
const getOutputPath = (agent: Agent, searchProvider: SearchProvider, trialType: TrialType): string => {
  const suffix = trialType === "default" ? "" : `-${trialType}`;
  return `data/results/trials/${agent}-${searchProvider}${suffix}.jsonl`;
};

/**
 * Run trials for a single agent-provider combination
 *
 * @param agent - Agent name
 * @param searchProvider - Search provider
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
  scenarioId: number,
  totalScenarios: number,
): Promise<number> => {
  return new Promise((resolve) => {
    const label = `[${scenarioId}/${totalScenarios}] ${agent}-${searchProvider}`;
    const dataset =
      searchProvider === "builtin"
        ? "data/prompts/trials/prompts.jsonl"
        : `data/prompts/trials/prompts-${searchProvider}.jsonl`;
    const schema = `agent-schemas/${agent}.json`;
    const outputPath = getOutputPath(agent, searchProvider, trialType);
    const grader = "./scripts/inline-grader.ts";

    const startTime = Date.now();

    console.log(`\n${"=".repeat(80)}`);
    console.log(`${label} - STARTING (k=${k})`);
    console.log(`${"=".repeat(80)}\n`);

    const proc = spawn(
      "bunx",
      [
        "@plaited/agent-eval-harness",
        "trials",
        dataset,
        "--schema",
        schema,
        "-k",
        k.toString(),
        "--grader",
        grader,
        "-o",
        outputPath,
        "--progress",
      ],
      {
        stdio: "pipe", // Capture output for selective logging
      },
    );

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

          if (line.includes("ERROR")) {
            hasError = true;
          }
        }
      }
    });

    proc.stderr?.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.trim() && line.includes("ERROR")) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.error(`  ${label} (${elapsed}s): ⚠️  ${line.trim()}`);
          hasError = true;
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

    console.log(`${options.dryRun ? "[DRY RUN] " : ""}Pass@k Trials Configuration`);
    console.log(`${"=".repeat(80)}`);
    console.log(`Trial type: ${options.trialType} (k=${k})`);
    console.log(`Agents: ${options.agents.join(", ")}`);
    console.log(`Search providers: ${options.searchProviders.join(", ")}`);
    console.log(`${"=".repeat(80)}\n`);

    // Build execution matrix
    type RunConfig = { agent: Agent; searchProvider: SearchProvider };
    const runs: RunConfig[] = [];
    for (const agent of options.agents) {
      for (const provider of options.searchProviders) {
        runs.push({ agent, searchProvider: provider });
      }
    }

    console.log(`${options.dryRun ? "[DRY RUN] Would run" : "Running"} ${runs.length} trial scenarios in parallel\n`);

    if (options.dryRun) {
      console.log("[DRY RUN] Execution plan:");
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        if (!run) continue;
        const dataset =
          run.searchProvider === "builtin"
            ? "data/prompts/trials/prompts.jsonl"
            : `data/prompts/trials/prompts-${run.searchProvider}.jsonl`;
        const outputPath = getOutputPath(run.agent, run.searchProvider, options.trialType);
        console.log(`  [${i + 1}/${runs.length}] ${run.agent}-${run.searchProvider}:`);
        console.log(`    Dataset: ${dataset}`);
        console.log(`    Output: ${outputPath}`);
        console.log(`    Trials per prompt: ${k}\n`);
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
      const inProgress = runs.length - completed.size;

      if (inProgress > 0) {
        console.log(`\n⏱️  Status update (${elapsed}s elapsed):`);
        console.log(`   Completed: ${completed.size}/${runs.length}`);
        console.log(`   In progress: ${inProgress}`);

        const stillRunning = runs
          .map((run, index) =>
            completed.has(index + 1) ? null : `[${index + 1}/${runs.length}] ${run.agent}-${run.searchProvider}`,
          )
          .filter((x) => x !== null);

        if (stillRunning.length > 0) {
          console.log(`   Still running: ${stillRunning.join(", ")}`);
        }
        console.log("");
      }
    }, 60000);

    // Run all scenarios in parallel
    const results = await Promise.all(
      runs.map(({ agent, searchProvider }, index) =>
        runTrials(agent, searchProvider, options.trialType, k, index + 1, runs.length).then((result) => {
          completed.add(index + 1);
          return result;
        }),
      ),
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
      const result = results[i];
      if (!run || result === undefined) continue;

      const label = `${run.agent}-${run.searchProvider}`;
      if (result === 0) {
        successes.push(label);
      } else {
        failures.push({ label, exitCode: result });
      }
    }

    console.log(`✓ Successful: ${successes.length}/${runs.length}`);
    if (successes.length > 0) {
      console.log(`  ${successes.join(", ")}`);
    }

    if (failures.length > 0) {
      console.log(`\n✗ Failed: ${failures.length}/${runs.length}`);
      for (const failure of failures) {
        console.log(`  ${failure.label} (exit code: ${failure.exitCode})`);
      }
    }

    console.log("=".repeat(80));

    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\nTotal time: ${totalTime} minutes`);

    // Exit with failure if any scenario failed
    process.exit(failures.length > 0 ? 1 : 0);
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
};

main();
