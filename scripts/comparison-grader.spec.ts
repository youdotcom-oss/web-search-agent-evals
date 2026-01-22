import { test, expect } from "bun:test";
import type { ComparisonGrader } from "@plaited/agent-eval-harness/pipeline";

/**
 * Tests for hybrid comparison grader
 *
 * @remarks
 * Tests deterministic scoring, LLM integration, and fallback behavior
 */

type ComparisonGraderContext = Parameters<ComparisonGrader>[0];

test("deterministic scoring: completion only", async () => {
  // Mock Gemini to test deterministic fallback
  const _mockEnv = { GEMINI_API_KEY: undefined };

  const context: ComparisonGraderContext = {
    id: "test-1",
    input: "Test query",
    hint: undefined,
    runs: {
      "agent-a": {
        output: "Some output",
        trajectory: [],
      },
      "agent-b": {
        output: "",
        trajectory: [],
      },
    },
  };

  // Import with mocked env
  const originalEnv = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = undefined;

  // Dynamically import to get fresh module
  const { grade } = await import("./comparison-grader.ts");

  const result = await grade(context);

  // Restore env
  if (originalEnv) process.env.GEMINI_API_KEY = originalEnv;

  expect(result.rankings).toHaveLength(2);
  expect(result.rankings[0]?.run).toBe("agent-a");
  expect(result.rankings[0]?.score).toBe(0.3); // 30pts completion only
  expect(result.rankings[1]?.run).toBe("agent-b");
  expect(result.rankings[1]?.score).toBe(0); // No output
});

test("deterministic scoring: completion + tool usage", async () => {
  const context: ComparisonGraderContext = {
    id: "test-2",
    input: "Test query",
    hint: undefined,
    runs: {
      "agent-a": {
        output: "Result from search",
        trajectory: [
          {
            type: "tool_call",
            name: "WebSearch",
            status: "completed",
            timestamp: 100,
          },
        ],
      },
      "agent-b": {
        output: "Result without search",
        trajectory: [],
      },
    },
  };

  process.env.GEMINI_API_KEY = undefined;
  const { grade } = await import("./comparison-grader.ts");

  const result = await grade(context);

  expect(result.rankings[0]?.run).toBe("agent-a");
  expect(result.rankings[0]?.score).toBe(0.5); // 30pts completion + 20pts tool
  expect(result.rankings[1]?.run).toBe("agent-b");
  expect(result.rankings[1]?.score).toBe(0.3); // 30pts completion only
});

test("tool usage detection: case insensitive", async () => {
  const context: ComparisonGraderContext = {
    id: "test-3",
    input: "Test query",
    hint: undefined,
    runs: {
      "agent-a": {
        output: "Result",
        trajectory: [
          {
            type: "tool_call",
            name: "search_web",
            status: "completed",
            timestamp: 100,
          },
        ],
      },
      "agent-b": {
        output: "Result",
        trajectory: [
          {
            type: "tool_call",
            name: "WebSearchTool",
            status: "completed",
            timestamp: 100,
          },
        ],
      },
    },
  };

  process.env.GEMINI_API_KEY = undefined;
  const { grade } = await import("./comparison-grader.ts");

  const result = await grade(context);

  // Both should get tool usage points
  expect(result.rankings[0]?.score).toBe(0.5);
  expect(result.rankings[1]?.score).toBe(0.5);
});

test("rankings sorted by score descending", async () => {
  const context: ComparisonGraderContext = {
    id: "test-4",
    input: "Test query",
    hint: undefined,
    runs: {
      "low-score": {
        output: "",
        trajectory: [],
      },
      "high-score": {
        output: "Complete answer",
        trajectory: [
          {
            type: "tool_call",
            name: "WebSearch",
            status: "completed",
            timestamp: 100,
          },
        ],
      },
      "mid-score": {
        output: "Partial answer",
        trajectory: [],
      },
    },
  };

  process.env.GEMINI_API_KEY = undefined;
  const { grade } = await import("./comparison-grader.ts");

  const result = await grade(context);

  expect(result.rankings[0]?.run).toBe("high-score");
  expect(result.rankings[0]?.rank).toBe(1);
  expect(result.rankings[1]?.run).toBe("mid-score");
  expect(result.rankings[1]?.rank).toBe(2);
  expect(result.rankings[2]?.run).toBe("low-score");
  expect(result.rankings[2]?.rank).toBe(3);
});

test("metadata includes score breakdown", async () => {
  const context: ComparisonGraderContext = {
    id: "test-5",
    input: "Test query",
    hint: undefined,
    runs: {
      "agent-a": {
        output: "Output",
        trajectory: [
          {
            type: "tool_call",
            name: "search",
            status: "completed",
            timestamp: 100,
          },
        ],
      },
    },
  };

  process.env.GEMINI_API_KEY = undefined;
  const { grade } = await import("./comparison-grader.ts");

  const result = await grade(context);

  const ranking = result.rankings[0];
  expect(ranking).toBeDefined();
  expect((ranking as any).metadata).toBeDefined();
  expect((ranking as any).metadata.deterministic).toBe(50); // 30 + 20
  expect((ranking as any).metadata.llm).toBe(0); // No LLM when key missing
});

test("reasoning includes winner and score", async () => {
  const context: ComparisonGraderContext = {
    id: "test-6",
    input: "Test query",
    hint: undefined,
    runs: {
      winner: {
        output: "Best output",
        trajectory: [
          {
            type: "tool_call",
            name: "WebSearch",
            status: "completed",
            timestamp: 100,
          },
        ],
      },
      loser: {
        output: "",
        trajectory: [],
      },
    },
  };

  process.env.GEMINI_API_KEY = undefined;
  const { grade } = await import("./comparison-grader.ts");

  const result = await grade(context);

  expect(result.reasoning).toContain("winner");
  expect(result.reasoning).toContain("ranked #1");
  expect(result.reasoning).toContain("0.50"); // Score
  expect(result.reasoning).toContain("deterministic: 50");
});
