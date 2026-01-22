#!/usr/bin/env bun
/**
 * Gemini MCP Configuration Schema
 *
 * @remarks
 * Gemini expects MCP config at `.gemini/settings.json` in the working directory.
 * Format: { "mcpServers": { [name]: { "type": "http", "url": string, "headers"?: {} } } }
 *
 * @public
 */

import { z } from "zod";

/**
 * Gemini MCP server configuration schema (same as Claude)
 */
export const GeminiMcpServerSchema = z.object({
  type: z.literal("http"),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

/**
 * Gemini MCP configuration schema
 */
export const GeminiMcpConfigSchema = z.object({
  mcpServers: z.record(GeminiMcpServerSchema),
});

export type GeminiMcpConfig = z.infer<typeof GeminiMcpConfigSchema>;
export type GeminiMcpServer = z.infer<typeof GeminiMcpServerSchema>;

/**
 * Path where Gemini expects MCP config
 */
export const GEMINI_CONFIG_PATH = ".gemini/settings.json";

/**
 * Generate Gemini MCP config from unified server list
 *
 * @param servers - MCP server definitions from tools/mcp-servers.json
 * @param env - Environment variables for auth token substitution
 * @returns Gemini-formatted MCP config
 *
 * @public
 */
export const generateGeminiConfig = (
  servers: Record<string, { name: string; url: string; auth?: { envVar: string } }>,
  env: Record<string, string | undefined>,
): GeminiMcpConfig => {
  const mcpServers: Record<string, GeminiMcpServer> = {};

  for (const [key, server] of Object.entries(servers)) {
    const headers: Record<string, string> = {};

    if (server.auth?.envVar) {
      const token = env[server.auth.envVar];
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      } else {
        console.warn(`Warning: ${server.auth.envVar} not set for ${key}`);
      }
    }

    mcpServers[server.name] = {
      type: "http",
      url: server.url,
      ...(Object.keys(headers).length > 0 && { headers }),
    };
  }

  return { mcpServers };
};
