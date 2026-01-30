import { z } from "zod";

/**
 * Base schema for evaluation prompts
 *
 * @public
 */
export const PromptSchema = z.object({
  id: z.string(),
  input: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  hint: z.string().optional(),
});

/**
 * Schema for MCP (Model Context Protocol) prompts with server metadata
 *
 * @public
 */
export const McpPromptSchema = PromptSchema.extend({
  metadata: z
    .object({
      mcpServer: z.string(),
      expectedTools: z.array(z.string()).readonly(),
    })
    .passthrough(),
});

/**
 * Base prompt type for evaluation tasks
 *
 * @public
 */
export type Prompt = z.infer<typeof PromptSchema>;

/**
 * MCP prompt type with server and tool expectations
 *
 * @public
 */
export type McpPrompt = z.infer<typeof McpPromptSchema>;
