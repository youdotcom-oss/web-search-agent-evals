#!/usr/bin/env bun
import type { ComparisonGrader } from "@plaited/agent-eval-harness/pipeline";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * MCP indicators - signs that You.com MCP was used
 */
const MCP_INDICATORS = [
  "feels like", // Temperature detail
  "mph", // Wind speed
  "air quality", // Air quality info
  "uv index", // UV index
  "precipitation", // Precipitation detail
  "as of", // Timestamp format
  "pm pst", // Specific time format
  "am pst", // Specific time format
  "pm est",
  "am est",
];

/**
 * Check if output likely came from MCP server
 */
const hasMcpIndicators = (output: string): boolean => {
  const lowerOutput = output.toLowerCase();
  const matchCount = MCP_INDICATORS.filter((indicator) => lowerOutput.includes(indicator)).length;
  return matchCount >= 3;
};

/**
 * Check if run label suggests MCP usage
 */
const isMcpRun = (label: string): boolean => {
  const lower = label.toLowerCase();
  return lower.includes("you") || lower.includes("mcp") || lower.includes("ydc");
};

/**
 * Hybrid comparison grader: Deterministic facts + LLM quality judgment + MCP validation
 *
 * Deterministic (60 points max):
 * - Completion (30 pts): Did it produce output?
 * - Tool usage (20 pts): Did it use web search?
 * - MCP validation (10 pts): If MCP run, does output show MCP indicators?
 *
 * LLM Quality (40 points max):
 * - Accuracy: Is the information correct?
 * - Relevance: Does it answer the query?
 * - Completeness: Are all aspects covered?
 *
 * @remarks
 * Falls back to deterministic-only scoring if GEMINI_API_KEY is not available.
 * Validates MCP runs show different data patterns than builtin.
 *
 * @public
 */
export const grade: ComparisonGrader = async ({ id: _id, input, hint, runs }) => {
  const scores: Record<string, { deterministic: number; llm: number; mcpStatus?: string; total: number }> = {};

  // Phase 1: Deterministic scoring (fast, objective)
  for (const [label, result] of Object.entries(runs)) {
    let deterministicScore = 0;

    // Completion check (30 pts)
    if (result.output && result.output.length > 0) {
      deterministicScore += 30;
    }

    // Tool usage check (20 pts)
    const usedWebSearch = result.trajectory?.some(
      (step) =>
        step.type === "tool_call" &&
        (step.name?.toLowerCase().includes("search") || step.name?.toLowerCase().includes("web")),
    );
    if (usedWebSearch) {
      deterministicScore += 20;
    }

    // MCP validation (10 pts)
    let mcpStatus: string | undefined;
    if (isMcpRun(label)) {
      const hasMcp = hasMcpIndicators(result.output);
      if (hasMcp) {
        deterministicScore += 10;
        mcpStatus = "verified";
      } else {
        deterministicScore += 0;
        mcpStatus = "not_detected";
      }
    }

    scores[label] = { deterministic: deterministicScore, llm: 0, mcpStatus, total: 0 };
  }

  // Phase 2: LLM quality judgment (slower, nuanced)
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const genai = new GoogleGenerativeAI(apiKey);
      const model = genai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const prompt = `Compare these agent outputs for the query: "${input}"
${hint ? `\nExpected content: ${hint}` : ""}

Outputs to compare:
${Object.entries(runs)
  .map(
    ([label, result]) => `
${label}:
${result.output || "(no output)"}
`,
  )
  .join("\n")}

Rate each output on a scale of 0-40 based on:
- Accuracy: Is the information correct?
- Relevance: Does it answer the query?
- Completeness: Are all aspects addressed?

Return ONLY valid JSON with this structure:
{
  "scores": {
    "label1": 35,
    "label2": 28
  },
  "reasoning": "Brief explanation of rankings"
}
`;

      const response = await model.generateContent(prompt);
      const text = response.response.text();

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const llmResult = JSON.parse(jsonMatch[0]) as { scores: Record<string, number>; reasoning?: string };

        // Combine deterministic + LLM scores
        for (const [label, llmScore] of Object.entries(llmResult.scores)) {
          if (scores[label]) {
            scores[label].llm = llmScore;
            scores[label].total = scores[label].deterministic + llmScore;
          }
        }
      }
    } catch (error) {
      console.error("LLM grading failed, using deterministic only:", error);
      // Fallback: use only deterministic scores
      for (const label of Object.keys(scores)) {
        scores[label].total = scores[label].deterministic;
      }
    }
  } else {
    // No API key: use only deterministic scores
    for (const label of Object.keys(scores)) {
      scores[label].total = scores[label].deterministic;
    }
  }

  // Sort by total score descending
  const rankings = Object.entries(scores)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([label, scoreBreakdown], index) => ({
      run: label,
      rank: index + 1,
      score: scoreBreakdown.total / 100, // Normalize to 0-1
      metadata: {
        deterministic: scoreBreakdown.deterministic,
        llm: scoreBreakdown.llm,
        ...(scoreBreakdown.mcpStatus && { mcpStatus: scoreBreakdown.mcpStatus }),
      },
    }));

  const best = rankings[0];
  const mcpInfo = best.metadata.mcpStatus ? `, mcp: ${best.metadata.mcpStatus}` : "";
  const reasoning = `${best.run} ranked #1 (score: ${best.score.toFixed(2)}, deterministic: ${best.metadata.deterministic}, llm: ${best.metadata.llm}${mcpInfo})`;

  return { rankings, reasoning };
};
