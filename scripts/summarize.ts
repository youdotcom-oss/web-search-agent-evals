#!/usr/bin/env bun

/**
 * Generate markdown summary from comparison results
 *
 * @remarks
 * Reads weighted and statistical comparison JSON files and generates
 * a comprehensive markdown report with insights and recommendations.
 *
 * Usage:
 *   bun scripts/summarize.ts                              # Latest full run
 *   bun scripts/summarize.ts --mode test                  # Test results
 *   bun scripts/summarize.ts --run-date 2026-01-29        # Specific run
 *   bun scripts/summarize.ts --input path/to/comparison.json  # Custom input file
 *   bun scripts/summarize.ts --output summary.md          # Custom output file
 *
 * @public
 */

import { join } from "node:path";
import type { ReliabilityMetrics, WeightedComparison } from "./schemas/comparisons.ts";
import { WeightedComparisonSchema } from "./schemas/comparisons.ts";
import { loadJsonFile } from "./schemas/common.ts";
import type { Mode } from "./schemas/configs.ts";

type SummarizeOptions = {
  mode: Mode;
  runDate?: string;
  output?: string;
  input?: string;
  fixtureDir?: string;
  dryRun?: boolean;
};

const parseArgs = (args: string[]): SummarizeOptions => {
  let mode: Mode = "full";
  let runDate: string | undefined;
  let output: string | undefined;
  let input: string | undefined;
  let fixtureDir: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--mode") {
      const value = args[++i];
      if (value !== "test" && value !== "full" && value !== "trials") {
        throw new Error(`Invalid mode: ${value}. Must be 'test', 'full', or 'trials'`);
      }
      mode = value;
    } else if (arg === "--run-date") {
      runDate = args[++i];
    } else if (arg === "--output" || arg === "-o") {
      output = args[++i];
    } else if (arg === "--input" || arg === "-i") {
      input = args[++i];
    } else if (arg === "--fixture-dir") {
      fixtureDir = args[++i];
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      console.error(`
Generate markdown summary from comparison results

Usage:
  bun scripts/summarize.ts [options]

Options:
  --mode <test|full|trials> Mode to summarize (default: full)
  --run-date <YYYY-MM-DD>   Specific run date (default: latest)
  --input, -i <file>        Custom input comparison file path (overrides mode/date)
  --output, -o <file>       Output file path (default: auto-generated)
  --fixture-dir <path>      Use fixture data directory (for testing)
  --dry-run                 Show what would be done without writing files
  --help, -h                Show this help message
`);
      process.exit(0);
    }
  }

  return { mode, runDate, output, input, fixtureDir, dryRun };
};

const findLatestRunDate = async (fixtureDir?: string): Promise<string> => {
  const runsDir = fixtureDir ? join(fixtureDir, "results/runs") : "data/results/runs";
  const dirs = await Array.fromAsync(new Bun.Glob("*").scan({ cwd: runsDir, onlyFiles: false }));
  const dates = dirs
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  if (dates.length === 0) {
    throw new Error(`No dated runs found in ${runsDir}`);
  }
  const latestDate = dates[0];
  if (!latestDate) {
    throw new Error(`No dated runs found in ${runsDir}`);
  }
  return latestDate;
};

const findLatestTrialsDate = async (fixtureDir?: string): Promise<string> => {
  const baseDir = fixtureDir ?? "data";
  const trialsDir = `${baseDir}/comparisons/trials`;
  const dirs = await Array.fromAsync(new Bun.Glob("*").scan({ cwd: trialsDir, onlyFiles: false }));
  const dates = dirs
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  if (dates.length === 0) {
    throw new Error(`No dated trials found in ${trialsDir}`);
  }
  const latestDate = dates[0];
  if (!latestDate) {
    throw new Error(`No dated trials found in ${trialsDir}`);
  }
  return latestDate;
};

