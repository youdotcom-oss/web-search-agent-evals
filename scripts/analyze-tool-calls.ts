#!/usr/bin/env bun

/**
 * Analyze tool call statistics from trial data
 *
 * Calculates percentiles (P50/median, P90, P99) of tool calls per prompt
 * for comparison between builtin and MCP providers.
 */

type TrialResult = {
  id: string;
  trials: Array<{
    trajectory?: Array<{
      type: string;
      name?: string;
      toolName?: string;
      title?: string;
    }>;
  }>;
};

const calculatePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sorted[lower] ?? 0;
  }

  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? 0;
  return lowerValue * (1 - weight) + upperValue * weight;
};

const countToolCalls = (trajectory?: Array<{ type: string }>): number => {
  if (!trajectory) return 0;
  return trajectory.filter((step) => step.type === "tool_call").length;
};

const analyzeFile = async (
  filePath: string,
): Promise<{
  provider: string;
  agent: string;
  toolCalls: number[];
  stats: {
    count: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    p90: number;
    p99: number;
  };
}> => {
  const parts = filePath.split("/");
  const provider = parts[parts.length - 1]?.replace(".jsonl", "") ?? "unknown";
  const agent = parts[parts.length - 2] ?? "unknown";

  const file = Bun.file(filePath);
  const text = await file.text();
  const lines = text.trim().split("\n");

  const toolCalls: number[] = [];

  for (const line of lines) {
    const result: TrialResult = JSON.parse(line);

    // For each trial, count tool calls
    for (const trial of result.trials) {
      const count = countToolCalls(trial.trajectory);
      toolCalls.push(count);
    }
  }

  toolCalls.sort((a, b) => a - b);

  const stats = {
    count: toolCalls.length,
    min: toolCalls[0] ?? 0,
    max: toolCalls[toolCalls.length - 1] ?? 0,
    mean: toolCalls.reduce((sum, v) => sum + v, 0) / toolCalls.length,
    median: calculatePercentile(toolCalls, 50),
    p90: calculatePercentile(toolCalls, 90),
    p99: calculatePercentile(toolCalls, 99),
  };

  return { provider, agent, toolCalls, stats };
};

const main = async () => {
  const trialDate = process.argv[2] ?? "2026-02-10";
  const trialDir = `data/results/trials/${trialDate}`;

  console.log(`Analyzing tool call statistics from ${trialDir}\n`);

  // Find all JSONL files
  const glob = new Bun.Glob("**/*.jsonl");
  const files = Array.from(glob.scanSync({ cwd: trialDir }))
    .map((f) => `${trialDir}/${f}`)
    .sort();

  if (files.length === 0) {
    console.error(`No trial data found in ${trialDir}`);
    process.exit(1);
  }

  const results = await Promise.all(files.map(analyzeFile));

  // Group by agent
  const byAgent = new Map<string, typeof results>();
  for (const result of results) {
    const existing = byAgent.get(result.agent) ?? [];
    existing.push(result);
    byAgent.set(result.agent, existing);
  }

  // Print results
  for (const [agent, agentResults] of byAgent.entries()) {
    console.log(`\n## ${agent.toUpperCase()}\n`);

    const builtin = agentResults.find((r) => r.provider === "builtin");
    const you = agentResults.find((r) => r.provider === "you");

    if (!builtin || !you) {
      console.log("  Missing data for comparison\n");
      continue;
    }

    console.log("| Metric | Builtin | You.com | Difference | % Change |");
    console.log("|--------|---------|---------|------------|----------|");

    const metrics = [
      { label: "Median (P50)", key: "median" as const },
      { label: "P90", key: "p90" as const },
      { label: "P99", key: "p99" as const },
      { label: "Mean", key: "mean" as const },
      { label: "Min", key: "min" as const },
      { label: "Max", key: "max" as const },
    ];

    for (const { label, key } of metrics) {
      const builtinVal = builtin.stats[key];
      const youVal = you.stats[key];
      const diff = youVal - builtinVal;
      const pctChange = builtinVal > 0 ? (diff / builtinVal) * 100 : 0;
      const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";

      console.log(
        `| ${label} | ${builtinVal.toFixed(1)} | ${youVal.toFixed(1)} | ${arrow} ${Math.abs(diff).toFixed(1)} | ${pctChange > 0 ? "+" : ""}${pctChange.toFixed(1)}% |`,
      );
    }

    console.log(
      `\n**Sample size:** ${builtin.stats.count} observations (builtin), ${you.stats.count} observations (you)\n`,
    );
  }
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
