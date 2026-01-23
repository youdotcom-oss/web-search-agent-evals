import type { Grader } from "@plaited/agent-eval-harness/schemas";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Hybrid inline grader: Deterministic MCP validation + LLM quality judgment
 *
 * @remarks
 * **Priority 1 (Deterministic):** MCP detection is strict. If MCP requested but not used, immediate fail (score 0).
 *
 * **Priority 2 (Hybrid):** Output quality uses both deterministic (60%) and LLM (40%) scoring:
 * - **Deterministic (60 pts):** Completion (30), tool usage (20), MCP indicators (10)
 * - **LLM (40 pts):** Accuracy, relevance, completeness via Gemini Flash 2.0
 *
 * **Scoring breakdown:**
 * - Deterministic completion: 30 pts for substantial output (>50 chars)
 * - Deterministic tools: 20 pts for any tool usage
 * - Deterministic MCP: 10 pts for MCP indicators (3+ matches)
 * - LLM quality: 0-40 pts for accuracy, relevance, completeness
 *
 * **Pass threshold:** 70/100 (0.7 normalized score)
 *
 * **Calibration Required:** The LLM judge may hallucinate facts. Always:
 * - Review sampled failures manually before trusting scores
 * - Use `bunx @plaited/agent-eval-harness calibrate` to validate grader accuracy
 * - Check for systematic biases in LLM scoring
 * - Compare deterministic-only vs hybrid scoring distributions
 *
 * **Fallback:** Works without GEMINI_API_KEY (deterministic-only mode, max score 60/100)
 *
 * **MCP Detection:** Uses `metadata.agent` field (reliable) and trajectory tool calls (less reliable due to adapter deduplication)
 *
 * @public
 */

/**
 * MCP-specific data indicators from You.com
 *
 * @remarks
 * These patterns appear in You.com MCP responses but not in builtin search.
 * Used to verify MCP server was actually called.
 */
const MCP_INDICATORS = [
  "feels like", // Temperature detail
  "mph", // Wind speed
  "air quality", // Air quality info
  "uv index", // UV index
  "precipitation", // Precipitation detail
  "as of", // Timestamp format
  "pm pst", // Specific time format
  "am pst",
  "pm est",
  "am est",
];

/**
 * Check if MCP tool was actually called in trajectory
 *
 * @remarks
 * NOTE: Due to adapter schema deduplication, tool names in trajectory show
 * tool IDs (toolu_XXX) not actual MCP tool names. This function checks for
 * any completed tool calls as a proxy - if tools were called in an MCP run,
 * they were likely MCP tools.
 *
 * For reliable MCP detection, use metadata.agent field instead.
 */
const hasMcpToolCall = (
  trajectory?: Array<{
    type: string;
    name?: string;
    status?: string;
  }>,
): boolean => {
  if (!trajectory) return false;

  // Check for any completed tool calls
  // In MCP runs, these are likely MCP tool calls even if name shows ID
  return trajectory.some((step) => step.type === "tool_call" && step.status === "completed");
};

/**
 * Check if output contains MCP-specific data patterns
 *
 * @remarks
 * MCP (You.com) returns richer data than builtin search.
 * We require 3+ indicators to confirm MCP was used.
 *
 * NOTE: Current indicators are weather-specific and may not match all queries.
 * For reliable MCP detection, use metadata.agent field instead.
 */
const hasMcpDataIndicators = (output: string): number => {
  const lowerOutput = output.toLowerCase();
  return MCP_INDICATORS.filter((indicator) => lowerOutput.includes(indicator)).length;
};

/**
 * Check for errors or timeouts in execution
 */
const hasExecutionErrors = (
  output: string,
  trajectory?: Array<{
    type: string;
    status?: string;
  }>,
): { hasErrors: boolean; hasTimeout: boolean } => {
  const hasErrors =
    trajectory?.some((step) => step.type === "tool_call" && (step.status === "failed" || step.status === "error")) ??
    false;

  const hasTimeout = output.toLowerCase().includes("timeout") || output.toLowerCase().includes("timed out");

  return { hasErrors, hasTimeout };
};

