#!/usr/bin/env bun

/**
 * Interactive calibration script for grader evaluation
 *
 * @remarks
 * Prompts user for:
 * - Mode: test-runs or specific dated run
 * - Agent: claude-code, gemini, droid, codex
 * - Search provider: builtin, you, etc.
 * - Sample count: number of failures to sample (default 5)
 *
 * Cleans calibration folder before generating new reports.
 *
 * Usage:
 *   bun scripts/calibrate.ts
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

  // Step 2: Choose agent
  console.log("\nSelect agent:");
  ALL_AGENTS.forEach((agent, i) => {
    console.log(`  ${i + 1}. ${agent}`);
  });

  const agentChoice = await prompt(`\nEnter choice (1-${ALL_AGENTS.length}) [1]: `);
  const agentIndex = agentChoice ? Number.parseInt(agentChoice, 10) - 1 : 0;

  if (agentIndex < 0 || agentIndex >= ALL_AGENTS.length) {
    console.error("❌ Invalid choice");
    process.exit(1);
  }

  const agent = ALL_AGENTS[agentIndex];

  // Step 3: Choose search provider
  const mcpKeys = Object.keys(MCP_SERVERS) as McpServerKey[];
  const allProviders: SearchProvider[] = ["builtin", ...mcpKeys];

  console.log("\nSelect search provider:");
  allProviders.forEach((provider, i) => {
    console.log(`  ${i + 1}. ${provider}`);
  });

  const providerChoice = await prompt(`\nEnter choice (1-${allProviders.length}) [1]: `);
  const providerIndex = providerChoice ? Number.parseInt(providerChoice, 10) - 1 : 0;

  if (providerIndex < 0 || providerIndex >= allProviders.length) {
    console.error("❌ Invalid choice");
    process.exit(1);
  }

  const searchProvider = allProviders[providerIndex];

  // Step 4: Choose sample count
  const sampleInput = await prompt("\nNumber of samples [5]: ");
  const sampleCount = sampleInput ? Number.parseInt(sampleInput, 10) : 5;

  if (Number.isNaN(sampleCount) || sampleCount < 1) {
    console.error("❌ Invalid sample count");
    process.exit(1);
  }

  // Build paths
  const inputFile = join(process.cwd(), baseDir, agent, `${searchProvider}.jsonl`);
  const outputFile = join(process.cwd(), "data", "calibration", `${prefix}-${agent}-${searchProvider}.md`);

  // Check if input file exists
  if (!(await Bun.file(inputFile).exists())) {
    console.error(`❌ Input file not found: ${inputFile}`);
    process.exit(1);
  }

  // Run calibration
  const exitCode = await runCalibrate(inputFile, outputFile, sampleCount);

  if (exitCode === 0) {
    console.log(`\n✅ Calibration complete!`);
    console.log(`📄 Report saved to: ${outputFile}`);
  } else {
    console.error(`\n❌ Calibration failed with exit code ${exitCode}`);
    process.exit(exitCode);
  }
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
