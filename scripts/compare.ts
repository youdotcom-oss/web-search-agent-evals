#!/usr/bin/env bun

/**
 * Statistical comparison tool for trials results
 *
 * @remarks
 * Compares agent trial performance across different runs using statistical analysis or weighted scoring.
 * Generates comparison reports to identify performance differences in pass@k and reliability metrics.
 *
 * ## Comparison Strategies
 *
 * - **weighted**: Score-based comparison using trial pass rates
 *   - Analyzes passAtK (capability) and passExpK (reliability) distributions
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
 *
 * ## Output Paths
 *
 * Results are written to:
 * ```
 * data/comparisons/[date]/[scope]-[strategy][-trial-type].json
 * ```
 *
 * Examples:
 * - `data/comparisons/2026-01-29/all-weighted.json` (default, k=5)
 * - `data/comparisons/2026-01-29/all-weighted-capability.json` (k=10)
 * - `data/comparisons/2026-01-29/builtin-vs-you-statistical-regression.json` (k=3)
 *
 * ## Result Path Convention
 *
 * - `data/results/[date]/[agent]/[provider].jsonl`
 * - `data/results/[date]/[agent]/[provider]-capability.jsonl` (with type suffix)
 *
 * Usage:
 *   bun scripts/compare.ts                           # Latest, all agents, weighted
 *   bun scripts/compare.ts --run-date 2026-01-29    # Specific date
 *   bun scripts/compare.ts --trial-type capability   # k=10 trials
 *   bun scripts/compare.ts --strategy statistical    # Bootstrap sampling
 *   bun scripts/compare.ts --agent claude-code       # Specific agent
 *   bun scripts/compare.ts --search-provider you     # Specific provider
 *   bun scripts/compare.ts --dry-run                 # Show plan without running
 *
 * @public
 */

import { MCP_SERVERS, type McpServerKey } from "../mcp-servers.ts";
import { ALL_AGENTS } from "./shared/shared.constants.ts";
import type { Agent, SearchProvider } from "./shared/shared.types.ts";

type TrialType = "default" | "capability" | "regression";
type Strategy = "weighted" | "statistical";

type CompareOptions = {
  agents: Agent[];
  searchProviders: SearchProvider[];
  trialType: TrialType;
  strategy: Strategy;
  runDate?: string;
  dryRun?: boolean;
};

const ALL_STRATEGIES: Strategy[] = ["weighted", "statistical"];

/**
 * Parse command-line arguments
 *
 * @param args - Command-line arguments
 * @returns Parsed options
 *
 * @internal
 */
const parseArgs = (args: string[]): CompareOptions => {
  const agents: Agent[] = [];
  const searchProviders: SearchProvider[] = [];
  let trialType: TrialType = "default";
  let strategy: Strategy = "weighted";
  let runDate: string | undefined;
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
    } else if (args[i] === "--search-provider" && i + 1 < args.length) {
      const provider = args[i + 1];
      if (!validProviders.includes(provider as string)) {
        throw new Error(`Invalid search provider: ${provider}. Must be one of: ${validProviders.join(", ")}`);
      }
      searchProviders.push(provider as SearchProvider);
      i++;
    } else if (args[i] === "--trial-type" && i + 1 < args.length) {
      const type = args[i + 1];
      if (type !== "default" && type !== "capability" && type !== "regression") {
        throw new Error(`Invalid trial type: ${type}. Must be "default", "capability", or "regression"`);
      }
      trialType = type as TrialType;
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
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  // Defaults
  const mcpProviders = Object.keys(MCP_SERVERS) as McpServerKey[];

  return {
    agents: agents.length > 0 ? agents : ALL_AGENTS,
    searchProviders: searchProviders.length > 0 ? searchProviders : ["builtin", ...mcpProviders],
    trialType,
    strategy,
    runDate,
    dryRun,
  };
};

/**
 * Discover latest results date from directory structure
 *
 * @param resultsBaseDir - Base results directory path
 * @returns Latest date string in YYYY-MM-DD format
 *
 * @internal
 */
const discoverLatestDate = async (resultsBaseDir: string): Promise<string> => {
  const dirs = await Array.fromAsync(new Bun.Glob("*").scan({ cwd: resultsBaseDir, onlyFiles: false }));
  const dates = dirs.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (dates.length === 0) {
    throw new Error(`No dated runs found in ${resultsBaseDir}`);
  }
  const latestDate = dates[dates.length - 1];
  if (!latestDate) {
    throw new Error(`Failed to get latest date from ${resultsBaseDir}`);
  }
  return latestDate;
};

