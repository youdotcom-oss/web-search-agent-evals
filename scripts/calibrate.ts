#!/usr/bin/env bun

/**
 * Interactive calibration script for grader evaluation
 *
 * @remarks
 * Prompts user for:
 * - Mode: test-runs or specific dated run (with list of available dates)
 * - Agents: multi-select via space-separated numbers or "all"
 * - Search providers: multi-select via space-separated numbers or "all"
 * - Sample count: number of failures to sample (default 5)
 *
 * Supports batch generation: selecting multiple agents and providers generates
 * all combinations (e.g., 2 agents × 2 providers = 4 reports).
 *
 * Cleans calibration folder before generating new reports.
 *
 * Usage:
 *   bun scripts/calibrate.ts
 *   bun run calibrate
 *
 * @public
 */

import { spawn } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { MCP_SERVERS, type McpServerKey } from "../mcp-servers.ts";

type Agent = "claude-code" | "gemini" | "droid" | "codex";
type SearchProvider = McpServerKey | "builtin";

const ALL_AGENTS: Agent[] = ["claude-code", "gemini", "droid", "codex"];

/**
 * Prompt user for input with readline
 *
 * @param question - Question to display
 * @returns User's input
 *
 * @internal
 */
const prompt = async (question: string): Promise<string> => {
  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

/**
 * Get list of dated run directories
 *
 * @returns Array of run dates (YYYY-MM-DD format)
 *
 * @internal
 */
const getRunDates = async (): Promise<string[]> => {
  const runsDir = join(process.cwd(), "data", "results", "runs");
  try {
    const entries = await readdir(runsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse(); // Most recent first
  } catch {
    return [];
  }
};

/**
 * Clean calibration directory
 *
 * @remarks
 * Removes all .md files from data/calibration/
 *
 * @internal
 */
const cleanCalibrationDir = async (): Promise<void> => {
  const calibrationDir = join(process.cwd(), "data", "calibration");
  try {
    const files = await readdir(calibrationDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    for (const file of mdFiles) {
      await rm(join(calibrationDir, file));
    }

    if (mdFiles.length > 0) {
      console.log(`🧹 Cleaned ${mdFiles.length} files from calibration directory\n`);
    }
  } catch {
    // Directory doesn't exist or other error, that's fine
  }
};

/**
 * Run calibration command
 *
 * @param inputFile - Path to results file
 * @param outputFile - Path to output markdown
 * @param sampleCount - Number of samples to generate
 * @returns Exit code
 *
 * @internal
 */
const runCalibrate = (inputFile: string, outputFile: string, sampleCount: number): Promise<number> => {
  return new Promise((resolve) => {
    console.log(`\n📊 Running calibration...`);
    console.log(`   Input:  ${inputFile}`);
    console.log(`   Output: ${outputFile}`);
    console.log(`   Samples: ${sampleCount}\n`);

    const proc = spawn(
      "bunx",
      ["@plaited/agent-eval-harness", "calibrate", inputFile, "--sample", sampleCount.toString(), "-o", outputFile],
      { stdio: "inherit" },
    );

    proc.on("close", (code) => {
      resolve(code ?? 1);
    });

    proc.on("error", (err) => {
      console.error(`Error running calibration: ${err.message}`);
      resolve(1);
    });
  });
};

/**
 * Main interactive flow
 *
 * @internal
 */
const main = async () => {
  console.log("🎯 Grader Calibration Tool\n");

  // Clean calibration directory first
  await cleanCalibrationDir();

  // Step 1: Choose mode
  console.log("Select mode:");
  console.log("  1. test-runs (quick test results)");
  console.log("  2. runs (dated full evaluation runs)");

  const modeChoice = await prompt("\nEnter choice (1 or 2) [1]: ");
  const isTestMode = !modeChoice || modeChoice === "1";

  let baseDir: string;
  let prefix: string;

  if (isTestMode) {
    baseDir = "data/results/test-runs";
    prefix = "test";
  } else {
    // Show available run dates
    const runDates = await getRunDates();

    if (runDates.length === 0) {
      console.error("❌ No dated runs found in data/results/runs/");
      process.exit(1);
    }

    console.log("\nAvailable runs:");
    runDates.forEach((date, i) => {
      console.log(`  ${i + 1}. ${date}`);
    });

    const dateChoice = await prompt(`\nEnter choice (1-${runDates.length}) [1]: `);
    const dateIndex = dateChoice ? Number.parseInt(dateChoice, 10) - 1 : 0;

    if (dateIndex < 0 || dateIndex >= runDates.length) {
      console.error("❌ Invalid choice");
      process.exit(1);
    }

    const selectedDate = runDates[dateIndex];
    baseDir = `data/results/runs/${selectedDate}`;
    prefix = selectedDate;
  }

  // Step 2: Choose agents (multi-select)
  console.log("\nSelect agents (space-separated numbers, or 'all'):");
  ALL_AGENTS.forEach((agent, i) => {
    console.log(`  ${i + 1}. ${agent}`);
  });

  const agentChoice = await prompt(`\nEnter choices (e.g., "1 3" or "all") [all]: `);
  let selectedAgents: Agent[];

  if (!agentChoice || agentChoice === "all") {
    selectedAgents = [...ALL_AGENTS];
  } else {
    const indices = agentChoice
      .split(/\s+/)
      .map((s) => Number.parseInt(s, 10) - 1)
      .filter((i) => i >= 0 && i < ALL_AGENTS.length);

    if (indices.length === 0) {
      console.error("❌ Invalid choices");
      process.exit(1);
    }

    selectedAgents = indices.map((i) => ALL_AGENTS[i] as Agent);
  }

  // Step 3: Choose search providers (multi-select)
  const mcpKeys = Object.keys(MCP_SERVERS) as McpServerKey[];
  const allProviders: SearchProvider[] = ["builtin", ...mcpKeys];

  console.log("\nSelect search providers (space-separated numbers, or 'all'):");
  allProviders.forEach((provider, i) => {
    console.log(`  ${i + 1}. ${provider}`);
  });

  const providerChoice = await prompt(`\nEnter choices (e.g., "1 2" or "all") [all]: `);
  let selectedProviders: SearchProvider[];

  if (!providerChoice || providerChoice === "all") {
    selectedProviders = [...allProviders];
  } else {
    const indices = providerChoice
      .split(/\s+/)
      .map((s) => Number.parseInt(s, 10) - 1)
      .filter((i) => i >= 0 && i < allProviders.length);

    if (indices.length === 0) {
      console.error("❌ Invalid choices");
      process.exit(1);
    }

    selectedProviders = indices.map((i) => allProviders[i] as SearchProvider);
  }

  // Step 4: Choose sample count
  const sampleInput = await prompt("\nNumber of samples [5]: ");
  const sampleCount = sampleInput ? Number.parseInt(sampleInput, 10) : 5;

  if (Number.isNaN(sampleCount) || sampleCount < 1) {
    console.error("❌ Invalid sample count");
    process.exit(1);
  }

  // Build combinations
  const combinations: Array<{ agent: Agent; provider: SearchProvider }> = [];
  for (const agent of selectedAgents) {
    for (const provider of selectedProviders) {
      combinations.push({ agent, provider });
    }
  }

  console.log(`\n📊 Will generate ${combinations.length} calibration report(s):\n`);
  combinations.forEach(({ agent, provider }) => {
    console.log(`   - ${agent} with ${provider}`);
  });

  const confirm = await prompt("\nProceed? (y/n) [y]: ");
  if (confirm && confirm.toLowerCase() !== "y" && confirm !== "") {
    console.log("❌ Cancelled");
    process.exit(0);
  }

  // Run calibrations
  let successCount = 0;
  let failCount = 0;

  for (const { agent, provider } of combinations) {
    const inputFile = join(process.cwd(), baseDir, agent, `${provider}.jsonl`);
    const outputFile = join(process.cwd(), "data", "calibration", `${prefix}-${agent}-${provider}.md`);

    // Check if input file exists
    if (!(await Bun.file(inputFile).exists())) {
      console.log(`\n⚠️  Skipping ${agent}-${provider}: input file not found`);
      failCount++;
      continue;
    }

    // Run calibration
    const exitCode = await runCalibrate(inputFile, outputFile, sampleCount);

    if (exitCode === 0) {
      successCount++;
    } else {
      failCount++;
    }
  }

  // Summary
  console.log(`\n${"=".repeat(80)}`);
  console.log("CALIBRATION SUMMARY");
  console.log("=".repeat(80));
  console.log(`✅ Success: ${successCount}/${combinations.length}`);
  console.log(`❌ Failed:  ${failCount}/${combinations.length}`);
  console.log("=".repeat(80));

  if (failCount > 0) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
