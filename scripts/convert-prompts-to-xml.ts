#!/usr/bin/env bun
import { parseArgs } from "node:util";

type Prompt = {
  id: string;
  input: string;
  metadata?: Record<string, unknown>;
};

/**
 * Convert keyword-based prompts to natural language XML format
 *
 * @remarks
 * Transforms keyword queries to natural language questions wrapped in <web-search> tags.
 * Adds time markers (2025, "current", "latest") for relevance.
 *
 * @public
 */
const convertPrompt = (prompt: Prompt): Prompt => {
  const { input } = prompt;

  // Skip if already has XML tags
  if (input.includes("<web-search>")) {
    return prompt;
  }

  // Convert keyword query to question
  let question = input;

  // Add time marker for relevance
  const year = new Date().getFullYear();
  if (!input.includes("2024") && !input.includes("2025") && !input.includes("2026")) {
    question = `${question} ${year}`;
  }

  // Make it a question if not already
  if (!question.endsWith("?")) {
    // Detect intent and add appropriate prefix
    if (input.toLowerCase().includes("how") || input.toLowerCase().includes("tutorial")) {
      question = `How do I find information about: ${question}?`;
    } else {
      question = `Find current information about: ${question}`;
    }
  }

  // Wrap in XML
  const xmlInput = `<web-search>${question}</web-search>`;

  return {
    ...prompt,
    input: xmlInput,
  };
};

const main = async () => {
  const { values } = parseArgs({
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || !values.input) {
    console.log(`
Usage: bun scripts/convert-prompts-to-xml.ts -i <input> -o <output>

Converts keyword-based prompts to XML-wrapped natural language format.

Options:
  -i, --input <file>   Input JSONL file with keyword-based prompts
  -o, --output <file>  Output JSONL file (default: <input>-xml.jsonl)
  -h, --help           Show this help

Example:
  bun scripts/convert-prompts-to-xml.ts -i data/prompts/test.jsonl -o data/prompts/test-xml.jsonl
`);
    process.exit(values.help ? 0 : 1);
  }

  const inputPath = values.input;
  const outputPath = values.output ?? inputPath.replace(".jsonl", "-xml.jsonl");

  console.log(`Converting ${inputPath} to ${outputPath}...`);

  const inputFile = Bun.file(inputPath);
  const text = await inputFile.text();
  const lines = text.trim().split("\n");

  const converted: string[] = [];

  for (const line of lines) {
    const prompt = JSON.parse(line) as Prompt;
    const xmlPrompt = convertPrompt(prompt);
    converted.push(JSON.stringify(xmlPrompt));
  }

  await Bun.write(outputPath, `${converted.join("\n")}\n`);

  console.log(`✓ Converted ${lines.length} prompts`);
  console.log(`  Output: ${outputPath}`);
};

main();