/**
 * Build run label for comparison output
 *
 * @param agent - Agent name
 * @param searchProvider - Search provider
 * @returns Run label string
 *
 * @internal
 */
const buildRunLabel = (agent: Agent, searchProvider: SearchProvider): string => {
  return `${agent}-${searchProvider}`;
};

/**
 * Build results file path
 *
 * @param resultsDir - Base results directory for date
 * @param agent - Agent name
 * @param searchProvider - Search provider
 * @param trialType - Trial type
 * @returns Results file path
 *
 * @internal
 */
const buildResultsPath = (
  resultsDir: string,
  agent: Agent,
  searchProvider: SearchProvider,
  trialType: TrialType,
): string => {
  const typeSuffix = trialType === "default" ? "" : `-${trialType}`;
  return `${resultsDir}/${agent}/${searchProvider}${typeSuffix}.jsonl`;
};

/**
 * Generate comparison scope name
 *
 * @param scenarios - Array of agent-provider scenarios
 * @param options - Comparison options
 * @returns Scope name for output file
 *
 * @internal
 */
const getComparisonScope = (
  scenarios: Array<{ agent: Agent; provider: SearchProvider }>,
  options: CompareOptions,
): string => {
  const { agents, searchProviders } = options;

  // Check if all scenarios are builtin
  const allBuiltin = scenarios.every((s) => s.provider === "builtin");
  if (allBuiltin) {
    return "all-builtin";
  }

  // Check if all scenarios use a single non-builtin (MCP) provider
  const hasBuiltin = scenarios.some((s) => s.provider === "builtin");
  const nonBuiltinProviders = [...new Set(scenarios.map((s) => s.provider).filter((p) => p !== "builtin"))];
  if (!hasBuiltin && nonBuiltinProviders.length === 1) {
    return `all-${nonBuiltinProviders[0]}`;
  }

  // Check if we have both builtin and a single MCP provider
  if (hasBuiltin && nonBuiltinProviders.length === 1) {
    return `builtin-vs-${nonBuiltinProviders[0]}`;
  }

  // Custom scope: specific agents or providers
  if (agents.length < ALL_AGENTS.length) {
    return searchProviders.length === 1 ? `${agents.join("-")}-${searchProviders[0]}` : agents.join("-");
  }

  return "all";
};

/**
 * Run comparison for a specific scope
 *
 * @param scenarios - Array of agent-provider scenarios
 * @param options - Comparison options
 * @returns Promise resolving when comparison completes
 *
 * @internal
 */
const runComparison = async (
  scenarios: Array<{ agent: Agent; provider: SearchProvider }>,
  options: CompareOptions,
): Promise<void> => {
  const { strategy, runDate, trialType, dryRun } = options;

  // runDate is always resolved by main() before calling runComparison
  const resultsBaseDir = "data/results";
  if (!runDate) throw new Error("runDate must be resolved before calling runComparison");
  const dateDir = runDate;
  const resultsDir = `${resultsBaseDir}/${dateDir}`;

  // Build output path
  const scope = getComparisonScope(scenarios, options);
  const outputDir = `data/comparisons/${dateDir}`;
  await Bun.$`mkdir -p ${outputDir}`.quiet();

  // Include trial type in filename if not default
  const typeSuffix = trialType === "default" ? "" : `-${trialType}`;
  const outputPath = `${outputDir}/${scope}-${strategy}${typeSuffix}.json`;

  // Build command arguments
  const args = ["@plaited/agent-eval-harness", "compare"];

  for (const { agent, provider } of scenarios) {
    const label = buildRunLabel(agent, provider);
    const path = buildResultsPath(resultsDir, agent, provider, trialType);

    // Check if file exists
    const exists = await Bun.file(path).exists();
    if (!exists) {
      console.warn(`⚠️  Skipping ${label}: File not found at ${path}`);
      continue;
    }

    args.push("--run", `${label}:${path}`);
  }

  args.push("--strategy", strategy);
  args.push("-o", outputPath);

  if (dryRun) {
    console.log(`\n[DRY RUN] Would run comparison:`);
    console.log(`  Scope: ${scope}`);
    console.log(`  Strategy: ${strategy}`);
    console.log(`  Output: ${outputPath}`);
    console.log(`  Command: bunx ${args.join(" ")}`);
    return;
  }

  console.log(`\n🔄 ${scope} (${strategy})`);
  console.log(`   Output: ${outputPath}`);

  // Execute
  const result = await Bun.$`bunx ${args}`.nothrow();
  if (result.exitCode !== 0) {
    throw new Error(`Comparison failed with exit code ${result.exitCode}`);
  }
  console.log(`   ✓ Complete\n`);
};

