#!/usr/bin/env bun

/**
 * MCP adoption diagnostic CLI
 *
 * @remarks
 * Inspects tool_call events in trial JSONL files to classify each trial's
 * search behavior: MCP only, builtin only, both, or neither. Useful for
 * understanding whether agents actually use the configured MCP server.
 *
 * Usage:
 *   bun scripts/analyze-fallbacks.ts                        # latest date
 *   bun scripts/analyze-fallbacks.ts --run-date 2026-02-27  # specific date
 *   bun scripts/analyze-fallbacks.ts --verbose              # per-prompt breakdown
 *
 * @public
 */

import { BUILTIN_SEARCH_TOOLS, MCP_TOOL_PATTERNS } from "./shared/shared.constants.ts";
import type { Agent, TrialSearchBehavior } from "./shared/shared.types.ts";
import { findLatestDate } from "./report.ts";

type TrajectoryStep = {
  type: string;
  name?: string;
  status?: string;
  content?: string;
};

type TrialData = {
  id: string;
  trials: Array<{
    pass: boolean;
    score: number;
    trajectory?: TrajectoryStep[];
  }>;
};

type CliOptions = {
  runDate?: string;
  verbose: boolean;
};

const parseArgs = (args: string[]): CliOptions => {
  let runDate: string | undefined;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--run-date" && i + 1 < args.length) {
      runDate = args[++i];
    } else if (args[i] === "--verbose" || args[i] === "-v") {
      verbose = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
MCP Adoption Diagnostic — classify trials by search tool usage

Usage:
  bun scripts/analyze-fallbacks.ts [options]

Options:
  --run-date <YYYY-MM-DD>   Specific run date (default: latest)
  --verbose, -v             Show per-prompt breakdown
  --help, -h                Show this help message
`);
      process.exit(0);
    }
  }

  return { runDate, verbose };
};

const classifyTrial = (trajectory: TrajectoryStep[] | undefined, agent: string): TrialSearchBehavior => {
  if (!trajectory) return "neither";

  const toolNames = trajectory
    .filter((step) => step.type === "tool_call" && step.name && !step.name.startsWith("toolu_"))
    .map((step) => step.name as string);

  const usedMcp = toolNames.some((name) => MCP_TOOL_PATTERNS.some((pattern) => name.includes(pattern)));

  const builtinTools = BUILTIN_SEARCH_TOOLS[agent as Agent] ?? [];
  const usedBuiltin = toolNames.some((name) => builtinTools.some((builtin) => name.startsWith(builtin)));

  if (usedMcp && usedBuiltin) return "both";
  if (usedMcp) return "mcp_only";
  if (usedBuiltin) return "builtin_only";
  return "neither";
};

const pct = (n: number, total: number): string => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "0.0%");

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  const resultsBase = "data/results";
  const runDate = options.runDate ?? (await findLatestDate(resultsBase));
  const resultsDir = `${resultsBase}/${runDate}`;

  console.log(`Analyzing MCP adoption for run: ${runDate}\n`);

  const glob = new Bun.Glob("**/*.jsonl");
  const files = await Array.fromAsync(glob.scan({ cwd: resultsDir, followSymlinks: true }));

  // Only analyze MCP provider files (not builtin)
  const mcpFiles = files.filter((f) => !f.includes("builtin"));

  if (mcpFiles.length === 0) {
    console.log("No MCP provider result files found.");
    return;
  }

  for (const file of mcpFiles.sort()) {
    const parts = file.split("/");
    const agent = parts[0] ?? "unknown";
    const provider = (parts[1] ?? "unknown").replace(".jsonl", "").replace(/-(capability|regression)$/, "");
    const label = `${agent}-${provider}`;

    const text = await Bun.file(`${resultsDir}/${file}`).text();
    const lines = text.trim().split("\n").filter(Boolean);

    const buckets = { mcp_only: 0, builtin_only: 0, both: 0, neither: 0 };
    let totalTrials = 0;

    const promptDetails: Array<{
      id: string;
      buckets: Record<TrialSearchBehavior, number>;
      trialCount: number;
    }> = [];

    for (const line of lines) {
      const result: TrialData = JSON.parse(line);
      const promptBuckets = { mcp_only: 0, builtin_only: 0, both: 0, neither: 0 };

      for (const trial of result.trials) {
        const behavior = classifyTrial(trial.trajectory, agent);
        buckets[behavior]++;
        promptBuckets[behavior]++;
        totalTrials++;
      }

      promptDetails.push({
        id: result.id,
        buckets: promptBuckets,
        trialCount: result.trials.length,
      });
    }

    console.log(`--- ${label} (${totalTrials} trials) ---`);
    console.log(`  MCP Only:     ${buckets.mcp_only.toString().padStart(4)}  ${pct(buckets.mcp_only, totalTrials)}`);
    console.log(
      `  Builtin Only: ${buckets.builtin_only.toString().padStart(4)}  ${pct(buckets.builtin_only, totalTrials)}`,
    );
    console.log(`  Both:         ${buckets.both.toString().padStart(4)}  ${pct(buckets.both, totalTrials)}`);
    console.log(`  Neither:      ${buckets.neither.toString().padStart(4)}  ${pct(buckets.neither, totalTrials)}`);
    console.log();

    if (options.verbose) {
      // Show prompts where builtin was used (fallback behavior)
      const fallbackPrompts = promptDetails.filter((p) => p.buckets.builtin_only > 0 || p.buckets.both > 0);
      if (fallbackPrompts.length > 0) {
        console.log("  Prompts using builtin search:");
        for (const p of fallbackPrompts.slice(0, 20)) {
          const builtinTrials = p.buckets.builtin_only + p.buckets.both;
          console.log(`    ${p.id}: ${builtinTrials}/${p.trialCount} trials (${pct(builtinTrials, p.trialCount)})`);
        }
        if (fallbackPrompts.length > 20) {
          console.log(`    ... and ${fallbackPrompts.length - 20} more`);
        }
        console.log();
      }
    }
  }
};

if (import.meta.main) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
