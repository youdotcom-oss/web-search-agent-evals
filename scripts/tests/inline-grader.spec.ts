/**
 * Test suite for inline-grader.ts
 *
 * @remarks
 * Tests the hybrid grading system that combines deterministic scoring
 * (basic output, tool usage, multi-tool, output depth, error detection)
 * with LLM-based quality assessment.
 *
 * Key areas covered:
 * - Basic output detection (40 char threshold)
 * - Tool usage scoring with MCP detection (5 pts)
 * - Multi-tool engagement gradient (5/3/0 pts)
 * - Output depth gradient (5/3/2/0 pts)
 * - Error and timeout detection
 * - Hybrid scoring (deterministic 50 + LLM 50 = 100)
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

  describe("tool usage assessment - builtin mode", () => {
    test("awards full points for any tool when no MCP expected", async () => {
      const result = await grade({
        input: "Test query",
        output: "Result from web search with sufficient length for basic output check.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
        metadata: {},
      });

      expect(result.reasoning).toContain("tools=5");
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

      expect(result.reasoning).toContain("tools=5");
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

      expect(result.reasoning).toContain("tools=5");
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

      expect(result.reasoning).toContain("tools=5");
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

      expect(result.reasoning).toContain("tools=5");
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

      expect(result.reasoning).toContain("tools=5");
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

      expect(result.reasoning).toContain("tools=3");
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
      expect(result.reasoning).toContain("tools=3"); // Wrong tool, not no tool
    });
  });

  describe("multi-tool engagement gradient", () => {
    test("awards 5 points for 3+ tool calls", async () => {
      const result = await grade({
        input: "Test query",
        output: "Response with many tool calls and sufficient length for basic output.",
        trajectory: [
          { type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() },
          { type: "tool_call", name: "Read", status: "success", timestamp: Date.now() },
          { type: "tool_call", name: "Write", status: "success", timestamp: Date.now() },
        ],
        metadata: {},
      });

      expect(result.reasoning).toContain("multiTool=5");
    });

    test("awards 3 points for 2 tool calls", async () => {
      const result = await grade({
        input: "Test query",
        output: "Response with two tool calls and sufficient length for basic output.",
        trajectory: [
          { type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() },
          { type: "tool_call", name: "Read", status: "success", timestamp: Date.now() },
        ],
        metadata: {},
      });

      expect(result.reasoning).toContain("multiTool=3");
    });

    test("awards 0 points for 1 or fewer tool calls", async () => {
      const result = await grade({
        input: "Test query",
        output: "Response with single tool call and sufficient length for basic output.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
        metadata: {},
      });

      expect(result.reasoning).toContain("multiTool=0");
    });
  });

  describe("output depth gradient", () => {
    test("awards 5 points for 500+ char output", async () => {
      const longOutput = "A".repeat(500);
      const result = await grade({
        input: "Test query",
        output: longOutput,
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
        metadata: {},
      });

      expect(result.reasoning).toContain("depth=5");
    });

    test("awards 3 points for 200-499 char output", async () => {
      const medOutput = "A".repeat(250);
      const result = await grade({
        input: "Test query",
        output: medOutput,
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
        metadata: {},
      });

      expect(result.reasoning).toContain("depth=3");
    });

    test("awards 2 points for 100-199 char output", async () => {
      const shortOutput = "A".repeat(120);
      const result = await grade({
        input: "Test query",
        output: shortOutput,
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
        metadata: {},
      });

      expect(result.reasoning).toContain("depth=2");
    });

    test("awards 0 points for <100 char output", async () => {
      const result = await grade({
        input: "Test query",
        output: "This output is under one hundred characters but above forty.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
        metadata: {},
      });

      expect(result.reasoning).toContain("depth=0");
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

    test("fails immediately on metadata timedOut flag", async () => {
      const result = await grade({
        input: "Test query",
        output: "Some output from before the timeout occurred during execution.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
        metadata: { timedOut: true },
      });

      expect(result.pass).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reasoning).toContain("Execution timed out");
      expect(result.metadata?.hasTimeout).toBe(true);
    });

    test("does not falsely detect timeout from output text", async () => {
      const result = await grade({
        input: "Test query",
        output: "The operation timed out but this is just text, not a real timeout indicator for the grader.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
        metadata: {},
      });

      // Without metadata.timedOut, should NOT treat as timeout
      expect(result.metadata?.hasTimeout).toBe(false);
      expect(result.score).toBeGreaterThan(0);
    });

    test("awards clean execution points when no errors", async () => {
      const result = await grade({
        input: "Test query",
        output: "Clean execution with sufficient output length for basic check.",
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
      // 1 tool call, 65 chars output → basic=10, tools=5, multiTool=0, depth=0, clean=25 = 40
      const result = await grade({
        input: "Test query",
        output: "Complete response with tool usage, no errors, for scoring test.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
        metadata: {},
      });

      expect(result.metadata?.deterministicScore).toBe(40);
    });

    test("maximum deterministic score with all bonuses", async () => {
      // 3 tool calls, 500+ chars → basic=10, tools=5, multiTool=5, depth=5, clean=25 = 50
      const longOutput = "A".repeat(500);
      const result = await grade({
        input: "Test query",
        output: longOutput,
        trajectory: [
          { type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() },
          { type: "tool_call", name: "Read", status: "success", timestamp: Date.now() },
          { type: "tool_call", name: "Grep", status: "success", timestamp: Date.now() },
        ],
        metadata: {},
      });

      expect(result.metadata?.deterministicScore).toBe(50);
    });

    test("pass threshold is 0.65 (65/100 points)", async () => {
      // Max deterministic without LLM = 50/100 = 0.50, which is below threshold
      const longOutput = "A".repeat(500);
      const result = await grade({
        input: "Test query",
        output: longOutput,
        trajectory: [
          { type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() },
          { type: "tool_call", name: "Read", status: "success", timestamp: Date.now() },
          { type: "tool_call", name: "Grep", status: "success", timestamp: Date.now() },
        ],
        metadata: {},
      });

      // Deterministic-only: 50/100 = 0.50, below 0.65 threshold
      expect(result.metadata?.deterministicScore).toBe(50);
      expect(result.pass).toBe(false); // Needs LLM pts to pass
    });

    test("fails when deterministic score is low", async () => {
      const result = await grade({
        input: "Test query",
        output: "Response with length but no tool usage to keep score low enough.",
        trajectory: [], // No tools = 0 pts for tools and multiTool
        metadata: {},
      });

      // Deterministic: 10 (basic) + 0 (tools) + 0 (multiTool) + 0 (depth) + 25 (clean) = 35
      expect(result.metadata?.deterministicScore).toBe(35);
      expect(result.pass).toBe(false);
    });

    test("tracks grader latency", async () => {
      const result = await grade({
        input: "Test query",
        output: "Response for latency test with sufficient length for basic check.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.metadata?.graderLatency).toBeGreaterThan(0);
    });

    test("tracks LLM latency when API key available", async () => {
      const result = await grade({
        input: "Test query",
        output: "Response for LLM latency test with sufficient length for check.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      // GEMINI_API_KEY deleted in beforeAll, so LLM latency should be 0
      expect(result.metadata?.llmLatency).toBe(0);
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
        output: "Response for score metadata validation with sufficient length.",
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
        output: "Response to multi-turn conversation with sufficient length for basic check.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.pass).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    test("handles string input directly", async () => {
      const result = await grade({
        input: "Single turn query",
        output: "Response to single turn with sufficient length for basic output check.",
        trajectory: [{ type: "tool_call", name: "WebSearch", status: "success", timestamp: Date.now() }],
      });

      expect(result.pass).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});
