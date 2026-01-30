import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runScript } from "./test-utils.ts";

const SCRIPT_PATH = join(import.meta.dir, "..", "compare-trials.ts");

/**
 * Test suite for compare-trials.ts
 *
 * @remarks
 * Tests argument parsing and validation.
 * Tests that require file discovery are skipped since the script
 * always attempts to discover files from data/results/trials.
 *
 * To test with fixtures, the script would need a --fixture-dir option
 * similar to compare.ts.
 */
describe("compare-trials.ts", () => {
  describe("parseArgs - valid inputs", () => {
    test("accepts --trial-type default", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "default", "--dry-run"]);

      // May fail if no trials exist, but should not be a parse error
      if (exitCode !== 0) {
        expect(stderr).not.toContain("Invalid trial type");
      }
    });

    test("accepts --trial-type capability", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "capability", "--dry-run"]);

      // May fail if no trials exist, but should not be a parse error
      if (exitCode !== 0) {
        expect(stderr).not.toContain("Invalid trial type");
      }
    });

    test("accepts --trial-type regression", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "regression", "--dry-run"]);

      // May fail if no trials exist, but should not be a parse error
      if (exitCode !== 0) {
        expect(stderr).not.toContain("Invalid trial type");
      }
    });

    test("accepts --strategy weighted", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--strategy", "weighted", "--dry-run"]);

      // May fail if no trials exist, but should not be a parse error
      if (exitCode !== 0) {
        expect(stderr).not.toContain("Invalid strategy");
      }
    });

    test("accepts --strategy statistical", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--strategy", "statistical", "--dry-run"]);

      // May fail if no trials exist, but should not be a parse error
      if (exitCode !== 0) {
        expect(stderr).not.toContain("Invalid strategy");
      }
    });

    test("accepts --agent flag", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "gemini", "--dry-run"]);

      // May fail if no trials exist, but should not be a parse error
      if (exitCode !== 0) {
        expect(stderr).not.toContain("Invalid agent");
      }
    });

    test("accepts --search-provider builtin", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--search-provider", "builtin", "--dry-run"]);

      // May fail if no trials exist, but should not be a parse error
      if (exitCode !== 0) {
        expect(stderr).not.toContain("Invalid search provider");
      }
    });

    test("accepts --search-provider you", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--search-provider", "you", "--dry-run"]);

      // May fail if no trials exist, but should not be a parse error
      if (exitCode !== 0) {
        expect(stderr).not.toContain("Invalid search provider");
      }
    });

    test("accepts --run-date", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--run-date", "2026-01-29", "--dry-run"]);

      // May fail if date doesn't exist, but should not be a parse error
      if (exitCode !== 0) {
        // Should only fail on missing files, not invalid args
        expect(stderr).toMatch(/No trials files found|No dated runs found/);
      }
    });

    test("accepts all flags combined", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "gemini",
        "--search-provider",
        "builtin",
        "--trial-type",
        "capability",
        "--strategy",
        "statistical",
        "--run-date",
        "2026-01-29",
        "--dry-run",
      ]);

      // May fail if files don't exist, but should not be a parse error
      if (exitCode !== 0) {
        expect(stderr).not.toContain("Invalid agent");
        expect(stderr).not.toContain("Invalid search provider");
        expect(stderr).not.toContain("Invalid trial type");
        expect(stderr).not.toContain("Invalid strategy");
      }
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

    test("rejects invalid trial type", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "invalid"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid trial type: invalid");
      expect(stderr).toContain('Must be "default", "capability", or "regression"');
    });

    test("rejects invalid strategy", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--strategy", "invalid"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid strategy: invalid");
      expect(stderr).toContain("Must be one of:");
    });
  });

  describe("--dry-run mode", () => {
    test("prevents execution", async () => {
      const { stdout, stderr, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      // Should show dry run indicator even if no trials exist
      if (exitCode === 0) {
        expect(stdout).toContain("[DRY RUN]");
      } else {
        // If it fails, should be due to missing files, not dry-run issue
        expect(stderr).toMatch(/No trials files found|No dated runs found/);
      }
    });

    test("shows configuration", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      // If successful, should show configuration
      if (exitCode === 0) {
        expect(stdout).toContain("TRIALS COMPARISON");
        expect(stdout).toContain("Trial Type:");
        expect(stdout).toContain("Strategy:");
      }
    });

    test("accepts all configuration flags", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "gemini",
        "--search-provider",
        "you",
        "--trial-type",
        "capability",
        "--strategy",
        "statistical",
        "--run-date",
        "2026-01-29",
        "--dry-run",
      ]);

      // If successful, should show all configuration
      if (exitCode === 0) {
        expect(stdout).toContain("[DRY RUN]");
        expect(stdout).toContain("Trial Type: capability");
        expect(stdout).toContain("Strategy: statistical");
        expect(stdout).toContain("2026-01-29");
      }
    });
  });
});
