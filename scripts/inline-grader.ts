import type { Grader } from "@plaited/agent-eval-harness/schemas";
import { GoogleGenAI } from "@google/genai";

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
 * - **Deterministic (60 base, 70 max):** Basic output (10), tool usage (25), no errors (25), sources bonus (10)
 * - **LLM (30 pts):** Query match, source evidence, content substance, format quality via Gemini Flash 3.0
 * - **Pass threshold:** 65/100 (0.65 normalized score)
 *
 * **Deterministic Breakdown:**
 * - 10 pts: Basic output (>= 40 chars)
 * - 25 pts: Correct tool usage
 * - 25 pts: No execution errors
 * - 10 pts: Sources bonus (URLs/references)
 *
 * **Tool Usage (25 pts):**
 * - If MCP expected: 25 pts for correct tool, 15 pts for wrong tool, 0 for no tool
 * - If builtin (no MCP): 25 pts for any tool, 0 for no tool
 *
 * **Pass Threshold Logic:**
 * - Baseline (no sources): 10 + 25 + 25 = 60 pts
 * - With sources: 60 + 10 = 70 pts deterministic + up to 30 LLM = 100 max
 * - Pass requires 65/100, so agents need sources OR LLM boost to pass
 * - Structure/formatting judged by LLM (Format Quality dimension)
 *
 * **Execution Errors:** Timeout or tool failures result in immediate fail (score 0)
 *
 * **Fallback:** Works without GEMINI_API_KEY (deterministic-only mode, max 70/100)
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
 * Check for errors or timeouts in execution
 */
const hasExecutionErrors = (
  output: string,
  trajectory?: Array<{
    type: string;
    status?: string;
    content?: string;
  }>,
): { hasErrors: boolean; hasTimeout: boolean } => {
  const hasErrors =
    trajectory?.some((step) => step.type === "tool_call" && (step.status === "failed" || step.status === "error")) ??
    false;

  const hasTimeout = output.toLowerCase().includes("timeout") || output.toLowerCase().includes("timed out");

  return { hasErrors, hasTimeout };
};

/**
 * Assess basic output presence
 *
 * @returns 10 points if output exists (>= 40 chars), 0 if empty
 */
const assessBasicOutput = (output: string): number => {
  return output.length >= 40 ? 10 : 0;
};

/**
 * Assess source evidence (bonus points)
 *
 * @returns 10 points if output has URLs/sources, 0 otherwise
 */
const assessSources = (output: string): number => {
  const hasSources = /https?:\/\/|source:|reference:/i.test(output);
  return hasSources ? 10 : 0;
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
 *   - 25 pts: Correct MCP tool used (matches expected server/tools)
 *   - 15 pts: Any tool used (wrong choice)
 *   - 0 pts: No tools
 * - **If NO MCP expected** (builtin):
 *   - 25 pts: Any tool used (full credit for builtin)
 *   - 0 pts: No tools
 *
 * @param trajectory - Agent execution trajectory with tool calls
 * @param metadata - Prompt metadata containing `mcpServer` and `expectedTools`
 * @returns Score from 0-25 points based on tool correctness
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

    return usedCorrectTool ? 25 : 15; // Full credit for correct, partial for wrong
  }

  // Case 2: Builtin (no MCP) - any tool usage gets full credit
  return 25;
};