/**
 * Hybrid quality assessment: deterministic (60%) + LLM (40%)
 *
 * @remarks
 * Deterministic scoring (60 pts):
 * - 30 pts: Completion (has substantial output, no errors/timeout)
 * - 20 pts: Tool usage (used search tools)
 * - 10 pts: MCP data (if MCP run, has MCP indicators)
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
  isMcpRun,
}: {
  input: string;
  output: string;
  hint?: string;
  trajectory?: Array<{ type: string; name?: string; status?: string }>;
  isMcpRun: boolean;
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

  // 20 pts: Tool usage (used search tools)
  const hasSearchTool = trajectory?.some((step) => step.type === "tool_call" && step.status === "completed") ?? false;
  if (hasSearchTool) {
    deterministicScore += 20;
  }

  // 10 pts: MCP validation (if MCP run, check indicators)
  if (isMcpRun) {
    const mcpIndicatorCount = hasMcpDataIndicators(output);
    if (mcpIndicatorCount >= 3) {
      deterministicScore += 10;
    }
  } else {
    // For builtin runs, give 10 pts if they have content
    if (hasContent) {
      deterministicScore += 10;
    }
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

  const reasoning = `Deterministic: ${deterministicScore}/60 (content=${hasContent}, tools=${hasSearchTool}). LLM: ${llmScore}/40. ${llmReasoning}`;

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
 * **MCP Gate (Priority 1):** If prompt requests MCP but MCP not used → immediate fail (score 0)
 *
 * **Hybrid Scoring (Priority 2):**
 * - Deterministic: 60 pts (completion, tool usage, MCP indicators)
 * - LLM: 40 pts (accuracy, relevance, completeness)
 * - Pass threshold: 70/100
 *
 * **Execution errors:** Timeout or tool failures → immediate fail (score 0)
 *
 * **Fallback:** Works without API key (deterministic-only, max 60 pts)
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

  // Detect if this is an MCP run (check prompt for MCP server specification)
  const isMcpRun = inputStr.includes('mcp-server="ydc-server"');

  // Check for execution errors
  const { hasErrors, hasTimeout } = hasExecutionErrors(output, trajectory);

  // Fail immediately on errors or timeout
  if (hasErrors || hasTimeout) {
    return {
      pass: false,
      score: 0,
      reasoning: hasTimeout ? "Execution timed out" : "Tool execution failed with errors",
      metadata: {
        isMcpRun,
        mcpToolCalled: false,
        mcpIndicatorCount: 0,
        qualityPassed: false,
        hasErrors,
        hasTimeout,
      },
    };
  }

  // For MCP runs: check if MCP was actually used
  const mcpToolCalled = hasMcpToolCall(trajectory);
  const mcpIndicatorCount = hasMcpDataIndicators(output);

  // CRITICAL MCP gate: If prompt requests MCP but MCP not used, immediate FAIL
  if (isMcpRun && !mcpToolCalled && mcpIndicatorCount < 3) {
    return {
      pass: false,
      score: 0,
      reasoning: `MCP requested but NOT used! Tool called: ${mcpToolCalled}, indicators: ${mcpIndicatorCount}. MCP config may be broken.`,
      metadata: {
        isMcpRun: true,
        mcpToolCalled,
        mcpIndicatorCount,
        deterministicScore: 0,
        llmScore: 0,
        hasErrors: false,
        hasTimeout: false,
      },
    };
  }

  // Hybrid quality assessment (deterministic 60% + LLM 40%)
  const quality = await assessQuality({
    input: inputStr,
    output,
    hint,
    trajectory,
    isMcpRun,
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
      isMcpRun,
      mcpToolCalled,
      mcpIndicatorCount,
      deterministicScore: quality.deterministicScore,
      llmScore: quality.llmScore,
      hasErrors: false,
      hasTimeout: false,
    },
  };
};
