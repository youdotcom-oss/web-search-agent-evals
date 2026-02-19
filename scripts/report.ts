#!/usr/bin/env bun

/**
 * Comprehensive report generator for trial results
 *
 * @remarks
 * Reads comparison JSON files and raw trial JSONL data to generate a comprehensive
 * REPORT.md. Replaces summarize.ts, analyze-tool-calls.ts, visualize-tool-calls.ts,
 * and find-failing-prompts.ts.
 *
 * Sections generated:
 * - Executive summary + quality rankings
 * - Performance + capability + flakiness tables
 * - MCP tool impact analysis
 * - Tool call statistics (P50/P90/P99/mean per provider)
 * - Tool call distribution histograms (ASCII bar charts)
 * - Failing prompts (pass@k = 0 for each agent-provider)
 *
 * Usage:
 *   bun scripts/report.ts                              # Latest run
 *   bun scripts/report.ts --run-date 2026-02-18        # Specific date
 *   bun scripts/report.ts --output custom.md           # Custom output path
 *   bun scripts/report.ts --dry-run                    # Show config only
 *
 * @public
 */

import type { QualityMetrics, ReliabilityMetrics, WeightedComparison } from "./schemas/comparisons.ts";
import { WeightedComparisonSchema } from "./schemas/comparisons.ts";
import { loadJsonFile } from "./schemas/common.ts";
import { MCP_SERVERS } from "../mcp-servers.ts";
import { ALL_AGENTS } from "./shared/shared.constants.ts";

type ReportOptions = {
  runDate?: string;
  output?: string;
  dryRun?: boolean;
};

type TrialResult = {
  id: string;
  passRate: number;
  passAtK: number;
  passExpK: number;
  trials: Array<{
    passed: boolean;
    score: number;
    trajectory?: Array<{ type: string; name?: string }>;
  }>;
};

// ─── Arg Parsing ─────────────────────────────────────────────────────────────

