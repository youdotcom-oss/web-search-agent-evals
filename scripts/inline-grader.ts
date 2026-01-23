import type { Grader } from "@plaited/agent-eval-harness/schemas";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Hybrid inline grader: Deterministic scoring + LLM quality judgment
 *
 * @remarks
 * **MCP Detection:** Uses explicit tool name indicators from trajectory (see FINDINGS-MCP-RAW-OUTPUT.md):
 * - **Claude Code**: tool names with `mcp__` prefix (e.g., `mcp__ydc-server__you-search`)
 * - **Codex**: trajectory steps with `mcpServer` field
 * - **DROID**: tool names with `___` separator (e.g., `ydc-server___you-search`)
 * - **GEMINI**: tool name `you-search` (vs builtin `google_web_search`)
 * - Schemas extract these fields from raw CLI output for authoritative detection
 *
 * **Hybrid Scoring:**
 * - **Deterministic (60 pts):** Completion (30), tool usage (20), quality bonus (10)
 * - **LLM (40 pts):** Accuracy, relevance, completeness via Gemini Flash 2.0
 * - **Pass threshold:** 70/100 (0.7 normalized score)
 *
 * **Execution Errors:** Timeout or tool failures result in immediate fail (score 0)
 *
 * **Fallback:** Works without GEMINI_API_KEY (deterministic-only mode, max score 60/100)
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
 * Detect MCP tool usage from agent trajectory
 *
 * @remarks
 * Detects Model Context Protocol (MCP) tool usage by checking explicit indicators
 * extracted from raw CLI output by adapter schemas. Each agent platform has a unique
 * MCP signature pattern that reliably distinguishes MCP tools from builtin tools.
 *
 * ## Detection Patterns by Agent
 *
 * ### Claude Code
 * **Pattern**: Tool names with `mcp__<server>__<tool>` format
 * - **Example**: `mcp__ydc-server__you-search`
 * - **How it works**: Claude Code prefixes all MCP tool names with the server name
 * - **Schema field**: `name` or `toolName`
 * - **Detection**: Check if tool name starts with `mcp__`
 *
 * ### Codex
 * **Pattern**: Explicit `mcpServer` field in trajectory steps
 * - **Example**: `{type: "tool_call", mcpServer: "ydc-server", toolName: "you-search"}`
 * - **How it works**: Codex uses dedicated `mcp_tool_call` event type with separate server field
 * - **Schema field**: `mcpServer`
 * - **Detection**: Check if `mcpServer` field exists
 *
 * ### DROID
 * **Pattern**: Tool names with `<server>___<tool>` format (triple underscore)
 * - **Example**: `ydc-server___you-search`
 * - **How it works**: DROID concatenates server and tool names with triple underscore separator
 * - **Schema field**: `name`
 * - **Detection**: Check if tool name contains `___` (excluding Claude tool IDs like `toolu_`)
 * - **False positives avoided**: `toolu_01ABC...` (Claude's internal IDs use single underscore)
 *
 * ### GEMINI
 * **Pattern**: Specific MCP tool names vs builtin tool names
 * - **MCP example**: `you-search` or `you-search-1769145251964-7bebc5cb4e7ed8`
 * - **Builtin example**: `google_web_search` or `google_web_search-<timestamp>-<id>`
 * - **How it works**: GEMINI uses different tool names for MCP vs builtin implementations
 * - **Schema field**: `name`
 * - **Detection**: Check if tool name is `you-search` or starts with `you-search-`
 * - **Note**: Message content with `<web-search mcp-server="...">` is the INPUT prompt, not a trajectory indicator
 *
 * ## Why This Approach Works
 *
 * 1. **No heuristics**: Uses explicit indicators from agent output, not content analysis
 * 2. **Reliable**: These patterns are part of each agent's MCP implementation
 * 3. **Fast**: Simple string checks, no complex parsing or LLM calls
 * 4. **Maintainable**: Each agent pattern is independent and well-documented
 *
 * ## Investigation References
 *
 * - **Claude Code/Codex**: See FINDINGS-MCP-RAW-OUTPUT.md for raw CLI output analysis
 * - **DROID/GEMINI**: See FINDINGS-DROID-GEMINI-MCP.md for trajectory analysis
 *
 * @param trajectory - Agent execution trajectory with tool calls and messages
 * @returns `true` if any MCP tool usage detected, `false` otherwise
 *
 * @public
 */
const detectMcpFromTrajectory = (
  trajectory?: Array<{
    type: string;
    toolName?: string;
    mcpServer?: string;
    name?: string;
    title?: string;
    content?: string;
  }>
): boolean => {
  if (!trajectory) return false;

  return trajectory.some((step) => {
    // Get tool identifier from various possible field names
    // Different schemas extract to different fields (name, toolName, title)
    const toolIdentifier = step.name || step.toolName || step.title || "";

    // Claude Code: tool names with mcp__<server>__<tool> pattern
    // Example: mcp__ydc-server__you-search
    if (toolIdentifier.startsWith("mcp__")) return true;

    // Codex: explicit mcpServer field from mcp_tool_call events
    // Example: {mcpServer: "ydc-server", toolName: "you-search"}
    if (step.mcpServer) return true;

    // DROID: tool names with <server>___<tool> pattern (triple underscore)
    // Example: ydc-server___you-search
    // Exclude Claude's internal tool IDs (toolu_01ABC...) which use single underscore
    if (
      step.type === "tool_call" &&
      toolIdentifier.includes("___") &&
      !toolIdentifier.startsWith("toolu_")
    ) {
      return true;
    }

    // GEMINI: MCP tool name vs builtin tool name
    // MCP: you-search or you-search-<timestamp>-<id>
    // Builtin: google_web_search or google_web_search-<timestamp>-<id>
    if (
      step.type === "tool_call" &&
      (toolIdentifier === "you-search" || toolIdentifier.startsWith("you-search-"))
    ) {
      return true;
    }

    return false;
  });
};

/**
 * Check for errors or timeouts in execution
 */
const hasExecutionErrors = (
  output: string,
  trajectory?: Array<{
    type: string;
    status?: string;
    content?: string;
  }>
): { hasErrors: boolean; hasTimeout: boolean } => {
  const hasErrors =
    trajectory?.some(
      (step) =>
        step.type === "tool_call" &&
        (step.status === "failed" || step.status === "error")
    ) ?? false;

  const hasTimeout =
    output.toLowerCase().includes("timeout") ||
    output.toLowerCase().includes("timed out");

  return { hasErrors, hasTimeout };
};

/**
 * Hybrid quality assessment: deterministic (60%) + LLM (40%)
 *
 * @remarks
 * Deterministic scoring (60 pts):
 * - 30 pts: Completion (has substantial output >50 chars)
 * - 20 pts: Tool usage (any tool calls in trajectory)
 * - 10 pts: Quality bonus (has content and no errors)
 *
 * LLM scoring (40 pts):
 * - Accuracy: Is the information correct?
 * - Relevance: Does it answer the query?
 * - Completeness: Are all aspects covered?
 *
 * Falls back to deterministic-only if GEMINI_API_KEY not available.
 */
const assessQuality = async ({
  input,
  output,
  hint,
  trajectory,
}: {
  input: string;
  output: string;
  hint?: string;
  trajectory?: Array<{
    type: string;
    name?: string;
    status?: string;
    content?: string;
  }>;
}): Promise<{
  deterministicScore: number;
  llmScore: number;
  reasoning: string;
}> => {
  // Phase 1: Deterministic scoring (60 pts max)
  let deterministicScore = 0;

  // 30 pts: Completion (has substantial output)
  const hasContent = output.length > 50;
  if (hasContent) {
    deterministicScore += 30;
  }

  // 20 pts: Tool usage (any tool calls in trajectory)
  const usedTools =
    trajectory?.some((step) => step.type === "tool_call") ?? false;
  if (usedTools) {
    deterministicScore += 20;
  }

  // 10 pts: Quality bonus (has content and no execution errors)
  const { hasErrors } = hasExecutionErrors(output, trajectory);
  if (hasContent && !hasErrors) {
    deterministicScore += 10;
  }

  // Phase 2: LLM quality judgment (40 pts max)
  let llmScore = 0;
  let llmReasoning = "";

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const genai = new GoogleGenerativeAI(apiKey);
      const model = genai.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
      });

      const prompt = `Evaluate this agent output for the query: "${input}"
${hint ? `\nExpected content: ${hint}` : ""}

Output:
${output || "(no output)"}

Rate the output on a scale of 0-40 based on:
- Accuracy: Is the information correct? (0-15 pts)
- Relevance: Does it answer the query? (0-15 pts)
- Completeness: Are all aspects addressed? (0-10 pts)

**IMPORTANT:** If you cannot confidently judge accuracy (e.g., you don't have access to current facts), return a score of 0 and explain why in the reasoning. Do not hallucinate facts or make up information.

Return ONLY valid JSON with this structure:
{
  "score": 35,
  "reasoning": "Brief explanation"
}`;

      const response = await model.generateContent(prompt);
      const text = response.response.text();

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const llmResult = JSON.parse(jsonMatch[0]) as {
          score: number;
          reasoning?: string;
        };

        if (typeof llmResult.score === "number") {
          llmScore = Math.min(40, Math.max(0, llmResult.score));
          llmReasoning = llmResult.reasoning || "";
        }
      }
    } catch (_: unknown) {
      // Fallback: LLM scoring failed, use deterministic only
      llmReasoning = "LLM grading failed";
    }
  } else {
    llmReasoning = "No GEMINI_API_KEY (deterministic-only mode)";
  }

  const reasoning = `Deterministic: ${deterministicScore}/60 (content=${hasContent}, tools=${usedTools}). LLM: ${llmScore}/40. ${llmReasoning}`;

  return {
    deterministicScore,
    llmScore,
    reasoning,
  };
};

