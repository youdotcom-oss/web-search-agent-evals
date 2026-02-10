/**
 * LLM grading logic for structured per-dimension scoring
 *
 * @remarks
 * Used by `inline-grader.ts` (Gemini API path).
 * Provides prompt construction, response parsing, and score computation.
 *
 * Dimensions (50 pts total):
 * - Query Match (0-15): Does it answer the search query?
 * - Target Alignment (0-15): Does it match the expected answer?
 * - Content Substance (0-10): Specific details vs generic fluff?
 * - Format Quality (0-10): Well-organized and readable?
 *
 * @public
 */

/**
 * Structured LLM response with per-dimension scores
 */
export type LlmDimensions = {
  queryMatch: number;
  targetAlignment: number;
  contentSubstance: number;
  formatQuality: number;
  reasoning: string;
};

/**
 * Build the LLM grading prompt for structured per-dimension scoring
 *
 * @remarks
 * Includes an instruction to ignore agent process noise when scoring Format Quality,
 * avoiding the need for lossy pre-processing of the output.
 */
export const buildGradingPrompt = ({ input, output, hint }: { input: string; output: string; hint: string }): string =>
  `Role: Search Quality Evaluator. Grade this web search result strictly.

Query: "${input}"
Target: ${hint}

Result:
${output || "(no output)"}

Score across 4 dimensions. Return ONLY a JSON object with per-dimension scores:

**queryMatch (0-15)**: Does it answer the search query?
15 = Complete, direct answer | 10 = Mostly answers | 7 = Partial | 3 = Tangential | 0 = Off-topic

**targetAlignment (0-15)**: Does the result contain the expected information from the Target field above?
15 = Contains key facts from target | 10 = Most target info present | 5 = Some overlap | 0 = Missing target info entirely

**contentSubstance (0-10)**: Specific info or generic fluff?
10 = Dense with specific details | 7 = Good detail | 3 = Mixed | 0 = Vague/generic

**formatQuality (0-10)**: Is it well-organized and readable?
10 = Clear structure with headings/lists | 7 = Good structure | 3 = Basic | 0 = Poor/unreadable
IMPORTANT: The result may contain agent process noise (lines starting with > or $, DEBUG/INFO/WARN log lines, timestamps). Ignore this noise entirely when scoring format — only evaluate the actual answer content.

Calibration: Most acceptable answers score 20-35 total. Reserve 40+ for exceptional, comprehensive results only. A passing answer that merely addresses the query with basic detail should score ~25 total.

JSON:
{
  "queryMatch": 10,
  "targetAlignment": 8,
  "contentSubstance": 5,
  "formatQuality": 4,
  "reasoning": "Brief explanation of scores"
}`;

/**
 * Parse structured LLM dimensions from JSON response text
 *
 * @remarks
 * Extracts the first JSON object from the response, validates field types,
 * and clamps values to their dimension bounds. Returns null on parse failure.
 */
export const parseLlmDimensions = (text: string): LlmDimensions | null => {
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) return null;

  try {
    const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const queryMatch = typeof raw.queryMatch === "number" ? Math.min(15, Math.max(0, raw.queryMatch)) : 0;
    const targetAlignment =
      typeof raw.targetAlignment === "number" ? Math.min(15, Math.max(0, raw.targetAlignment)) : 0;
    const contentSubstance =
      typeof raw.contentSubstance === "number" ? Math.min(10, Math.max(0, raw.contentSubstance)) : 0;
    const formatQuality = typeof raw.formatQuality === "number" ? Math.min(10, Math.max(0, raw.formatQuality)) : 0;
    const reasoning = typeof raw.reasoning === "string" ? raw.reasoning : "";

    return { queryMatch, targetAlignment, contentSubstance, formatQuality, reasoning };
  } catch {
    return null;
  }
};

/**
 * Compute total LLM score from dimensions with hallucination penalty
 *
 * @remarks
 * When targetAlignment < 5/15, applies a 0.7x multiplier
 * to penalize answers that confidently present wrong facts.
 */
export const computeLlmScore = (dims: LlmDimensions): number => {
  let total = dims.queryMatch + dims.targetAlignment + dims.contentSubstance + dims.formatQuality;

  // Hallucination penalty: confident but factually wrong
  if (dims.targetAlignment < 5) {
    total = Math.round(total * 0.7);
  }

  return Math.min(50, Math.max(0, total));
};

/**
 * Format LLM dimensions into human-readable reasoning string
 */
export const formatDimensionReasoning = (dims: LlmDimensions, penalized: boolean): string => {
  const parts = [
    `Match: ${dims.queryMatch}/15`,
    `Align: ${dims.targetAlignment}/15`,
    `Substance: ${dims.contentSubstance}/10`,
    `Format: ${dims.formatQuality}/10`,
  ];
  if (penalized) parts.push("(hallucination penalty applied)");
  if (dims.reasoning) parts.push(dims.reasoning);
  return parts.join(", ");
};