const parseArgs = (args: string[]): ReportOptions => {
  let runDate: string | undefined;
  let output: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--run-date" && i + 1 < args.length) {
      runDate = args[++i];
    } else if ((args[i] === "--output" || args[i] === "-o") && i + 1 < args.length) {
      output = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Generate comprehensive REPORT.md from comparison results and trial data

Usage:
  bun scripts/report.ts [options]

Options:
  --run-date <YYYY-MM-DD>   Specific run date (default: latest)
  --output, -o <file>       Output file path (default: data/comparisons/{date}/REPORT.md)
  --dry-run                 Show configuration without generating report
  --help, -h                Show this help message
`);
      process.exit(0);
    }
  }

  return { runDate, output, dryRun };
};

// ─── Discovery ───────────────────────────────────────────────────────────────

export const findLatestDate = async (baseDir: string): Promise<string> => {
  const dirs = await Array.fromAsync(new Bun.Glob("*").scan({ cwd: baseDir, onlyFiles: false }));
  const dates = dirs
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  if (dates.length === 0) {
    throw new Error(`No dated runs found in ${baseDir}`);
  }
  const latest = dates[0];
  if (!latest) throw new Error(`No dated runs found in ${baseDir}`);
  return latest;
};

const loadComparison = async (
  comparisonsDir: string,
  type: "weighted" | "statistical",
): Promise<WeightedComparison | null> => {
  // Try files in priority order, deriving MCP provider names dynamically
  const mcpKeys = Object.keys(MCP_SERVERS);
  const candidates = [
    ...mcpKeys.map((k) => `${comparisonsDir}/builtin-vs-${k}-${type}.json`),
    `${comparisonsDir}/all-${type}.json`,
    `${comparisonsDir}/all-builtin-${type}.json`,
    ...mcpKeys.map((k) => `${comparisonsDir}/all-${k}-${type}.json`),
  ];

  for (const path of candidates) {
    if (await Bun.file(path).exists()) {
      const { data, errors } = await loadJsonFile(WeightedComparisonSchema, path);
      if (errors.length === 0) return data;
      console.warn(`Warning: Validation error in ${path}\n${errors.join("\n")}`);
    }
  }
  return null;
};

// ─── Formatting Helpers ───────────────────────────────────────────────────────

const fmt = (n: number, decimals = 2): string => n.toFixed(decimals);
const pct = (n: number, decimals = 1): string => `${(n * 100).toFixed(decimals)}%`;
const ms = (n: number): string => (n < 1000 ? `${Math.round(n)}ms` : `${(n / 1000).toFixed(1)}s`);

/**
 * Parse a run label like "claude-code-builtin" into agent and provider.
 *
 * @remarks
 * Matches against ALL_AGENTS so agent names containing hyphens (e.g. "claude-code")
 * are handled correctly. The provider is whatever follows the matched agent prefix.
 *
 * @param label - Run label in the form `{agent}-{provider}`
 * @returns Parsed agent and provider names
 *
 * @internal
 */
export const parseRunLabel = (label: string): { agent: string; provider: string } => {
  for (const agent of ALL_AGENTS) {
    const prefix = `${agent}-`;
    if (label.startsWith(prefix)) {
      return { agent, provider: label.slice(prefix.length) };
    }
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
} => metrics.type === "run";

const isRegularRunQuality = (
  metrics: QualityMetrics,
): metrics is {
  avgScore: number;
  passRate: number;
  passCount: number;
  failCount: number;
} => "passRate" in metrics && "passCount" in metrics && "failCount" in metrics;

const isTrialQuality = (
  metrics: QualityMetrics,
): metrics is {
  avgScore: number;
  medianScore: number;
  p25Score: number;
  p75Score: number;
} => "medianScore" in metrics && "p25Score" in metrics && "p75Score" in metrics;

// ─── Tool Call Analysis ───────────────────────────────────────────────────────

const calculatePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  return (sorted[lower] ?? 0) * (1 - (index - lower)) + (sorted[upper] ?? 0) * (index - lower);
};

const countToolCalls = (trajectory?: Array<{ type: string }>): number => {
  if (!trajectory) return 0;
  return trajectory.filter((step) => step.type === "tool_call").length;
};

type FileAnalysis = {
  agent: string;
  provider: string;
  toolCalls: number[];
  stats: { count: number; min: number; max: number; mean: number; median: number; p90: number; p99: number };
  results: TrialResult[];
};

const analyzeFile = async (filePath: string): Promise<FileAnalysis> => {
  const parts = filePath.split("/");
  const provider = parts[parts.length - 1]?.replace(".jsonl", "") ?? "unknown";
  const agent = parts[parts.length - 2] ?? "unknown";

  const text = await Bun.file(filePath).text();
  const lines = text.trim().split("\n").filter(Boolean);

  const toolCalls: number[] = [];
  const results: TrialResult[] = [];

  for (const line of lines) {
    const result: TrialResult = JSON.parse(line);
    results.push(result);
    for (const trial of result.trials) {
      toolCalls.push(countToolCalls(trial.trajectory));
    }
  }

  toolCalls.sort((a, b) => a - b);

  const stats = {
    count: toolCalls.length,
    min: toolCalls[0] ?? 0,
    max: toolCalls[toolCalls.length - 1] ?? 0,
    mean: toolCalls.length > 0 ? toolCalls.reduce((sum, v) => sum + v, 0) / toolCalls.length : 0,
    median: calculatePercentile(toolCalls, 50),
    p90: calculatePercentile(toolCalls, 90),
    p99: calculatePercentile(toolCalls, 99),
  };

  return { agent, provider, toolCalls, stats, results };
};

const renderHistogram = (values: number[], label: string): string => {
  const freq = new Map<number, number>();
  for (const v of values) {
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }

  const sorted = Array.from(freq.entries()).sort((a, b) => a[0] - b[0]);
  if (sorted.length === 0) return "";
  const maxFreq = Math.max(...sorted.map(([, f]) => f));
  const maxBar = 40;

  const lines: string[] = [`### ${label} Distribution\n`, "```"];
  for (const [calls, count] of sorted) {
    const barLength = Math.round((count / maxFreq) * maxBar);
    const bar = "█".repeat(barLength);
    const p = ((count / values.length) * 100).toFixed(1);
    lines.push(`${calls.toString().padStart(2)} calls | ${bar} ${count} (${p}%)`);
  }
  lines.push("```\n");
  return lines.join("\n");
};

