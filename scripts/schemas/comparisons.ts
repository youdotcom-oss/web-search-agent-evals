import { z } from "zod";

/**
 * Latency percentile metrics
 *
 * @public
 */
export const LatencyMetricsSchema = z.object({
  p50: z.number(),
  p90: z.number(),
  p99: z.number(),
  mean: z.number(),
  min: z.number(),
  max: z.number(),
});

/**
 * Quality metrics for a single run
 *
 * @public
 */
export const QualityMetricsSchema = z.object({
  avgScore: z.number(),
  passRate: z.number(),
  passCount: z.number(),
  failCount: z.number(),
  scoreDistribution: z.record(z.string(), z.number()).optional(),
  confidenceIntervals: z
    .object({
      avgScore: z.tuple([z.number(), z.number()]).optional(),
      passRate: z.tuple([z.number(), z.number()]).optional(),
    })
    .optional(),
});

/**
 * Performance metrics for a single run
 *
 * @public
 */
export const PerformanceMetricsSchema = z.object({
  latency: LatencyMetricsSchema,
  firstResponse: LatencyMetricsSchema.optional(),
  totalDuration: z.number(),
  confidenceIntervals: z
    .object({
      latencyMean: z.tuple([z.number(), z.number()]).optional(),
    })
    .optional(),
});

/**
 * Reliability metrics for a single run
 *
 * @remarks
 * For regular runs: toolErrors, toolErrorRate, timeouts, timeoutRate, completionRate
 * For trials: avgPassExpK, medianPassExpK, p25PassExpK, p75PassExpK
 *
 * @public
 */
export const ReliabilityMetricsSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("run"),
    toolErrors: z.number(),
    toolErrorRate: z.number(),
    timeouts: z.number(),
    timeoutRate: z.number(),
    completionRate: z.number(),
  }),
  z.object({
    type: z.literal("trial"),
    avgPassExpK: z.number(),
    medianPassExpK: z.number(),
    p25PassExpK: z.number(),
    p75PassExpK: z.number(),
  }),
]);

/**
 * Pass@k capability metrics for a single run
 *
 * @public
 */
export const CapabilityMetricsSchema = z.object({
  avgPassAtK: z.number(),
  medianPassAtK: z.number(),
  p25PassAtK: z.number(),
  p75PassAtK: z.number(),
});

/**
 * Flakiness metrics for a single run
 *
 * @public
 */
export const FlakinessMetricsSchema = z.object({
  avgFlakiness: z.number(),
  medianFlakiness: z.number(),
  flakyPromptCount: z.number(),
  topFlakyPrompts: z.array(
    z.object({
      id: z.string(),
      flakiness: z.number(),
    }),
  ),
});

/**
 * Head-to-head comparison between two runs
 *
 * @public
 */
export const HeadToHeadComparisonSchema = z.object({
  runA: z.string(),
  runB: z.string(),
  aWins: z.number(),
  bWins: z.number(),
  ties: z.number(),
});

/**
 * Metadata about the comparison analysis
 *
 * @public
 */
export const ComparisonMetaSchema = z.object({
  generatedAt: z.string(),
  runs: z.array(z.string()),
  promptCount: z.number(),
  promptsWithAllRuns: z.number().optional(),
  trialsPerPrompt: z.number().optional(),
  inputFormat: z.string().optional(),
});

/**
 * Weighted comparison analysis schema
 *
 * @remarks
 * Contains comprehensive metrics across quality, performance, reliability,
 * capability, and flakiness dimensions for multiple agent runs.
 *
 * For regular run comparisons: quality, performance, reliability are present
 * For trials comparisons: capability, flakiness, reliability (with passExpK metrics) are present
 *
 * @public
 */
export const WeightedComparisonSchema = z.object({
  meta: ComparisonMetaSchema,
  quality: z.record(z.string(), QualityMetricsSchema).optional(),
  performance: z.record(z.string(), PerformanceMetricsSchema).optional(),
  reliability: z.record(z.string(), ReliabilityMetricsSchema).optional(),
  capability: z.record(z.string(), CapabilityMetricsSchema).optional(),
  flakiness: z.record(z.string(), FlakinessMetricsSchema).optional(),
  headToHead: z
    .object({
      capability: z.array(HeadToHeadComparisonSchema).optional(),
      reliability: z.array(HeadToHeadComparisonSchema).optional(),
    })
    .optional(),
});

/**
 * Latency metrics type
 *
 * @public
 */
export type LatencyMetrics = z.infer<typeof LatencyMetricsSchema>;

/**
 * Quality metrics type
 *
 * @public
 */
export type QualityMetrics = z.infer<typeof QualityMetricsSchema>;

/**
 * Performance metrics type
 *
 * @public
 */
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

/**
 * Reliability metrics type
 *
 * @public
 */
export type ReliabilityMetrics = z.infer<typeof ReliabilityMetricsSchema>;

/**
 * Capability metrics type
 *
 * @public
 */
export type CapabilityMetrics = z.infer<typeof CapabilityMetricsSchema>;

/**
 * Flakiness metrics type
 *
 * @public
 */
export type FlakinessMetrics = z.infer<typeof FlakinessMetricsSchema>;

/**
 * Head-to-head comparison type
 *
 * @public
 */
export type HeadToHeadComparison = z.infer<typeof HeadToHeadComparisonSchema>;

/**
 * Comparison metadata type
 *
 * @public
 */
export type ComparisonMeta = z.infer<typeof ComparisonMetaSchema>;

/**
 * Weighted comparison analysis type
 *
 * @public
 */
export type WeightedComparison = z.infer<typeof WeightedComparisonSchema>;
