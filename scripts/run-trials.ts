#!/usr/bin/env bun
import { spawn } from "node:child_process";

type Agent = "claude-code" | "gemini" | "droid" | "codex";
type Mode = "test" | "full";
type TrialType = "default" | "capability" | "regression";

type TrialsOptions = {
  agent: Agent;
  mode: Mode;
  trialType: TrialType;
  k?: number;
  dryRun?: boolean;
};

const ALL_AGENTS: Agent[] = ["claude-code", "gemini", "droid", "codex"];

/**
 * Parse command-line arguments for trials execution
 *
 * @param args - Command-line arguments
 * @returns Parsed options
 *
 * @public
 */
const parseArgs = (args: string[]): TrialsOptions => {
  let agent: Agent = "droid"; // Default to droid
  let mode: Mode = "test";
  let trialType: TrialType = "default";
  let k: number | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agent" && i + 1 < args.length) {
      const agentArg = args[i + 1];
      if (!ALL_AGENTS.includes(agentArg as Agent)) {
        throw new Error(`Invalid agent: ${agentArg}. Must be one of: ${ALL_AGENTS.join(", ")}`);
      }
      agent = agentArg as Agent;
      i++;
    } else if (args[i] === "--mode" && i + 1 < args.length) {
      const modeArg = args[i + 1];
      if (modeArg !== "test" && modeArg !== "full") {
        throw new Error(`Invalid mode: ${modeArg}. Must be "test" or "full"`);
      }
      mode = modeArg;
      i++;
    } else if (args[i] === "--type" && i + 1 < args.length) {
      const typeArg = args[i + 1];
      if (typeArg !== "default" && typeArg !== "capability" && typeArg !== "regression") {
        throw new Error(`Invalid trial type: ${typeArg}. Must be "default", "capability", or "regression"`);
      }
      trialType = typeArg as TrialType;
      i++;
    } else if (args[i] === "-k" && i + 1 < args.length) {
      const kArg = args[i + 1];
      if (!kArg) {
        throw new Error("Missing value for -k flag");
      }
      k = Number.parseInt(kArg, 10);
      if (Number.isNaN(k) || k < 1) {
        throw new Error(`Invalid k value: ${kArg}. Must be a positive integer`);
      }
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return { agent, mode, trialType, k, dryRun };
};

/**
 * Get k value for trial type
 *
 * @param trialType - Type of trial (default, capability, regression)
 * @param override - Optional override value
 * @returns Number of trials to run
 *
 * @internal
 */
const getKValue = (trialType: TrialType, override?: number): number => {
  if (override) return override;

  switch (trialType) {
    case "capability":
      return 10;
    case "regression":
      return 3;
    default:
      return 5;
  }
};

/**
 * Get output file path for trials results
 *
 * @param agent - Agent name
 * @param mode - Test mode (test or full)
 * @param trialType - Type of trial
 * @returns Output file path
 *
 * @internal
 */
const getOutputPath = (agent: Agent, mode: Mode, trialType: TrialType): string => {
  if (trialType === "capability") {
    return `data/results/trials/${agent}-capability.jsonl`;
  }
  if (trialType === "regression") {
    return `data/results/trials/${agent}-regression.jsonl`;
  }
  return `data/results/trials/${agent}-${mode}.jsonl`;
};

/**
 * Run trials for a single agent
 *
 * @param options - Trials execution options
 * @returns Promise resolving to exit code
 *
 * @internal
 */
const runTrials = (options: TrialsOptions): Promise<number> => {
  return new Promise((resolve) => {
    const k = getKValue(options.trialType, options.k);
    const dataset = options.mode === "full" ? "data/prompts/full.jsonl" : "data/prompts/test.jsonl";
    const schema = `agent-schemas/${options.agent}.json`;
    const outputPath = getOutputPath(options.agent, options.mode, options.trialType);
    const grader = "./scripts/inline-grader.ts";

    const startTime = Date.now();

    console.log(`\n${"=".repeat(80)}`);
    console.log(`Running trials: ${options.agent} (k=${k}, mode=${options.mode})`);
    console.log(`${"=".repeat(80)}\n`);

    if (options.dryRun) {
      console.log("[DRY RUN] Would execute:");
      console.log(
        `  bunx @plaited/agent-eval-harness trials ${dataset} --schema ${schema} -k ${k} --grader ${grader} -o ${outputPath} --progress`,
      );
      resolve(0);
      return;
    }

    const proc = spawn(
      "bunx",
      [
        "@plaited/agent-eval-harness",
        "trials",
        dataset,
        "--schema",
        schema,
        "-k",
        k.toString(),
        "--grader",
        grader,
        "-o",
        outputPath,
        "--progress",
      ],
      {
        stdio: "inherit",
      },
    );

    proc.on("close", (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const status = code === 0 ? "✓ COMPLETED" : "✗ FAILED";

      console.log(`\n${"=".repeat(80)}`);
      console.log(`${options.agent} - ${status} (${elapsed}s, exit code: ${code})`);
      console.log(`${"=".repeat(80)}\n`);

      resolve(code ?? 1);
    });

    proc.on("error", (err) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`\n${"=".repeat(80)}`);
      console.error(`${options.agent} - ✗ ERROR (${elapsed}s)`);
      console.error(`  ${err.message}`);
      console.error(`${"=".repeat(80)}\n`);
      resolve(1);
    });
  });
};

/**
 * Main entry point
 *
 * @internal
 */
const main = async () => {
  const args = process.argv.slice(2);

  try {
    const options = parseArgs(args);

    console.log(`Agent: ${options.agent}`);
    console.log(`Mode: ${options.mode}`);
    console.log(`Trial type: ${options.trialType}`);
    console.log(`k: ${getKValue(options.trialType, options.k)}`);

    const exitCode = await runTrials(options);
    process.exit(exitCode);
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
};

main();
