#!/usr/bin/env bun

/**
 * Statistical comparison tool for agent evaluation results
 *
 * @remarks
 * Compares agent performance across different runs using statistical analysis or weighted scoring.
 * Generates comparison reports and visualizations to identify performance differences.
 *
 * ## Comparison Strategies
 *
 * - **weighted**: Score-based comparison using deterministic and LLM scores
 *   - Analyzes score distributions and pass rates
 *   - Generates statistical summaries (mean, median, std dev)
 *   - Useful for overall performance assessment
 *
 * - **statistical**: Hypothesis testing for statistical significance
 *   - Uses statistical tests (t-test, Mann-Whitney U) to compare distributions
 *   - Provides p-values and confidence intervals
 *   - Useful for determining if differences are statistically significant
 *
 * ## Run Labeling Format
 *
 * Runs are labeled using the pattern:
 * ```
 * [agent]-[search-provider]
 * ```
 *
 * Examples:
 * - `claude-code-builtin` - Claude Code with builtin search
 * - `gemini-you` - Gemini with You.com MCP server
 * - `droid-builtin` - DROID with builtin search
 *
 * ## Output Paths
 *
 * Results are written to:
 * ```
 * data/comparisons/[mode]/comparison-[timestamp].json
 * ```
 *
 * For dated runs:
 * ```
 * data/comparisons/runs/[date]/comparison-[timestamp].json
 * ```
 *
 * For fixture-based comparisons:
 * ```
 * [fixture-dir]/comparison-[timestamp].json
 * ```
 *
 * ## Result Path Convention
 *
 * - **Test mode**: `data/results/test-runs/[agent]/[provider].jsonl`
 * - **Full mode**: `data/results/runs/[date]/[agent]/[provider].jsonl`
 * - **Fixtures**: `[fixture-dir]/results/runs/[date]/[agent]/[provider].jsonl`
 *
 * Usage:
 *   bun scripts/compare.ts --mode test                              # Compare test results
 *   bun scripts/compare.ts --mode full --strategy statistical       # Statistical comparison
 *   bun scripts/compare.ts --agent claude-code --search-provider you  # Specific combo
 *   bun scripts/compare.ts --run-date 2026-01-15                    # Compare dated run
 *   bun scripts/compare.ts --fixture-dir ./test-fixtures            # Compare fixtures
 *   bun scripts/compare.ts --dry-run                                # Show what would run
 *
 * @public
 */

import { spawn } from "node:child_process";
import { MCP_SERVERS, type McpServerKey } from "../mcp-servers.ts";

import type { Agent, Mode, SearchProvider } from "./shared/shared.types.ts";
import { ALL_AGENTS } from "./shared/shared.constants.ts";

type Strategy = "weighted" | "statistical";

type CompareOptions = {
  agents: Agent[];
  mode: Mode;
  searchProvider?: SearchProvider;
  strategy: Strategy;
  dryRun?: boolean;
  runDate?: string;
  fixtureDir?: string;
};

const ALL_STRATEGIES: Strategy[] = ["weighted", "statistical"];

const parseArgs = (args: string[]): CompareOptions => {
  const agents: Agent[] = [];
  let mode: Mode = "test";
  let searchProvider: SearchProvider | undefined;
  let strategy: Strategy = "weighted";
  let dryRun = false;
  let runDate: string | undefined;
  let fixtureDir: string | undefined;

  const validProviders = ["builtin", "skill", ...Object.keys(MCP_SERVERS)];

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
    } else if (args[i] === "--strategy" && i + 1 < args.length) {
      const s = args[i + 1];
      if (!ALL_STRATEGIES.includes(s as Strategy)) {
        throw new Error(`Invalid strategy: ${s}. Must be one of: ${ALL_STRATEGIES.join(", ")}`);
      }
      strategy = s as Strategy;
      i++;
    } else if (args[i] === "--run-date" && i + 1 < args.length) {
      runDate = args[i + 1];
      i++;
    } else if (args[i] === "--fixture-dir" && i + 1 < args.length) {
      fixtureDir = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return {
    agents: agents.length > 0 ? agents : ALL_AGENTS,
    mode,
    searchProvider,
    strategy,
    dryRun,
    runDate,
    fixtureDir,
  };
};

const getLatestRunPath = async (fixtureDir?: string): Promise<string> => {
  const dataDir = fixtureDir || "data";
  const runsDir = `${dataDir}/results/runs`;

  // Scan runs directory for dated folders
  const entries = await Array.fromAsync(new Bun.Glob("*").scan({ cwd: runsDir, onlyFiles: false }));
  const datedDirs = entries.filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry));

  if (datedDirs.length === 0) {
    throw new Error(`No dated runs found in ${runsDir}`);
  }

  // Sort by date (YYYY-MM-DD format sorts lexicographically) and take the latest
  const latestDate = datedDirs.sort().reverse()[0];
  return `runs/${latestDate}`;
};

