#!/usr/bin/env bun

/**
 * Create distribution histogram of tool calls
 */

type TrialResult = {
  id: string;
  trials: Array<{
    trajectory?: Array<{ type: string }>;
  }>;
};

const countToolCalls = (trajectory?: Array<{ type: string }>): number => {
  if (!trajectory) return 0;
  return trajectory.filter((step) => step.type === "tool_call").length;
};

const analyzeFile = async (filePath: string): Promise<number[]> => {
  const file = Bun.file(filePath);
  const text = await file.text();
  const lines = text.trim().split("\n");

  const toolCalls: number[] = [];

  for (const line of lines) {
    const result: TrialResult = JSON.parse(line);
    for (const trial of result.trials) {
      toolCalls.push(countToolCalls(trial.trajectory));
    }
  }

  return toolCalls;
};

const createHistogram = (values: number[], label: string): void => {
  const freq = new Map<number, number>();
  for (const v of values) {
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }

  const sorted = Array.from(freq.entries()).sort((a, b) => a[0] - b[0]);
  const maxFreq = Math.max(...sorted.map(([_, f]) => f));
  const maxBar = 50;

  console.log(`\n### ${label} Distribution\n`);
  console.log("```");
  for (const [calls, count] of sorted) {
    const barLength = Math.round((count / maxFreq) * maxBar);
    const bar = "█".repeat(barLength);
    const pct = ((count / values.length) * 100).toFixed(1);
    console.log(`${calls.toString().padStart(2)} calls | ${bar} ${count} (${pct}%)`);
  }
  console.log("```\n");
};

const main = async () => {
  const trialDate = "2026-02-10";
  const trialDir = `data/results/trials/${trialDate}`;

  const builtinCalls = await analyzeFile(`${trialDir}/droid/builtin.jsonl`);
  const youCalls = await analyzeFile(`${trialDir}/droid/you.jsonl`);

  console.log("## Tool Call Distribution Histograms\n");

  createHistogram(builtinCalls, "Builtin");
  createHistogram(youCalls, "You.com MCP");

  // Comparison
  console.log("### Key Observations\n");

  const builtin0 = builtinCalls.filter((c) => c === 0).length;
  const you0 = youCalls.filter((c) => c === 0).length;
  console.log(
    `- **Zero tool calls:** Builtin=${builtin0} (${((builtin0 / builtinCalls.length) * 100).toFixed(1)}%), You=${you0} (${((you0 / youCalls.length) * 100).toFixed(1)}%)`,
  );

  const builtin2 = builtinCalls.filter((c) => c === 2).length;
  const you3 = youCalls.filter((c) => c === 3).length;
  console.log(
    `- **Modal value:** Builtin=2 calls (${((builtin2 / builtinCalls.length) * 100).toFixed(1)}%), You=3 calls (${((you3 / youCalls.length) * 100).toFixed(1)}%)`,
  );

  const builtin5plus = builtinCalls.filter((c) => c >= 5).length;
  const you5plus = youCalls.filter((c) => c >= 5).length;
  console.log(
    `- **Heavy users (5+ calls):** Builtin=${builtin5plus} (${((builtin5plus / builtinCalls.length) * 100).toFixed(1)}%), You=${you5plus} (${((you5plus / youCalls.length) * 100).toFixed(1)}%)`,
  );
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
