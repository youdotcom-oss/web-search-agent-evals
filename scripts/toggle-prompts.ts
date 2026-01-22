#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Mode = "test" | "full";

interface ToggleOptions {
  mode?: Mode;
  status?: boolean;
  dryRun?: boolean;
}

const parseArgs = (args: string[]): ToggleOptions => {
  const options: ToggleOptions = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mode" && i + 1 < args.length) {
      const mode = args[i + 1];
      if (mode !== "test" && mode !== "full") {
        throw new Error(`Invalid mode: ${mode}. Must be "test" or "full"`);
      }
      options.mode = mode;
      i++;
    } else if (args[i] === "--status") {
      options.status = true;
    } else if (args[i] === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
};

const detectCurrentMode = (content: string): Mode => {
  // Check builtin services for mode (they all should match)
  if (content.includes("/eval/data/prompts/test.jsonl")) {
    return "test";
  }
  if (content.includes("/eval/data/prompts/full.jsonl")) {
    return "full";
  }
  throw new Error("Could not detect current mode from docker-compose.yml");
};

const togglePrompts = async (mode: Mode, composeFile: string, dryRun = false): Promise<void> => {
  console.log(`${dryRun ? "[DRY RUN] " : ""}Switching to ${mode} mode...`);

  // Read current content
  const content = await readFile(composeFile, "utf-8");
  const currentMode = detectCurrentMode(content);

  if (currentMode === mode) {
    console.log(`Already in ${mode} mode. No changes needed.`);
    return;
  }

  // Replace prompt files
  let newContent = content;

  if (mode === "test") {
    // Switch from full to test
    newContent = newContent.replace(/\/eval\/data\/prompts\/full\.jsonl/g, "/eval/data/prompts/test.jsonl");
    newContent = newContent.replace(/\/eval\/data\/prompts\/full-mcp\.jsonl/g, "/eval/data/prompts/test-mcp.jsonl");
    // Update output paths to include -test suffix
    newContent = newContent.replace(
      /\/eval\/data\/results\/([^/]+)\/(builtin|you)\.jsonl/g,
      "/eval/data/results/$1/$2-test.jsonl",
    );
  } else {
    // Switch from test to full
    newContent = newContent.replace(/\/eval\/data\/prompts\/test\.jsonl/g, "/eval/data/prompts/full.jsonl");
    newContent = newContent.replace(/\/eval\/data\/prompts\/test-mcp\.jsonl/g, "/eval/data/prompts/full-mcp.jsonl");
    // Remove -test suffix from output paths
    newContent = newContent.replace(
      /\/eval\/data\/results\/([^/]+)\/(builtin|you)-test\.jsonl/g,
      "/eval/data/results/$1/$2.jsonl",
    );
  }

  if (dryRun) {
    console.log("\n[DRY RUN] Would make the following changes:");
    console.log(`  Current mode: ${currentMode}`);
    console.log(`  Target mode: ${mode}`);
    console.log(
      `  Prompt files: ${currentMode === "test" ? "test" : "full"}*.jsonl → ${mode === "test" ? "test" : "full"}*.jsonl`,
    );
    console.log(`  Output files: ${mode === "test" ? "add -test suffix" : "remove -test suffix"}`);
    console.log("\n[DRY RUN] No files were modified.");
  } else {
    // Create backup
    const backupFile = `${composeFile}.bak`;
    await writeFile(backupFile, content, "utf-8");
    console.log(`Created backup: ${backupFile}`);

    // Write updated content
    await writeFile(composeFile, newContent, "utf-8");

    // Show diff summary
    const oldPrompts = mode === "test" ? "full" : "test";
    const newPrompts = mode;
    console.log("\n✓ Updated docker-compose.yml:");
    console.log(`  Prompt files: ${oldPrompts}*.jsonl → ${newPrompts}*.jsonl`);
    console.log(`  Output files: ${mode === "test" ? "added -test suffix" : "removed -test suffix"}`);
  }
};

const showStatus = async (composeFile: string): Promise<void> => {
  const content = await readFile(composeFile, "utf-8");
  const currentMode = detectCurrentMode(content);

  console.log(`Current mode: ${currentMode}`);
  console.log("\nPrompt files:");
  console.log(`  Builtin: /eval/data/prompts/${currentMode === "test" ? "test" : "full"}.jsonl`);
  console.log(`  MCP: /eval/data/prompts/${currentMode === "test" ? "test-mcp" : "full-mcp"}.jsonl`);
  console.log("\nOutput files:");
  console.log(`  Pattern: /eval/data/results/{agent}/{builtin|you}${currentMode === "test" ? "-test" : ""}.jsonl`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  const composeFile = join(process.cwd(), "docker-compose.yml");

  try {
    if (options.status) {
      await showStatus(composeFile);
    } else if (options.mode) {
      await togglePrompts(options.mode, composeFile, options.dryRun);
    } else {
      console.log("Usage:");
      console.log("  bun scripts/toggle-prompts.ts --mode test|full [--dry-run]");
      console.log("  bun scripts/toggle-prompts.ts --status");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
};

main();