/**
 * Inline grader with hybrid scoring
 *
 * @remarks
 * **MCP Detection (Authoritative):** Uses explicit indicators from trajectory:
 * - **Claude Code**: Checks for `mcp__` prefix in tool names
 * - **Codex**: Checks for `mcpServer` field in trajectory steps
 * - **DROID**: Checks for `___` separator in tool names
 * - **GEMINI**: Checks for `you-search` tool name
 * - Schemas extract these fields from raw CLI output (see FINDINGS-MCP-RAW-OUTPUT.md)
 *
 * **Hybrid Scoring:**
 * - Deterministic: 60 pts (completion, tool usage, quality bonus)
 * - LLM: 40 pts (accuracy, relevance, completeness)
 * - Pass threshold: 70/100
 *
 * **Execution errors:** Timeout or tool failures → immediate fail (score 0)
 *
 * **Fallback:** Works without GEMINI_API_KEY (deterministic-only, max 60 pts)
 *
 * @param input - The prompt (string or multi-turn array)
 * @param output - Agent's final output
 * @param hint - Expected content for grading context
 * @param trajectory - Full execution trace with tool calls
 *
 * @returns Grading result with pass/fail, normalized score (0-1), reasoning, and metadata
 */
export const grade: Grader = async ({ input, output, hint, trajectory }) => {
  // Normalize input to string
  const inputStr = Array.isArray(input) ? input.join(" ") : input;

  // Check for execution errors first
  const { hasErrors, hasTimeout } = hasExecutionErrors(output, trajectory);

  // Fail immediately on errors or timeout
  if (hasErrors || hasTimeout) {
    return {
      pass: false,
      score: 0,
      reasoning: hasTimeout
        ? "Execution timed out"
        : "Tool execution failed with errors",
      metadata: {
        mcpToolCalled: false,
        hasErrors,
        hasTimeout,
      },
    };
  }

  // Detect MCP usage from trajectory (authoritative method)
  const mcpToolCalled = detectMcpFromTrajectory(trajectory);

  // Determine if MCP was expected from the input prompt
  const expectedMcp = inputStr.startsWith("<web-search mcp-server=");

  // Hybrid quality assessment (deterministic 60% + LLM 40%)
  const quality = await assessQuality({
    input: inputStr,
    output,
    hint,
    trajectory,
  });

  // Combine scores
  const totalScore = quality.deterministicScore + quality.llmScore;
  const normalizedScore = totalScore / 100;
  const pass = normalizedScore >= 0.7; // 70% threshold

  return {
    pass,
    score: normalizedScore,
    reasoning: quality.reasoning,
    metadata: {
      expectedMcp,
      mcpToolCalled,
      deterministicScore: quality.deterministicScore,
      llmScore: quality.llmScore,
      hasErrors: false,
      hasTimeout: false,
    },
  };
};
