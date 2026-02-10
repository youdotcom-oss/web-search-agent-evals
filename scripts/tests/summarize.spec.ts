import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runScript } from "./test-utils.ts";

const SCRIPT_PATH = join(import.meta.dir, "..", "summarize.ts");
const FIXTURE_DIR = join(import.meta.dir, "fixtures", "data");

describe("summarize.ts", () => {
  describe("parseArgs - valid inputs", () => {
    test("shows help message", async () => {
      const { exitCode, stderr } = await runScript(SCRIPT_PATH, ["--help"]);

      expect(exitCode).toBe(0);
      expect(stderr).toContain("Generate markdown summary");
      expect(stderr).toContain("--mode");
      expect(stderr).toContain("--run-date");
      expect(stderr).toContain("--output");
    });

    test("accepts --mode full", async () => {
      const { exitCode } = await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--fixture-dir",
        FIXTURE_DIR,
        "--output",
        "/tmp/test-summary.md",
      ]);

      expect(exitCode).toBe(0);
    });

    test("accepts --mode test", async () => {
      // Test mode will fail without comparison data, but should parse args
      const { stderr } = await runScript(SCRIPT_PATH, ["--mode", "test"]);

      // Error is expected due to missing comparison data
      expect(stderr).toContain("Could not load weighted comparison");
    });

    test("accepts --run-date option", async () => {
      const { exitCode } = await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--run-date",
        "2026-01-24",
        "--fixture-dir",
        FIXTURE_DIR,
        "--output",
        "/tmp/test-summary-dated.md",
      ]);

      expect(exitCode).toBe(0);
    });

    test("accepts --output option", async () => {
      const customOutput = "/tmp/custom-summary.md";
      const { exitCode, stdout } = await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--fixture-dir",
        FIXTURE_DIR,
        "--output",
        customOutput,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain(customOutput);
    });

    test("accepts -o shorthand for output", async () => {
      const customOutput = "/tmp/custom-summary-short.md";
      const { exitCode, stdout } = await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--fixture-dir",
        FIXTURE_DIR,
        "-o",
        customOutput,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain(customOutput);
    });

    test("accepts --input for custom comparison file", async () => {
      const inputFile = join(FIXTURE_DIR, "comparisons/runs/2026-01-24/all-weighted.json");
      const outputPath = "/tmp/test-input-summary.md";
      const { exitCode, stdout } = await runScript(SCRIPT_PATH, ["--input", inputFile, "--output", outputPath]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Input:");
      expect(stdout).toContain(inputFile);
    });

    test("accepts -i shorthand for input", async () => {
      const inputFile = join(FIXTURE_DIR, "comparisons/runs/2026-01-24/all-weighted.json");
      const outputPath = "/tmp/test-input-short-summary.md";
      const { exitCode, stdout } = await runScript(SCRIPT_PATH, ["-i", inputFile, "-o", outputPath]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Input:");
    });
  });

  describe("parseArgs - invalid inputs", () => {
    test("rejects invalid mode", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--mode", "invalid"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid mode: invalid");
      expect(stderr).toContain("Must be 'test' or 'full'");
    });
  });

  describe("summary generation - fixture data", () => {
    test("generates summary for full run with fixture data", async () => {
      const outputPath = "/tmp/test-full-summary.md";
      const { exitCode, stdout } = await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--run-date",
        "2026-01-24",
        "--fixture-dir",
        FIXTURE_DIR,
        "--output",
        outputPath,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Generating summary");
      expect(stdout).toContain("Mode: full");
      expect(stdout).toContain("Run date: 2026-01-24");
      expect(stdout).toContain("Summary written to:");
      expect(stdout).toContain(outputPath);

      // Verify the file was created
      const file = Bun.file(outputPath);
      expect(await file.exists()).toBe(true);

      const content = await file.text();

      // Check for expected sections (performance/reliability sections are conditional)
      expect(content).toContain("# Web Search Agent Evaluation Summary");
      expect(content).toContain("## Executive Summary");
      expect(content).toContain("## Quality Rankings");
      expect(content).toContain("## MCP Tool Impact Analysis");
      expect(content).toContain("## Recommendations");

      // Check for specific data from fixtures (fixture has 2 prompts)
      expect(content).toContain("**Prompts:** 2");
    });

    test("includes correct metadata in summary", async () => {
      const outputPath = "/tmp/test-metadata-summary.md";
      await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--run-date",
        "2026-01-24",
        "--fixture-dir",
        FIXTURE_DIR,
        "--output",
        outputPath,
      ]);

      const content = await Bun.file(outputPath).text();

      expect(content).toContain("**Mode:** Full evaluation");
      expect(content).toContain("**Prompts:** 2");
    });

    test("includes quality rankings table", async () => {
      const outputPath = "/tmp/test-quality-summary.md";
      await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--run-date",
        "2026-01-24",
        "--fixture-dir",
        FIXTURE_DIR,
        "--output",
        outputPath,
      ]);

      const content = await Bun.file(outputPath).text();

      expect(content).toMatch(/\| Rank \| Agent \+ Search \| Avg Score \|/);
      expect(content).toContain("claude-code-builtin");
      expect(content).toContain("gemini-you");
    });

    test("includes performance rankings when data is available", async () => {
      const outputPath = "/tmp/test-perf-summary.md";
      await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--run-date",
        "2026-01-24",
        "--fixture-dir",
        FIXTURE_DIR,
        "--output",
        outputPath,
      ]);

      const content = await Bun.file(outputPath).text();

      // Performance section should be present when data is available
      expect(content).toContain("## Performance Rankings");
      expect(content).toContain("P50");
      expect(content).toContain("P90");
      expect(content).toContain("**Fastest:**");
    });

    test("includes reliability metrics when data is available", async () => {
      const outputPath = "/tmp/test-reliability-summary.md";
      await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--run-date",
        "2026-01-24",
        "--fixture-dir",
        FIXTURE_DIR,
        "--output",
        outputPath,
      ]);

      const content = await Bun.file(outputPath).text();

      // Reliability section should be present when data is available
      expect(content).toContain("## Reliability Metrics");
      expect(content).toContain("Tool Error Rate");
      expect(content).toContain("Completion Rate");
    });

    test("includes MCP impact analysis", async () => {
      const outputPath = "/tmp/test-mcp-summary.md";
      await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--run-date",
        "2026-01-24",
        "--fixture-dir",
        FIXTURE_DIR,
        "--output",
        outputPath,
      ]);

      const content = await Bun.file(outputPath).text();

      expect(content).toContain("## MCP Tool Impact Analysis");
      expect(content).toMatch(/\| Agent \| Quality \(builtin → MCP\) \| Speed \(builtin → MCP\) \|/);
    });

    test("includes recommendations section", async () => {
      const outputPath = "/tmp/test-recommendations-summary.md";
      await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--run-date",
        "2026-01-24",
        "--fixture-dir",
        FIXTURE_DIR,
        "--output",
        outputPath,
      ]);

      const content = await Bun.file(outputPath).text();

      expect(content).toContain("## Recommendations");
      expect(content).toContain("### For Production Use");
      expect(content).toContain("### Areas for Improvement");
      expect(content).toContain("**Best Quality:**");
      // Note: "**Fastest:**" requires performance data, omitted with fixture
    });

    test("includes confidence intervals in MCP impact analysis when available", async () => {
      const outputPath = "/tmp/test-confidence-intervals-summary.md";
      await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--run-date",
        "2026-01-24",
        "--fixture-dir",
        FIXTURE_DIR,
        "--output",
        outputPath,
      ]);

      const content = await Bun.file(outputPath).text();

      // Should have MCP Tool Impact Analysis section
      expect(content).toContain("## MCP Tool Impact Analysis");

      // Should contain confidence intervals in the format: "± X.X%"
      expect(content).toMatch(/±\s+\d+\.\d+%/);

      // Should show all three metrics with CIs
      expect(content).toContain("Quality (builtin → MCP)");
      expect(content).toContain("Speed (builtin → MCP)");
      expect(content).toContain("Reliability (builtin → MCP)");

      // Verify the format includes arrows and percentages
      expect(content).toMatch(/[↑↓→]\s+\d+\.\d+%\s+±\s+\d+\.\d+%/);
    });
  });

  describe("output path logic", () => {
    test("default full mode output path", async () => {
      const { stdout } = await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--run-date",
        "2026-01-24",
        "--fixture-dir",
        FIXTURE_DIR,
      ]);

      expect(stdout).toContain("comparisons/runs/2026-01-24/SUMMARY.md");
    });

    test("custom output path", async () => {
      const customPath = "/tmp/my-custom-summary.md";
      const { stdout } = await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--run-date",
        "2026-01-24",
        "--fixture-dir",
        FIXTURE_DIR,
        "--output",
        customPath,
      ]);

      expect(stdout).toContain(customPath);
    });
  });

  describe("error handling", () => {
    test("fails when comparison file not found", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--mode", "test"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Could not load weighted comparison");
    });

    test("shows helpful message on missing data", async () => {
      const { stderr } = await runScript(SCRIPT_PATH, ["--mode", "full", "--run-date", "nonexistent-date"]);

      expect(stderr).toContain("Error");
    });
  });

  describe("dry-run mode", () => {
    test("shows configuration without writing files", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--run-date",
        "2026-01-24",
        "--fixture-dir",
        FIXTURE_DIR,
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("[DRY RUN]");
      expect(stdout).toContain("Configuration:");
      expect(stdout).toContain("Mode: full");
      expect(stdout).toContain("Run date: 2026-01-24");
      expect(stdout).toContain("Output path:");
      expect(stdout).toContain("Would generate summary from comparison data");
      expect(stdout).toContain("Would write to:");
    });

    test("does not write files in dry-run mode", async () => {
      const outputPath = "/tmp/dry-run-test-summary.md";

      // Remove file if it exists
      try {
        const exists = await Bun.file(outputPath).exists();
        if (exists) {
          await Bun.$`rm ${outputPath}`.quiet();
        }
      } catch {}

      const { exitCode } = await runScript(SCRIPT_PATH, [
        "--mode",
        "full",
        "--run-date",
        "2026-01-24",
        "--fixture-dir",
        FIXTURE_DIR,
        "--output",
        outputPath,
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(await Bun.file(outputPath).exists()).toBe(false);
    });
  });

  describe("help output", () => {
    test("shows help with --help flag", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--help"]);

      expect(exitCode).toBe(0);
      expect(stderr).toContain("Generate markdown summary");
      expect(stderr).toContain("Usage:");
      expect(stderr).toContain("Options:");
      expect(stderr).toContain("--input");
    });

    test("shows help with -h flag", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["-h"]);

      expect(exitCode).toBe(0);
      expect(stderr).toContain("Generate markdown summary");
    });
  });

  describe("trial data handling", () => {
    test("handles trial data with capability metrics", async () => {
      const outputPath = "/tmp/test-trials-summary.md";
      const trialsInput = join(FIXTURE_DIR, "comparisons/trials/2026-01-29/all-weighted.json");

      // Check if trials fixture exists
      const trialsFile = Bun.file(trialsInput);
      if (!(await trialsFile.exists())) {
        console.warn(`Skipping trial test: ${trialsInput} not found`);
        return;
      }

      const { exitCode } = await runScript(SCRIPT_PATH, ["--input", trialsInput, "--output", outputPath]);

      expect(exitCode).toBe(0);

      const content = await Bun.file(outputPath).text();

      // Should include capability metrics section for trial data
      expect(content).toContain("## Capability Metrics (Pass@k)");
      expect(content).toContain("Avg Pass@k");
      expect(content).toContain("Median Pass@k");
    });

    test("shows flakiness analysis with correct table format", async () => {
      const outputPath = "/tmp/test-flakiness-summary.md";
      const trialsInput = join(FIXTURE_DIR, "comparisons/trials/2026-01-29/all-weighted.json");

      // Check if trials fixture exists
      const trialsFile = Bun.file(trialsInput);
      if (!(await trialsFile.exists())) {
        console.warn(`Skipping flakiness test: ${trialsInput} not found`);
        return;
      }

      const { exitCode } = await runScript(SCRIPT_PATH, ["--input", trialsInput, "--output", outputPath]);

      expect(exitCode).toBe(0);

      const content = await Bun.file(outputPath).text();

      // Should include flakiness analysis
      expect(content).toContain("## Flakiness Analysis");

      // Verify table header is correctly formatted (no escaped newline)
      expect(content).toContain(
        "| Agent + Search | Avg Flakiness | Median Flakiness | Flaky Prompt Count |\n|----------------|---------------|------------------|--------------------|\n",
      );

      // Should NOT contain the escaped newline bug
      expect(content).not.toContain("\\n");
    });

    test("shows trial-specific recommendations", async () => {
      const outputPath = "/tmp/test-trial-recommendations-summary.md";
      const trialsInput = join(FIXTURE_DIR, "comparisons/trials/2026-01-29/all-weighted.json");

      // Check if trials fixture exists
      const trialsFile = Bun.file(trialsInput);
      if (!(await trialsFile.exists())) {
        console.warn(`Skipping trial recommendations test: ${trialsInput} not found`);
        return;
      }

      const { exitCode } = await runScript(SCRIPT_PATH, ["--input", trialsInput, "--output", outputPath]);

      expect(exitCode).toBe(0);

      const content = await Bun.file(outputPath).text();

      // Should show capability-based recommendations instead of quality
      expect(content).toContain("**Best Capability:**");
      expect(content).toContain("Pass@k");

      // Should show "Areas for Improvement" section
      expect(content).toContain("### Areas for Improvement");
      expect(content).toContain("**Lowest Capability:**");
    });
  });
});
