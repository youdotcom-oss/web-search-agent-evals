#!/usr/bin/env bun
import { readFile } from "node:fs/promises";

/**
 * Validates the evaluation setup
 *
 * @remarks
 * Checks that all required files exist and are properly configured
 */

type ValidationResult = {
  passed: boolean;
  message: string;
};

const checkFileExists = async (path: string): Promise<boolean> => {
  try {
    await Bun.file(path).text();
    return true;
  } catch {
    return false;
  }
};

const validatePromptFiles = async (): Promise<ValidationResult[]> => {
  const results: ValidationResult[] = [];
  const promptFiles = [
    "data/prompts/test.jsonl",
    "data/prompts/test-mcp.jsonl",
    "data/prompts/full.jsonl",
    "data/prompts/full-mcp.jsonl",
  ];

  for (const file of promptFiles) {
    const exists = await checkFileExists(file);
    results.push({
      passed: exists,
      message: exists ? `✓ Found ${file}` : `✗ Missing ${file}`,
    });

    if (exists) {
      // Count prompts
      const content = await Bun.file(file).text();
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.trim());
      results.push({
        passed: lines.length > 0,
        message: `  → ${lines.length} prompts`,
      });
    }
  }

  return results;
};

const validateDockerCompose = async (): Promise<ValidationResult[]> => {
  const results: ValidationResult[] = [];
  const composeFile = "docker-compose.yml";

  const exists = await checkFileExists(composeFile);
  results.push({
    passed: exists,
    message: exists ? `✓ Found ${composeFile}` : `✗ Missing ${composeFile}`,
  });

  if (exists) {
    const content = await readFile(composeFile, "utf-8");

    // Check all 8 services exist
    const services = [
      "claude-code-builtin",
      "claude-code-you",
      "gemini-builtin",
      "gemini-you",
      "droid-builtin",
      "droid-you",
      "codex-builtin",
      "codex-you",
    ];

    for (const service of services) {
      const exists = content.includes(`${service}:`);
      results.push({
        passed: exists,
        message: exists ? `  ✓ Service: ${service}` : `  ✗ Missing service: ${service}`,
      });
    }

    // Check grader is configured for MCP services
    const mcpServices = ["claude-code-you", "gemini-you", "droid-you", "codex-you"];
    for (const service of mcpServices) {
      const serviceIndex = content.indexOf(`${service}:`);
      if (serviceIndex !== -1) {
        const serviceBlock = content.slice(
          serviceIndex,
          content.indexOf("\n  #", serviceIndex + 1) !== -1
            ? content.indexOf("\n  #", serviceIndex + 1)
            : content.length,
        );
        const hasGrader = serviceBlock.includes("--grader");
        results.push({
          passed: hasGrader,
          message: hasGrader ? `  ✓ Grader configured for ${service}` : `  ✗ Grader missing for ${service}`,
        });
      }
    }
  }

  return results;
};

const validateAgentSchemas = async (): Promise<ValidationResult[]> => {
  const results: ValidationResult[] = [];
  const schemas = [
    "agent-schemas/claude-code.json",
    "agent-schemas/claude-code-mcp.json",
    "agent-schemas/gemini.json",
    "agent-schemas/gemini-mcp.json",
    "agent-schemas/droid.json",
    "agent-schemas/droid-mcp.json",
    "agent-schemas/codex.json",
    "agent-schemas/codex-mcp.json",
  ];

  for (const schema of schemas) {
    const exists = await checkFileExists(schema);
    results.push({
      passed: exists,
      message: exists ? `✓ Found ${schema}` : `✗ Missing ${schema}`,
    });
  }

  return results;
};

const validateGrader = async (): Promise<ValidationResult[]> => {
  const results: ValidationResult[] = [];
  const graderFile = "scripts/inline-grader.ts";

  const exists = await checkFileExists(graderFile);
  results.push({
    passed: exists,
    message: exists ? `✓ Found ${graderFile}` : `✗ Missing ${graderFile}`,
  });

  if (exists) {
    const content = await Bun.file(graderFile).text();
    const hasGradeExport = content.includes("export const grade");
    results.push({
      passed: hasGradeExport,
      message: hasGradeExport ? "  ✓ Exports grade function" : "  ✗ Missing grade export",
    });
  }

  return results;
};

const main = async () => {
  console.log("Validating ACP Evaluation Setup\n");
  console.log("=".repeat(80));

  let allPassed = true;

  // Validate prompt files
  console.log("\nPrompt Files:");
  const promptResults = await validatePromptFiles();
  for (const result of promptResults) {
    console.log(result.message);
    if (!result.passed) allPassed = false;
  }

  // Validate docker-compose.yml
  console.log("\nDocker Configuration:");
  const dockerResults = await validateDockerCompose();
  for (const result of dockerResults) {
    console.log(result.message);
    if (!result.passed) allPassed = false;
  }

  // Validate agent schemas
  console.log("\nAgent Schemas:");
  const schemaResults = await validateAgentSchemas();
  for (const result of schemaResults) {
    console.log(result.message);
    if (!result.passed) allPassed = false;
  }

  // Validate grader
  console.log("\nInline Grader:");
  const graderResults = await validateGrader();
  for (const result of graderResults) {
    console.log(result.message);
    if (!result.passed) allPassed = false;
  }

  console.log(`\n${"=".repeat(80)}`);
  if (allPassed) {
    console.log("✓ All validation checks passed!");
    process.exit(0);
  } else {
    console.log("✗ Some validation checks failed.");
    process.exit(1);
  }
};

main();