const loadComparison = async (
  mode: Mode,
  runDate: string | undefined,
  type: "weighted" | "statistical",
  fixtureDir?: string,
): Promise<WeightedComparison | null> => {
  let path: string;

  if (mode === "test") {
    const baseDir = fixtureDir ?? "data";
    path = `${baseDir}/comparisons/test-runs/all-${type}.json`;
  } else if (mode === "trials") {
    // For trials mode, delegate to loadTrialsComparison
    return await loadTrialsComparison(runDate, type, undefined, fixtureDir);
  } else {
    const date = runDate ?? (await findLatestRunDate(fixtureDir));
    const baseDir = fixtureDir ?? "data";
    path = `${baseDir}/comparisons/runs/${date}/all-${type}.json`;
  }

  const file = Bun.file(path);
  if (!(await file.exists())) {
    console.warn(`Warning: ${path} not found`);
    return null;
  }

  const { data, errors } = await loadJsonFile(WeightedComparisonSchema, path);
  if (errors.length > 0) {
    console.warn(`Warning: Validation error in ${path}\n${errors.join("\n")}`);
    return null;
  }
  return data;
};

const loadTrialsComparison = async (
  runDate: string | undefined,
  type: "weighted" | "statistical",
  filter?: "builtin" | "you",
  fixtureDir?: string,
): Promise<WeightedComparison | null> => {
  const date = runDate ?? (await findLatestTrialsDate(fixtureDir));
  const baseDir = fixtureDir ?? "data";
  const trialsDir = `${baseDir}/comparisons/trials/${date}`;

  // Build list of paths to try in order of preference
  const pathsToTry: string[] = [];

  if (filter) {
    // If a specific filter is requested, try only that
    pathsToTry.push(`${trialsDir}/all-${filter}-${type}.json`);
  } else {
    // Try files in priority order:
    // 1. builtin-vs-you: Most comprehensive comparison across all agents and search providers
    // 2. all: Combined data when builtin-vs-you split doesn't exist
    // 3. all-builtin, all-you: Provider-specific fallbacks
    pathsToTry.push(
      `${trialsDir}/builtin-vs-you-${type}.json`,
      `${trialsDir}/all-${type}.json`,
      `${trialsDir}/all-builtin-${type}.json`,
      `${trialsDir}/all-you-${type}.json`,
    );
  }

  // Try each path until we find one that exists
  for (const path of pathsToTry) {
    const file = Bun.file(path);
    if (await file.exists()) {
      const { data, errors } = await loadJsonFile(WeightedComparisonSchema, path);
      if (errors.length > 0) {
        console.warn(`Warning: Validation error in ${path}\n${errors.join("\n")}`);
        continue;
      }
      return data;
    }
  }

  console.warn(`Warning: No trials comparison found in ${trialsDir} for type ${type}`);
  return null;
};

const formatNumber = (n: number, decimals = 2): string => {
  return n.toFixed(decimals);
};

const formatPercent = (n: number, decimals = 1): string => {
  return `${(n * 100).toFixed(decimals)}%`;
};

const formatMs = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const parseRunLabel = (label: string): { agent: string; provider: string } => {
  const parts = label.split("-");
  // Handle "claude-code-builtin" vs "gemini-you"
  if (parts.length === 3 && parts[0] === "claude" && parts[1] === "code") {
    const provider = parts[2];
    if (!provider) throw new Error(`Invalid run label format: ${label}`);
    return { agent: "claude-code", provider };
  }
  if (parts.length === 2) {
    const agent = parts[0];
    const provider = parts[1];
    if (!agent || !provider) throw new Error(`Invalid run label format: ${label}`);
    return { agent, provider };
  }
  throw new Error(`Invalid run label format: ${label}`);
};

const isRegularRunReliability = (
  metrics: ReliabilityMetrics,
): metrics is {
  type: "run";
  toolErrors: number;
  toolErrorRate: number;
  timeouts: number;
  timeoutRate: number;
  completionRate: number;
} => {
  return metrics.type === "run";
};

const isRegularRunQuality = (
  metrics: QualityMetrics,
): metrics is {
  avgScore: number;
  passRate: number;
  passCount: number;
  failCount: number;
} => {
  return "passRate" in metrics && "passCount" in metrics && "failCount" in metrics;
};

