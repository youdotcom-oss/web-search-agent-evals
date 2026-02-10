import type { Grader } from "@plaited/agent-eval-harness/schemas";
import { GoogleGenAI } from "@google/genai";
import { buildGradingPrompt, parseLlmDimensions, computeLlmScore, formatDimensionReasoning } from "./grader-llm.ts";

/**
 * Hybrid inline grader: Deterministic scoring + LLM quality judgment
 *
 * @remarks
 * **MCP Detection:** Uses metadata-driven detection (prompt metadata specifies expected MCP server):
 * - Agent schemas extract tool names from CLI output
 * - Grader checks if expected MCP server tools were called
 * - Supports all agents: Claude Code, Codex, DROID, GEMINI
 * - Detection patterns implemented in `assessToolUsage()` function
 *
 * **Hybrid Scoring:**
 * - **Deterministic (50 pts):** Basic output (10), tool usage (5), multi-tool (5), output depth (5), no errors (25)
 * - **LLM (50 pts):** Query match (15), target alignment (15), content substance (10), format quality (10)
 * - **Pass threshold:** 65/100 (0.65 normalized score)
 *
 * **Deterministic Breakdown:**
 * - 10 pts: Basic output (>= 40 chars)
 * - 5 pts: Correct tool usage (MCP detection)
 * - 5 pts: Multi-tool engagement (3+: 5, 2: 3, <2: 0)
 * - 5 pts: Output depth gradient (500+: 5, 200+: 3, 100+: 2, <100: 0)
 * - 25 pts: No execution errors
 *
 * **Tool Usage (5 pts):**
 * - If MCP expected: 5 pts for correct tool, 3 pts for wrong tool, 0 for no tool
 * - If builtin (no MCP): 5 pts for any tool, 0 for no tool
 *
 * **LLM Dimensions (50 pts):**
 * - Query Match (15) + Target Alignment (15) + Content Substance (10) + Format Quality (10)
 * - Calibration: Most acceptable answers 20-35, reserve 40+ for exceptional results
 *
 * **Hallucination Penalty:** When targetAlignment < 5/15, total LLM score
 * is multiplied by 0.7 to penalize confidently wrong answers.
 *
 * **Log Noise Handling:** LLM prompt instructs judge to ignore agent process noise
 * (npm/bun script echo, shell commands, debug logs) when scoring Format Quality.
 *
 * **Pass Threshold Logic:**
 * - Baseline: 10 + 5 + 5 + 5 + 25 = 50 pts deterministic + up to 50 LLM = 100 max
 * - Pass requires 65/100, so agents need 15+ LLM pts to pass
 *
 * **Execution Errors:** Timeout (via metadata.timedOut) or tool failures result in immediate fail (score 0)
 *
 * **Fallback:** Works without GEMINI_API_KEY (deterministic-only mode, max 50/100)
 *
 * **Latency Tracking:** Records grader execution time separately from agent time
 *
 * **Calibration Required:** The LLM judge may hallucinate facts. Always:
 * - Review sampled failures manually before trusting scores
 * - Use `bunx @plaited/agent-eval-harness calibrate` to validate grader accuracy
 * - Check for systematic biases in LLM scoring
 * - Compare deterministic-only vs hybrid scoring distributions
 *
 * @public
 */

/**
 * Check for tool execution errors in trajectory
 */
const hasToolErrors = (
  trajectory?: Array<{
    type: string;
    status?: string;
    content?: string;
  }>,
): boolean =>
  trajectory?.some((step) => step.type === "tool_call" && (step.status === "failed" || step.status === "error")) ??
  false;

/**
 * Assess basic output presence
 *
 * @returns 10 points if output exists (>= 40 chars), 0 if empty
 */
const assessBasicOutput = (output: string): number => {
  return output.length >= 40 ? 10 : 0;
};

/**
 * Assess correct tool usage with sophisticated MCP detection
 *
 * @remarks
 * Evaluates tool selection correctness and detects MCP tool usage across all agent types
 * using agent-specific naming patterns.
 *
 * ## Detection Patterns by Agent
 *
 * - **Claude Code**: `mcp__<server>__<tool>` format (e.g., `mcp__ydc-server__you-search`)
 * - **Codex**: Explicit `mcpServer` field in trajectory step
 * - **DROID**: `<server>___<tool>` format with triple underscore (e.g., `ydc-server___you-search`)
 * - **GEMINI**: Tool name matches expected tools, including timestamped variants (e.g., `you-search-123`)
 *
 * ## Scoring Logic
 *
 * - **If MCP expected** (metadata.mcpServer and metadata.expectedTools exist):
 *   - 5 pts: Correct MCP tool used (matches expected server/tools)
 *   - 3 pts: Any tool used (wrong choice)
 *   - 0 pts: No tools
 * - **If NO MCP expected** (builtin):
 *   - 5 pts: Any tool used (full credit for builtin)
 *   - 0 pts: No tools
 *
 * @param trajectory - Agent execution trajectory with tool calls
 * @param metadata - Prompt metadata containing `mcpServer` and `expectedTools`
 * @returns Score from 0-5 points based on tool correctness
 *
 * @internal
 */