/**
 * Hybrid quality assessment: deterministic (65-70%) + LLM (30%)
 *
 * @remarks
 * Deterministic scoring (60 base pts, 70 max with sources bonus):
 * - 10 pts: Basic output (>= 40 chars)
 * - 25 pts: Correct tool usage
 * - 25 pts: No execution errors
 * - 10 pts: Sources bonus (URLs/references)
 *
 * LLM scoring (30 pts max):
 * - Query match, source evidence, content substance, format quality
 * - Uses Gemini Flash 3.0 for web search result evaluation
 *
 * Pass threshold: 0.65 (65/100)
 * - Baseline without sources = 60 pts (10 + 25 + 25)
 * - With sources = 70 pts deterministic + up to 30 LLM = 100 max
 * - Agents need sources OR LLM quality boost to reach 65/100 pass threshold
 * - Structure/formatting judged by LLM, not deterministic
 *
 * Falls back to deterministic-only if GEMINI_API_KEY not available.
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
  hint?: string;
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

  // Phase 1: Deterministic scoring (60 base, 70 max)
  let deterministicScore = 0;

  // 10 pts: Basic output
  const basicOutput = assessBasicOutput(output);
  deterministicScore += basicOutput;

  // 25 pts: Correct tool usage
  const toolScore = assessToolUsage(trajectory, metadata);
  deterministicScore += toolScore;

  // 25 pts: No execution errors
  const { hasErrors } = hasExecutionErrors(output, trajectory);
  const cleanScore = !hasErrors && output.length >= 40 ? 25 : 0;
  deterministicScore += cleanScore;

  // 10 pts: Sources bonus
  const sourcesBonus = assessSources(output);
  deterministicScore += sourcesBonus;

  // Phase 2: LLM quality judgment (30 pts max)
  let llmScore = 0;
  let llmReasoning = "";
  let llmLatency = 0;

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    const llmStart = performance.now();
    try {
      const ai = new GoogleGenAI({ apiKey });

      const contents = `Role: Search Quality Evaluator. Grade this web search result without verifying facts.

Query: "${input}"
${hint ? `Target: ${hint}` : ""}

Result:
${output || "(no output)"}

Score 0-30 across 4 dimensions:

**Query Match (0-15)**: Does it answer the search query?
Scoring: Full answer = 15, Partial = 10, Tangential = 5, Off-topic = 0

**Source Evidence (0-5)**: Are sources/URLs cited?
Scoring: Multiple URLs = 5, Vague sources = 3, None = 0

**Content Substance (0-5)**: Specific info or generic fluff?
Scoring: Dense/specific = 5, Mixed = 3, Fluff = 0

**Format Quality (0-5)**: Is it well-organized?
Scoring: Clear structure = 5, Basic = 3, Poor = 0

Note: Judge search quality indicators only, not factual correctness.

JSON:
{
  "score": 24,
  "reasoning": "Match: 14/15, Evidence: 4/5, Substance: 3/5, Format: 3/5"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents,
      });
      const { text } = response;
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text?.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const llmResult = JSON.parse(jsonMatch[0]) as {
          score: number;
          reasoning?: string;
        };

        if (typeof llmResult.score === "number") {
          llmScore = Math.min(30, Math.max(0, llmResult.score));
          llmReasoning = llmResult.reasoning || "";
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

  const reasoning = `Deterministic: ${deterministicScore}/70 (basic=${basicOutput}, tools=${toolScore}, clean=${cleanScore}, sources=${sourcesBonus}). LLM: ${llmScore}/30. ${llmReasoning}`;

  // Derive MCP tool usage from score: true only if MCP expected and got full 25 points
  const mcpToolCalled = !!(metadata?.mcpServer && metadata?.expectedTools?.length && toolScore === 25);

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
 * **MCP Detection:** Uses metadata from prompts to verify expected MCP tool usage:
 * - Prompt metadata specifies `mcpServer` and `expectedTools`
 * - Agent schemas extract tool names from CLI output
 * - Grader checks if any expected tool was actually called
 * - Works across all agent types (Claude Code, Codex, DROID, GEMINI)
 *
 * **Hybrid Scoring:**
 * - Deterministic: 70 pts (output quality, correct tool usage, no errors)
 * - LLM: 30 pts (query match, source evidence, content substance, format quality)
 * - Pass threshold: 70/100
 *
 * **Execution errors:** Timeout or tool failures → immediate fail (score 0)
 *
 * **Fallback:** Works without GEMINI_API_KEY (deterministic-only, max 70 pts)
 *
 * **Latency Tracking:** Records grader execution time (graderLatency, llmLatency)
 *
 * @param input - The prompt (string or multi-turn array)
 * @param output - Agent's final output
 * @param hint - Expected content for grading context
 * @param trajectory - Full execution trace with tool calls
 * @param metadata - Prompt metadata with MCP server info
 *
 * @returns Grading result with pass/fail, normalized score (0-1), reasoning, and metadata
 */
export const grade: Grader = async ({ input, output, hint, trajectory, metadata }) => {
  // Normalize input to string
  const inputStr = Array.isArray(input) ? input.join(" ") : input;

  // Check for execution errors first
  const { hasErrors, hasTimeout } = hasExecutionErrors(output, trajectory);

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

  // Hybrid quality assessment (deterministic 70% + LLM 30%)
  // Also detects MCP tool usage from scoring (25 pts = correct MCP tool used)
  const quality = await assessQuality({
    input: inputStr,
    output,
    hint,
    trajectory,
    metadata,
  });

  // Combine scores (70 deterministic + 30 LLM = 100 total)
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
