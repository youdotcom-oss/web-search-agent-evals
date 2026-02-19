import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runScript } from "./test-utils.ts";

const SCRIPT_PATH = join(import.meta.dir, "..", "generate-mcp-prompts.ts");

describe("generate-mcp-prompts.ts", () => {
  describe("parseArgs - valid inputs", () => {
    test("dry-run exits 0 and shows preview", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("[DRY RUN] MCP Prompt Generation Preview");
    });

    test("dry-run shows configured MCP server (you)", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Processing you:");
      expect(stdout).toContain("MCP Server: ydc-server");
    });

    test("dry-run shows expected tools", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Tool Names:");
      expect(stdout).toContain("you-search");
    });

    test("dry-run shows prompt count from full dataset", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      // Should show N prompts from data/prompts/prompts.jsonl
      expect(stdout).toMatch(/Would convert \d+ prompts/);
    });

    test("dry-run shows output path", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/prompts/prompts-you.jsonl");
    });

    test("accepts --mcp-key you", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--mcp-key", "you", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Processing you:");
    });

    test("accepts --suffix flag", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--mcp-key",
        "you",
        "--suffix",
        "custom",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("prompts-custom.jsonl");
    });

    test("dry-run shows total count summary", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("[DRY RUN] Would convert");
      expect(stdout).toContain("server(s).");
    });

    test("--help exits 0 with usage text", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--help"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("--mcp-key");
      expect(stdout).toContain("--suffix");
      expect(stdout).toContain("--dry-run");
    });

    test("-h shorthand shows help", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["-h"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("--mcp-key");
    });
  });

  describe("parseArgs - invalid inputs", () => {
    test("rejects invalid --mcp-key", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--mcp-key", "invalid-mcp"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid MCP key: invalid-mcp");
      expect(stderr).toContain("Must be one of:");
    });
  });

  describe("output path generation", () => {
    test("output uses mcp-key as suffix by default", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--mcp-key", "you", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/prompts/prompts-you.jsonl");
    });

    test("custom suffix overrides mcp-key for output path", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--mcp-key", "you", "--suffix", "ydc", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/prompts/prompts-ydc.jsonl");
      expect(stdout).not.toContain("prompts-you.jsonl");
    });
  });
});
