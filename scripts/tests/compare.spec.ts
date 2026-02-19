import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runScript } from "./test-utils.ts";

const SCRIPT_PATH = join(import.meta.dir, "..", "compare.ts");

describe("compare.ts", () => {
  describe("parseArgs - valid inputs", () => {
    test("uses defaults: all agents, all providers, default type, weighted", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("[DRY RUN]");
      expect(stdout).toContain("Trial Type: default");
      expect(stdout).toContain("Strategy: weighted");
    });

    test("accepts --strategy statistical", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--strategy", "statistical", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Strategy: statistical");
    });

    test("accepts --strategy weighted", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--strategy", "weighted", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Strategy: weighted");
    });

    test("accepts --trial-type capability", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "capability", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Trial Type: capability");
    });

    test("accepts --trial-type regression", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "regression", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Trial Type: regression");
    });

    test("accepts --agent flag", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "droid", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("droid-");
    });

    test("accepts --search-provider builtin", async () => {
      const { exitCode } = await runScript(SCRIPT_PATH, ["--search-provider", "builtin", "--dry-run"]);

      expect(exitCode).toBe(0);
    });

    test("accepts --run-date flag", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--run-date", "2026-02-18", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("2026-02-18");
    });

    test("accepts all flags combined", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "droid",
        "--search-provider",
        "builtin",
        "--trial-type",
        "default",
        "--strategy",
        "statistical",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Trial Type: default");
      expect(stdout).toContain("Strategy: statistical");
      expect(stdout).toContain("droid");
    });
  });

  describe("parseArgs - invalid inputs", () => {
    test("rejects invalid agent", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "invalid-agent"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid agent: invalid-agent");
      expect(stderr).toContain("Must be one of:");
    });

    test("rejects invalid search provider", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--search-provider", "invalid"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid search provider: invalid");
      expect(stderr).toContain("Must be one of:");
    });

    test("rejects invalid strategy", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--strategy", "invalid"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid strategy: invalid");
      expect(stderr).toContain("Must be one of:");
    });

    test("rejects invalid trial type", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "invalid"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid trial type: invalid");
      expect(stderr).toContain("Must be");
    });
  });

  describe("output path generation", () => {
    test("dry-run output path includes date and strategy", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--run-date", "2026-02-18", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("data/comparisons/2026-02-18/");
      expect(stdout).toContain("-weighted.json");
    });

    test("statistical strategy suffix in output path", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--run-date",
        "2026-02-18",
        "--strategy",
        "statistical",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("-statistical.json");
    });

    test("capability type adds suffix to output path", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--run-date",
        "2026-02-18",
        "--trial-type",
        "capability",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("-capability.json");
    });
  });

  describe("dry-run mode", () => {
    test("exits with code 0", async () => {
      const { exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);
      expect(exitCode).toBe(0);
    });

    test("outputs [DRY RUN] prefix", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);
      expect(stdout).toContain("[DRY RUN]");
    });

    test("shows comparison header with date", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--run-date", "2026-02-18", "--dry-run"]);
      expect(stdout).toContain("COMPARISON - 2026-02-18");
    });

    test("shows found scenarios", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--run-date", "2026-02-18", "--dry-run"]);
      expect(stdout).toContain("Found");
      expect(stdout).toContain("scenarios:");
    });

    test("shows output path", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);
      expect(stdout).toContain("Output:");
      expect(stdout).toContain("data/comparisons/");
    });

    test("shows command", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);
      expect(stdout).toContain("Command: bunx @plaited/agent-eval-harness compare");
    });
  });
});