// ─── Section Generators ───────────────────────────────────────────────────────

const generateSummarySections = (weighted: WeightedComparison, statistical: WeightedComparison | null): string => {
  const { meta, quality, performance, reliability, capability, flakiness } = weighted;
  const md: string[] = [];

  // Header
  md.push("# Web Search Agent Evaluation Report\n");
  md.push(
    `**Generated:** ${new Date(meta.generatedAt).toLocaleString("en-US", {
      timeZone: "UTC",
      dateStyle: "full",
      timeStyle: "short",
    })}\n`,
  );
  md.push(`**Prompts:** ${meta.promptCount}\n`);
  if (meta.trialsPerPrompt) md.push(`**Trials per prompt:** ${meta.trialsPerPrompt}\n`);
  md.push("\n---\n\n");

  // Executive Summary
  md.push("## Executive Summary\n\n");

  const qualityRankings = quality
    ? Object.entries(quality)
        .map(([run, m]) => ({ run, avgScore: m.avgScore }))
        .sort((a, b) => b.avgScore - a.avgScore)
    : [];

  const latencyRankings = performance
    ? Object.entries(performance)
        .map(([run, m]) => ({ run, p50: m.latency.p50 }))
        .sort((a, b) => a.p50 - b.p50)
    : [];

  const bestQuality = qualityRankings[0];
  const fastestAgent = latencyRankings[0];

  if (bestQuality) {
    const m = quality?.[bestQuality.run];
    if (m && isRegularRunQuality(m)) {
      md.push(
        `**Best Quality:** ${bestQuality.run} (${fmt(bestQuality.avgScore)} avg score, ${pct(m.passRate)} pass rate)\n\n`,
      );
    } else {
      md.push(`**Best Quality:** ${bestQuality.run} (${fmt(bestQuality.avgScore)} avg score)\n\n`);
    }
  }

  if (fastestAgent) {
    md.push(`**Fastest:** ${fastestAgent.run} (${ms(fastestAgent.p50)} median latency)\n\n`);
  }

  if (flakiness && Object.keys(flakiness).length > 0) {
    const mostReliable = Object.entries(flakiness).sort((a, b) => a[1].avgFlakiness - b[1].avgFlakiness)[0];
    if (mostReliable) {
      md.push(`**Most Reliable:** ${mostReliable[0]} (${pct(mostReliable[1].avgFlakiness)} flakiness)\n\n`);
    }
  }

  md.push("---\n\n");

  // Quality Rankings
  if (quality && Object.keys(quality).length > 0) {
    md.push("## Quality Rankings\n\n");
    const firstMetrics = Object.values(quality)[0];
    const isTrial = firstMetrics && isTrialQuality(firstMetrics);

    if (isTrial) {
      md.push("| Rank | Agent + Search | Avg Score | Median Score | P25 Score | P75 Score |\n");
      md.push("|------|----------------|-----------|--------------|-----------|----------|\n");
      qualityRankings.forEach((entry, idx) => {
        const m = quality[entry.run];
        if (!m || !isTrialQuality(m)) return;
        md.push(
          `| ${idx + 1} | ${entry.run} | ${fmt(m.avgScore)} | ${fmt(m.medianScore)} | ${fmt(m.p25Score)} | ${fmt(m.p75Score)} |\n`,
        );
      });
    } else {
      md.push("| Rank | Agent + Search | Avg Score | Pass Rate | Pass Count | Fail Count |\n");
      md.push("|------|----------------|-----------|-----------|------------|------------|\n");
      qualityRankings.forEach((entry, idx) => {
        const m = quality[entry.run];
        if (!m || !isRegularRunQuality(m)) return;
        md.push(
          `| ${idx + 1} | ${entry.run} | ${fmt(entry.avgScore)} | ${pct(m.passRate)} | ${m.passCount} | ${m.failCount} |\n`,
        );
      });
    }
    md.push("\n");
  }

  // Performance Rankings
  if (performance && Object.keys(performance).length > 0) {
    md.push("## Performance Rankings (Latency)\n\n");
    md.push("| Rank | Agent + Search | P50 | P90 | P99 | Mean | Total Duration |\n");
    md.push("|------|----------------|-----|-----|-----|------|----------------|\n");
    latencyRankings.forEach((entry, idx) => {
      const m = performance[entry.run];
      if (!m) return;
      md.push(
        `| ${idx + 1} | ${entry.run} | ${ms(m.latency.p50)} | ${ms(m.latency.p90)} | ${ms(m.latency.p99)} | ${ms(m.latency.mean)} | ${ms(m.totalDuration)} |\n`,
      );
    });
    md.push("\n");
  }

  // Reliability
  if (reliability && Object.keys(reliability).length > 0) {
    const regularRunReliability = Object.entries(reliability).filter(([, m]) => isRegularRunReliability(m));
    if (regularRunReliability.length > 0) {
      md.push("## Reliability Metrics\n\n");
      md.push("| Agent + Search | Tool Errors | Tool Error Rate | Timeouts | Timeout Rate | Completion Rate |\n");
      md.push("|----------------|-------------|-----------------|----------|--------------|----------------|\n");
      regularRunReliability.forEach(([run, m]) => {
        const r = m as {
          toolErrors: number;
          toolErrorRate: number;
          timeouts: number;
          timeoutRate: number;
          completionRate: number;
        };
        md.push(
          `| ${run} | ${r.toolErrors} | ${pct(r.toolErrorRate)} | ${r.timeouts} | ${pct(r.timeoutRate)} | ${pct(r.completionRate)} |\n`,
        );
      });
      md.push("\n");
    }
  }

  // Capability Metrics
  if (capability && Object.keys(capability).length > 0) {
    md.push("## Capability Metrics (Pass@k)\n\n");
    md.push("| Agent + Search | Avg Pass@k | Median Pass@k | P25 Pass@k | P75 Pass@k |\n");
    md.push("|----------------|------------|---------------|------------|------------|\n");
    Object.entries(capability)
      .sort((a, b) => b[1].avgPassAtK - a[1].avgPassAtK)
      .forEach(([run, m]) => {
        md.push(
          `| ${run} | ${pct(m.avgPassAtK)} | ${pct(m.medianPassAtK)} | ${pct(m.p25PassAtK)} | ${pct(m.p75PassAtK)} |\n`,
        );
      });
    md.push("\n");
  }

  // Flakiness Analysis
  if (flakiness && Object.keys(flakiness).length > 0) {
    md.push("## Flakiness Analysis\n\n");
    md.push("| Agent + Search | Avg Flakiness | Median Flakiness | Flaky Prompt Count |\n");
    md.push("|----------------|---------------|------------------|--------------------|\n");
    Object.entries(flakiness)
      .sort((a, b) => a[1].avgFlakiness - b[1].avgFlakiness)
      .forEach(([run, m]) => {
        md.push(`| ${run} | ${pct(m.avgFlakiness)} | ${pct(m.medianFlakiness)} | ${m.flakyPromptCount} |\n`);
      });
    md.push("\n");

    // Top flaky prompts
    const allFlakyPrompts = new Map<string, number>();
    Object.values(flakiness).forEach((m) => {
      m.topFlakyPrompts.forEach((p: { id: string; flakiness: number }) => {
        allFlakyPrompts.set(p.id, Math.max(allFlakyPrompts.get(p.id) ?? 0, p.flakiness));
      });
    });
    const topFlaky = Array.from(allFlakyPrompts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    if (topFlaky.length > 0) {
      md.push("### Most Flaky Prompts\n\n");
      md.push("| Prompt ID | Max Flakiness |\n");
      md.push("|-----------|---------------|\n");
      topFlaky.forEach(([id, f]) => {
        md.push(`| ${id} | ${pct(f)} |\n`);
      });
      md.push("\n");
    }
  }

  // MCP Tool Impact Analysis
  if (quality && Object.keys(quality).length > 0) {
    md.push("## MCP Tool Impact Analysis\n\n");
    const agents = Array.from(new Set(meta.runs.map((r) => parseRunLabel(r).agent)));
    const providers = Array.from(new Set(meta.runs.map((r) => parseRunLabel(r).provider)));

    if (providers.includes("builtin") && providers.length > 1) {
      md.push("| Agent | Quality (builtin → MCP) | Speed (builtin → MCP) | Reliability (builtin → MCP) |\n");
      md.push("|-------|------------------------|----------------------|----------------------------|\n");

      agents.forEach((agent) => {
        const builtinRun = `${agent}-builtin`;
        providers
          .filter((p) => p !== "builtin")
          .map((p) => `${agent}-${p}`)
          .forEach((mcpRun) => {
            if (!performance) return;
            const bq = quality[builtinRun];
            const mq = quality[mcpRun];
            const bp = performance[builtinRun];
            const mp = performance[mcpRun];
            if (!bq || !mq || !bp || !mp) return;

            const qualityDiff = ((mq.avgScore - bq.avgScore) / bq.avgScore) * 100;
            const speedDiff = ((mp.latency.p50 - bp.latency.p50) / bp.latency.p50) * 100;

            let reliabilityDiff = 0;
            if (reliability?.[builtinRun] && reliability[mcpRun] && !isRegularRunReliability(reliability[builtinRun])) {
              const br = reliability[builtinRun];
              const mr = reliability[mcpRun];
              if ("avgPassExpK" in br && "avgPassExpK" in mr) {
                reliabilityDiff = (mr.avgPassExpK - br.avgPassExpK) * 100;
              }
            } else if (isRegularRunQuality(bq) && isRegularRunQuality(mq)) {
              reliabilityDiff = (mq.passRate - bq.passRate) * 100;
            }

            const mcpProvider = parseRunLabel(mcpRun).provider;
            const qa = qualityDiff > 0 ? "↑" : qualityDiff < 0 ? "↓" : "→";
            const sa = speedDiff < 0 ? "↑" : speedDiff > 0 ? "↓" : "→";
            const ra = reliabilityDiff > 0 ? "↑" : reliabilityDiff < 0 ? "↓" : "→";

            // Add CI margins if statistical data available
            let qm = "";
            let sm = "";
            let rm = "";
            if (statistical?.quality && statistical?.performance) {
              const smq = statistical.quality[mcpRun];
              const sbq = statistical.quality[builtinRun];
              const smp = statistical.performance[mcpRun];
              const sbp = statistical.performance[builtinRun];
              if (smq?.confidenceIntervals?.avgScore && sbq) {
                const [lo, hi] = smq.confidenceIntervals.avgScore;
                qm = ` ± ${fmt(((hi - lo) / 2 / sbq.avgScore) * 100, 1)}%`;
              }
              if (smp?.confidenceIntervals?.latencyMean && sbp) {
                const [lo, hi] = smp.confidenceIntervals.latencyMean;
                sm = ` ± ${fmt(((hi - lo) / 2 / sbp.latency.mean) * 100, 1)}%`;
              }
              if (
                smq?.confidenceIntervals &&
                "passRate" in smq.confidenceIntervals &&
                smq.confidenceIntervals.passRate
              ) {
                const [lo, hi] = smq.confidenceIntervals.passRate;
                rm = ` ± ${fmt(((hi - lo) / 2) * 100, 1)}pp`;
              }
            }

            md.push(
              `| ${agent} (${mcpProvider}) | ${qa} ${fmt(Math.abs(qualityDiff), 1)}%${qm} | ${sa} ${fmt(Math.abs(speedDiff), 1)}%${sm} | ${ra} ${fmt(Math.abs(reliabilityDiff), 1)}pp${rm} |\n`,
            );
          });
      });
      md.push("\n");
    }
  }

  return md.join("");
};

const generateToolCallSections = (analyses: FileAnalysis[]): string => {
  const md: string[] = [];

  // Group by agent
  const byAgent = new Map<string, FileAnalysis[]>();
  for (const a of analyses) {
    const existing = byAgent.get(a.agent) ?? [];
    existing.push(a);
    byAgent.set(a.agent, existing);
  }

  // Tool Call Statistics
  md.push("## Tool Call Statistics\n\n");
  for (const [agent, agentResults] of byAgent.entries()) {
    md.push(`### ${agent.toUpperCase()}\n\n`);

    const builtin = agentResults.find((r) => r.provider === "builtin");
    const mcp = agentResults.find((r) => r.provider !== "builtin");

    if (!builtin || !mcp) {
      // Single provider: just show stats
      for (const r of agentResults) {
        const { stats } = r;
        md.push(
          `**${r.provider}:** Median=${stats.median.toFixed(1)}, P90=${stats.p90.toFixed(1)}, P99=${stats.p99.toFixed(1)}, Mean=${stats.mean.toFixed(1)} (n=${stats.count})\n\n`,
        );
      }
      continue;
    }

    md.push(`| Metric | Builtin | ${mcp.provider} | Difference | % Change |\n`);
    md.push("|--------|---------|---------|------------|----------|\n");
    const metrics: Array<{ label: string; key: "median" | "p90" | "p99" | "mean" | "min" | "max" }> = [
      { label: "Median (P50)", key: "median" },
      { label: "P90", key: "p90" },
      { label: "P99", key: "p99" },
      { label: "Mean", key: "mean" },
      { label: "Min", key: "min" },
      { label: "Max", key: "max" },
    ];
    for (const { label, key } of metrics) {
      const bv = builtin.stats[key];
      const mv = mcp.stats[key];
      const diff = mv - bv;
      const pctChange = bv > 0 ? (diff / bv) * 100 : 0;
      const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
      md.push(
        `| ${label} | ${bv.toFixed(1)} | ${mv.toFixed(1)} | ${arrow} ${Math.abs(diff).toFixed(1)} | ${pctChange > 0 ? "+" : ""}${pctChange.toFixed(1)}% |\n`,
      );
    }
    md.push(`\n**Sample size:** ${builtin.stats.count} (builtin), ${mcp.stats.count} (${mcp.provider})\n\n`);
  }

  // Tool Call Distribution Histograms
  md.push("## Tool Call Distribution\n\n");
  for (const [agent, agentResults] of byAgent.entries()) {
    md.push(`### ${agent.toUpperCase()}\n\n`);
    for (const r of agentResults) {
      if (r.toolCalls.length > 0) {
        md.push(renderHistogram(r.toolCalls, `${r.provider}`));
      }
    }

    // Key observations for builtin vs MCP provider
    const builtin = agentResults.find((r) => r.provider === "builtin");
    const mcp = agentResults.find((r) => r.provider !== "builtin");
    if (builtin && mcp && builtin.toolCalls.length > 0 && mcp.toolCalls.length > 0) {
      const b0 = builtin.toolCalls.filter((c) => c === 0).length;
      const m0 = mcp.toolCalls.filter((c) => c === 0).length;
      const b5 = builtin.toolCalls.filter((c) => c >= 5).length;
      const m5 = mcp.toolCalls.filter((c) => c >= 5).length;
      md.push("**Key Observations:**\n\n");
      md.push(
        `- Zero tool calls: Builtin=${b0} (${((b0 / builtin.toolCalls.length) * 100).toFixed(1)}%), ${mcp.provider}=${m0} (${((m0 / mcp.toolCalls.length) * 100).toFixed(1)}%)\n`,
      );
      md.push(
        `- Heavy users (5+ calls): Builtin=${b5} (${((b5 / builtin.toolCalls.length) * 100).toFixed(1)}%), ${mcp.provider}=${m5} (${((m5 / mcp.toolCalls.length) * 100).toFixed(1)}%)\n\n`,
      );
    }
  }

  return md.join("");
};

const generateFailingPromptsSection = async (analyses: FileAnalysis[]): Promise<string> => {
  const md: string[] = [];

  // Load prompt queries from full dataset
  const promptFile = "data/prompts/prompts.jsonl";
  const promptMap = new Map<string, string>();
  if (await Bun.file(promptFile).exists()) {
    const lines = (await Bun.file(promptFile).text()).trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const p = JSON.parse(line);
      promptMap.set(p.id, p.input);
    }
  }

  md.push("## Failing Prompts (pass@k = 0)\n\n");

  for (const analysis of analyses) {
    const label = `${analysis.agent}-${analysis.provider}`;
    const failures = analysis.results.filter((r) => r.passAtK === 0);
    const lowPerformers = analysis.results.filter((r) => r.passAtK > 0 && r.passAtK < 0.5);

    if (failures.length === 0 && lowPerformers.length === 0) continue;

    md.push(`### ${label}\n\n`);
    md.push(
      `Total: ${analysis.results.length} prompts, ${failures.length} complete failures, ${lowPerformers.length} low performers (<50%)\n\n`,
    );

    if (failures.length > 0) {
      md.push("**Complete Failures (pass@k = 0%):**\n\n");
      md.push("| Prompt ID | Pass Rate | Pass@k | Pass^k |\n");
      md.push("|-----------|-----------|--------|--------|\n");
      for (const f of failures.sort((a, b) => a.id.localeCompare(b.id))) {
        md.push(`| ${f.id} | ${pct(f.passRate)} | ${pct(f.passAtK)} | ${pct(f.passExpK)} |\n`);
      }
      md.push("\n");

      if (promptMap.size > 0) {
        md.push("**Failing Prompt Queries:**\n\n");
        for (const f of failures.slice(0, 20)) {
          const query = promptMap.get(f.id) ?? "Unknown";
          md.push(`**${f.id}** (pass@k=${pct(f.passAtK)})\n> ${query}\n\n`);
        }
      }
    }

    if (lowPerformers.length > 0) {
      md.push("**Low Performers (0% < pass@k < 50%) — Top 10:**\n\n");
      md.push("| Prompt ID | Pass Rate | Pass@k | Pass^k |\n");
      md.push("|-----------|-----------|--------|--------|\n");
      for (const lp of lowPerformers.sort((a, b) => a.passAtK - b.passAtK).slice(0, 10)) {
        md.push(`| ${lp.id} | ${pct(lp.passRate)} | ${pct(lp.passAtK)} | ${pct(lp.passExpK)} |\n`);
      }
      md.push("\n");
    }
  }

  return md.join("");
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  const comparisonsBase = "data/comparisons";
  const resultsBase = "data/results";

  const runDate = options.runDate ?? (await findLatestDate(comparisonsBase));
  const comparisonsDir = `${comparisonsBase}/${runDate}`;
  const resultsDir = `${resultsBase}/${runDate}`;
  const outputPath = options.output ?? `${comparisonsDir}/REPORT.md`;

  console.log("Report Configuration:");
  console.log(`  Run date:   ${runDate}`);
  console.log(`  Comparisons: ${comparisonsDir}`);
  console.log(`  Results:    ${resultsDir}`);
  console.log(`  Output:     ${outputPath}`);
  console.log();

  if (options.dryRun) {
    console.log("[DRY RUN] Would generate REPORT.md — exiting.");
    return;
  }

  // Load comparison data
  const weighted = await loadComparison(comparisonsDir, "weighted");
  if (!weighted) {
    throw new Error(`No comparison data found in ${comparisonsDir}`);
  }
  const statistical = await loadComparison(comparisonsDir, "statistical");

  // Load raw trial data for tool call analysis
  const glob = new Bun.Glob("**/*.jsonl");
  const jsonlFiles = await Array.fromAsync(glob.scan({ cwd: resultsDir }));
  const analyses: FileAnalysis[] = await Promise.all(jsonlFiles.map((f) => analyzeFile(`${resultsDir}/${f}`)));

  // Generate report sections
  const summarySections = generateSummarySections(weighted, statistical);
  const toolCallSections = analyses.length > 0 ? generateToolCallSections(analyses) : "";
  const failingPromptsSection = analyses.length > 0 ? await generateFailingPromptsSection(analyses) : "";

  const footer = "\n---\n\n*Generated by `bun scripts/report.ts`*\n";

  const report = [summarySections, toolCallSections, failingPromptsSection, footer].filter(Boolean).join("\n");

  await Bun.$`mkdir -p ${comparisonsDir}`.quiet();
  await Bun.write(outputPath, report);

  console.log(`✓ Report written to: ${outputPath}`);
};

if (import.meta.main) {
  main().catch((error) => {
    console.error("Error generating report:", error);
    process.exit(1);
  });
}
