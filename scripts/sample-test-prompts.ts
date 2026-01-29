#!/usr/bin/env bun
/**
 * Sample test prompts from full dataset
 *
 * @remarks
 * Creates test.jsonl and test-you.jsonl by randomly sampling 5 prompts from full.jsonl.
 * Both files use identical "Use web search to find:" prompt text.
 * The only difference is metadata:
 * - test.jsonl: No MCP metadata (builtin search)
 * - test-you.jsonl: mcp_server="ydc-server", expected_tool="you-search"
 */

type Prompt = {
  id: string;
  input: string;
  metadata?: Record<string, unknown>;
  hint?: string;
};

const SAMPLE_SIZE = 5;
const FULL_PROMPTS_PATH = "data/prompts/full.jsonl";
const TEST_OUTPUT_PATH = "data/prompts/test.jsonl";
const TEST_YOU_OUTPUT_PATH = "data/prompts/test-you.jsonl";

const main = async () => {
  // Read full prompts
  const fullFile = Bun.file(FULL_PROMPTS_PATH);
  if (!(await fullFile.exists())) {
    console.error(`Error: ${FULL_PROMPTS_PATH} not found`);
    process.exit(1);
  }

  const fullText = await fullFile.text();
  const lines = fullText.trim().split("\n");
  const prompts: Prompt[] = lines.map((line) => JSON.parse(line));

  console.log(`📊 Found ${prompts.length} prompts in ${FULL_PROMPTS_PATH}`);

  // Randomly sample 5 prompts
  const shuffled = [...prompts].sort(() => Math.random() - 0.5);
  const sampled = shuffled.slice(0, SAMPLE_SIZE);

  console.log(`🎲 Sampled ${SAMPLE_SIZE} prompts:`);
  for (const p of sampled) {
    console.log(`  - ${p.id}`);
  }

  // Create test.jsonl (builtin format)
  const testPrompts = sampled.map((prompt) => ({
    ...prompt,
    // Keep input as-is (already in "Use web search to find:\n<query>" format)
    // Remove any MCP metadata
    metadata: {
      ...prompt.metadata,
      mcp_server: undefined,
      expected_tool: undefined,
    },
  }));

  const testContent = `${testPrompts.map((p) => JSON.stringify(p)).join("\n")}\n`;
  await Bun.write(TEST_OUTPUT_PATH, testContent);
  console.log(`✅ Written ${TEST_OUTPUT_PATH}`);

  // Create test-you.jsonl (MCP format with metadata only)
  const testYouPrompts = sampled.map((prompt) => ({
    ...prompt,
    // Keep input unchanged - unified "Use web search to find:" format works for both
    metadata: {
      ...prompt.metadata,
      mcp_server: "ydc-server",
      expected_tool: "you-search",
    },
  }));

  const testYouContent = `${testYouPrompts.map((p) => JSON.stringify(p)).join("\n")}\n`;
  await Bun.write(TEST_YOU_OUTPUT_PATH, testYouContent);
  console.log(`✅ Written ${TEST_YOU_OUTPUT_PATH}`);

  console.log("\n🎉 Done! Test prompts updated.");
};

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