/**
 * Main entry point
 *
 * @internal
 */
const main = async () => {
  try {
    const options = parseArgs(process.argv.slice(2));

    const resultsBaseDir = "data/results";
    options.runDate = options.runDate ?? (await discoverLatestDate(resultsBaseDir));
    const runDate = options.runDate;
    const resultsDir = `${resultsBaseDir}/${runDate}`;
    const typeSuffix = options.trialType === "default" ? "" : `-${options.trialType}`;

    console.log(`📊 COMPARISON - ${runDate}`);
    console.log(`Trial Type: ${options.trialType}`);
    console.log(`Strategy: ${options.strategy}`);
    console.log(`${options.dryRun ? "[DRY RUN] " : ""}`);
    console.log();

    // Discover available results files (skip file check in dry-run mode)
    const scenarios: Array<{ agent: Agent; provider: SearchProvider }> = [];
    for (const agent of options.agents) {
      for (const provider of options.searchProviders) {
        const resultsFile = `${resultsDir}/${agent}/${provider}${typeSuffix}.jsonl`;
        if (options.dryRun || (await Bun.file(resultsFile).exists())) {
          scenarios.push({ agent, provider });
        }
      }
    }

    if (scenarios.length === 0) {
      throw new Error(`No results files found in ${resultsDir}`);
    }

    console.log(`Found ${scenarios.length} scenarios:`);
    for (const { agent, provider } of scenarios) {
      console.log(`  - ${agent}-${provider}`);
    }
    console.log();

    // Generate comparisons based on available scenarios
    const comparisons: Array<{
      description: string;
      scenarios: Array<{ agent: Agent; provider: SearchProvider }>;
    }> = [];

    // All builtin comparison
    const builtinScenarios = scenarios.filter((s) => s.provider === "builtin");
    if (builtinScenarios.length > 1) {
      comparisons.push({
        description: "All agents with builtin search",
        scenarios: builtinScenarios,
      });
    }

    // All MCP provider comparisons (one per provider key)
    const mcpKeys = Object.keys(MCP_SERVERS) as McpServerKey[];
    for (const mcpKey of mcpKeys) {
      const mcpScenarios = scenarios.filter((s) => s.provider === mcpKey);
      if (mcpScenarios.length > 1) {
        comparisons.push({
          description: `All agents with ${mcpKey} MCP`,
          scenarios: mcpScenarios,
        });
      }
    }

    // Builtin vs each MCP provider (if we have data for both)
    if (builtinScenarios.length > 0) {
      for (const mcpKey of mcpKeys) {
        const mcpScenarios = scenarios.filter((s) => s.provider === mcpKey);
        if (mcpScenarios.length > 0 && builtinScenarios.length > 0) {
          comparisons.push({
            description: `Builtin vs ${mcpKey} across all agents`,
            scenarios: [...builtinScenarios, ...mcpScenarios],
          });
        }
      }
    }

    // If no multi-scenario comparisons, just run a single comparison with all scenarios
    if (comparisons.length === 0 && scenarios.length > 1) {
      comparisons.push({
        description: "All available scenarios",
        scenarios: scenarios,
      });
    }

    if (comparisons.length === 0) {
      console.log("⚠️  Not enough scenarios for comparison (need at least 2)");
      process.exit(options.dryRun ? 0 : 1);
    }

    // Run all comparisons
    let failureCount = 0;
    for (const comparison of comparisons) {
      try {
        await runComparison(comparison.scenarios, options);
      } catch (error) {
        failureCount++;
        console.error(`✗ Failed: ${comparison.description}`);
        console.error(`  ${(error as Error).message}`);
      }
    }

    if (failureCount > 0) {
      console.error(`\n❌ ${failureCount} comparison(s) failed.`);
      process.exit(1);
    }
    console.log("✅ All comparisons complete!");
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
};

main();
