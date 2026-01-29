#!/usr/bin/env bun

/**
 * Generate MCP variant prompt files from base prompts
 *
 * @remarks
 * Adds MCP metadata to base prompts (full.jsonl, test.jsonl) without changing prompt text.
 * The unified "Use web search to find:" format works for both builtin and MCP modes.
 * Only adds metadata: mcp_server and expected_tool
 *
 * Usage:
 *   bun scripts/generate-mcp-prompts.ts
 *   bun scripts/generate-mcp-prompts.ts --mcp-server ydc-server --tool you-search
 *   bun scripts/generate-mcp-prompts.ts --mcp-server exa-server --tool exa-search
 *
 * @public
 */

type Prompt = {
  id: string;
  input: string;
  metadata?: Record<string, unknown>;
  hint?: string;
};

type McpConfig = {
  server: string;
  tool: string;
  suffix: string;
};

const parseArgs = (): McpConfig => {
  const args = process.argv.slice(2);

  let server = "ydc-server";
  let tool = "you-search";
  let suffix = "you";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mcp-server" && i + 1 < args.length) {
      server = args[i + 1] ?? server;
      i++;
    } else if (args[i] === "--tool" && i + 1 < args.length) {
      tool = args[i + 1] ?? tool;
      i++;
    } else if (args[i] === "--suffix" && i + 1 < args.length) {
      suffix = args[i + 1] ?? suffix;
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Generate MCP variant prompt files from base prompts

Usage:
  bun scripts/generate-mcp-prompts.ts [options]

Options:
  --mcp-server <name>  MCP server name (default: ydc-server)
  --tool <name>        Tool name for prompts (default: you-search)
  --suffix <name>      File suffix (default: you) → full-<suffix>.jsonl
  --help, -h           Show this help message

Examples:
  # Generate You.com variants (default)
  bun scripts/generate-mcp-prompts.ts

  # Generate Exa variants
  bun scripts/generate-mcp-prompts.ts --mcp-server exa-server --tool exa-search --suffix exa

Output files:
  data/prompts/full-<suffix>.jsonl
  data/prompts/test-<suffix>.jsonl
      `);
      process.exit(0);
    }
  }

  return { server, tool, suffix };
};

const convertPrompt = (prompt: Prompt, config: McpConfig): Prompt => {
  // Keep input unchanged - unified "Use web search to find:" format works for both builtin and MCP
  // Only add metadata to indicate MCP expectations
  return {
    ...prompt,
    metadata: {
      ...prompt.metadata,
      mcp_server: config.server,
      expected_tool: config.tool,
    },
  };
};

const convertFile = async (inputPath: string, outputPath: string, config: McpConfig): Promise<number> => {
  const inputFile = Bun.file(inputPath);

  if (!(await inputFile.exists())) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const text = await inputFile.text();
  const lines = text.trim().split("\n");
  const prompts: Prompt[] = lines.map((line) => JSON.parse(line));

  const converted = prompts.map((p) => convertPrompt(p, config));

  const output = `${converted.map((p) => JSON.stringify(p)).join("\n")}\n`;
  await Bun.write(outputPath, output);

  return converted.length;
};

const main = async () => {
  const config = parseArgs();

  console.log(`📝 Generating MCP variant files:`);
  console.log(`   MCP Server: ${config.server}`);
  console.log(`   Tool Name:  ${config.tool}`);
  console.log(`   Suffix:     ${config.suffix}\n`);

  // Convert full.jsonl
  const fullInput = "data/prompts/full.jsonl";
  const fullOutput = `data/prompts/full-${config.suffix}.jsonl`;
  const fullCount = await convertFile(fullInput, fullOutput, config);
  console.log(`✅ Converted ${fullCount} prompts: ${fullOutput}`);

  // Convert test.jsonl
  const testInput = "data/prompts/test.jsonl";
  const testOutput = `data/prompts/test-${config.suffix}.jsonl`;
  const testCount = await convertFile(testInput, testOutput, config);
  console.log(`✅ Converted ${testCount} prompts: ${testOutput}`);

  console.log(`\n🎉 Done! MCP variants generated.`);
  console.log(`\nSample output:`);

  // Show sample
  const firstLine = (await Bun.file(fullOutput).text()).split("\n")[0];
  if (firstLine) {
    const sample = JSON.parse(firstLine) as Prompt;
    console.log(`  Input:    ${sample.input.slice(0, 60)}...`);
    console.log(
      `  Metadata: mcp_server="${sample.metadata?.mcp_server}", expected_tool="${sample.metadata?.expected_tool}"`,
    );
  }
};

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
