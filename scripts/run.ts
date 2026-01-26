#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type Agent = "claude-code" | "gemini" | "droid" | "codex";
type Mode = "test" | "full";
type SearchProvider = "builtin" | "you";

type RunOptions = {
  agents: Agent[];
  mode?: Mode;
  searchProvider?: SearchProvider;
  dryRun?: boolean;
};

const ALL_AGENTS: Agent[] = ["claude-code", "gemini", "droid", "codex"];

const parseArgs = (args: string[]): RunOptions => {
  const agents: Agent[] = [];
  let mode: Mode | undefined;
  let searchProvider: SearchProvider | undefined;
  let dryRun = false;

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
      if (tool !== "builtin" && tool !== "you") {
        throw new Error(`Invalid search provider: ${tool}. Must be "builtin" or "you"`);
      }
      searchProvider = tool;
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return {
    agents: agents.length > 0 ? agents : ALL_AGENTS,
    mode,
    searchProvider,
    dryRun,
  };
};

const detectCurrentMode = async (): Promise<Mode> => {
  // Check TypeScript entrypoint for DATASET variable default
  const entrypointFile = join(process.cwd(), "docker", "entrypoint");
  const content = await readFile(entrypointFile, "utf-8");

  const datasetMatch = content.match(/const DATASET = process\.env\.DATASET \|\| "(\w+)"/);
  if (datasetMatch?.[1]) {
    return datasetMatch[1] as Mode;
  }

  // Fallback: check for test or full patterns in prompt paths
  if (content.includes(`/eval/data/prompts/\${DATASET}.jsonl`) || content.includes("prompts/test.jsonl")) {
    return "test";
  }
  if (content.includes("prompts/full.jsonl")) {
    return "full";
  }
  throw new Error("Could not detect current mode from docker/entrypoint");
};

const runService = (
  agent: Agent,
  searchProvider: SearchProvider,
  dataset: Mode,
  scenarioId: number,
  totalScenarios: number,
): Promise<number> => {
  return new Promise((resolve) => {
    const label = `[${scenarioId}/${totalScenarios}] ${agent}-${searchProvider}`;
    const startTime = Date.now();

    console.log(`\n${"=".repeat(80)}`);
    console.log(`${label} - STARTING`);
    console.log(`${"=".repeat(80)}\n`);

    const proc = spawn(
      "docker",
      ["compose", "run", "--rm", "-e", `SEARCH_PROVIDER=${searchProvider}`, "-e", `DATASET=${dataset}`, agent],
      {
        stdio: "pipe", // Capture output instead of inherit
      },
    );

    let currentPrompt = "";
    let hasError = false;

    // Show progress lines that matter
    proc.stdout?.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        // Track current prompt for context
        const promptMatch = line.match(/\[(\d+)\/(\d+)\]/);
        if (promptMatch) {
          currentPrompt = `${promptMatch[1]}/${promptMatch[2]}`;
        }

        // Only show important progress indicators
        if (
          (line.includes("[") && line.includes("/") && line.includes("]")) || // [1/5] progress
          line.includes("Done!") ||
          line.includes("TIMEOUT") ||
          line.includes("ERROR") ||
          line.includes("Failed") ||
          line.match(/✓|✗|!/) !== null
        ) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          const prefix = currentPrompt ? `[${currentPrompt}] ` : "";
          console.log(`  ${label} ${prefix}(${elapsed}s): ${line.trim()}`);

          // Track if there are errors
          if (line.includes("ERROR") || line.includes("Failed")) {
            hasError = true;
          }
        }
      }
    });

    proc.stderr?.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.includes("ERROR") && !line.includes("MCP ERROR")) {
          // Fatal errors (non-MCP)
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.error(`  ${label} (${elapsed}s): ⚠️  FATAL: ${line.trim()}`);
          hasError = true;
        } else if (line.includes("MCP ERROR")) {
          // MCP errors are often warnings (tool may continue)
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.warn(`  ${label} (${elapsed}s): ⚠️  WARNING: ${line.trim()}`);
        }
      }
    });

    proc.on("close", (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const status = code === 0 ? "✓ COMPLETED" : "✗ FAILED";
      const errorNote = hasError && code === 0 ? " (had warnings)" : "";

      console.log(`\n${"=".repeat(80)}`);
      console.log(`${label} - ${status}${errorNote} (${elapsed}s, exit code: ${code})`);
      console.log(`${"=".repeat(80)}\n`);

      resolve(code ?? 1);
    });

    proc.on("error", (err) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`\n${"=".repeat(80)}`);
      console.error(`${label} - ✗ ERROR (${elapsed}s)`);
      console.error(`  ${err.message}`);
      console.error(`${"=".repeat(80)}\n`);
      resolve(1);
    });
  });
};

