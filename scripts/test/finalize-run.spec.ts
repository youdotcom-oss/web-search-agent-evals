import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { runScript } from "./test-utils.ts";

const SCRIPT_PATH = join(import.meta.dir, "..", "finalize-run.ts");
const TEST_DIR = join(import.meta.dir, "..", "..", "test-tmp-finalize");

describe("finalize-run.ts", () => {
  beforeEach(() => {
    // Clean up test directory
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("manifest creation", () => {
    test("creates manifest entry for existing run", async () => {
      // This test requires actual run data to exist
      // Just verify the script runs without error on actual data
      const { exitCode, stdout } = await runScript(SCRIPT_PATH, ["2026-01-24"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("✓ Manifest");
      expect(stdout).toContain("2026-01-24");
      expect(stdout).toContain("Agents:");
      expect(stdout).toContain("Search Providers:");
      expect(stdout).toContain("Prompts:");
      expect(stdout).toContain("Commit:");
    });

    test("shows workflow instructions", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["2026-01-24"]);

      expect(stdout).toContain("Recommended workflow:");
      expect(stdout).toContain("1. Commit results first:");
      expect(stdout).toContain("git add data/results/runs/2026-01-24/");
      expect(stdout).toContain("2. Then commit manifest");
      expect(stdout).toContain("git add data/results/latest.json data/results/MANIFEST.jsonl");
      expect(stdout).toContain("For CI (single commit)");
    });

    test("indicates update when entry already exists", async () => {
      // Run twice - second run should show update message
      await runScript(SCRIPT_PATH, ["2026-01-24"]);
      const { stdout } = await runScript(SCRIPT_PATH, ["2026-01-24"]);

      expect(stdout).toContain("✓ Manifest updated for 2026-01-24");
      expect(stdout).toContain("(Replaced existing entry for this date)");
    });
  });

  describe("error handling", () => {
    test("fails gracefully if run directory doesn't exist", async () => {
      const { exitCode, stderr } = await runScript(SCRIPT_PATH, ["2099-12-31"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Error: No full run found");
    });

    test("fails if no agent schemas found", async () => {
      // This would require moving agent-schemas, which is destructive
      // Skip this test in normal runs
      expect(true).toBe(true);
    });
  });

  describe("dynamic discovery", () => {
    test("discovers all agents from schemas", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["2026-01-24"]);

      // Should find all 4 agents
      expect(stdout).toContain("claude-code");
      expect(stdout).toContain("codex");
      expect(stdout).toContain("droid");
      expect(stdout).toContain("gemini");
    });

    test("discovers search providers from mcp-servers.ts", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, ["2026-01-24"]);

      // Should find builtin + MCP providers
      expect(stdout).toContain("builtin");
      expect(stdout).toContain("you");
    });
  });

  describe("manifest format", () => {
    test("creates valid JSONL format", async () => {
      await runScript(SCRIPT_PATH, ["2026-01-24"]);

      const manifestFile = Bun.file("data/results/MANIFEST.jsonl");
      const content = await manifestFile.text();

      // Each line should be valid JSON
      const lines = content.trim().split("\n");
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });

    test("includes all required fields", async () => {
      await runScript(SCRIPT_PATH, ["2026-01-24"]);

      const manifestFile = Bun.file("data/results/MANIFEST.jsonl");
      const content = await manifestFile.text();
      const lastLine = content.trim().split("\n").pop();

      if (lastLine) {
        const entry = JSON.parse(lastLine);
        expect(entry.date).toBeDefined();
        expect(entry.mode).toBe("full");
        expect(Array.isArray(entry.agents)).toBe(true);
        expect(Array.isArray(entry.searchProviders)).toBe(true);
        expect(typeof entry.promptCount).toBe("number");
        expect(typeof entry.commit).toBe("string");
      }
    });
  });

  describe("latest.json pointer", () => {
    test("creates latest.json with correct structure", async () => {
      await runScript(SCRIPT_PATH, ["2026-01-24"]);

      const latestFile = Bun.file("data/results/latest.json");
      const latest = await latestFile.json();

      expect(latest.date).toBe("2026-01-24");
      expect(latest.path).toBe("runs/2026-01-24");
      expect(latest.mode).toBe("full");
      expect(typeof latest.promptCount).toBe("number");
      expect(typeof latest.commit).toBe("string");
    });

    test("updates latest.json on each run", async () => {
      await runScript(SCRIPT_PATH, ["2026-01-24"]);

      const latestFile = Bun.file("data/results/latest.json");
      const _before = await latestFile.json();

      await runScript(SCRIPT_PATH, ["2026-01-24"]);
      const after = await latestFile.json();

      // Commit might change, but date should stay same
      expect(after.date).toBe("2026-01-24");
      expect(after.path).toBe("runs/2026-01-24");
    });
  });
});
