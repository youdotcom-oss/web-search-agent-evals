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
      expect(stdout).toContain("Search providers: builtin, you");
      expect(stdout).toContain("Trial type: default");
      expect(stdout).toContain("(k=5)");
      expect(stdout).toContain("8 trial scenarios");
    });

    test("accepts --agent flag", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "gemini", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Agents: gemini");
      expect(stdout).toContain("2 trial scenarios"); // gemini × 2 providers
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

    test("accepts --type capability", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "capability", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Trial type: capability");
      expect(stdout).toContain("(k=10)");
    });

    test("accepts --type regression", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "regression", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Trial type: regression");
      expect(stdout).toContain("(k=3)");
    });

    test("accepts --type default", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "default", "--dry-run"]);

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
        "--type",
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
      const { stderr, exitCode } = await runScript(SCRIPT_PATH, ["--type", "invalid-type"]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid trial type: invalid-type");
      expect(stderr).toContain("Must be");
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
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "default", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("(k=5)");
    });

    test("capability type returns k=10", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "capability", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("(k=10)");
    });

    test("regression type returns k=3", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "regression", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("(k=3)");
    });

    test("custom -k value overrides type default", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "capability", "-k", "12", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("(k=12)");
      expect(stdout).toContain("Trial type: capability");
    });
  });

  describe("getOutputPath - output file naming", () => {
    test("default type omits suffix", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "default", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude-code-builtin.jsonl");
      expect(stdout).not.toContain("claude-code-builtin-default.jsonl");
    });

    test("capability type adds suffix", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "capability", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude-code-builtin-capability.jsonl");
    });

    test("regression type adds suffix", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--type", "regression", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude-code-builtin-regression.jsonl");
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

    test("shows correct output paths", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Output: /eval/data/results/trials/");
      expect(stdout).toContain(".jsonl");
    });
  });

  describe("parallel execution matrix", () => {
    test("runs all agent × provider combinations by default", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("8 trial scenarios"); // 4 agents × 2 providers
      expect(stdout).toContain("[1/8] claude-code-builtin");
      expect(stdout).toContain("[2/8] claude-code-you");
      expect(stdout).toContain("[3/8] gemini-builtin");
      expect(stdout).toContain("[4/8] gemini-you");
      expect(stdout).toContain("[5/8] droid-builtin");
      expect(stdout).toContain("[6/8] droid-you");
      expect(stdout).toContain("[7/8] codex-builtin");
      expect(stdout).toContain("[8/8] codex-you");
    });

    test("filters to single agent", async () => {
      const { stdout, exitCode } = await runScript(SCRIPT_PATH, ["--agent", "droid", "--dry-run"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("2 trial scenarios"); // droid × 2 providers
      expect(stdout).toContain("[1/2] droid-builtin");
      expect(stdout).toContain("[2/2] droid-you");
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
