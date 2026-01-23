#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type Agent = "claude-code" | "gemini" | "droid" | "codex";
type Mode = "test" | "full";
type McpTool = "builtin" | "you";

interface RunOptions {
  agents: Agent[];
  mode?: Mode;
  mcp?: McpTool;
  dryRun?: boolean;
}

const ALL_AGENTS: Agent[] = ["claude-code", "gemini", "droid", "codex"];

const parseArgs = (args: string[]): RunOptions => {
  const agents: Agent[] = [];
  let mode: Mode | undefined;
  let mcp: McpTool | undefined;
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
    } else if (args[i] === "--mcp" && i + 1 < args.length) {
      const tool = args[i + 1];
      if (tool !== "builtin" && tool !== "you") {
        throw new Error(`Invalid MCP tool: ${tool}. Must be "builtin" or "you"`);
      }
      mcp = tool;
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return {
    agents: agents.length > 0 ? agents : ALL_AGENTS,
    mode,
    mcp,
    dryRun,
  };
};

const detectCurrentMode = async (): Promise<Mode> => {
  // Check TypeScript entrypoint for DATASET variable default
  const entrypointFile = join(process.cwd(), "docker", "entrypoint");
  const content = await readFile(entrypointFile, "utf-8");

  const datasetMatch = content.match(/const DATASET = process\.env\.DATASET \|\| "(\w+)"/);
  if (datasetMatch && datasetMatch[1]) {
    return datasetMatch[1] as Mode;
  }

  // Fallback: check for test or full patterns in prompt paths
  if (content.includes("/eval/data/prompts/${DATASET}.jsonl") || content.includes("prompts/test.jsonl")) {
    return "test";
  }
  if (content.includes("prompts/full.jsonl")) {
    return "full";
  }
  throw new Error("Could not detect current mode from docker/entrypoint");
};

const runService = (agent: Agent, mcpTool: McpTool, dataset: Mode): Promise<number> => {
  return new Promise((resolve) => {
    console.log(`Starting: ${agent} (${mcpTool}, ${dataset})`);

    const proc = spawn("docker", [
      "compose",
      "run",
      "--rm",
      "-e",
      `MCP_TOOL=${mcpTool}`,
      "-e",
      `DATASET=${dataset}`,
      agent,
    ], {
      stdio: "inherit",
    });

    proc.on("close", (code) => {
      resolve(code ?? 1);
    });

    proc.on("error", (err) => {
      console.error(`Failed to start ${agent} (${mcpTool}):`, err.message);
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

    // Determine which MCP tools to test
    const mcpTools: McpTool[] = options.mcp ? [options.mcp] : ["builtin", "you"];
    console.log(`MCP tools: ${mcpTools.join(", ")}`);
    console.log("");

    // Build execution list (each agent runs with each MCP tool)
    type RunConfig = { agent: Agent; mcpTool: McpTool };
    const runs: RunConfig[] = [];
    for (const agent of options.agents) {
      for (const tool of mcpTools) {
        runs.push({ agent, mcpTool: tool });
      }
    }

    console.log(`${options.dryRun ? "[DRY RUN] Would run" : "Running"} ${runs.length} scenarios in parallel\n`);

    if (options.dryRun) {
      console.log("[DRY RUN] Execution plan:");
      for (const { agent, mcpTool } of runs) {
        console.log(`  - docker compose run --rm -e MCP_TOOL=${mcpTool} -e DATASET=${currentMode} ${agent}`);
      }
      console.log("\n[DRY RUN] No services were executed.");
      process.exit(0);
    }

    // Run all scenarios in parallel
    const results = await Promise.all(runs.map(({ agent, mcpTool }) => runService(agent, mcpTool, currentMode)));

    // Report results
    console.log(`\n${"=".repeat(80)}`);
    console.log("Results:");
    console.log("=".repeat(80));

    const failures: string[] = [];
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const exitCode = results[i];
      if (run === undefined || exitCode === undefined) {
        continue;
      }
      const status = exitCode === 0 ? "✓" : "✗";
      const label = `${run.agent} (${run.mcpTool})`;
      console.log(`${status} ${label}: exit code ${exitCode}`);

      if (exitCode !== 0) {
        failures.push(label);
      }
    }

    console.log("");

    if (failures.length > 0) {
      console.error(`Failed scenarios (${failures.length}):`);
      failures.forEach((label) => console.error(`  - ${label}`));
      process.exit(1);
    } else {
      console.log("All scenarios completed successfully!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
};

main();
