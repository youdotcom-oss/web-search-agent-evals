#!/usr/bin/env bun
import { spawn } from "node:child_process";

type Mode = "test" | "full";
type Agent = "claude-code" | "gemini" | "droid" | "codex";
type McpTool = "builtin" | "you";
type Strategy = "weighted" | "statistical";

interface CompareOptions {
  agents: Agent[];
  mode: Mode;
  mcp?: McpTool;
  strategy: Strategy;
  dryRun?: boolean;
}

const ALL_AGENTS: Agent[] = ["claude-code", "gemini", "droid", "codex"];
const ALL_STRATEGIES: Strategy[] = ["weighted", "statistical"];

const parseArgs = (args: string[]): CompareOptions => {
  const agents: Agent[] = [];
  let mode: Mode = "test";
  let mcp: McpTool | undefined;
  let strategy: Strategy = "weighted";
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
    } else if (args[i] === "--strategy" && i + 1 < args.length) {
      const s = args[i + 1];
      if (!ALL_STRATEGIES.includes(s as Strategy)) {
        throw new Error(`Invalid strategy: ${s}. Must be one of: ${ALL_STRATEGIES.join(", ")}`);
      }
      strategy = s as Strategy;
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return {
    agents: agents.length > 0 ? agents : ALL_AGENTS,
    mode,
    mcp,
    strategy,
    dryRun,
  };
};

const buildResultPath = (agent: Agent, mcpTool: McpTool, mode: Mode): string => {
  const datasetSuffix = mode === "test" ? "-test" : "";
  return `data/results/${agent}/${mcpTool}${datasetSuffix}.jsonl`;
};

const buildRunLabel = (agent: Agent, mcpTool: McpTool): string => {
  return `${agent}-${mcpTool}`;
};

const buildOutputPath = (options: CompareOptions): string => {
  const { agents, mcp, strategy, mode } = options;

  let scope: string;
  if (agents.length < ALL_AGENTS.length) {
    // Specific agents: gemini-claude-code
    scope = agents.join("-");
  } else if (mcp) {
    // All agents, specific MCP: builtin or you
    scope = mcp;
  } else {
    // All agents, both MCP modes: all
    scope = "all";
  }

  return `data/comparison-${scope}-${strategy}-${mode}.json`;
};

const runComparison = async (options: CompareOptions): Promise<void> => {
  const { agents, mode, mcp, strategy } = options;

  // Build scenario matrix
  const mcpTools: McpTool[] = mcp ? [mcp] : ["builtin", "you"];
  const runs: Array<{ agent: Agent; mcpTool: McpTool }> = [];

  for (const agent of agents) {
    for (const tool of mcpTools) {
      runs.push({ agent, mcpTool: tool });
    }
  }

  // Build command arguments
  const args = ["@plaited/agent-eval-harness", "compare"];

  for (const { agent, mcpTool } of runs) {
    const label = buildRunLabel(agent, mcpTool);
    const path = buildResultPath(agent, mcpTool, mode);
    args.push("--run", `${label}:${path}`);
  }

  args.push("--strategy", strategy);
  args.push("-o", buildOutputPath(options));

  // Execute
  const proc = spawn("bunx", args, { stdio: "inherit" });

  return new Promise((resolve, reject) => {
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Comparison failed with exit code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
};

const main = async () => {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.dryRun) {
      console.log("[DRY RUN] Comparison validation mode\n");
      console.log("Configuration:");
      console.log(`  Mode: ${options.mode}`);
      console.log(`  Agents: ${options.agents.join(", ")}`);
      console.log(`  MCP: ${options.mcp || "all"}`);
      console.log(`  Strategy: ${options.strategy}`);
      console.log(`\nOutput: ${buildOutputPath(options)}\n`);

      // Build scenario matrix for preview
      const mcpTools: McpTool[] = options.mcp ? [options.mcp] : ["builtin", "you"];
      const runs: Array<{ agent: Agent; mcpTool: McpTool }> = [];

      for (const agent of options.agents) {
        for (const tool of mcpTools) {
          runs.push({ agent, mcpTool: tool });
        }
      }

      console.log("Runs to compare:");
      for (const { agent, mcpTool } of runs) {
        const label = buildRunLabel(agent, mcpTool);
        const path = buildResultPath(agent, mcpTool, options.mode);
        console.log(`  ${label}: ${path}`);
      }

      process.exit(0);
    }

    console.log("Comparison Configuration:");
    console.log(`  Mode: ${options.mode}`);
    console.log(`  Agents: ${options.agents.join(", ")}`);
    console.log(`  MCP: ${options.mcp || "all"}`);
    console.log(`  Strategy: ${options.strategy}`);
    console.log(`  Output: ${buildOutputPath(options)}\n`);

    await runComparison(options);

    console.log(`\n✓ Comparison complete: ${buildOutputPath(options)}`);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
};

main();
