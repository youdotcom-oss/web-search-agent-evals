import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runScript } from "./test-utils.ts";

const SCRIPT_PATH = join(import.meta.dir, "..", "compare.ts");

describe("compare.ts", () => {
  describe("parseArgs - valid inputs", () => {
    test("uses defaults when no args provided", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("[DRY RUN]");
      expect(stdout).toContain("Mode: test");
      expect(stdout).toContain("Agents: claude-code, gemini, droid, codex");
      expect(stdout).toContain("MCP: all");
      expect(stdout).toContain("Strategy: weighted");
    });

    test("accepts single --agent flag", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "gemini", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Agents: gemini");
    });

    test("accepts multiple --agent flags", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "gemini", "--agent", "droid", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Agents: gemini, droid");
    });

    test("accepts --mode full", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--mode", "full", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Mode: full");
    });

    test("accepts --mode test", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--mode", "test", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Mode: test");
    });

    test("accepts --mcp builtin", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--mcp", "builtin", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("MCP: builtin");
    });

    test("accepts --mcp you", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--mcp", "you", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("MCP: you");
    });

    test("accepts --strategy weighted", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--strategy", "weighted", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Strategy: weighted");
    });

    test("accepts --strategy statistical", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--strategy", "statistical", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Strategy: statistical");
    });

    test("accepts all flags combined", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "gemini",
        "--mode",
        "full",
        "--mcp",
        "builtin",
        "--strategy",
        "statistical",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Mode: full");
      expect(stdout).toContain("Agents: gemini");
      expect(stdout).toContain("MCP: builtin");
      expect(stdout).toContain("Strategy: statistical");
    });
  });

  describe("parseArgs - invalid inputs", () => {
    test("rejects invalid agent", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "invalid-agent"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid agent: invalid-agent");
      expect(stderr).toContain("Must be one of:");
    });

    test("rejects invalid mode", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--mode", "invalid"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid mode: invalid");
      expect(stderr).toContain('Must be "test" or "full"');
    });

    test("rejects invalid MCP tool", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--mcp", "invalid"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid MCP tool: invalid");
      expect(stderr).toContain('Must be "builtin" or "you"');
    });

    test("rejects invalid strategy", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--strategy", "invalid"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid strategy: invalid");
      expect(stderr).toContain("Must be one of:");
    });
  });

  describe("buildResultPath - path generation", () => {
    test("generates path for claude-code builtin test", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "claude-code",
        "--mcp",
        "builtin",
        "--mode",
        "test",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/results/claude-code/builtin-test.jsonl");
    });

    test("generates path for gemini you test", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "gemini",
        "--mcp",
        "you",
        "--mode",
        "test",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/results/gemini/you-test.jsonl");
    });

    test("generates path for droid builtin full", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "droid",
        "--mcp",
        "builtin",
        "--mode",
        "full",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/results/droid/builtin.jsonl");
    });

    test("generates path for codex you full", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "codex",
        "--mcp",
        "you",
        "--mode",
        "full",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/results/codex/you.jsonl");
    });
  });

  describe("buildRunLabel - label generation", () => {
    test("generates label for claude-code builtin", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "claude-code",
        "--mcp",
        "builtin",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude-code-builtin:");
    });

    test("generates label for gemini you", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "gemini", "--mcp", "you", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("gemini-you:");
    });

    test("generates label for droid builtin", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "droid", "--mcp", "builtin", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("droid-builtin:");
    });

    test("generates label for codex you", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "codex", "--mcp", "you", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("codex-you:");
    });
  });

  describe("buildOutputPath - output path logic", () => {
    test("all agents, no MCP filter, weighted, test mode", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--strategy",
        "weighted",
        "--mode",
        "test",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/comparison-all-weighted-test.json");
    });

    test("all agents, no MCP filter, statistical, test mode", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--strategy",
        "statistical",
        "--mode",
        "test",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/comparison-all-statistical-test.json");
    });

    test("all agents, builtin only, weighted, test mode", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--mcp",
        "builtin",
        "--strategy",
        "weighted",
        "--mode",
        "test",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/comparison-builtin-weighted-test.json");
    });

    test("all agents, you only, statistical, test mode", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--mcp",
        "you",
        "--strategy",
        "statistical",
        "--mode",
        "test",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/comparison-you-statistical-test.json");
    });

    test("specific agents (gemini + droid), no MCP filter, weighted, test mode", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "gemini",
        "--agent",
        "droid",
        "--strategy",
        "weighted",
        "--mode",
        "test",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/comparison-gemini-droid-weighted-test.json");
    });

    test("full mode output path", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--strategy",
        "weighted",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/comparison-all-weighted-full.json");
    });
  });

  describe("--dry-run mode", () => {
    test("exits successfully with code 0", async () => {
      const { exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
    });

    test('outputs "[DRY RUN]" prefix', async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toContain("[DRY RUN]");
    });

    test("shows configuration summary", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toContain("Configuration:");
      expect(stdout).toContain("Mode:");
      expect(stdout).toContain("Agents:");
      expect(stdout).toContain("MCP:");
      expect(stdout).toContain("Strategy:");
    });

    test("shows output path", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toContain("Output:");
      expect(stdout).toContain("data/comparison-");
    });

    test("lists runs to compare", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toContain("Runs to compare:");
    });

    test("shows all scenarios for default (all agents, both MCP tools)", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      // Should show 8 runs: 4 agents × 2 MCP tools
      expect(stdout).toContain("claude-code-builtin:");
      expect(stdout).toContain("claude-code-you:");
      expect(stdout).toContain("gemini-builtin:");
      expect(stdout).toContain("gemini-you:");
      expect(stdout).toContain("droid-builtin:");
      expect(stdout).toContain("droid-you:");
      expect(stdout).toContain("codex-builtin:");
      expect(stdout).toContain("codex-you:");
    });

    test("shows scenarios for specific agent and MCP tool", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--agent", "gemini", "--mcp", "builtin", "--dry-run"]);

      // Should show only 1 run: gemini × builtin
      expect(stdout).toContain("gemini-builtin:");
      expect(stdout).not.toContain("gemini-you:");
    });

    test("full configuration with all flags", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "gemini",
        "--mode",
        "full",
        "--mcp",
        "you",
        "--strategy",
        "statistical",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("[DRY RUN]");
      expect(stdout).toContain("Mode: full");
      expect(stdout).toContain("Agents: gemini");
      expect(stdout).toContain("MCP: you");
      expect(stdout).toContain("Strategy: statistical");
      expect(stdout).toContain("gemini-you:");
      expect(stdout).toContain("data/comparison-gemini-statistical-full.json");
    });
  });
});
