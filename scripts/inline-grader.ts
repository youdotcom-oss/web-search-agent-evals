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
 * - Detection patterns documented in `detectMcpFromTrajectory()` function below
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
 * - `mcpServer`: The MCP server name (e.g., "ydc-server")
 * - `expectedTools`: expected MCP tools (e.g., ["you-search", "you-express"])
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
 * - **Detection**: Check if tool name (base or timestamped) is in expectedTools list
 *
 * ## Benefits
 *
 * 1. **Future-proof**: Add any MCP server by updating prompt metadata
 * 2. **No hardcoding**: No agent-specific tool name patterns
 * 3. **Explicit**: Clear intent in prompt files
 * 4. **Testable**: Easy to verify detection against expected tools
 *
 * @param trajectory - Agent execution trajectory with tool calls and messages
 * @param metadata - Prompt metadata containing `mcpServer` and `expectedTools`
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
    mcpServer?: string;
    expectedTools?: string[];
  },
): boolean => {
  // No MCP expected if metadata doesn't specify server
  if (!trajectory || !metadata?.mcpServer) return false;

  const { mcpServer, expectedTools } = metadata;

  return trajectory.some((step) => {
    if (step.type !== "tool_call") return false;

    // Get tool identifier from various possible field names
    const toolIdentifier = step.name || step.toolName || step.title || "";

    // Claude Code: extract server from mcp__<server>__<tool>
    if (toolIdentifier.startsWith("mcp__")) {
      const parts = toolIdentifier.split("__");
      return parts[1] === mcpServer;
    }

    // Codex: check mcpServer field directly
    if (step.mcpServer) {
      return step.mcpServer === mcpServer;
    }

    // DROID: extract server from <server>___<tool>
    // Exclude false positives like Claude's tool IDs (toolu_)
    if (toolIdentifier.includes("___") && !toolIdentifier.startsWith("toolu_")) {
      const server = toolIdentifier.split("___")[0];
      return server === mcpServer;
    }

    // GEMINI: check if tool name matches any expected tool
    // Handle both base names and timestamped variants (you-search-123...)
    if (expectedTools?.some((tool) => toolIdentifier === tool || toolIdentifier.startsWith(`${tool}-`))) {
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
 * Assess correct tool usage
 *
 * @returns 0-25 points based on tool correctness
 *
 * Logic:
 * - If MCP expected (metadata.mcpServer and metadata.expectedTools exist):
 *   - 25 pts if correct MCP tool used (matches any in expectedTools, e.g., "you-search")
 *   - 15 pts if any tool used (wrong choice)
 *   - 0 pts if no tools
 * - If NO MCP expected (builtin):
 *   - 25 pts if any tool used (full credit for builtin)
 *   - 0 pts if no tools
 */
const assessToolUsage = (
  trajectory?: Array<{
    type: string;
    name?: string;
    toolName?: string;
    title?: string;
  }>,
  metadata?: { expectedTools?: string[]; mcpServer?: string },
): number => {
  const toolCalls = trajectory?.filter((s) => s.type === "tool_call") ?? [];

  // No tools used at all
  if (toolCalls.length === 0) return 0;

  const expectedMcpServer = metadata?.mcpServer;
  const expectedTools = metadata?.expectedTools;

  // Case 1: MCP expected - validate correct tool
  if (expectedMcpServer && expectedTools?.length) {
    const usedCorrectTool = toolCalls.some((call) => {
      const toolIdentifier = call.name || call.toolName || call.title || "";

      // Check if tool name includes any expected tool (e.g., "you-search", "you-express")
      if (expectedTools.some((tool) => toolIdentifier.includes(tool))) return true;

      // Also check if tool name includes expected MCP server
      if (toolIdentifier.includes(expectedMcpServer)) return true;

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
    expectedTools?: string[];
  };
}): Promise<{
  deterministicScore: number;
  llmScore: number;
  reasoning: string;
  graderLatency: number;
  llmLatency: number;
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

  return {
    deterministicScore,
    llmScore,
    reasoning,
    graderLatency: totalLatency,
    llmLatency,
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

  // Detect MCP usage from trajectory using metadata
  const mcpToolCalled = detectMcpFromTrajectory(trajectory, metadata);

  // Determine if MCP was expected from metadata
  const expectedMcp = !!metadata?.mcpServer;

  // Hybrid quality assessment (deterministic 70% + LLM 30%)
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
      mcpToolCalled,
      deterministicScore: quality.deterministicScore,
      llmScore: quality.llmScore,
      hasErrors: false,
      hasTimeout: false,
      graderLatency: quality.graderLatency,
      llmLatency: quality.llmLatency,
    },
  };
};
