import { z } from "zod";

/**
 * Supported CLI agent names
 *
 * @public
 */
export const AgentSchema = z.enum(["claude-code", "gemini", "droid", "codex"]);

/**
 * Evaluation mode (trials only)
 *
 * @public
 */
export const ModeSchema = z.literal("trials");

/**
 * Comparison strategy for evaluations
 *
 * @public
 */
export const StrategySchema = z.enum(["weighted", "statistical"]);

/**
 * Trial type classification
 *
 * @public
 */
export const TrialTypeSchema = z.enum(["default", "capability", "regression"]);

/**
 * Search provider configuration
 *
 * @remarks
 * Can be "builtin" for agent's native search, or a custom provider name
 *
 * @public
 */
export const SearchProviderSchema = z.union([z.literal("builtin"), z.string()]);

/**
 * MCP (Model Context Protocol) server configuration
 *
 * @public
 */
export const McpServerSchema = z.object({
  name: z.string(),
  type: z.literal("http"),
  url: z.string().url(),
  auth: z
    .object({
      type: z.literal("bearer"),
      envVar: z.string(),
    })
    .optional(),
  expectedTools: z.array(z.string()).readonly(),
});

/**
 * CLI agent type
 *
 * @public
 */
export type Agent = z.infer<typeof AgentSchema>;

/**
 * Evaluation mode type
 *
 * @public
 */
export type Mode = z.infer<typeof ModeSchema>;

/**
 * Comparison strategy type
 *
 * @public
 */
export type Strategy = z.infer<typeof StrategySchema>;

/**
 * Trial type classification
 *
 * @public
 */
export type TrialType = z.infer<typeof TrialTypeSchema>;

/**
 * Search provider type
 *
 * @public
 */
export type SearchProvider = z.infer<typeof SearchProviderSchema>;

/**
 * MCP server configuration type
 *
 * @public
 */
export type McpServer = z.infer<typeof McpServerSchema>;
