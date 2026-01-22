#!/usr/bin/env bun
/**
 * Claude MCP Configuration Schema
 *
 * @remarks
 * Claude expects MCP config at `.mcp.json` in the working directory.
 * Format: { "mcpServers": { [name]: { "type": "http", "url": string, "headers"?: {} } } }
 *
 * @public
 */

import { z } from "zod";

/**
 * Claude MCP server configuration schema
 */
export const ClaudeMcpServerSchema = z.object({
  type: z.literal("http"),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

/**
 * Claude MCP configuration schema
 */
export const ClaudeMcpConfigSchema = z.object({
  mcpServers: z.record(ClaudeMcpServerSchema),
});

export type ClaudeMcpConfig = z.infer<typeof ClaudeMcpConfigSchema>;
export type ClaudeMcpServer = z.infer<typeof ClaudeMcpServerSchema>;

/**
 * Path where Claude expects MCP config
 */
export const CLAUDE_CONFIG_PATH = ".mcp.json";

/**
 * Generate Claude MCP config from unified server list
 *
 * @param servers - MCP server definitions from tools/mcp-servers.json
 * @param env - Environment variables for auth token substitution
 * @returns Claude-formatted MCP config
 *
 * @public
 */
export const generateClaudeConfig = (
  servers: Record<string, { name: string; url: string; auth?: { envVar: string } }>,
  env: Record<string, string | undefined>,
): ClaudeMcpConfig => {
  const mcpServers: Record<string, ClaudeMcpServer> = {};

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