const assessToolUsage = (
  trajectory?: Array<{
    type: string;
    name?: string;
    toolName?: string;
    title?: string;
    mcpServer?: string;
  }>,
  metadata?: { expectedTools?: readonly string[]; mcpServer?: string },
): number => {
  const toolCalls = trajectory?.filter((s) => s.type === "tool_call") ?? [];

  // No tools used at all
  if (toolCalls.length === 0) return 0;

  const expectedMcpServer = metadata?.mcpServer;
  const expectedTools = metadata?.expectedTools;

  // Case 1: MCP expected - validate correct tool using sophisticated detection
  if (expectedMcpServer && expectedTools?.length) {
    const usedCorrectTool = toolCalls.some((call) => {
      const toolIdentifier = call.name || call.toolName || call.title || "";

      // Claude Code: extract server from mcp__<server>__<tool>
      if (toolIdentifier.startsWith("mcp__")) {
        const parts = toolIdentifier.split("__");
        return parts[1] === expectedMcpServer;
      }

      // Codex: check mcpServer field directly
      if (call.mcpServer) {
        return call.mcpServer === expectedMcpServer;
      }

      // DROID: extract server from <server>___<tool>
      // Exclude false positives like Claude's tool IDs (toolu_)
      if (toolIdentifier.includes("___") && !toolIdentifier.startsWith("toolu_")) {
        const server = toolIdentifier.split("___")[0];
        return server === expectedMcpServer;
      }

      // GEMINI: check if tool name matches any expected tool
      // Handle both base names and timestamped variants (you-search-123...)
      if (expectedTools.some((tool) => toolIdentifier === tool || toolIdentifier.startsWith(`${tool}-`))) {
        return true;
      }

      return false;
    });

    return usedCorrectTool ? 5 : 3; // Full credit for correct, partial for wrong
  }

  // Case 2: Builtin (no MCP) - any tool usage gets full credit
  return 5;
};

/**
 * Assess multi-tool engagement
 *
 * @returns 5 points for 3+ tool calls, 3 for 2, 0 for 1 or fewer
 *
 * @internal
 */
const assessMultiTool = (trajectory?: Array<{ type: string }>): number => {
  const toolCalls = trajectory?.filter((s) => s.type === "tool_call") ?? [];
  if (toolCalls.length >= 3) return 5;
  if (toolCalls.length >= 2) return 3;
  return 0;
};

/**
 * Assess output depth beyond basic threshold with gradient scoring
 *
 * @returns 5 pts for 500+ chars, 3 pts for 200+, 2 pts for 100+, 0 otherwise
 *
 * @internal
 */
const assessOutputDepth = (output: string): number => {
  if (output.length >= 500) return 5;
  if (output.length >= 200) return 3;
  if (output.length >= 100) return 2;
  return 0;
};

/**
 * Hybrid quality assessment: deterministic (50%) + LLM (50%)
 *
 * @remarks
 * Deterministic scoring (50 pts):
 * - 10 pts: Basic output (>= 40 chars)
 * - 5 pts: Correct tool usage (MCP detection)
 * - 5 pts: Multi-tool engagement (3+: 5, 2: 3, <2: 0)
 * - 5 pts: Output depth gradient (500+: 5, 200+: 3, 100+: 2, <100: 0)
 * - 25 pts: No execution errors
 *
 * LLM scoring (50 pts max):
 * - With hint: Query Match (15) + Target Alignment (15) + Content Substance (10) + Format Quality (10)
 * - Without hint: Query Match (15) + Content Substance (25) + Format Quality (10)
 * - Hallucination penalty: 0.7x when hint present and targetAlignment < 5
 * - Calibration anchoring: most acceptable answers 20-35, 40+ reserved for exceptional
 *
 * LLM priority: GEMINI_API_KEY → deterministic-only fallback.
 */
