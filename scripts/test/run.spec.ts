import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runScript } from "./test-utils.ts";

const SCRIPT_PATH = join(import.meta.dir, "..", "run.ts");

describe("run.ts", () => {
  describe("parseArgs - valid inputs", () => {
    test("uses defaults: all agents, no overrides", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Agents: claude-code, gemini, droid, codex");
      expect(stdout).toContain("MCP tools: builtin, you");
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
      expect(stdout).toContain("Running in full mode");
    });

    test("accepts --mode test", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--mode", "test", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Running in test mode");
    });

    test("accepts --mcp builtin", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--mcp", "builtin", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("MCP tools: builtin");
    });

    test("accepts --mcp you", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--mcp", "you", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("MCP tools: you");
    });

    test("accepts all flags combined", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "gemini",
        "--mode",
        "full",
        "--mcp",
        "builtin",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Running in full mode");
      expect(stdout).toContain("Agents: gemini");
      expect(stdout).toContain("MCP tools: builtin");
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
  });

  describe("detectCurrentMode", () => {
    test("detects mode from docker/entrypoint file", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      // Should show either "Running in test mode" or "Running in full mode"
      expect(stdout).toMatch(/Running in (test|full) mode/);
    });

    test("mode override takes precedence over detected mode", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--mode", "full", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Running in full mode");
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

    test("shows execution plan with docker compose commands", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toContain("[DRY RUN] Execution plan:");
      expect(stdout).toContain("docker compose run --rm");
    });

    test("shows message that no services were executed", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toContain("[DRY RUN] No services were executed.");
    });

    test("shows running in detected mode", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toMatch(/Running in (test|full) mode/);
    });

    test("shows agent list", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toContain("Agents:");
    });

    test("shows MCP tools list", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toContain("MCP tools:");
    });

    test("shows scenario count for default (4 agents × 2 MCP = 8)", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toContain("[DRY RUN] Would run 8 scenarios");
    });

    test("shows scenario count for single agent (1 × 2 MCP = 2)", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--agent", "gemini", "--dry-run"]);

      expect(stdout).toContain("[DRY RUN] Would run 2 scenarios");
    });

    test("shows scenario count for single MCP (4 agents × 1 = 4)", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--mcp", "builtin", "--dry-run"]);

      expect(stdout).toContain("[DRY RUN] Would run 4 scenarios");
    });

    test("shows scenario count for specific agent + MCP (1 × 1 = 1)", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--agent", "gemini", "--mcp", "builtin", "--dry-run"]);

      expect(stdout).toContain("[DRY RUN] Would run 1 scenarios");
    });

    test("shows all scenarios in execution matrix for default", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      // Should show 8 scenarios: 4 agents × 2 MCP tools
      expect(stdout).toMatch(/\[1\/8\] claude-code-builtin/);
      expect(stdout).toMatch(/\[2\/8\] claude-code-you/);
      expect(stdout).toMatch(/\[3\/8\] gemini-builtin/);
      expect(stdout).toMatch(/\[4\/8\] gemini-you/);
      expect(stdout).toMatch(/\[5\/8\] droid-builtin/);
      expect(stdout).toMatch(/\[6\/8\] droid-you/);
      expect(stdout).toMatch(/\[7\/8\] codex-builtin/);
      expect(stdout).toMatch(/\[8\/8\] codex-you/);
    });

    test("shows docker compose commands with MCP_TOOL env var", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--agent", "gemini", "--dry-run"]);

      expect(stdout).toContain("-e MCP_TOOL=builtin");
      expect(stdout).toContain("-e MCP_TOOL=you");
    });

    test("shows docker compose commands with DATASET env var", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--mode", "test", "--dry-run"]);

      expect(stdout).toContain("-e DATASET=test");
    });

    test("docker commands for specific agent and MCP", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, [
        "--agent",
        "gemini",
        "--mcp",
        "builtin",
        "--mode",
        "full",
        "--dry-run",
      ]);

      expect(stdout).toContain("[1/1] gemini-builtin");
      expect(stdout).toContain("-e MCP_TOOL=builtin");
      expect(stdout).toContain("-e DATASET=full");
      expect(stdout).toContain("gemini");
    });

    test("full configuration with all flags", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "gemini",
        "--agent",
        "droid",
        "--mode",
        "full",
        "--mcp",
        "you",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("[DRY RUN]");
      expect(stdout).toContain("Running in full mode");
      expect(stdout).toContain("Agents: gemini, droid");
      expect(stdout).toContain("MCP tools: you");
      expect(stdout).toContain("[DRY RUN] Would run 2 scenarios");
      expect(stdout).toContain("[1/2] gemini-you");
      expect(stdout).toContain("[2/2] droid-you");
      expect(stdout).toContain("-e MCP_TOOL=you");
      expect(stdout).toContain("-e DATASET=full");
    });
  });
});
