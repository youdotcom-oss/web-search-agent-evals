/**
 * Test suite for inline-grader.ts
 *
 * @remarks
 * Tests the hybrid grading system that combines deterministic scoring
 * (basic output, tool usage, error detection, sources) with LLM-based
 * quality assessment.
 *
 * Key areas covered:
 * - Basic output detection (40 char threshold)
 * - Source/URL detection
 * - Tool usage scoring with MCP detection
 * - Error and timeout detection
 * - Hybrid scoring (deterministic + LLM)
 * - Pass threshold (0.65 = 65/100)
 *
 * @public
 */

import { beforeAll, describe, expect, test } from "bun:test";
import { grade } from "../inline-grader.ts";

describe("inline-grader", () => {
  // Disable LLM for faster tests (deterministic scoring only)
  beforeAll(() => {
    delete process.env.GEMINI_API_KEY;
  });
  describe("basic output assessment", () => {
    test("fails on empty output", async () => {
      const result = await grade({
        input: "Test query",
        output: "",
        trajectory: [],
      });

      expect(result.pass).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reasoning).toContain("basic=0");
    });

    test("fails on short output (<40 chars)", async () => {
      const result = await grade({
        input: "Test query",
        output: "Short",
        trajectory: [],
      });

      expect(result.pass).toBe(false);
      expect(result.score).toBeLessThan(0.65);
      expect(result.reasoning).toContain("basic=0");
    });

    test("awards points for sufficient output (>=40 chars)", async () => {
      const result = await grade({
        input: "Test query",
        output: "This is a response with enough characters to pass the threshold",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.reasoning).toContain("basic=10");
    });
  });

  describe("source detection", () => {
    test("detects HTTP URLs", async () => {
      const result = await grade({
        input: "Test query",
        output:
          "According to http://example.com, the answer is 42. This response has sufficient length to pass basic checks.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.reasoning).toContain("sources=10");
    });

    test("detects HTTPS URLs", async () => {
      const result = await grade({
        input: "Test query",
        output:
          "According to https://example.com, the answer is 42. This response has sufficient length to pass basic checks.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.reasoning).toContain("sources=10");
    });

    test("detects 'source:' references", async () => {
      const result = await grade({
        input: "Test query",
        output:
          "The answer is 42. Source: Documentation Page 5. This response has sufficient length to pass basic checks.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.reasoning).toContain("sources=10");
    });

    test("detects 'reference:' citations", async () => {
      const result = await grade({
        input: "Test query",
        output:
          "The answer is 42. Reference: API Documentation. This response has sufficient length to pass basic checks.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.reasoning).toContain("sources=10");
    });

    test("no sources bonus without URLs or references", async () => {
      const result = await grade({
        input: "Test query",
        output:
          "The answer is 42. This response has no sources or URLs but has sufficient length to pass basic checks.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.reasoning).toContain("sources=0");
    });
  });

  describe("tool usage assessment - builtin mode", () => {
    test("awards full points for any tool when no MCP expected", async () => {
      const result = await grade({
        input: "Test query",
        output: "Result from web search with sufficient length for basic output check.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
        metadata: {}, // No mcpServer or expectedTools
      });

      expect(result.reasoning).toContain("tools=25");
    });

    test("awards 0 points when no tools used (builtin)", async () => {
      const result = await grade({
        input: "Test query",
        output: "Result without any tools with sufficient length for basic output check.",
        trajectory: [],
        metadata: {},
      });

      expect(result.reasoning).toContain("tools=0");
    });
  });

  describe("tool usage assessment - MCP mode", () => {
    test("awards full points for correct MCP tool (Claude Code format)", async () => {
      const result = await grade({
        input: "Test query",
        output: "Result from You.com search with sufficient length for basic output check.",
        trajectory: [
          {
            type: "tool_call",
            name: "mcp__ydc-server__you-search",
            status: "success",
            timestamp: Date.now(),
          },
        ],
        metadata: {
          mcpServer: "ydc-server",
          expectedTools: ["you-search"],
        },
      });

      expect(result.reasoning).toContain("tools=25");
      expect(result.metadata?.mcpToolCalled).toBe(true);
    });

    test("awards full points for correct MCP tool (Codex format)", async () => {
      const result = await grade({
        input: "Test query",
        output: "Result from You.com search with sufficient length for basic output check.",
        trajectory: [
          {
            type: "tool_call",
            name: "you-search",
            status: "success",
            timestamp: Date.now(),
            // @ts-expect-error - Codex format includes mcpServer field not in official schema
            mcpServer: "ydc-server",
          },
        ],
        metadata: {
          mcpServer: "ydc-server",
          expectedTools: ["you-search"],
        },
      });

      expect(result.reasoning).toContain("tools=25");
      expect(result.metadata?.mcpToolCalled).toBe(true);
    });

    test("awards full points for correct MCP tool (DROID format)", async () => {
      const result = await grade({
        input: "Test query",
        output: "Result from You.com search with sufficient length for basic output check.",
        trajectory: [
          {
            type: "tool_call",
            name: "ydc-server___you-search",
            status: "success",
            timestamp: Date.now(),
          },
        ],
        metadata: {
          mcpServer: "ydc-server",
          expectedTools: ["you-search"],
        },
      });

      expect(result.reasoning).toContain("tools=25");
      expect(result.metadata?.mcpToolCalled).toBe(true);
    });

    test("awards full points for correct MCP tool (GEMINI format)", async () => {
      const result = await grade({
        input: "Test query",
        output: "Result from You.com search with sufficient length for basic output check.",
        trajectory: [
          {
            type: "tool_call",
            name: "you-search",
            status: "success",
            timestamp: Date.now(),
          },
        ],
        metadata: {
          mcpServer: "ydc-server",
          expectedTools: ["you-search"],
        },
      });

      expect(result.reasoning).toContain("tools=25");
      expect(result.metadata?.mcpToolCalled).toBe(true);
    });

    test("awards full points for timestamped tool variant (GEMINI)", async () => {
      const result = await grade({
        input: "Test query",
        output: "Result from You.com search with sufficient length for basic output check.",
        trajectory: [
          {
            type: "tool_call",
            name: "you-search-1234567890",
            status: "success",
            timestamp: Date.now(),
          },
        ],
        metadata: {
          mcpServer: "ydc-server",
          expectedTools: ["you-search"],
        },
      });

      expect(result.reasoning).toContain("tools=25");
    });

    test("awards partial points for wrong MCP tool", async () => {
      const result = await grade({
        input: "Test query",
        output: "Result from wrong tool with sufficient length for basic output check.",
        trajectory: [
          {
            type: "tool_call",
            name: "mcp__wrong-server__wrong-tool",
            status: "success",
            timestamp: Date.now(),
          },
        ],
        metadata: {
          mcpServer: "ydc-server",
          expectedTools: ["you-search"],
        },
      });

      expect(result.reasoning).toContain("tools=15");
      expect(result.metadata?.mcpToolCalled).toBe(false);
    });

    test("awards 0 points when no tool used but MCP expected", async () => {
      const result = await grade({
        input: "Test query",
        output: "Result without tools with sufficient length for basic output check.",
        trajectory: [],
        metadata: {
          mcpServer: "ydc-server",
          expectedTools: ["you-search"],
        },
      });

      expect(result.reasoning).toContain("tools=0");
      expect(result.metadata?.mcpToolCalled).toBe(false);
    });

    test("excludes false positives (Claude tool IDs)", async () => {
      const result = await grade({
        input: "Test query",
        output: "Result with Claude tool ID with sufficient length for basic output check.",
        trajectory: [
          {
            type: "tool_call",
            name: "toolu_123___something",
            status: "success",
            timestamp: Date.now(),
          },
        ],
        metadata: {
          mcpServer: "ydc-server",
          expectedTools: ["you-search"],
        },
      });

      // Should not match DROID pattern due to toolu_ prefix
      expect(result.reasoning).toContain("tools=15"); // Wrong tool, not no tool
    });
  });

  describe("error and timeout detection", () => {
    test("fails immediately on tool execution error", async () => {
      const result = await grade({
        input: "Test query",
        output: "Some output that would otherwise pass",
        trajectory: [
          {
            type: "tool_call",
            name: "WebSearch",
            status: "error",
            timestamp: Date.now(),
          },
        ],
      });

      expect(result.pass).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reasoning).toContain("Tool execution failed");
      expect(result.metadata?.hasErrors).toBe(true);
    });

    test("fails immediately on tool failure status", async () => {
      const result = await grade({
        input: "Test query",
        output: "Some output that would otherwise pass",
        trajectory: [
          {
            type: "tool_call",
            name: "WebSearch",
            status: "failed",
            timestamp: Date.now(),
          },
        ],
      });

      expect(result.pass).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reasoning).toContain("Tool execution failed");
      expect(result.metadata?.hasErrors).toBe(true);
    });

    test("fails immediately on timeout in output", async () => {
      const result = await grade({
        input: "Test query",
        output: "Execution timed out after 120 seconds",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.pass).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reasoning).toContain("Execution timed out");
      expect(result.metadata?.hasTimeout).toBe(true);
    });

    test('fails immediately on "timed out" in output', async () => {
      const result = await grade({
        input: "Test query",
        output: "The operation timed out while searching",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.pass).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reasoning).toContain("Execution timed out");
    });

    test("awards clean execution points when no errors", async () => {
      const result = await grade({
        input: "Test query",
        output: "Clean execution with sufficient output length and a source http://example.com",
        trajectory: [
          {
            type: "tool_call",
            name: "WebSearch",
            status: "success",
            timestamp: Date.now(),
          },
        ],
      });

      expect(result.reasoning).toContain("clean=25");
    });
  });

  describe("hybrid scoring system", () => {
    test("deterministic scoring components add up correctly", async () => {
      const result = await grade({
        input: "Test query",
        output:
          "Complete response with tool usage, no errors, and sources from https://example.com to validate scoring.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
        metadata: {},
      });

      // Should have: basic(10) + tools(25) + clean(25) + sources(10) = 70
      expect(result.metadata?.deterministicScore).toBe(70);
    });

    test("pass threshold is 0.65 (65/100 points)", async () => {
      const result = await grade({
        input: "Test query",
        output: "Response with sufficient length, tool usage, and source https://example.com for passing grade.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
        metadata: {},
      });

      // Deterministic: 70 pts (10+25+25+10)
      // LLM: variable (may be 0 if no API key)
      // Should pass if deterministic >= 70 (which is > 65 threshold)
      if (result.metadata?.deterministicScore === 70) {
        expect(result.pass).toBe(true);
      }
    });

    test("fails when deterministic score is below 65", async () => {
      const result = await grade({
        input: "Test query",
        output: "Response with length but no sources or tool usage to keep score low.",
        trajectory: [], // No tools = 0 pts
        metadata: {},
      });

      // Deterministic: 35 pts (10+0+25+0) - missing tool usage and sources
      // Below 65 threshold, should fail
      expect(result.metadata?.deterministicScore).toBe(35);
      expect(result.pass).toBe(false);
    });

    test("tracks grader latency", async () => {
      const result = await grade({
        input: "Test query",
        output: "Response for latency test with sufficient length and source https://example.com",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.metadata?.graderLatency).toBeGreaterThan(0);
    });

    test("tracks LLM latency when API key available", async () => {
      const result = await grade({
        input: "Test query",
        output: "Response for LLM latency test with sufficient length and source https://example.com",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      // If GEMINI_API_KEY is set, should have LLM latency
      if (process.env.GEMINI_API_KEY) {
        expect(result.metadata?.llmLatency).toBeGreaterThan(0);
      } else {
        expect(result.metadata?.llmLatency).toBe(0);
      }
    });
  });

  describe("metadata tracking", () => {
    test("tracks MCP expectations", async () => {
      const result = await grade({
        input: "Test query",
        output: "Response with MCP metadata tracking and sufficient length for validation.",
        trajectory: [
          {
            type: "tool_call",
            name: "mcp__ydc-server__you-search",
            status: "success",
            timestamp: Date.now(),
          },
        ],
        metadata: {
          mcpServer: "ydc-server",
          expectedTools: ["you-search"],
        },
      });

      expect(result.metadata?.expectedMcp).toBe(true);
      expect(result.metadata?.mcpToolCalled).toBe(true);
    });

    test("tracks when MCP not expected", async () => {
      const result = await grade({
        input: "Test query",
        output: "Response without MCP expectations and sufficient length for validation.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
        metadata: {},
      });

      expect(result.metadata?.expectedMcp).toBe(false);
      expect(result.metadata?.mcpToolCalled).toBe(false);
    });

    test("includes deterministic and LLM scores in metadata", async () => {
      const result = await grade({
        input: "Test query",
        output: "Response for score metadata validation with source https://example.com",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.metadata?.deterministicScore).toBeDefined();
      expect(result.metadata?.llmScore).toBeDefined();
      expect(typeof result.metadata?.deterministicScore).toBe("number");
      expect(typeof result.metadata?.llmScore).toBe("number");
    });
  });

  describe("multi-turn input support", () => {
    test("handles array input by joining", async () => {
      const result = await grade({
        input: ["First turn", "Second turn", "Third turn"],
        output: "Response to multi-turn conversation with sufficient length and source https://example.com",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.pass).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    test("handles string input directly", async () => {
      const result = await grade({
        input: "Single turn query",
        output: "Response to single turn with sufficient length and source https://example.com",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.pass).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});
