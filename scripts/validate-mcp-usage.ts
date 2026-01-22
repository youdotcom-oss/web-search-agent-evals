#!/usr/bin/env bun
/**
 * Validate that MCP mode actually uses MCP server
 *
 * @remarks
 * Compares builtin vs MCP outputs to verify they're different,
 * confirming MCP server is being called.
 *
 * Usage:
 *   bun scripts/validate-mcp-usage.ts -a claude-code
 *   bun scripts/validate-mcp-usage.ts --agent gemini
 */

import { join } from "node:path";
import { parseArgs } from "node:util";

type Agent = "claude-code" | "gemini" | "droid" | "codex";
type Result = {
  id: string;
  input: string;
  output: string;
  metadata?: Record<string, unknown>;
};

const AGENTS: Agent[] = ["claude-code", "gemini", "droid", "codex"];

/**
 * MCP indicators - signs that You.com MCP was used
 */
const MCP_INDICATORS = [
  "feels like", // Temperature detail
  "mph", // Wind speed
  "air quality", // Air quality info
  "uv index", // UV index
  "precipitation", // Precipitation detail
  "as of", // Timestamp format
  "pm pst", // Specific time format
  "am pst", // Specific time format
];

/**
 * Check if output likely came from MCP server
 */
const hasMcpIndicators = (output: string): boolean => {
  const lowerOutput = output.toLowerCase();
  const matchCount = MCP_INDICATORS.filter((indicator) => lowerOutput.includes(indicator)).length;

  // If 3+ indicators present, likely MCP
  return matchCount >= 3;
};

/**
 * Calculate similarity between two strings (0-1)
 */
const similarity = (a: string, b: string): number => {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  const editDistance = (s1: string, s2: string): number => {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  };

  return (longer.length - editDistance(longer, shorter)) / longer.length;
};

/**
 * Parse CLI arguments
 */
const parseCliArgs = () => {
  const { values } = parseArgs({
    options: {
      agent: { type: "string", short: "a" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(`
Validate that MCP mode actually uses MCP server

Usage:
  bun scripts/validate-mcp-usage.ts -a <agent>

Options:
  -a, --agent <name>   Agent name: ${AGENTS.join(", ")}
  -h, --help           Show this help

Examples:
  bun scripts/validate-mcp-usage.ts -a claude-code
  bun scripts/validate-mcp-usage.ts -a gemini
`);
    process.exit(0);
  }

  if (!values.agent) {
    console.error("Error: --agent is required");
    console.error("Run with --help for usage information");
    process.exit(1);
  }

  const agent = values.agent as Agent;
  if (!AGENTS.includes(agent)) {
    console.error(`Error: Invalid agent "${agent}". Must be one of: ${AGENTS.join(", ")}`);
    process.exit(1);
  }

  return { agent };
};

/**
 * Load results from JSONL file
 */
const loadResults = async (filePath: string): Promise<Result[]> => {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${filePath}`);
  }

  const text = await file.text();
  return text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Result);
};

/**
 * Main validation
 */
const main = async () => {
  const { agent } = parseCliArgs();

  const resultsDir = join("data", "results", agent);
  const builtinFile = join(resultsDir, "builtin.jsonl");
  const mcpFile = join(resultsDir, "you.jsonl");

  console.log(`\nValidating MCP Usage for ${agent}`);
  console.log("=".repeat(50));

  // Load results
  let builtinResults: Result[];
  let mcpResults: Result[];

  try {
    builtinResults = await loadResults(builtinFile);
    mcpResults = await loadResults(mcpFile);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n✗ ${error.message}`);
    }
    process.exit(1);
  }

  if (builtinResults.length === 0 || mcpResults.length === 0) {
    console.error("\n✗ One or both result files are empty");
    process.exit(1);
  }

  console.log(`\nComparing ${builtinResults.length} results...\n`);

  let mcpDetectedCount = 0;
  let differentOutputsCount = 0;
  let identicalOutputsCount = 0;

  // Compare each prompt
  for (let i = 0; i < Math.min(builtinResults.length, mcpResults.length); i++) {
    const builtin = builtinResults[i];
    const mcp = mcpResults[i];

    if (builtin.id !== mcp.id) {
      console.error(`⚠ Warning: ID mismatch at index ${i}: "${builtin.id}" vs "${mcp.id}"`);
      continue;
    }

    const outputSimilarity = similarity(builtin.output, mcp.output);
    const hasMcpMarkers = hasMcpIndicators(mcp.output);

    if (outputSimilarity < 0.7) {
      differentOutputsCount++;
    } else if (outputSimilarity > 0.95) {
      identicalOutputsCount++;
    }

    if (hasMcpMarkers) {
      mcpDetectedCount++;
    }

    const status = hasMcpMarkers ? "✓" : "✗";
    const simPercent = (outputSimilarity * 100).toFixed(0);

    console.log(`${status} ${builtin.id}: similarity=${simPercent}%, mcp_indicators=${hasMcpMarkers ? "yes" : "no"}`);
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log("Summary:");
  console.log(`  Total prompts:      ${Math.min(builtinResults.length, mcpResults.length)}`);
  console.log(`  MCP indicators:     ${mcpDetectedCount}`);
  console.log(`  Different outputs:  ${differentOutputsCount}`);
  console.log(`  Identical outputs:  ${identicalOutputsCount}`);

  // Verdict
  console.log(`\n${"=".repeat(50)}`);
  if (mcpDetectedCount >= 1 || differentOutputsCount >= 1) {
    console.log("✓ MCP appears to be working");
    console.log("  Different outputs detected, suggesting different data sources");
    process.exit(0);
  } else {
    console.log("✗ MCP may NOT be working");
    console.log("  Outputs are too similar to builtin mode");
    console.log("  Check MCP configuration and --mcp-config flag");
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