const buildResultPath = async ({
  agent,
  searchProvider,
  mode,
  runDate,
  fixtureDir,
}: {
  agent: Agent;
  searchProvider: SearchProvider;
  mode: Mode;
  runDate?: string;
  fixtureDir?: string;
}): Promise<string> => {
  const dataDir = fixtureDir || "data";

  if (mode === "test") {
    return `${dataDir}/results/test-runs/${agent}/${searchProvider}.jsonl`;
  }

  const runDir = runDate ? `runs/${runDate}` : await getLatestRunPath(fixtureDir);
  return `${dataDir}/results/${runDir}/${agent}/${searchProvider}.jsonl`;
};

const buildRunLabel = (agent: Agent, searchProvider: SearchProvider): string => {
  return `${agent}-${searchProvider}`;
};

const buildOutputPath = async (options: CompareOptions): Promise<string> => {
  const { agents, searchProvider, strategy, mode, runDate, fixtureDir } = options;
  const dataDir = fixtureDir || "data";

  let scope: string;
  if (agents.length < ALL_AGENTS.length) {
    // Specific agents: gemini-claude-code (include searchProvider if specified)
    scope = searchProvider ? `${agents.join("-")}-${searchProvider}` : agents.join("-");
  } else if (searchProvider) {
    // All agents, specific search provider: builtin or you
    scope = searchProvider;
  } else {
    // All agents, both search providers: all
    scope = "all";
  }

  // Version comparison outputs by mode and date
  if (mode === "test") {
    // Test comparisons: test-runs directory
    return `${dataDir}/comparisons/test-runs/${scope}-${strategy}.json`;
  }

  // Full comparisons: dated directory (use runDate or latest)
  const dateDir = runDate || (await getLatestRunPath(fixtureDir)).replace("runs/", "");
  return `${dataDir}/comparisons/runs/${dateDir}/${scope}-${strategy}.json`;
};

const runComparison = async (options: CompareOptions): Promise<void> => {
  const { agents, mode, searchProvider, strategy, runDate, fixtureDir } = options;

  // Build scenario matrix
  const mcpProviders = Object.keys(MCP_SERVERS) as McpServerKey[];
  const searchProviders: SearchProvider[] = searchProvider ? [searchProvider] : ["builtin", ...mcpProviders];
  const runs: Array<{ agent: Agent; searchProvider: SearchProvider }> = [];

  for (const agent of agents) {
    for (const provider of searchProviders) {
      runs.push({ agent, searchProvider: provider });
    }
  }

  // Build command arguments
  const args = ["@plaited/agent-eval-harness", "compare"];

  for (const { agent, searchProvider: provider } of runs) {
    const label = buildRunLabel(agent, provider);
    const path = await buildResultPath({
      agent,
      searchProvider: provider,
      mode,
      runDate,
      fixtureDir,
    });
    args.push("--run", `${label}:${path}`);
  }

  args.push("--strategy", strategy);

  const outputPath = await buildOutputPath(options);

  // Ensure output directory exists
  const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));
  await Bun.$`mkdir -p ${outputDir}`.quiet();

  args.push("-o", outputPath);

  // Execute
  const proc = spawn("bunx", args, { stdio: "inherit" });

  return new Promise((resolve, reject) => {
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Comparison failed with exit code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
};

const main = async () => {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.dryRun) {
      console.log("[DRY RUN] Comparison validation mode\n");
      console.log("Configuration:");
      console.log(`  Mode: ${options.mode}`);
      console.log(`  Agents: ${options.agents.join(", ")}`);
      console.log(`  Search Provider: ${options.searchProvider || "all"}`);
      console.log(`  Strategy: ${options.strategy}`);
      console.log(`\nOutput: ${await buildOutputPath(options)}\n`);

      // Build scenario matrix for preview
      const mcpProviders = Object.keys(MCP_SERVERS) as McpServerKey[];
      const searchProviders: SearchProvider[] = options.searchProvider
        ? [options.searchProvider]
        : ["builtin", ...mcpProviders];
      const runs: Array<{ agent: Agent; searchProvider: SearchProvider }> = [];

      for (const agent of options.agents) {
        for (const provider of searchProviders) {
          runs.push({ agent, searchProvider: provider });
        }
      }

      console.log("Runs to compare:");
      for (const { agent, searchProvider: provider } of runs) {
        const label = buildRunLabel(agent, provider);
        const path = await buildResultPath({
          agent,
          searchProvider: provider,
          mode: options.mode,
          runDate: options.runDate,
          fixtureDir: options.fixtureDir,
        });
        console.log(`  ${label}: ${path}`);
      }

      process.exit(0);
    }

    console.log("Comparison Configuration:");
    console.log(`  Mode: ${options.mode}`);
    console.log(`  Agents: ${options.agents.join(", ")}`);
    console.log(`  Search Provider: ${options.searchProvider || "all"}`);
    console.log(`  Strategy: ${options.strategy}`);
    const outputPath = await buildOutputPath(options);
    console.log(`  Output: ${outputPath}\n`);

    await runComparison(options);

    console.log(`\n✓ Comparison complete: ${outputPath}`);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
};

main();