const isTrialQuality = (
  metrics: QualityMetrics,
): metrics is {
  avgScore: number;
  medianScore: number;
  p25Score: number;
  p75Score: number;
} => {
  return "medianScore" in metrics && "p25Score" in metrics && "p75Score" in metrics;
};

const generateSummary = async (options: SummarizeOptions): Promise<string> => {
  const { mode, runDate, input, fixtureDir } = options;

  // Load comparisons - use custom input path if provided
  let weighted: WeightedComparison | null = null;
  if (input) {
    const { data, errors } = await loadJsonFile(WeightedComparisonSchema, input);
    if (errors.length > 0) {
      throw new Error(`Validation error in ${input}\n${errors.join("\n")}`);
    }
    weighted = data;
  } else {
    weighted = await loadComparison(mode, runDate, "weighted", fixtureDir);
  }

  if (!weighted) {
    throw new Error("Could not load weighted comparison");
  }

  // Load statistical comparison for confidence intervals
  let statistical: WeightedComparison | null = null;
  if (input) {
    // If using custom input, try to load companion statistical file
    // Support both trials and regular comparison formats
    const inputDir = input.substring(0, input.lastIndexOf("/"));
    const inputFilename = input.substring(input.lastIndexOf("/") + 1);

    // Try to find statistical version by replacing -weighted with -statistical
    if (inputFilename.includes("-weighted.json")) {
      const statisticalPath = `${inputDir}/${inputFilename.replace("-weighted.json", "-statistical.json")}`;
      const statisticalFile = Bun.file(statisticalPath);
      if (await statisticalFile.exists()) {
        const { data, errors } = await loadJsonFile(WeightedComparisonSchema, statisticalPath);
        if (errors.length === 0) {
          statistical = data;
        }
      }
    }
  } else {
    // Auto-discovery mode
    statistical = await loadComparison(mode, runDate, "statistical", fixtureDir);
  }

  // Try to load trials data if available (only if not using custom input and mode is full)
  let trialsWeighted: WeightedComparison | null = null;
  if (!input && mode === "full") {
    trialsWeighted = await loadTrialsComparison(runDate, "weighted", undefined, fixtureDir);
  }

  const { meta, quality, performance, reliability, capability, flakiness } = weighted;

  const md: string[] = [];

  // Header
  md.push("# Web Search Agent Evaluation Summary\n");
  md.push(
    `**Generated:** ${new Date(meta.generatedAt).toLocaleString("en-US", {
      timeZone: "UTC",
      dateStyle: "full",
      timeStyle: "short",
    })}\n`,
  );
  md.push(`**Mode:** ${mode === "full" ? "Full evaluation" : "Test run"}\n`);
  md.push(`**Prompts:** ${meta.promptCount}\n`);
  if (meta.trialsPerPrompt) {
    md.push(`**Trials per prompt:** ${meta.trialsPerPrompt}\n`);
  }
  md.push("\n---\n\n");

  // Executive Summary
  md.push("## Executive Summary\n\n");

  const qualityRankings = quality
    ? Object.entries(quality)
        .map(([run, metrics]) => ({
          run,
          avgScore: metrics.avgScore,
          passRate: isRegularRunQuality(metrics) ? metrics.passRate : undefined,
          medianScore: isTrialQuality(metrics) ? metrics.medianScore : undefined,
        }))
        .sort((a, b) => b.avgScore - a.avgScore)
    : [];

  const latencyRankings = performance
    ? Object.entries(performance)
        .map(([run, metrics]) => ({
          run,
          p50: metrics.latency.p50,
        }))
        .sort((a, b) => a.p50 - b.p50)
    : [];

  const bestQuality = qualityRankings[0];
  const fastestAgent = latencyRankings[0];

  if (bestQuality) {
    if (bestQuality.passRate !== undefined) {
      // Regular run format with pass rate
      md.push(
        `**Best Quality:** ${bestQuality.run} (${formatNumber(
          bestQuality.avgScore,
        )} avg score, ${formatPercent(bestQuality.passRate)} pass rate)\n\n`,
      );
    } else {
      // Trial format without pass rate
      md.push(`**Best Quality:** ${bestQuality.run} (${formatNumber(bestQuality.avgScore)} avg score)\n\n`);
    }
  }

  if (fastestAgent) {
    md.push(`**Fastest:** ${fastestAgent.run} (${formatMs(fastestAgent.p50)} median latency)\n\n`);
  }

  // Add reliability winner if trials data available
  if (trialsWeighted?.flakiness && Object.keys(trialsWeighted.flakiness).length > 0) {
    const reliabilityRankings = Object.entries(trialsWeighted.flakiness)
      .map(([run, metrics]) => ({
        run,
        flakiness: metrics.avgFlakiness,
        passExpK: trialsWeighted.capability?.[run]?.avgPassAtK ?? 0,
      }))
      .sort((a, b) => a.flakiness - b.flakiness || b.passExpK - a.passExpK);

    const mostReliable = reliabilityRankings[0];
    if (mostReliable) {
      md.push(`**Most Reliable:** ${mostReliable.run} (${formatPercent(mostReliable.flakiness)} flakiness)\n\n`);
    }
  }

  md.push("---\n\n");

  // Quality Rankings (only if quality data available)
  if (quality && Object.keys(quality).length > 0) {
    md.push("## Quality Rankings\n\n");

    // Check if we have trial or regular run quality metrics
    const firstMetrics = Object.values(quality)[0];
    const isTrial = firstMetrics && isTrialQuality(firstMetrics);

    if (isTrial) {
      // Trial format: show score distribution
      md.push("| Rank | Agent + Search | Avg Score | Median Score | P25 Score | P75 Score |\n");
      md.push("|------|----------------|-----------|--------------|-----------|----------|\n");

      qualityRankings.forEach((entry, idx) => {
        const metrics = quality[entry.run];
        if (!metrics || !isTrialQuality(metrics)) return;
        md.push(
          `| ${idx + 1} | ${entry.run} | ${formatNumber(metrics.avgScore)} | ${formatNumber(metrics.medianScore)} | ${formatNumber(metrics.p25Score)} | ${formatNumber(metrics.p75Score)} |\n`,
        );
      });
    } else {
      // Regular run format: show pass/fail counts
      md.push("| Rank | Agent + Search | Avg Score | Pass Rate | Pass Count | Fail Count |\n");
      md.push("|------|----------------|-----------|-----------|------------|------------|\n");

      qualityRankings.forEach((entry, idx) => {
        const metrics = quality[entry.run];
        if (!metrics || !isRegularRunQuality(metrics)) return;
        md.push(
          `| ${idx + 1} | ${entry.run} | ${formatNumber(
            entry.avgScore,
          )} | ${formatPercent(entry.passRate)} | ${metrics.passCount} | ${metrics.failCount} |\n`,
        );
      });
    }

    md.push("\n");
  }

  // Performance Rankings (only if data available)
  if (performance && Object.keys(performance).length > 0) {
    md.push("## Performance Rankings (Latency)\n\n");
    md.push("| Rank | Agent + Search | P50 | P90 | P99 | Mean | Total Duration |\n");
    md.push("|------|----------------|-----|-----|-----|------|----------------|\n");

    latencyRankings.forEach((entry, idx) => {
      const metrics = performance[entry.run];
      if (!metrics) return;
      md.push(
        `| ${idx + 1} | ${entry.run} | ${formatMs(metrics.latency.p50)} | ${formatMs(metrics.latency.p90)} | ${formatMs(
          metrics.latency.p99,
        )} | ${formatMs(metrics.latency.mean)} | ${formatMs(metrics.totalDuration)} |\n`,
      );
    });

    md.push("\n");
  }

  // Reliability (only if data available and in regular run format)
  if (reliability && Object.keys(reliability).length > 0) {
    // Filter to only show regular run reliability metrics (not trials passExpK metrics)
    const regularRunReliability = Object.entries(reliability).filter(([_run, metrics]) =>
      isRegularRunReliability(metrics),
    );

    if (regularRunReliability.length > 0) {
      md.push("## Reliability Metrics\n\n");
      md.push("| Agent + Search | Tool Errors | Tool Error Rate | Timeouts | Timeout Rate | Completion Rate |\n");
      md.push("|----------------|-------------|-----------------|----------|--------------|----------------|\n");

      regularRunReliability.forEach(([run, metrics]) => {
        // Type assertion safe because we filtered with isRegularRunReliability above
        const regularMetrics = metrics as {
          toolErrors: number;
          toolErrorRate: number;
          timeouts: number;
          timeoutRate: number;
          completionRate: number;
        };
        md.push(
          `| ${run} | ${regularMetrics.toolErrors} | ${formatPercent(
            regularMetrics.toolErrorRate,
          )} | ${regularMetrics.timeouts} | ${formatPercent(
            regularMetrics.timeoutRate,
          )} | ${formatPercent(regularMetrics.completionRate)} |\n`,
        );
      });

      md.push("\n");
    }
  }

  // Trials-specific sections
  if (capability && Object.keys(capability).length > 0) {
    md.push("## Capability Metrics (Pass@k)\n\n");
    md.push("| Agent + Search | Avg Pass@k | Median Pass@k | P25 Pass@k | P75 Pass@k |\n");
    md.push("|----------------|------------|---------------|------------|------------|\n");

    const capabilityRankings = Object.entries(capability).sort((a, b) => b[1].avgPassAtK - a[1].avgPassAtK);

    capabilityRankings.forEach(([run, metrics]) => {
      md.push(
        `| ${run} | ${formatPercent(metrics.avgPassAtK)} | ${formatPercent(
          metrics.medianPassAtK,
        )} | ${formatPercent(metrics.p25PassAtK)} | ${formatPercent(metrics.p75PassAtK)} |\n`,
      );
    });

    md.push("\n");
  }

  if (flakiness && Object.keys(flakiness).length > 0) {
    md.push("## Flakiness Analysis\n\n");
    md.push("| Agent + Search | Avg Flakiness | Median Flakiness | Flaky Prompt Count |\n");
    md.push("|----------------|---------------|------------------|--------------------|\n");

    const flakinessRankings = Object.entries(flakiness).sort((a, b) => a[1].avgFlakiness - b[1].avgFlakiness);

    flakinessRankings.forEach(([run, metrics]) => {
      md.push(
        `| ${run} | ${formatPercent(metrics.avgFlakiness)} | ${formatPercent(
          metrics.medianFlakiness,
        )} | ${metrics.flakyPromptCount} |\n`,
      );
    });

    md.push("\n");

    // Top flaky prompts
    const allFlakyPrompts = new Map<string, number>();
    Object.values(flakiness).forEach((metrics) => {
      metrics.topFlakyPrompts.forEach((prompt: { id: string; flakiness: number }) => {
        const current = allFlakyPrompts.get(prompt.id) ?? 0;
        allFlakyPrompts.set(prompt.id, Math.max(current, prompt.flakiness));
      });
    });

    const topFlaky = Array.from(allFlakyPrompts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (topFlaky.length > 0) {
      md.push("### Most Flaky Prompts\n\n");
      md.push("| Prompt ID | Max Flakiness |\n");
      md.push("|-----------|---------------|\n");
      topFlaky.forEach(([id, flakiness]) => {
        md.push(`| ${id} | ${formatPercent(flakiness)} |\n`);
      });
      md.push("\n");
    }
  }

  // MCP Impact Analysis
  if (quality && Object.keys(quality).length > 0) {
    md.push("## MCP Tool Impact Analysis\n\n");

    const agents = Array.from(new Set(meta.runs.map((r) => parseRunLabel(r).agent)));
    const providers = Array.from(new Set(meta.runs.map((r) => parseRunLabel(r).provider)));

    if (providers.includes("builtin") && providers.length > 1) {
      md.push("| Agent | Quality (builtin → MCP) | Speed (builtin → MCP) | Reliability (builtin → MCP) |\n");
      md.push("|-------|------------------------|----------------------|----------------------------|\n");

      agents.forEach((agent) => {
        const builtinRun = `${agent}-builtin`;
        const mcpRuns = providers.filter((p) => p !== "builtin").map((p) => `${agent}-${p}`);

        mcpRuns.forEach((mcpRun) => {
          if (!performance) return;
          const builtinQuality = quality[builtinRun];
          const mcpQuality = quality[mcpRun];
          const builtinPerf = performance[builtinRun];
          const mcpPerf = performance[mcpRun];

          if (!builtinQuality || !mcpQuality || !builtinPerf || !mcpPerf) return;

          const qualityDiff = ((mcpQuality.avgScore - builtinQuality.avgScore) / builtinQuality.avgScore) * 100;
          const speedDiff = ((mcpPerf.latency.p50 - builtinPerf.latency.p50) / builtinPerf.latency.p50) * 100;

          // For reliability, use passRate for regular runs, or passExpK for trials
          let reliabilityDiff = 0;
          if (
            reliability &&
            reliability[builtinRun] &&
            reliability[mcpRun] &&
            !isRegularRunReliability(reliability[builtinRun])
          ) {
            // Trial format: use passExpK
            const builtinRel = reliability[builtinRun];
            const mcpRel = reliability[mcpRun];
            if ("avgPassExpK" in builtinRel && "avgPassExpK" in mcpRel) {
              reliabilityDiff = (mcpRel.avgPassExpK - builtinRel.avgPassExpK) * 100;
            }
          } else if (isRegularRunQuality(builtinQuality) && isRegularRunQuality(mcpQuality)) {
            // Regular run format: use passRate
            reliabilityDiff = (mcpQuality.passRate - builtinQuality.passRate) * 100;
          }

          const mcpProvider = parseRunLabel(mcpRun).provider;
          const qualityArrow = qualityDiff > 0 ? "↑" : qualityDiff < 0 ? "↓" : "→";
          const speedArrow = speedDiff < 0 ? "↑" : speedDiff > 0 ? "↓" : "→";
          const reliabilityArrow = reliabilityDiff > 0 ? "↑" : reliabilityDiff < 0 ? "↓" : "→";

          // Calculate confidence interval margins if available from statistical comparison
          let qualityMargin = "";
          let speedMargin = "";
          let reliabilityMargin = "";

          if (statistical?.quality && statistical?.performance) {
            const statMcpQuality = statistical.quality[mcpRun];
            const statBuiltinQuality = statistical.quality[builtinRun];
            const statMcpPerf = statistical.performance[mcpRun];
            const statBuiltinPerf = statistical.performance[builtinRun];

            if (statMcpQuality?.confidenceIntervals?.avgScore && statBuiltinQuality) {
              const [lower, upper] = statMcpQuality.confidenceIntervals.avgScore;
              const margin = ((upper - lower) / 2 / statBuiltinQuality.avgScore) * 100;
              qualityMargin = ` ± ${formatNumber(margin, 1)}%`;
            }

            if (statMcpPerf?.confidenceIntervals?.latencyMean && statBuiltinPerf) {
              const [lower, upper] = statMcpPerf.confidenceIntervals.latencyMean;
              const margin = ((upper - lower) / 2 / statBuiltinPerf.latency.mean) * 100;
              speedMargin = ` ± ${formatNumber(margin, 1)}%`;
            }

            // Reliability CI: check both regular run and trials format
            if (statMcpQuality?.confidenceIntervals?.passRate) {
              // Regular run format
              const [lower, upper] = statMcpQuality.confidenceIntervals.passRate;
              const margin = ((upper - lower) / 2) * 100;
              reliabilityMargin = ` ± ${formatNumber(margin, 1)}pp`;
            } else if (statistical?.reliability) {
              // Trials format: use avgPassExpK from reliability object
              const statMcpRel = statistical.reliability[mcpRun];
              const statBuiltinRel = statistical.reliability[builtinRun];
              if (statMcpRel?.confidenceIntervals?.avgPassExpK && statBuiltinRel && "avgPassExpK" in statBuiltinRel) {
                const [lower, upper] = statMcpRel.confidenceIntervals.avgPassExpK;
                const margin = ((upper - lower) / 2) * 100;
                reliabilityMargin = ` ± ${formatNumber(margin, 1)}pp`;
              }
            }
          }

          md.push(
            `| ${agent} (${mcpProvider}) | ${qualityArrow} ${formatNumber(
              Math.abs(qualityDiff),
              1,
            )}%${qualityMargin} | ${speedArrow} ${formatNumber(
              Math.abs(speedDiff),
              1,
            )}%${speedMargin} | ${reliabilityArrow} ${formatNumber(
              Math.abs(reliabilityDiff),
              1,
            )}pp${reliabilityMargin} |\n`,
          );
        });
      });

      md.push("\n");
    }
  }

  // Recommendations
  md.push("## Recommendations\n\n");

  md.push("### For Production Use\n\n");

  // For trial data: use capability rankings
  if (capability && Object.keys(capability).length > 0 && qualityRankings.length === 0) {
    const capabilityRankings = Object.entries(capability)
      .map(([run, metrics]) => ({
        run,
        passAtK: metrics.avgPassAtK,
        medianPassAtK: metrics.medianPassAtK,
      }))
      .sort((a, b) => b.passAtK - a.passAtK);

    const topCapability = capabilityRankings[0];
    if (topCapability) {
      md.push(`- **Best Capability:** ${topCapability.run} (${formatPercent(topCapability.passAtK)} Pass@k)\n`);
    }

    // Most reliable from trials
    if (flakiness) {
      const reliabilityRankings = Object.entries(flakiness)
        .map(([run, metrics]) => ({
          run,
          flakiness: metrics.avgFlakiness,
          capability: capability[run]?.avgPassAtK ?? 0,
        }))
        .filter((r) => r.capability > 0.8) // Only consider high-capability agents
        .sort((a, b) => a.flakiness - b.flakiness);

      if (reliabilityRankings.length > 0) {
        const mostReliable = reliabilityRankings[0];
        if (mostReliable) {
          md.push(
            `- **Most Reliable:** ${mostReliable.run} (${formatPercent(
              mostReliable.flakiness,
            )} flakiness, ${formatPercent(mostReliable.capability)} Pass@k)\n`,
          );
        }
      }
    }
  } else {
    // For regular run data: use quality rankings
    const topQuality = qualityRankings[0];
    if (topQuality) {
      md.push(`- **Best Quality:** ${topQuality.run} (${formatNumber(topQuality.avgScore)} avg score)\n`);
    }

    // Most reliable (if trials data available)
    if (trialsWeighted?.flakiness && quality && Object.keys(trialsWeighted.flakiness).length > 0) {
      const reliabilityRankings = Object.entries(trialsWeighted.flakiness)
        .map(([run, metrics]) => ({
          run,
          flakiness: metrics.avgFlakiness,
          quality: quality[run]?.avgScore ?? 0,
        }))
        .filter((r) => r.quality > 0.8) // Only consider high-quality agents
        .sort((a, b) => a.flakiness - b.flakiness);

      if (reliabilityRankings.length > 0) {
        const mostReliable = reliabilityRankings[0];
        if (mostReliable) {
          md.push(
            `- **Most Reliable:** ${mostReliable.run} (${formatPercent(
              mostReliable.flakiness,
            )} flakiness, ${formatNumber(mostReliable.quality)} quality)\n`,
          );
        }
      }
    }

    // Fastest
    const topSpeed = latencyRankings[0];
    if (topSpeed) {
      md.push(`- **Fastest:** ${topSpeed.run} (${formatMs(topSpeed.p50)} P50 latency)\n`);
    }
  }

  // Best balance
  const balanceScores = qualityRankings
    .map((entry) => {
      if (!performance || !reliability) return null;
      const perf = performance[entry.run];
      const rel = reliability[entry.run];
      if (!perf || !rel || !isRegularRunReliability(rel)) return null;
      const latency = perf.latency.p50;
      const reliabilityScore = rel.completionRate;
      const normalizedQuality = entry.avgScore;
      const normalizedSpeed = 1 - latency / Math.max(...latencyRankings.map((r) => r.p50));
      const balanceScore = normalizedQuality * 0.5 + normalizedSpeed * 0.3 + reliabilityScore * 0.2;
      return { run: entry.run, balanceScore };
    })
    .filter((entry): entry is { run: string; balanceScore: number } => entry !== null)
    .sort((a, b) => b.balanceScore - a.balanceScore);

  const topBalance = balanceScores[0];
  if (topBalance) {
    md.push(`- **Best Balance:** ${topBalance.run} (weighted: 50% quality + 30% speed + 20% reliability)\n\n`);
  }

  md.push("### Areas for Improvement\n\n");

  // For trial data: show lowest capability
  if (capability && Object.keys(capability).length > 0 && qualityRankings.length === 0) {
    const capabilityRankings = Object.entries(capability)
      .map(([run, metrics]) => ({
        run,
        passAtK: metrics.avgPassAtK,
      }))
      .sort((a, b) => b.passAtK - a.passAtK);

    const worstCapability = capabilityRankings[capabilityRankings.length - 1];
    if (worstCapability) {
      md.push(`- **Lowest Capability:** ${worstCapability.run} (${formatPercent(worstCapability.passAtK)} Pass@k)\n`);
    }
  } else {
    // For regular run data: show lowest quality
    const worstQuality = qualityRankings[qualityRankings.length - 1];
    if (worstQuality) {
      md.push(`- **Lowest Quality:** ${worstQuality.run} (${formatNumber(worstQuality.avgScore)} avg score)\n`);
    }
  }

  if (flakiness && Object.keys(flakiness).length > 0) {
    const worstFlakiness = Object.entries(flakiness).sort((a, b) => b[1].avgFlakiness - a[1].avgFlakiness)[0];
    if (worstFlakiness) {
      md.push(`- **Most Flaky:** ${worstFlakiness[0]} (${formatPercent(worstFlakiness[1].avgFlakiness)} flakiness)\n`);
    }
  }

  md.push("\n---\n\n");

  md.push("*Generated by `bun scripts/summarize.ts`*\n");

  return md.join("");
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const { mode, runDate, input, output: customOutput, fixtureDir, dryRun } = options;

  if (dryRun) {
    console.log("[DRY RUN]\n");
  }

  console.log("Configuration:");
  if (input) {
    console.log(`  Input: ${input}`);
  } else {
    console.log(`  Mode: ${mode}`);
    if (runDate) console.log(`  Run date: ${runDate}`);
  }
  if (fixtureDir) console.log(`  Fixture dir: ${fixtureDir}`);
  console.log();

  // Determine output path
  let outputPath: string;
  if (customOutput) {
    outputPath = customOutput;
  } else if (input) {
    // When using custom input, place SUMMARY.md in same directory
    const inputDir = input.substring(0, input.lastIndexOf("/"));
    outputPath = `${inputDir}/SUMMARY.md`;
  } else if (mode === "test") {
    const baseDir = fixtureDir ?? "data";
    outputPath = `${baseDir}/comparisons/test-runs/SUMMARY.md`;
  } else if (mode === "trials") {
    const date = runDate ?? (await findLatestTrialsDate(fixtureDir));
    const baseDir = fixtureDir ?? "data";
    outputPath = `${baseDir}/comparisons/trials/${date}/SUMMARY.md`;
  } else {
    const date = runDate ?? (await findLatestRunDate(fixtureDir));
    const baseDir = fixtureDir ?? "data";
    outputPath = `${baseDir}/comparisons/runs/${date}/SUMMARY.md`;
  }

  console.log(`Output path: ${outputPath}\n`);

  if (dryRun) {
    console.log("[DRY RUN] Would generate summary from comparison data");
    console.log("[DRY RUN] Would write to:", outputPath);
    return;
  }

  console.log("Generating summary...");
  const summary = await generateSummary(options);

  await Bun.write(outputPath, summary);
  console.log(`\n✓ Summary written to: ${outputPath}`);
};

main().catch((error) => {
  console.error("Error generating summary:", error);
  process.exit(1);
});
