/**
 * Test suite for grader-llm.ts
 *
 * @remarks
 * Tests the LLM grading functions:
 * - Prompt construction with target alignment
 * - Structured dimension parsing from LLM JSON responses
 * - Score computation with hallucination penalty
 * - Dimension bound clamping
 *
 * @public
 */

import { describe, expect, test } from "bun:test";
import { buildGradingPrompt, parseLlmDimensions, computeLlmScore, formatDimensionReasoning } from "../grader-llm.ts";

describe("grader-llm", () => {
  describe("buildGradingPrompt", () => {
    test("includes all 4 dimensions", () => {
      const prompt = buildGradingPrompt({ input: "test query", output: "test output", hint: "expected answer" });
      expect(prompt).toContain("targetAlignment (0-15)");
      expect(prompt).toContain("Target: expected answer");
      expect(prompt).toContain("contentSubstance (0-10)");
      expect(prompt).toContain("queryMatch (0-15)");
      expect(prompt).toContain("formatQuality (0-10)");
    });

    test("includes log noise instruction", () => {
      const prompt = buildGradingPrompt({ input: "test query", output: "test output", hint: "answer" });
      expect(prompt).toContain("agent process noise");
      expect(prompt).toContain("Ignore this noise entirely");
    });

    test("handles empty output", () => {
      const prompt = buildGradingPrompt({ input: "test query", output: "", hint: "answer" });
      expect(prompt).toContain("(no output)");
    });

    test("includes calibration guidance", () => {
      const prompt = buildGradingPrompt({ input: "test query", output: "test output", hint: "answer" });
      expect(prompt).toContain("Most acceptable answers score 20-35 total");
    });
  });

  describe("parseLlmDimensions", () => {
    test("parses valid JSON with all dimensions", () => {
      const text = `{"queryMatch": 12, "targetAlignment": 10, "contentSubstance": 7, "formatQuality": 8, "reasoning": "Good answer"}`;
      const dims = parseLlmDimensions(text);

      expect(dims).not.toBeNull();
      expect(dims?.queryMatch).toBe(12);
      expect(dims?.targetAlignment).toBe(10);
      expect(dims?.contentSubstance).toBe(7);
      expect(dims?.formatQuality).toBe(8);
      expect(dims?.reasoning).toBe("Good answer");
    });

    test("clamps values to dimension bounds", () => {
      const text = `{"queryMatch": 99, "targetAlignment": -5, "contentSubstance": 50, "formatQuality": 20}`;
      const dims = parseLlmDimensions(text);

      expect(dims).not.toBeNull();
      expect(dims?.queryMatch).toBe(15);
      expect(dims?.targetAlignment).toBe(0);
      expect(dims?.contentSubstance).toBe(10);
      expect(dims?.formatQuality).toBe(10);
    });

    test("handles missing fields as 0", () => {
      const text = `{"queryMatch": 10}`;
      const dims = parseLlmDimensions(text);

      expect(dims).not.toBeNull();
      expect(dims?.queryMatch).toBe(10);
      expect(dims?.targetAlignment).toBe(0);
      expect(dims?.contentSubstance).toBe(0);
      expect(dims?.formatQuality).toBe(0);
      expect(dims?.reasoning).toBe("");
    });

    test("extracts JSON from markdown code blocks", () => {
      const text = `Here's my score:\n\`\`\`json\n{"queryMatch": 10, "formatQuality": 7}\n\`\`\``;
      const dims = parseLlmDimensions(text);

      expect(dims).not.toBeNull();
      expect(dims?.queryMatch).toBe(10);
      expect(dims?.formatQuality).toBe(7);
    });

    test("returns null for non-JSON text", () => {
      const dims = parseLlmDimensions("This is not JSON at all");
      expect(dims).toBeNull();
    });

    test("returns null for invalid JSON", () => {
      const dims = parseLlmDimensions("{invalid json}");
      expect(dims).toBeNull();
    });
  });

  describe("computeLlmScore", () => {
    test("sums all dimensions without penalty", () => {
      const score = computeLlmScore({
        queryMatch: 10,
        targetAlignment: 10,
        contentSubstance: 7,
        formatQuality: 8,
        reasoning: "",
      });
      expect(score).toBe(35);
    });

    test("applies hallucination penalty when targetAlignment < 5", () => {
      const score = computeLlmScore({
        queryMatch: 15,
        targetAlignment: 3,
        contentSubstance: 10,
        formatQuality: 10,
        reasoning: "",
      });
      // Raw: 15 + 3 + 10 + 10 = 38, penalized: round(38 * 0.7) = 27
      expect(score).toBe(27);
    });

    test("no penalty when targetAlignment = 5", () => {
      const score = computeLlmScore({
        queryMatch: 15,
        targetAlignment: 5,
        contentSubstance: 10,
        formatQuality: 10,
        reasoning: "",
      });
      expect(score).toBe(40);
    });

    test("penalty at targetAlignment = 0 with high other scores", () => {
      const score = computeLlmScore({
        queryMatch: 15,
        targetAlignment: 0,
        contentSubstance: 10,
        formatQuality: 10,
        reasoning: "",
      });
      // Raw: 35, penalized: round(35 * 0.7) = 25
      expect(score).toBe(25);
    });

    test("clamps score to 50 max", () => {
      const score = computeLlmScore({
        queryMatch: 15,
        targetAlignment: 15,
        contentSubstance: 10,
        formatQuality: 10,
        reasoning: "",
      });
      expect(score).toBe(50);
    });

    test("clamps score to 0 min", () => {
      const score = computeLlmScore({
        queryMatch: 0,
        targetAlignment: 0,
        contentSubstance: 0,
        formatQuality: 0,
        reasoning: "",
      });
      expect(score).toBe(0);
    });
  });

  describe("formatDimensionReasoning", () => {
    test("formats all dimensions", () => {
      const result = formatDimensionReasoning(
        { queryMatch: 10, targetAlignment: 8, contentSubstance: 7, formatQuality: 6, reasoning: "test" },
        false,
      );
      expect(result).toContain("Match: 10/15");
      expect(result).toContain("Align: 8/15");
      expect(result).toContain("Substance: 7/10");
      expect(result).toContain("Format: 6/10");
      expect(result).toContain("test");
    });

    test("includes hallucination penalty note when penalized", () => {
      const result = formatDimensionReasoning(
        { queryMatch: 10, targetAlignment: 2, contentSubstance: 7, formatQuality: 6, reasoning: "" },
        true,
      );
      expect(result).toContain("(hallucination penalty applied)");
    });

    test("omits penalty note when not penalized", () => {
      const result = formatDimensionReasoning(
        { queryMatch: 10, targetAlignment: 10, contentSubstance: 7, formatQuality: 6, reasoning: "" },
        false,
      );
      expect(result).not.toContain("penalty");
    });
  });
});
