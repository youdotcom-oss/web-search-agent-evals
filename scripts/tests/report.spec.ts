import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { parseRunLabel } from "../report.ts";
import { runScript } from "./test-utils.ts";

const SCRIPT_PATH = join(import.meta.dir, "..", "report.ts");

describe("report.ts", () => {
  describe("parseArgs - valid inputs", () => {
    test("dry-run exits 0 with config output", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("[DRY RUN] Would generate REPORT.md");
      expect(stdout).toContain("Report Configuration:");
    });

    test("accepts --run-date flag", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--run-date", "2026-02-18", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("2026-02-18");
    });

    test("dry-run output shows correct paths for given date", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--run-date", "2026-02-18", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Comparisons: data/comparisons/2026-02-18");
      expect(stdout).toContain("Results:    data/results/2026-02-18");
      expect(stdout).toContain("Output:     data/comparisons/2026-02-18/REPORT.md");
    });

    test("accepts --output flag", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--run-date",
        "2026-02-18",
        "--output",
        "/tmp/custom-report.md",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("/tmp/custom-report.md");
    });

    test("accepts -o shorthand", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--run-date",
        "2026-02-18",
        "-o",
        "/tmp/custom-report.md",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("/tmp/custom-report.md");
    });

    test("auto-detects latest date when --run-date omitted", async () => {
      // data/comparisons/ has 2026-02-18 which should be auto-detected
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      // Should pick up a date from data/comparisons/
      expect(stdout).toMatch(/Run date:\s+\d{4}-\d{2}-\d{2}/);
    });

    test("--help flag exits 0 with usage text", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--help"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("--run-date");
      expect(stdout).toContain("--output");
      expect(stdout).toContain("--dry-run");
    });

    test("-h shorthand shows help", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["-h"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("--run-date");
    });
  });

  describe("error handling", () => {
    test("fails when run-date directory does not exist", async () => {
      const { exitCode } = await runScript(SCRIPT_PATH, ["--run-date", "1999-01-01"]);

      expect(exitCode).toBe(1);
    });
  });

  describe("parseRunLabel", () => {
    test("parses simple agent-provider label", () => {
      expect(parseRunLabel("gemini-you")).toEqual({ agent: "gemini", provider: "you" });
    });

    test("parses agent with hyphen (claude-code)", () => {
      expect(parseRunLabel("claude-code-builtin")).toEqual({ agent: "claude-code", provider: "builtin" });
    });

    test("parses claude-code with MCP provider", () => {
      expect(parseRunLabel("claude-code-you")).toEqual({ agent: "claude-code", provider: "you" });
    });

    test("parses provider containing a hyphen", () => {
      // A future MCP key like "some-provider" should not break parsing
      expect(parseRunLabel("gemini-some-provider")).toEqual({ agent: "gemini", provider: "some-provider" });
    });

    test("throws for unknown agent prefix", () => {
      expect(() => parseRunLabel("unknown-agent-builtin")).toThrow("Invalid run label format");
    });
  });

  describe("dry-run output format", () => {
    test("shows [DRY RUN] prefix", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--dry-run"]);
      expect(stdout).toContain("[DRY RUN]");
    });

    test("shows all four config fields", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["--run-date", "2026-02-18", "--dry-run"]);
      expect(stdout).toContain("Run date:");
      expect(stdout).toContain("Comparisons:");
      expect(stdout).toContain("Results:");
      expect(stdout).toContain("Output:");
    });
  });
});
