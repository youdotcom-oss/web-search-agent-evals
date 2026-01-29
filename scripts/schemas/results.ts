import { z } from "zod";

/**
 * Trajectory step type discriminators
 *
 * @public
 */
export const TrajectoryStepTypeSchema = z.enum(["message", "tool_call", "tool_result", "error", "plan", "thought"]);

/**
 * Base trajectory step schema
 *
 * @public
 */
export const BaseTrajectoryStepSchema = z.object({
  type: TrajectoryStepTypeSchema,
  timestamp: z.number(),
  content: z.string().optional(),
});

/**
 * Tool call trajectory step
 *
 * @public
 */
export const ToolCallStepSchema = BaseTrajectoryStepSchema.extend({
  type: z.literal("tool_call"),
  name: z.string(),
  status: z.enum(["pending", "completed", "failed"]),
});

/**
 * Generic trajectory step (message, tool_result, error, etc.)
 *
 * @public
 */
export const GenericTrajectoryStepSchema = BaseTrajectoryStepSchema;

/**
 * Any trajectory step (union of all step types)
 *
 * @public
 */
export const TrajectoryStepSchema = z.union([ToolCallStepSchema, GenericTrajectoryStepSchema]);

/**
 * Timing information for execution
 *
 * @public
 */
export const TimingSchema = z.object({
  start: z.number(),
  end: z.number(),
  firstResponse: z.number().optional(),
  sessionCreation: z.number().optional(),
  total: z.number(),
});

/**
 * Metadata about the execution
 *
 * @public
 */
export const ResultMetadataSchema = z.object({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  lang: z.string().optional(),
  tool: z.string().optional(),
  is_dev: z.boolean().optional(),
  mcpServer: z.string().optional(),
  expectedTools: z.array(z.string()).optional(),
  agent: z.string(),
  trajectoryRichness: z.enum(["full", "minimal", "none"]).optional(),
  turnCount: z.number().optional(),
  exitCode: z.number().optional(),
  timedOut: z.boolean().optional(),
});

/**
 * Score metadata from grading
 *
 * @public
 */
export const ScoreMetadataSchema = z.object({
  expectedMcp: z.boolean().optional(),
  mcpToolCalled: z.boolean().optional(),
  deterministicScore: z.number().optional(),
  llmScore: z.number().optional(),
  hasErrors: z.boolean().optional(),
  hasTimeout: z.boolean().optional(),
  graderLatency: z.number().optional(),
  llmLatency: z.number().optional(),
});

/**
 * Score information for a result
 *
 * @public
 */
export const ScoreSchema = z.object({
  pass: z.boolean(),
  score: z.number(),
  reasoning: z.string().optional(),
  metadata: ScoreMetadataSchema.optional(),
});

/**
 * Single evaluation result record
 *
 * @public
 */
export const ResultRecordSchema = z.object({
  id: z.string(),
  input: z.string(),
  output: z.string(),
  trajectory: z.array(TrajectoryStepSchema).optional(),
  metadata: ResultMetadataSchema,
  timing: TimingSchema,
  toolErrors: z.boolean().optional(),
  score: ScoreSchema.optional(),
});

/**
 * Trial result record (pass@k evaluation)
 *
 * @remarks
 * Contains multiple trial runs for the same prompt to measure
 * consistency and pass rate
 *
 * @public
 */
export const TrialResultRecordSchema = z.object({
  id: z.string(),
  input: z.string(),
  trials: z.array(
    z.object({
      trialIndex: z.number(),
      output: z.string(),
      trajectory: z.array(TrajectoryStepSchema).optional(),
      timing: TimingSchema,
      toolErrors: z.boolean().optional(),
      score: ScoreSchema.optional(),
    }),
  ),
  metadata: ResultMetadataSchema,
  passAtK: z.number().optional(),
  flakiness: z.number().optional(),
});

/**
 * Trajectory step type
 *
 * @public
 */
export type TrajectoryStepType = z.infer<typeof TrajectoryStepTypeSchema>;

/**
 * Tool call step type
 *
 * @public
 */
export type ToolCallStep = z.infer<typeof ToolCallStepSchema>;

/**
 * Generic trajectory step type
 *
 * @public
 */
export type GenericTrajectoryStep = z.infer<typeof GenericTrajectoryStepSchema>;

/**
 * Trajectory step type (any step)
 *
 * @public
 */
export type TrajectoryStep = z.infer<typeof TrajectoryStepSchema>;

/**
 * Timing information type
 *
 * @public
 */
export type Timing = z.infer<typeof TimingSchema>;

/**
 * Result metadata type
 *
 * @public
 */
export type ResultMetadata = z.infer<typeof ResultMetadataSchema>;

/**
 * Score metadata type
 *
 * @public
 */
export type ScoreMetadata = z.infer<typeof ScoreMetadataSchema>;

/**
 * Score type
 *
 * @public
 */
export type Score = z.infer<typeof ScoreSchema>;

/**
 * Single evaluation result type
 *
 * @public
 */
export type ResultRecord = z.infer<typeof ResultRecordSchema>;

/**
 * Trial result type (pass@k evaluation)
 *
 * @public
 */
export type TrialResultRecord = z.infer<typeof TrialResultRecordSchema>;