const assessQuality = async ({
  input,
  output,
  hint,
  trajectory,
  metadata,
}: {
  input: string;
  output: string;
  hint: string;
  trajectory?: Array<{
    type: string;
    name?: string;
    toolName?: string;
    title?: string;
    status?: string;
    content?: string;
  }>;
  metadata?: {
    mcpServer?: string;
    expectedTools?: readonly string[];
  };
}): Promise<{
  deterministicScore: number;
  llmScore: number;
  reasoning: string;
  graderLatency: number;
  llmLatency: number;
  mcpToolCalled: boolean;
}> => {
  const startTime = performance.now();

  // Phase 1: Deterministic scoring (50 pts)
  let deterministicScore = 0;

  // 10 pts: Basic output
  const basicOutput = assessBasicOutput(output);
  deterministicScore += basicOutput;

  // 5 pts: Correct tool usage
  const toolScore = assessToolUsage(trajectory, metadata);
  deterministicScore += toolScore;

  // 5 pts: Multi-tool engagement
  const multiToolScore = assessMultiTool(trajectory);
  deterministicScore += multiToolScore;

  // 5 pts: Output depth bonus
  const depthScore = assessOutputDepth(output);
  deterministicScore += depthScore;

  // 25 pts: No execution errors
  const hasErrors = hasToolErrors(trajectory);
  const cleanScore = !hasErrors && output.length >= 40 ? 25 : 0;
  deterministicScore += cleanScore;

  // Phase 2: LLM quality judgment (50 pts max)
  let llmScore = 0;
  let llmReasoning = "";
  let llmLatency = 0;

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    const llmStart = performance.now();
    try {
      const ai = new GoogleGenAI({ apiKey });
      const contents = buildGradingPrompt({ input, output, hint });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents,
      });
      const { text } = response;

      if (text) {
        const dims = parseLlmDimensions(text);
        if (dims) {
          llmScore = computeLlmScore(dims);
          const penalized = dims.targetAlignment < 5;
          llmReasoning = formatDimensionReasoning(dims, penalized);
        }
      }
    } catch (_: unknown) {
      llmReasoning = "LLM grading failed";
    }
    llmLatency = performance.now() - llmStart;
  } else {
    llmReasoning = "No GEMINI_API_KEY (deterministic-only mode)";
  }

  const totalLatency = performance.now() - startTime;

  const reasoning = `Deterministic: ${deterministicScore}/50 (basic=${basicOutput}, tools=${toolScore}, multiTool=${multiToolScore}, depth=${depthScore}, clean=${cleanScore}). LLM: ${llmScore}/50. ${llmReasoning}`;

  // Derive MCP tool usage from score: true only if MCP expected and got full 5 points
  const mcpToolCalled = !!(metadata?.mcpServer && metadata?.expectedTools?.length && toolScore === 5);

  return {
    deterministicScore,
    llmScore,
    reasoning,
    graderLatency: totalLatency,
    llmLatency,
    mcpToolCalled,
  };
};

/**
 * Inline grader with hybrid scoring
 *
 * @remarks
 * **Hybrid Scoring:**
 * - Deterministic: 50 pts (output quality, tool usage, multi-tool, depth, no errors)
 * - LLM: 50 pts (structured per-dimension scoring with hallucination penalty)
 * - Pass threshold: 65/100
 *
 * **LLM Priority:** GEMINI_API_KEY → deterministic-only fallback
 *
 * **Execution errors:** Timeout (metadata.timedOut) or tool failures → immediate fail (score 0)
 */
/**
 * Custom grader result with additional metadata
 *
 * @internal
 */
type CustomGraderResult = {
  pass: boolean;
  score: number;
  reasoning: string;
  metadata: {
    expectedMcp: boolean;
    mcpToolCalled: boolean;
    deterministicScore?: number;
    llmScore?: number;
    hasErrors: boolean;
    hasTimeout: boolean;
    graderLatency?: number;
    llmLatency?: number;
  };
};

/**
 * Grade function that returns custom result with metadata
 *
 * @internal
 */
export const grade = async ({
  input,
  output,
  hint,
  trajectory,
  metadata,
}: Parameters<Grader>[0]): Promise<CustomGraderResult> => {
  // Normalize input to string
  const inputStr = Array.isArray(input) ? input.join(" ") : input;

  // Check for execution errors first
  const hasErrors = hasToolErrors(trajectory);
  const hasTimeout = metadata?.timedOut === true;

  // Fail immediately on errors or timeout
  if (hasErrors || hasTimeout) {
    return {
      pass: false,
      score: 0,
      reasoning: hasTimeout ? "Execution timed out" : "Tool execution failed with errors",
      metadata: {
        mcpToolCalled: false,
        expectedMcp: !!metadata?.mcpServer,
        hasErrors,
        hasTimeout,
      },
    };
  }

  // Determine if MCP was expected from metadata
  const expectedMcp = !!metadata?.mcpServer;

  // Hybrid quality assessment (deterministic 50% + LLM 50%)
  // Also detects MCP tool usage from scoring (5 pts = correct MCP tool used)
  const quality = await assessQuality({
    input: inputStr,
    output,
    hint: hint!, // All prompts in our dataset include hints
    trajectory,
    metadata,
  });

  // Combine scores (50 deterministic + 50 LLM = 100 total)
  const totalScore = quality.deterministicScore + quality.llmScore;
  const normalizedScore = totalScore / 100;
  const pass = normalizedScore >= 0.65; // 65% threshold (baseline without sources)

  return {
    pass,
    score: normalizedScore,
    reasoning: quality.reasoning,
    metadata: {
      expectedMcp,
      mcpToolCalled: quality.mcpToolCalled,
      deterministicScore: quality.deterministicScore,
      llmScore: quality.llmScore,
      hasErrors: false,
      hasTimeout: false,
      graderLatency: quality.graderLatency,
      llmLatency: quality.llmLatency,
    },
  };
};
