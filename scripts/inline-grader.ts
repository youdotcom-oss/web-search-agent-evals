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
 * Detects Model Context Protocol (MCP) tool usage by checking if tools from the expected
 * MCP server were called during execution. Uses metadata-driven detection to support any
 * MCP server and tool combination.
 *
 * ## Metadata-Driven Detection
 *
 * The function requires prompt metadata specifying:
 * - `mcp_server`: The MCP server name (e.g., "ydc-server")
 * - `expected_tools`: List of acceptable MCP tools (e.g., ["you-search", "you-express"])
 *
 * ## Detection Patterns by Agent
 *
 * ### Claude Code
 * **Pattern**: Tool names with `mcp__<server>__<tool>` format
 * - **Example**: `mcp__ydc-server__you-search`
 * - **Detection**: Extract server from tool name, verify it matches expected server
 *
 * ### Codex
 * **Pattern**: Explicit `mcpServer` field in trajectory steps
 * - **Example**: `{mcpServer: "ydc-server", toolName: "you-search"}`
 * - **Detection**: Check if `mcpServer` matches expected server
 *
 * ### DROID
 * **Pattern**: Tool names with `<server>___<tool>` format (triple underscore)
 * - **Example**: `ydc-server___you-search`
 * - **Detection**: Extract server from tool name, verify it matches expected server
 *
 * ### GEMINI
 * **Pattern**: Tool names match expected tools list
 * - **Example**: `you-search` or `you-search-<timestamp>-<id>`
 * - **Detection**: Check if tool name (base or timestamped) is in expected_tools list
 *
 * ## Benefits
 *
 * 1. **Future-proof**: Add any MCP server by updating prompt metadata
 * 2. **No hardcoding**: No agent-specific tool name patterns
 * 3. **Explicit**: Clear intent in prompt files
 * 4. **Testable**: Easy to verify detection against expected tools
 *
 * @param trajectory - Agent execution trajectory with tool calls and messages
 * @param metadata - Prompt metadata containing `mcp_server` and `expected_tools`
 * @returns `true` if any expected MCP tool was used, `false` otherwise
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
  }>,
  metadata?: {
    mcp_server?: string;
    expected_tools?: string[];
  }
): boolean => {
  // No MCP expected if metadata doesn't specify server
  if (!trajectory || !metadata?.mcp_server) return false;

  const expectedServer = metadata.mcp_server;
  const expectedTools = metadata.expected_tools || [];

  return trajectory.some((step) => {
    if (step.type !== "tool_call") return false;

    // Get tool identifier from various possible field names
    const toolIdentifier = step.name || step.toolName || step.title || "";

    // Claude Code: extract server from mcp__<server>__<tool>
    if (toolIdentifier.startsWith("mcp__")) {
      const parts = toolIdentifier.split("__");
      return parts[1] === expectedServer;
    }

    // Codex: check mcpServer field directly
    if (step.mcpServer) {
      return step.mcpServer === expectedServer;
    }

    // DROID: extract server from <server>___<tool>
    // Exclude false positives like Claude's tool IDs (toolu_)
    if (toolIdentifier.includes("___") && !toolIdentifier.startsWith("toolu_")) {
      const server = toolIdentifier.split("___")[0];
      return server === expectedServer;
    }

    // GEMINI: check if tool name matches any expected tool
    // Handle both base names and timestamped variants (you-search-123...)
    for (const expectedTool of expectedTools) {
      if (toolIdentifier === expectedTool || toolIdentifier.startsWith(`${expectedTool}-`)) {
        return true;
      }
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
      reasoning: hasTimeout
        ? "Execution timed out"
        : "Tool execution failed with errors",
      metadata: {
        mcpToolCalled: false,
        expectedMcp: !!metadata?.mcp_server,
        hasErrors,
        hasTimeout,
      },
    };
  }

  // Detect MCP usage from trajectory using metadata
  const mcpToolCalled = detectMcpFromTrajectory(trajectory, metadata);

  // Determine if MCP was expected from metadata
  const expectedMcp = !!metadata?.mcp_server;

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
