#!/usr/bin/env bun

/**
 * Sample prompts from full dataset
 *
 * @remarks
 * Randomly samples prompts using Fisher-Yates shuffle and generates
 * both builtin and MCP variants for all configured MCP servers.
 *
 * Usage:
 *   bun scripts/sample.ts --dir test --count 5
 *   bun scripts/sample.ts --dir trials --count 30
 *
 * @public
 */

import { MCP_SERVERS, type McpServerKey } from "../mcp-servers.ts";

type Prompt = {
  id: string;
  input: string;
  metadata?: Record<string, unknown>;
  hint?: string;
};

type SampleOptions = {
  dir: string;
  count: number;
};

/**
 * Fisher-Yates shuffle implementation
 *
 * @remarks
 * Shuffles array in-place using the Fisher-Yates algorithm.
 * Works backwards through array, swapping each element with a random element
 * from the unshuffled portion.
 *
 * Time complexity: O(n)
 * Space complexity: O(1) - in-place swap
 *
 * @param array - Array to shuffle
 * @returns Shuffled array
 *
 * @internal
 */
const shuffle = <T>(array: T[]): T[] => {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    // Generate random index from 0 to i (inclusive)
    const j = Math.floor(Math.random() * (i + 1));

    // ES6 destructuring swap
    // biome-ignore lint/style/noNonNullAssertion: Fisher-Yates guarantees valid indices
    [result[i], result[j]] = [result[j]!, result[i]!];
  }

  return result;
};

/**
 * Parse command-line arguments
 *
 * @param args - Command-line arguments
 * @returns Parsed options
 *
 * @internal
 */
const parseArgs = (args: string[]): SampleOptions => {
  let dir = "test";
  let count = 5;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" && i + 1 < args.length) {
      dir = args[i + 1] ?? dir;
      i++;
    } else if (args[i] === "--count" && i + 1 < args.length) {
      const countArg = args[i + 1];
      if (!countArg) {
        throw new Error("Missing value for --count flag");
      }
      const parsedCount = Number.parseInt(countArg, 10);
      if (Number.isNaN(parsedCount) || parsedCount < 1) {
        throw new Error(`Invalid count: ${countArg}. Must be a positive integer`);
      }
      count = parsedCount;
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Sample prompts from full dataset

Usage:
  bun scripts/sample.ts [options]

Options:
  --dir <name>     Output directory (default: test)
                   Options: test, trials
  --count <num>    Number of prompts to sample (default: 5)
  --help, -h       Show this help message

Examples:
  # Sample 5 prompts for test set
  bun scripts/sample.ts --dir test --count 5

  # Sample 30 prompts for trials
  bun scripts/sample.ts --dir trials --count 30

Output:
  data/prompts/<dir>/prompts.jsonl           - Builtin variant
  data/prompts/<dir>/prompts-<key>.jsonl     - MCP variant for each server
      `);
      process.exit(0);
    }
  }

  return { dir, count };
};

/**
 * Convert prompt to MCP variant
 *
 * @param prompt - Base prompt
 * @param serverKey - MCP server key
 * @returns MCP variant prompt with metadata
 *
 * @internal
 */
const convertToMcpVariant = (prompt: Prompt, serverKey: McpServerKey): Prompt => {
  const server = MCP_SERVERS[serverKey];

  return {
    ...prompt,
    input: `Use ${server.name} and answer\n${prompt.input}`,
    metadata: {
      ...prompt.metadata,
      mcpServer: server.name,
      expectedTools: server.expectedTools,
    },
  };
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

    console.log(`🎲 Sampling prompts:`);
    console.log(`   Source:      data/prompts/full/prompts.jsonl`);
    console.log(`   Destination: data/prompts/${options.dir}/`);
    console.log(`   Count:       ${options.count}\n`);

    // Read full prompts
    const fullPath = "data/prompts/full/prompts.jsonl";
    const fullFile = Bun.file(fullPath);

    if (!(await fullFile.exists())) {
      throw new Error(`Full dataset not found: ${fullPath}`);
    }

    const text = await fullFile.text();
    const allPrompts: Prompt[] = text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    if (options.count > allPrompts.length) {
      throw new Error(`Cannot sample ${options.count} prompts from ${allPrompts.length} available prompts`);
    }

    // Sample randomly using Fisher-Yates shuffle
    const sampled = shuffle(allPrompts).slice(0, options.count);

    console.log(`✅ Sampled ${sampled.length} prompts from ${allPrompts.length} total\n`);

    // Ensure output directory exists
    const outputDir = `data/prompts/${options.dir}`;
    await Bun.$`mkdir -p ${outputDir}`.quiet();

    // Write builtin variant
    const builtinPath = `${outputDir}/prompts.jsonl`;
    const builtinContent = `${sampled.map((p) => JSON.stringify(p)).join("\n")}\n`;
    await Bun.write(builtinPath, builtinContent);
    console.log(`✅ Wrote builtin variant: ${builtinPath}`);

    // Write MCP variants for each server
    const mcpKeys = Object.keys(MCP_SERVERS) as McpServerKey[];

    for (const key of mcpKeys) {
      const mcpVariants = sampled.map((p) => convertToMcpVariant(p, key));
      const mcpPath = `${outputDir}/prompts-${key}.jsonl`;
      const mcpContent = `${mcpVariants.map((p) => JSON.stringify(p)).join("\n")}\n`;
      await Bun.write(mcpPath, mcpContent);
      console.log(`✅ Wrote ${key} MCP variant: ${mcpPath}`);
    }

    console.log(`\n🎉 Done! Generated ${1 + mcpKeys.length} prompt files in data/prompts/${options.dir}/`);

    // Show sample
    console.log(`\nSample prompt (builtin):`);
    const sample = sampled[0];
    if (sample) {
      console.log(`  ID:    ${sample.id}`);
      console.log(`  Input: ${sample.input.slice(0, 60)}...`);
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
};

main();
