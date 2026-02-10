import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runScript } from "./test-utils.ts";

const SCRIPT_PATH = join(import.meta.dir, "..", "run-trials.ts");

describe("run-trials.ts", () => {
  describe("parseArgs - valid inputs", () => {
    test("uses defaults: all agents, all providers, default type", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Agents: claude-code, gemini, droid, codex");
      expect(stdout).toContain("Search providers: builtin, skill, you");
      expect(stdout).toContain("Trial type: default");
      expect(stdout).toContain("(k=5)");
      expect(stdout).toContain("12 trial scenarios");
    });

    test("accepts --agent flag", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "gemini", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Agents: gemini");
      expect(stdout).toContain("3 trial scenarios"); // gemini × 3 providers
    });

    test("accepts --search-provider builtin", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--search-provider", "builtin", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Search providers: builtin");
      expect(stdout).toContain("4 trial scenarios"); // 4 agents × builtin
    });

    test("accepts --search-provider you", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--search-provider", "you", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Search providers: you");
      expect(stdout).toContain("4 trial scenarios"); // 4 agents × you
    });

    test("accepts --trial-type capability", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "capability", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Trial type: capability");
      expect(stdout).toContain("(k=10)");
    });

    test("accepts --trial-type regression", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "regression", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Trial type: regression");
      expect(stdout).toContain("(k=3)");
    });

    test("uses trials dataset by default", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Dataset: trials (30 prompts)");
      expect(stdout).toContain("Dataset: /eval/data/prompts/trials/prompts.jsonl");
    });

    test("accepts --dataset full", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dataset", "full", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Dataset: full (151 prompts)");
      expect(stdout).toContain("Dataset: /eval/data/prompts/full/prompts.jsonl");
    });

    test("accepts --trial-type default", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "default", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Trial type: default");
      expect(stdout).toContain("(k=5)");
    });

    test("accepts -k flag with valid number", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["-k", "7", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("(k=7)");
    });

    test("accepts all flags combined", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "codex",
        "--search-provider",
        "you",
        "--trial-type",
        "capability",
        "-k",
        "15",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Agents: codex");
      expect(stdout).toContain("Search providers: you");
      expect(stdout).toContain("Trial type: capability");
      expect(stdout).toContain("(k=15)");
      expect(stdout).toContain("1 trial scenarios"); // codex × you = 1 scenario
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
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--search-provider", "invalid-provider"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid search provider: invalid-provider");
      expect(stderr).toContain("Must be one of:");
    });

    test("rejects invalid trial type", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "invalid-type"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid trial type: invalid-type");
      expect(stderr).toContain("Must be");
    });

    test("rejects invalid dataset", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--dataset", "invalid-dataset"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid dataset: invalid-dataset");
      expect(stderr).toContain('Must be "trials" or "full"');
    });

    test("rejects invalid -k value (non-numeric)", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["-k", "abc"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid k value: abc");
      expect(stderr).toContain("Must be a positive integer");
    });

    test("rejects invalid -k value (zero)", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["-k", "0"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid k value: 0");
      expect(stderr).toContain("Must be a positive integer");
    });

    test("rejects invalid -k value (negative)", async () => {
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["-k", "-5"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid k value: -5");
      expect(stderr).toContain("Must be a positive integer");
    });
  });

  describe("getKValue - k value logic", () => {
    test("default type returns k=5", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "default", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("(k=5)");
    });

    test("capability type returns k=10", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "capability", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("(k=10)");
    });

    test("regression type returns k=3", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "regression", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("(k=3)");
    });

    test("custom -k value overrides type default", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--trial-type",
        "capability",
        "-k",
        "12",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("(k=12)");
      expect(stdout).toContain("Trial type: capability");
    });
  });

  describe("output path - dated folder structure", () => {
    test("default type omits suffix", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "default", "--dry-run"]);

      expect(exitCode).toBe(0);
      // Check for dated path structure: trials/YYYY-MM-DD/agent/provider.jsonl
      expect(stdout).toMatch(/trials\/\d{4}-\d{2}-\d{2}\/claude-code\/builtin\.jsonl/);
      expect(stdout).not.toContain("builtin-default.jsonl");
    });

    test("capability type adds suffix", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "capability", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/trials\/\d{4}-\d{2}-\d{2}\/claude-code\/builtin-capability\.jsonl/);
    });

    test("regression type adds suffix", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--trial-type", "regression", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/trials\/\d{4}-\d{2}-\d{2}\/claude-code\/builtin-regression\.jsonl/);
    });
  });

  describe("dry-run output", () => {
    test("shows execution plan", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("[DRY RUN]");
      expect(stdout).toContain("Execution plan:");
      expect(stdout).toContain("Dataset:");
      expect(stdout).toContain("Output:");
      expect(stdout).toContain("Trials per prompt:");
      expect(stdout).toContain("Docker:");
      expect(stdout).toContain("No trials were executed");
    });

    test("shows Docker execution model", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Execution: Docker containers (isolated)");
      expect(stdout).toContain("docker compose run --rm");
      expect(stdout).toContain("-e SEARCH_PROVIDER=");
    });

    test("shows correct dataset paths", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Dataset: /eval/data/prompts/trials/prompts.jsonl");
      expect(stdout).toContain("Dataset: /eval/data/prompts/trials/prompts-you.jsonl");
    });

    test("shows correct output paths with date", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Output: /eval/data/results/trials/");
      expect(stdout).toMatch(/trials\/\d{4}-\d{2}-\d{2}\//); // Verify date format
      expect(stdout).toContain(".jsonl");
    });
  });

  describe("parallel execution matrix", () => {
    test("runs all agent × provider combinations by default", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("12 trial scenarios"); // 4 agents × 3 providers
      expect(stdout).toContain("[1/12] claude-code-builtin");
      expect(stdout).toContain("[2/12] claude-code-skill");
      expect(stdout).toContain("[3/12] claude-code-you");
      expect(stdout).toContain("[4/12] gemini-builtin");
      expect(stdout).toContain("[5/12] gemini-skill");
      expect(stdout).toContain("[6/12] gemini-you");
      expect(stdout).toContain("[7/12] droid-builtin");
      expect(stdout).toContain("[8/12] droid-skill");
      expect(stdout).toContain("[9/12] droid-you");
      expect(stdout).toContain("[10/12] codex-builtin");
      expect(stdout).toContain("[11/12] codex-skill");
      expect(stdout).toContain("[12/12] codex-you");
    });

    test("filters to single agent", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "droid", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("3 trial scenarios"); // droid × 3 providers
      expect(stdout).toContain("[1/3] droid-builtin");
      expect(stdout).toContain("[2/3] droid-skill");
      expect(stdout).toContain("[3/3] droid-you");
    });

    test("filters to single provider", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--search-provider", "builtin", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("4 trial scenarios"); // 4 agents × builtin
      expect(stdout).toContain("claude-code-builtin");
      expect(stdout).toContain("gemini-builtin");
      expect(stdout).toContain("droid-builtin");
      expect(stdout).toContain("codex-builtin");
      expect(stdout).not.toContain("-you");
    });

    test("filters to single agent and provider", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
        "--agent",
        "gemini",
        "--search-provider",
        "you",
        "--dry-run",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("1 trial scenarios"); // gemini × you
      expect(stdout).toContain("[1/1] gemini-you");
    });
  });
});
