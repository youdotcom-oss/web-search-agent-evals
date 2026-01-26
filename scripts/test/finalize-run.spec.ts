import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { finalizeRun } from "../finalize-run.ts";

const TEST_DIR = join(import.meta.dir, "..", "..", "test-tmp-finalize");
const TEST_DATA_DIR = join(TEST_DIR, "data");
const TEST_SCHEMAS_DIR = join(TEST_DIR, "schemas");

describe("finalize-run.ts", () => {
  beforeEach(() => {
    // Clean up and recreate test directory
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DATA_DIR, { recursive: true });
    mkdirSync(TEST_SCHEMAS_DIR, { recursive: true });

    // Create mock agent schemas
    const mockAgents = ["agent-a", "agent-b", "agent-c"];
    for (const agent of mockAgents) {
      const schema = { name: agent, command: [`${agent}-cli`] };
      writeFileSync(join(TEST_SCHEMAS_DIR, `${agent}.json`), JSON.stringify(schema));
    }

    // Create mock run data
    const runDate = "2026-01-15";
    const runDir = join(TEST_DATA_DIR, "runs", runDate);
    mkdirSync(runDir, { recursive: true });

    // Create mock result files for each agent and provider
    for (const agent of mockAgents) {
      const agentDir = join(runDir, agent);
      mkdirSync(agentDir, { recursive: true });

      // Mock 10 prompts
      const mockResults = Array.from({ length: 10 }, (_, i) =>
        JSON.stringify({ id: `test-${i + 1}`, output: "result", score: 0.8 }),
      ).join("\n");

      writeFileSync(join(agentDir, "builtin.jsonl"), mockResults);
      writeFileSync(join(agentDir, "you.jsonl"), mockResults);
    }
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("manifest creation", () => {
    test("creates manifest entry for existing run", async () => {
      const entry = await finalizeRun({
        runDate: "2026-01-15",
        dataDir: TEST_DATA_DIR,
        agentSchemasDir: TEST_SCHEMAS_DIR,
      });

      expect(entry.date).toBe("2026-01-15");
      expect(entry.mode).toBe("full");
      expect(entry.agents).toEqual(["agent-a", "agent-b", "agent-c"]);
      expect(entry.searchProviders).toEqual(["builtin", "you"]);
      expect(entry.promptCount).toBe(10);
      expect(entry.commit).toBeTruthy();
      expect(typeof entry.commit).toBe("string");
    });

    test("writes manifest file", async () => {
      await finalizeRun({
        runDate: "2026-01-15",
        dataDir: TEST_DATA_DIR,
        agentSchemasDir: TEST_SCHEMAS_DIR,
      });

      const manifestPath = join(TEST_DATA_DIR, "MANIFEST.jsonl");
      const manifestFile = Bun.file(manifestPath);
      expect(await manifestFile.exists()).toBe(true);

      const content = await manifestFile.text();
      const entries = content.trim().split("\n").map(JSON.parse);

      expect(entries).toHaveLength(1);
      expect(entries[0].date).toBe("2026-01-15");
    });

    test("writes latest.json pointer", async () => {
      await finalizeRun({
        runDate: "2026-01-15",
        dataDir: TEST_DATA_DIR,
        agentSchemasDir: TEST_SCHEMAS_DIR,
      });

      const latestPath = join(TEST_DATA_DIR, "latest.json");
      const latestFile = Bun.file(latestPath);
      expect(await latestFile.exists()).toBe(true);

      const latest = await latestFile.json();
      expect(latest.date).toBe("2026-01-15");
      expect(latest.path).toBe("runs/2026-01-15");
      expect(latest.mode).toBe("full");
      expect(latest.promptCount).toBe(10);
    });

    test("updates existing manifest entry for same date", async () => {
      // Create initial entry
      await finalizeRun({
        runDate: "2026-01-15",
        dataDir: TEST_DATA_DIR,
        agentSchemasDir: TEST_SCHEMAS_DIR,
      });

      // Add a different date
      const runDate2 = "2026-01-16";
      const runDir2 = join(TEST_DATA_DIR, "runs", runDate2);
      mkdirSync(runDir2, { recursive: true });
      const agentDir2 = join(runDir2, "agent-a");
      mkdirSync(agentDir2, { recursive: true });
      writeFileSync(join(agentDir2, "builtin.jsonl"), JSON.stringify({ id: "test" }));

      await finalizeRun({
        runDate: runDate2,
        dataDir: TEST_DATA_DIR,
        agentSchemasDir: TEST_SCHEMAS_DIR,
      });

      // Update first date
      await finalizeRun({
        runDate: "2026-01-15",
        dataDir: TEST_DATA_DIR,
        agentSchemasDir: TEST_SCHEMAS_DIR,
      });

      const manifestFile = Bun.file(join(TEST_DATA_DIR, "MANIFEST.jsonl"));
      const content = await manifestFile.text();
      const entries = content.trim().split("\n").map(JSON.parse);

      // Should have 2 entries (not 3)
      expect(entries).toHaveLength(2);
      expect(entries.map((e: { date: string }) => e.date).sort()).toEqual(["2026-01-15", "2026-01-16"]);
    });
  });

  describe("error handling", () => {
    test("throws if run directory doesn't exist", async () => {
      await expect(
        finalizeRun({
          runDate: "2099-12-31",
          dataDir: TEST_DATA_DIR,
          agentSchemasDir: TEST_SCHEMAS_DIR,
        }),
      ).rejects.toThrow("No full run found");
    });

    test("throws if no agent schemas found", async () => {
      const emptySchemaDir = join(TEST_DIR, "empty-schemas");
      mkdirSync(emptySchemaDir, { recursive: true });

      await expect(
        finalizeRun({
          runDate: "2026-01-15",
          dataDir: TEST_DATA_DIR,
          agentSchemasDir: emptySchemaDir,
        }),
      ).rejects.toThrow("No agent schemas found");
    });
  });

  describe("dynamic discovery", () => {
    test("discovers all agents from schemas", async () => {
      const entry = await finalizeRun({
        runDate: "2026-01-15",
        dataDir: TEST_DATA_DIR,
        agentSchemasDir: TEST_SCHEMAS_DIR,
      });

      expect(entry.agents).toEqual(["agent-a", "agent-b", "agent-c"]);
    });

    test("discovers all search providers", async () => {
      const entry = await finalizeRun({
        runDate: "2026-01-15",
        dataDir: TEST_DATA_DIR,
        agentSchemasDir: TEST_SCHEMAS_DIR,
      });

      // Should include builtin + MCP_SERVERS keys (you)
      expect(entry.searchProviders).toContain("builtin");
      expect(entry.searchProviders).toContain("you");
    });
  });

  describe("prompt counting", () => {
    test("counts prompts from first agent/provider file", async () => {
      const entry = await finalizeRun({
        runDate: "2026-01-15",
        dataDir: TEST_DATA_DIR,
        agentSchemasDir: TEST_SCHEMAS_DIR,
      });

      expect(entry.promptCount).toBe(10);
    });
  });

  describe("manifest schema validation", () => {
    test("includes all required fields", async () => {
      const entry = await finalizeRun({
        runDate: "2026-01-15",
        dataDir: TEST_DATA_DIR,
        agentSchemasDir: TEST_SCHEMAS_DIR,
      });

      expect(entry.date).toBeDefined();
      expect(entry.mode).toBe("full");
      expect(Array.isArray(entry.agents)).toBe(true);
      expect(Array.isArray(entry.searchProviders)).toBe(true);
      expect(typeof entry.promptCount).toBe("number");
      expect(typeof entry.commit).toBe("string");
    });

    test("validates date format", async () => {
      // Valid format should work
      await expect(
        finalizeRun({
          runDate: "2026-01-15",
          dataDir: TEST_DATA_DIR,
          agentSchemasDir: TEST_SCHEMAS_DIR,
        }),
      ).resolves.toBeTruthy();

      // Invalid format should throw during validation
      const invalidRunDir = join(TEST_DATA_DIR, "runs", "invalid-date");
      mkdirSync(invalidRunDir, { recursive: true });
      const agentDir = join(invalidRunDir, "agent-a");
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(agentDir, "builtin.jsonl"), JSON.stringify({ id: "test" }));

      await expect(
        finalizeRun({
          runDate: "invalid-date",
          dataDir: TEST_DATA_DIR,
          agentSchemasDir: TEST_SCHEMAS_DIR,
        }),
      ).rejects.toThrow();
    });
  });
});