const main = async () => {
  const args = process.argv.slice(2);

  try {
    const options = parseArgs(args);

    if (options.dryRun) {
      console.log("[DRY RUN] Validation mode - no docker commands will run\n");
    }

    // Determine dataset mode (use override if provided, otherwise detect from entrypoint default)
    const currentMode = options.mode || (await detectCurrentMode());

    console.log(`${options.dryRun ? "[DRY RUN] " : ""}Running in ${currentMode} mode`);
    console.log(`Agents: ${options.agents.join(", ")}`);

    // Determine which search providers to test
    const searchProviders: SearchProvider[] = options.searchProvider ? [options.searchProvider] : ["builtin", "you"];
    console.log(`Search providers: ${searchProviders.join(", ")}`);
    console.log("");

    // Build execution list (each agent runs with each search provider)
    type RunConfig = { agent: Agent; searchProvider: SearchProvider };
    const runs: RunConfig[] = [];
    for (const agent of options.agents) {
      for (const provider of searchProviders) {
        runs.push({ agent, searchProvider: provider });
      }
    }

    console.log(`${options.dryRun ? "[DRY RUN] Would run" : "Running"} ${runs.length} scenarios in parallel\n`);

    if (options.dryRun) {
      console.log("[DRY RUN] Execution plan:");
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        if (!run) continue;
        console.log(
          `  [${i + 1}/${runs.length}] ${run.agent}-${run.searchProvider}: docker compose run --rm -e SEARCH_PROVIDER=${
            run.searchProvider
          } -e DATASET=${currentMode} ${run.agent}`,
        );
      }
      console.log("\n[DRY RUN] No services were executed.");
      process.exit(0);
    }

    // Track completion status
    const completed = new Set<number>();
    const startTime = Date.now();

    // Status heartbeat every 30 seconds
    const statusInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const inProgress = runs.length - completed.size;

      if (inProgress > 0) {
        console.log(`\n⏱️  Status update (${elapsed}s elapsed):`);
        console.log(`   Completed: ${completed.size}/${runs.length}`);
        console.log(`   In progress: ${inProgress}`);

        const stillRunning = runs
          .map((run, index) =>
            completed.has(index + 1) ? null : `[${index + 1}/${runs.length}] ${run.agent}-${run.searchProvider}`,
          )
          .filter((x) => x !== null);

        if (stillRunning.length > 0) {
          console.log(`   Still running: ${stillRunning.join(", ")}`);
        }
        console.log("");
      }
    }, 30000);

    // Run all scenarios in parallel
    const results = await Promise.all(
      runs.map(({ agent, searchProvider }, index) =>
        runService(agent, searchProvider, currentMode, index + 1, runs.length).then((result) => {
          completed.add(index + 1);
          return result;
        }),
      ),
    );

    clearInterval(statusInterval);

    // Report results summary
    console.log(`\n${"=".repeat(80)}`);
    console.log("FINAL RESULTS SUMMARY");
    console.log("=".repeat(80));

    const failures: Array<{ label: string; exitCode: number }> = [];
    const successes: string[] = [];

    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const exitCode = results[i];

      // Skip if run or result is missing (should never happen, but TypeScript requires the check)
      if (!run || exitCode === undefined) {
        continue;
      }

      const label = `[${i + 1}/${runs.length}] ${run.agent}-${run.searchProvider}`;

      if (exitCode === 0) {
        successes.push(label);
        console.log(`✓ ${label}`);
      } else {
        failures.push({ label, exitCode });
        console.log(`✗ ${label} (exit code: ${exitCode})`);
      }
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log(`Success: ${successes.length}/${runs.length}`);
    console.log(`Failed: ${failures.length}/${runs.length}`);
    console.log("=".repeat(80));

    if (failures.length > 0) {
      console.error(`\n⚠️  Failed scenarios (${failures.length}):`);
      failures.forEach(({ label, exitCode }) => {
        const errorType = exitCode === 143 || exitCode === 124 ? "TIMEOUT" : "ERROR";
        console.error(`  - ${label}: ${errorType} (exit code ${exitCode})`);
      });
      console.error("\n💡 Tip: Check output above for specific error details (tool errors, MCP issues, etc.)");
      process.exit(1);
    } else {
      console.log("\n✅ All scenarios completed successfully!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
};

main();
