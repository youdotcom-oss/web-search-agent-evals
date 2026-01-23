import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runScript } from "./test-utils.ts";

const SCRIPT_PATH = join(import.meta.dir, "..", "run-trials.ts");

describe("run-trials.ts", () => {
  describe("parseArgs - valid inputs", () => {
    test("uses defaults: droid agent, test mode, default type", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Agent: droid");
      expect(stdout).toContain("Mode: test");
      expect(stdout).toContain("Trial type: default");
      expect(stdout).toContain("k: 5");
    });

    test("accepts --agent flag", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "gemini", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Agent: gemini");
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

    test("accepts --type capability", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "capability", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Trial type: capability");
      expect(stdout).toContain("k: 10");
    });

    test("accepts --type regression", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "regression", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Trial type: regression");
      expect(stdout).toContain("k: 3");
    });

    test("accepts --type default", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "default", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Trial type: default");
      expect(stdout).toContain("k: 5");
    });

    test("accepts -k flag with valid number", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["-k", "7", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("k: 7");
    });

    test("accepts all flags combined", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "codex",
        "--mode",
        "full",
        "--type",
        "capability",
        "-k",
        "15",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Agent: codex");
      expect(stdout).toContain("Mode: full");
      expect(stdout).toContain("Trial type: capability");
      expect(stdout).toContain("k: 15");
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

    test("rejects invalid trial type", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--type", "invalid"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid trial type: invalid");
      expect(stderr).toContain('Must be "default", "capability", or "regression"');
    });

    test("rejects invalid k value (zero)", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["-k", "0"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid k value: 0");
      expect(stderr).toContain("Must be a positive integer");
    });

    test("rejects invalid k value (non-numeric)", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["-k", "abc"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid k value: abc");
      expect(stderr).toContain("Must be a positive integer");
    });

    test("rejects invalid k value (negative)", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["-k", "-5"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid k value: -5");
      expect(stderr).toContain("Must be a positive integer");
    });
  });

  describe("getKValue - k value logic", () => {
    test("default type returns k=5", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "default", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("k: 5");
    });

    test("capability type returns k=10", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "capability", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("k: 10");
    });

    test("regression type returns k=3", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "regression", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("k: 3");
    });

    test("override takes precedence for default type", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "default", "-k", "7", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("k: 7");
    });

    test("override takes precedence for capability type", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "capability", "-k", "15", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("k: 15");
    });

    test("override takes precedence for regression type", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "regression", "-k", "1", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("k: 1");
    });
  });

  describe("getOutputPath - output path generation", () => {
    test("default type, test mode", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "droid",
        "--type",
        "default",
        "--mode",
        "test",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/results/trials/droid-test.jsonl");
    });

    test("default type, full mode", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "gemini",
        "--type",
        "default",
        "--mode",
        "full",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/results/trials/gemini-full.jsonl");
    });

    test("capability type (mode ignored)", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "claude-code",
        "--type",
        "capability",
        "--mode",
        "test",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/results/trials/claude-code-capability.jsonl");
    });

    test("regression type (mode ignored)", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "codex",
        "--type",
        "regression",
        "--mode",
        "full",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/results/trials/codex-regression.jsonl");
    });

    test("all agents with capability type", async () => {
      for (const agent of ["claude-code", "gemini", "droid", "codex"]) {
        const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
          "--agent",
          agent,
          "--type",
          "capability",
          "--dry-run",
        ]);

        expect(exitCode).toBe(0);
        expect(stdout).toContain(`data/results/trials/${agent}-capability.jsonl`);
      }
    });

    test("all agents with regression type", async () => {
      for (const agent of ["claude-code", "gemini", "droid", "codex"]) {
        const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
          "--agent",
          agent,
          "--type",
          "regression",
          "--dry-run",
        ]);

        expect(exitCode).toBe(0);
        expect(stdout).toContain(`data/results/trials/${agent}-regression.jsonl`);
      }
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

    test("shows agent, mode, trial type, k value", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toContain("Agent:");
      expect(stdout).toContain("Mode:");
      expect(stdout).toContain("Trial type:");
      expect(stdout).toContain("k:");
    });

    test("shows bunx command that would execute", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toContain("[DRY RUN] Would execute:");
      expect(stdout).toContain("bunx @plaited/agent-eval-harness trials");
    });

    test("command includes correct dataset path for test mode", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--mode", "test", "--dry-run"]);

      expect(stdout).toContain("data/prompts/test.jsonl");
    });

    test("command includes correct dataset path for full mode", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--mode", "full", "--dry-run"]);

      expect(stdout).toContain("data/prompts/full.jsonl");
    });

    test("command includes correct schema path", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--agent", "gemini", "--dry-run"]);

      expect(stdout).toContain("--schema agent-schemas/gemini.json");
    });

    test("command includes correct k value", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["-k", "12", "--dry-run"]);

      expect(stdout).toContain("-k 12");
    });

    test("command includes grader script", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toContain("--grader ./scripts/inline-grader.ts");
    });

    test("command includes output path", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--agent", "droid", "--mode", "test", "--dry-run"]);

      expect(stdout).toContain("-o data/results/trials/droid-test.jsonl");
    });

    test("command includes --progress flag", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(stdout).toContain("--progress");
    });

    test("full configuration with all flags", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "codex",
        "--mode",
        "full",
        "--type",
        "capability",
        "-k",
        "12",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("[DRY RUN]");
      expect(stdout).toContain("Agent: codex");
      expect(stdout).toContain("Mode: full");
      expect(stdout).toContain("Trial type: capability");
      expect(stdout).toContain("k: 12");
      expect(stdout).toContain("bunx @plaited/agent-eval-harness trials");
      expect(stdout).toContain("data/prompts/full.jsonl");
      expect(stdout).toContain("agent-schemas/codex.json");
      expect(stdout).toContain("-k 12");
      expect(stdout).toContain("data/results/trials/codex-capability.jsonl");
    });
  });
});
