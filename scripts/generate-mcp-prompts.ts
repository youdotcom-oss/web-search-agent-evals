#!/usr/bin/env bun

/**
 * Generate MCP variant prompt files from base prompts
 *
 * @remarks
 * Adds MCP metadata to base prompts without changing prompt text.
 * Uses MCP_SERVERS configuration for server names and expected tools.
 * The unified "Use web search to find:" format works for both builtin and MCP modes.
 * Only adds metadata: mcpServer and expectedTools
 *
 * Usage:
 *   bun scripts/generate-mcp-prompts.ts
 *   bun scripts/generate-mcp-prompts.ts --mcp-key you
 *   bun scripts/generate-mcp-prompts.ts --mcp-key you --suffix custom
 *
 * @public
 */

import { MCP_SERVERS, type McpServerKey } from "../mcp-servers.ts";
import type { Prompt } from "./schemas/prompts.ts";
import { PromptSchema } from "./schemas/prompts.ts";
import { parseJsonl } from "./schemas/common.ts";

type McpConfig = {
  serverKey: McpServerKey;
  serverName: string;
  expectedTools: readonly string[];
  suffix: string;
};

type Options = {
  configs: McpConfig[];
  dryRun: boolean;
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);

  const mcpKeys = Object.keys(MCP_SERVERS) as McpServerKey[];
  if (mcpKeys.length === 0) {
    throw new Error("No MCP servers configured in MCP_SERVERS");
  }

  // Defaults from first MCP server
  const defaultKey = mcpKeys[0] as McpServerKey;

  let serverKey: McpServerKey | undefined;
  let suffix: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mcp-key" && i + 1 < args.length) {
      const keyArg = args[i + 1] as string;
      if (!mcpKeys.includes(keyArg as McpServerKey)) {
        throw new Error(`Invalid MCP key: ${keyArg}. Must be one of: ${mcpKeys.join(", ")}`);
      }
      serverKey = keyArg as McpServerKey;
      i++;
    } else if (args[i] === "--suffix" && i + 1 < args.length) {
      suffix = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Generate MCP variant prompt files from base prompts

Usage:
  bun scripts/generate-mcp-prompts.ts [options]

Options:
  --mcp-key <key>      MCP server key from mcp-servers.ts (default: ${defaultKey})
                       Available: ${mcpKeys.join(", ")}
  --suffix <name>      File suffix (default: same as mcp-key) → prompts-<suffix>.jsonl
  --dry-run            Show what would be generated without writing files
  --help, -h           Show this help message

Examples:
  # Generate You.com variants (default)
  bun scripts/generate-mcp-prompts.ts

  # Generate for specific MCP server
  bun scripts/generate-mcp-prompts.ts --mcp-key you

  # Custom suffix
  bun scripts/generate-mcp-prompts.ts --mcp-key you --suffix custom

  # Preview without writing files
  bun scripts/generate-mcp-prompts.ts --dry-run

Output files:
  data/prompts/full/prompts-<suffix>.jsonl
  data/prompts/test/prompts-<suffix>.jsonl
  data/prompts/trials/prompts-<suffix>.jsonl
      `);
      process.exit(0);
    }
  }

  // Build config list
  const hasKeyFlag = serverKey !== undefined;
  const configs: McpConfig[] = hasKeyFlag
    ? [
        {
          serverKey: serverKey as McpServerKey,
          serverName: MCP_SERVERS[serverKey as McpServerKey].name,
          expectedTools: MCP_SERVERS[serverKey as McpServerKey].expectedTools,
          suffix: suffix ?? (serverKey as McpServerKey),
        },
      ]
    : mcpKeys.map((key) => {
        const server = MCP_SERVERS[key];
        return {
          serverKey: key,
          serverName: server.name,
          expectedTools: server.expectedTools,
          suffix: key,
        };
      });

  return { configs, dryRun };
};

const convertPrompt = (prompt: Prompt, config: McpConfig): Prompt => {
  // Strip 'Use web search and answer\n' prefix if present
  const prefix = "Use web search and answer\n";
  const cleanedInput = prompt.input.startsWith(prefix) ? prompt.input.slice(prefix.length) : prompt.input;

  // Prefix input with rule to use the specified MCP tool
  // Add metadata to indicate MCP expectations for grader
  return {
    ...prompt,
    input: `Use ${config.serverName} and answer\n${cleanedInput}`,
    metadata: {
      ...prompt.metadata,
      mcpServer: config.serverName,
      expectedTools: config.expectedTools,
    },
  };
};

const convertFile = async (inputPath: string, outputPath: string, config: McpConfig): Promise<number> => {
  const inputFile = Bun.file(inputPath);

  if (!(await inputFile.exists())) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const text = await inputFile.text();
  const { data, errors } = parseJsonl(PromptSchema, text);

  if (errors.length > 0 || !data) {
    console.error(`Found ${errors.length} validation errors in ${inputPath}`);
    console.error(errors.join("\n"));
    throw new Error("Prompt validation failed");
  }

  const prompts = data;
  const converted = prompts.map((p) => convertPrompt(p, config));

  const output = `${converted.map((p) => JSON.stringify(p)).join("\n")}\n`;
  await Bun.write(outputPath, output);

  return converted.length;
};

const main = async () => {
  const { configs, dryRun } = parseArgs();

  if (dryRun) {
    console.log(`[DRY RUN] MCP Prompt Generation Preview\n`);
  } else {
    console.log(`📝 Generating MCP variant files for ${configs.length} server(s)\n`);
  }

  let grandTotalConverted = 0;

  for (const config of configs) {
    console.log(`Processing ${config.serverKey}:`);
    console.log(`   MCP Server: ${config.serverName}`);
    console.log(`   Tool Names: ${config.expectedTools.join(", ")}`);
    console.log(`   Suffix:     ${config.suffix}`);

    const datasets = ["full", "test", "trials"];
    let totalConverted = 0;

    for (const dataset of datasets) {
      const inputPath = `data/prompts/${dataset}/prompts.jsonl`;
      const outputPath = `data/prompts/${dataset}/prompts-${config.suffix}.jsonl`;

      const inputFile = Bun.file(inputPath);
      if (!(await inputFile.exists())) {
        console.log(`  ⚠️  Skipping ${dataset}: ${inputPath} not found`);
        continue;
      }

      if (dryRun) {
        // Just count without writing
        const text = await inputFile.text();
        const lines = text.trim().split("\n");
        const count = lines.length;
        console.log(`  [DRY RUN] Would convert ${count} prompts: ${outputPath}`);
        totalConverted += count;
      } else {
        const count = await convertFile(inputPath, outputPath, config);
        console.log(`  ✅ Converted ${count} prompts: ${outputPath}`);
        totalConverted += count;
      }
    }

    console.log(`  Total: ${totalConverted} prompts\n`);
    grandTotalConverted += totalConverted;
  }

  if (grandTotalConverted === 0) {
    console.log(`⚠️  No prompts converted. Check that base prompt files exist.`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would convert ${grandTotalConverted} total prompts across ${configs.length} server(s).`);
  } else {
    console.log(`🎉 Done! ${grandTotalConverted} total prompts converted across ${configs.length} server(s).`);
  }
};

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
