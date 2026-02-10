#!/usr/bin/env bun

/**
 * Parallel evaluation runner for web search agents
 *
 * @remarks
 * Runs multiple agent × search provider combinations in parallel using Docker Compose.
 * Each combination is executed as a separate scenario with isolated output and status tracking.
 *
 * ## Execution Model
 *
 * The script creates an agent × search provider matrix and runs each combination:
 * - **Agents**: claude-code, gemini, droid, codex
 * - **Search Providers**: builtin (no MCP) or MCP servers (you, exa, etc.)
 * - **Modes**: test (5 prompts) or full (151 prompts)
 *
 * Each scenario runs in a separate Docker container with isolated environment variables:
 * ```bash
 * docker compose run --rm \
 *   -e SEARCH_PROVIDER=you \
 *   -e DATASET=test \
 *   claude-code
 * ```
 *
 * ## Output Format
 *
 * Results are written to `data/results/[mode]/` with naming pattern:
 * ```
 * results-[agent]-[search-provider].jsonl
 * ```
 *
 * ## Status Reporting
 *
 * Each scenario logs:
 * - Start/completion timestamps with duration
 * - Real-time stdout/stderr from Docker containers
 * - Exit codes with visual indicators (✓ success, ✗ failure)
 * - Summary report of all scenarios at the end
 *
 * ## Error Handling
 *
 * - Non-zero exit codes are reported but don't stop other scenarios
 * - All scenarios run to completion regardless of failures
 * - Final exit code reflects worst outcome (0 = all pass, >0 = any failed)
 *
 * Usage:
 *   bun scripts/run.ts                                    # All agents, current mode (default: unlimited containers, sequential prompts)
 *   bun scripts/run.ts --agent claude-code                # Single agent
 *   bun scripts/run.ts --mode test                        # Test mode (5 prompts)
 *   bun scripts/run.ts --search-provider you              # Specific MCP server
 *   bun scripts/run.ts -j 4                               # 4 containers in parallel
 *   bun scripts/run.ts -j 0                               # Unlimited container parallelism
 *   bun scripts/run.ts --prompt-concurrency 8             # 8 prompts per container
 *   bun scripts/run.ts -j 2 --prompt-concurrency 4        # Custom both levels
 *   bun scripts/run.ts --dry-run                          # Show what would run
 *
 * @public
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MCP_SERVERS, type McpServerKey } from "../mcp-servers.ts";
import type { Agent, Mode, RunConfig, SearchProvider } from "./shared/shared.types.ts";
import { ALL_AGENTS } from "./shared/shared.constants.ts";
import { limitConcurrency } from "./shared/concurrency-limiter.ts";
import { runDockerScenario } from "./shared/docker-runner.ts";
import { createStatusHeartbeat, printResultsSummary, handleExit } from "./shared/reporting.ts";

type RunOptions = {
  agents: Agent[];
  mode?: Mode;
  searchProvider?: SearchProvider;
  concurrency?: number;
  promptConcurrency?: number;
  dryRun?: boolean;
};

const parseArgs = (args: string[]): RunOptions => {
  const agents: Agent[] = [];
  let mode: Mode | undefined;
  let searchProvider: SearchProvider | undefined;
  let concurrency: number | undefined;
  let promptConcurrency: number | undefined;
  let dryRun = false;

  const validProviders = ["builtin", ...Object.keys(MCP_SERVERS)];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agent" && i + 1 < args.length) {
      const agent = args[i + 1];
      if (!ALL_AGENTS.includes(agent as Agent)) {
        throw new Error(`Invalid agent: ${agent}. Must be one of: ${ALL_AGENTS.join(", ")}`);
      }
      agents.push(agent as Agent);
      i++;
    } else if (args[i] === "--mode" && i + 1 < args.length) {
      const m = args[i + 1];
      if (m !== "test" && m !== "full") {
        throw new Error(`Invalid mode: ${m}. Must be "test" or "full"`);
      }
      mode = m;
      i++;
    } else if ((args[i] === "--search-provider" || args[i] === "--mcp") && i + 1 < args.length) {
      const tool = args[i + 1];
      if (!validProviders.includes(tool as string)) {
        throw new Error(`Invalid search provider: ${tool}. Must be one of: ${validProviders.join(", ")}`);
      }
      searchProvider = tool as SearchProvider;
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

  return {
    agents: agents.length > 0 ? agents : ALL_AGENTS,
    mode,
    searchProvider,
    concurrency: concurrency ?? Infinity, // Default unlimited (I/O-bound workload)
    promptConcurrency: promptConcurrency ?? 1, // Default 1: stream-mode agents OOM at higher values (see issue #45)
    dryRun,
  };
};

const detectCurrentMode = async (): Promise<Mode> => {
  // Check TypeScript entrypoint for DATASET variable default
  const entrypointFile = join(process.cwd(), "docker", "entrypoint");
  const content = await readFile(entrypointFile, "utf-8");

  const datasetMatch = content.match(/const DATASET = process\.env\.DATASET \|\| "(\w+)"/);
  if (datasetMatch?.[1]) {
    return datasetMatch[1] as Mode;
  }

  // Fallback: check for test or full patterns in prompt paths
  if (content.includes(`/eval/data/prompts/\${DATASET}.jsonl`) || content.includes("prompts/test.jsonl")) {
    return "test";
  }
  if (content.includes("prompts/full.jsonl")) {
    return "full";
  }
  throw new Error("Could not detect current mode from docker/entrypoint");
};

const main = async () => {
  const args = process.argv.slice(2);

  try {
    const options = parseArgs(args);

    if (options.dryRun) {
      console.log("[DRY RUN] Validation mode - no docker commands will run\n");
    }

    // Determine dataset mode (use override if provided, otherwise detect from entrypoint default)
    const currentMode = options.mode || (await detectCurrentMode());

    console.log(`${options.dryRun ? "[DRY RUN] " : ""}Running in ${currentMode} mode`);
    console.log(`Agents: ${options.agents.join(", ")}`);

    // Determine which search providers to test
    const mcpProviders = Object.keys(MCP_SERVERS) as McpServerKey[];
    const searchProviders: SearchProvider[] = options.searchProvider
      ? [options.searchProvider]
      : ["builtin", ...mcpProviders];
    console.log(`Search providers: ${searchProviders.join(", ")}`);
    console.log("");

    // Build execution list (each agent runs with each search provider)
    const runs: RunConfig[] = [];
    for (const agent of options.agents) {
      for (const provider of searchProviders) {
        runs.push({ agent, searchProvider: provider });
      }
    }

    const concurrencyLabel = options.concurrency === Infinity ? "unlimited" : options.concurrency;
    console.log(
      `${options.dryRun ? "[DRY RUN] Would run" : "Running"} ${runs.length} scenarios (container concurrency: ${concurrencyLabel}, prompt concurrency: ${options.promptConcurrency})\n`,
    );

    if (options.dryRun) {
      console.log("[DRY RUN] Execution plan:");
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        if (!run) continue;
        console.log(
          `  [${i + 1}/${runs.length}] ${run.agent}-${run.searchProvider}: docker compose run --rm -e SEARCH_PROVIDER=${
            run.searchProvider
          } -e DATASET=${currentMode} -e PROMPT_CONCURRENCY=${options.promptConcurrency} ${run.agent}`,
        );
      }
      console.log("\n[DRY RUN] No services were executed.");
      process.exit(0);
    }

    // Track completion status
    const completed = new Set<number>();
    const startTime = Date.now();

    const statusInterval = createStatusHeartbeat({
      runs,
      completed,
      concurrency: options.concurrency!,
      intervalMs: 30000,
      startTime,
    });

    // Run all scenarios with controlled concurrency
    const results = await limitConcurrency(
      runs.map(
        ({ agent, searchProvider }, index) =>
          () =>
            runDockerScenario({
              agent,
              searchProvider,
              envVars: [
                "-e",
                `SEARCH_PROVIDER=${searchProvider}`,
                "-e",
                `DATASET=${currentMode}`,
                "-e",
                `PROMPT_CONCURRENCY=${options.promptConcurrency}`,
              ],
              label: `[${index + 1}/${runs.length}] ${agent}-${searchProvider}`,
            }).then((result) => {
              completed.add(index + 1);
              return result.exitCode;
            }),
      ),
      options.concurrency!,
    );

    clearInterval(statusInterval);

    const { failures } = printResultsSummary({ runs, results, startTime });
    await handleExit(failures);
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
};

main();
