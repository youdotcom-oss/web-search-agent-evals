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
  // Check entrypoint.sh since docker-compose.yml no longer has hardcoded paths
  const entrypointFile = join(process.cwd(), "docker", "entrypoint.sh");
  const content = await readFile(entrypointFile, "utf-8");

  if (content.includes('PROMPT_FILE="/eval/data/prompts/test.jsonl"')) {
    return "test";
  }
  if (content.includes('PROMPT_FILE="/eval/data/prompts/full.jsonl"')) {
    return "full";
  }
  throw new Error("Could not detect current mode from docker/entrypoint.sh");
};

const toggleMode = async (mode: Mode): Promise<void> => {
  console.log(`Toggling to ${mode} mode first...\n`);

  return new Promise((resolve, reject) => {
    const toggleProcess = spawn("bun", ["scripts/toggle-prompts.ts", "--mode", mode], {
      stdio: "inherit",
    });

    toggleProcess.on("close", (code) => {
      if (code === 0) {
        console.log("");
        resolve();
      } else {
        reject(new Error(`Toggle failed with exit code ${code}`));
      }
    });
  });
};

const runService = (agent: Agent, mcpTool: McpTool): Promise<number> => {
  return new Promise((resolve) => {
    console.log(`Starting: ${agent} (${mcpTool})`);

    const proc = spawn("docker", ["compose", "run", "--rm", "-e", `MCP_TOOL=${mcpTool}`, agent], {
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

    // Check if mode override is requested
    if (options.mode) {
      if (options.dryRun) {
        console.log(`[DRY RUN] Would toggle to ${options.mode} mode\n`);
      } else {
        await toggleMode(options.mode);
      }
    }

    // Detect current mode
    const currentMode = await detectCurrentMode();

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
        console.log(`  - docker compose run --rm -e MCP_TOOL=${mcpTool} ${agent}`);
      }
      console.log("\n[DRY RUN] No services were executed.");
      process.exit(0);
    }

    // Run all scenarios in parallel
    const results = await Promise.all(runs.map(({ agent, mcpTool }) => runService(agent, mcpTool)));

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
