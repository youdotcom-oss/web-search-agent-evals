#!/usr/bin/env bun

/**
 * Convert prompts to MCP format using the winning v2 variant.
 * Transforms: <web-search>query</web-search>
 * To: <web-search mcp-server="ydc-server">query</web-search>
 */

import { parseArgs } from "node:util";

type Prompt = {
  id: string;
  input: string;
  metadata?: Record<string, unknown>;
  hint?: string;
  reference?: string;
};

/**
 * Convert a single prompt to MCP format
 */
const convertToMcpFormat = (prompt: Prompt): Prompt => {
  // If already has mcp-server attribute, skip
  if (prompt.input.includes('mcp-server="')) {
    return prompt;
  }

  // Add mcp-server="ydc-server" attribute to <web-search> tags
  const mcpInput = prompt.input.replace(/<web-search>/g, '<web-search mcp-server="ydc-server">');

  return {
    ...prompt,
    input: mcpInput,
  };
};

/**
 * Main CLI
 */
const main = async () => {
  const { values } = parseArgs({
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || !values.input || !values.output) {
    console.log(`
Usage: bun scripts/convert-to-mcp-format.ts -i <input> -o <output>

Convert prompts to MCP format using the winning v2 variant.
Adds mcp-server="ydc-server" attribute to <web-search> tags.

Options:
  -i, --input <file>   Input JSONL file
  -o, --output <file>  Output JSONL file
  -h, --help           Show this help

Examples:
  bun scripts/convert-to-mcp-format.ts -i data/prompts/test.jsonl -o data/prompts/test-mcp.jsonl
  bun scripts/convert-to-mcp-format.ts -i data/prompts/full.jsonl -o data/prompts/full-mcp.jsonl
`);
    process.exit(values.help ? 0 : 1);
  }

  const inputPath = values.input;
  const outputPath = values.output;

  console.log(`Converting ${inputPath} to MCP format...`);

  // Read input file
  const file = Bun.file(inputPath);
  if (!(await file.exists())) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const text = await file.text();
  const lines = text.trim().split("\n");

  // Convert each prompt
  const converted: string[] = [];
  for (const line of lines) {
    try {
      const prompt = JSON.parse(line) as Prompt;
      const mcpPrompt = convertToMcpFormat(prompt);
      converted.push(JSON.stringify(mcpPrompt));
    } catch (error) {
      console.error(`Error parsing line: ${line}`);
      throw error;
    }
  }

  await Bun.write(outputPath, `${converted.join("\n")}\n`);

  console.log(`✓ Converted ${lines.length} prompts`);
  console.log(`✓ Output: ${outputPath}`);
  console.log(`\nFormat: <web-search mcp-server="ydc-server">query</web-search>`);
};

main();
