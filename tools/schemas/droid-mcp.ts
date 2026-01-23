#!/usr/bin/env bun
/**
 * Droid MCP Configuration Schema
 *
 * @remarks
 * Droid expects MCP config at `~/.factory/mcp.json` in the home directory (NOT working directory).
 * Format: { "mcpServers": { [name]: { "type": "http", "url": string, "headers"?: {}, "disabled": boolean } } }
 *
 * @public
 */

import { z } from "zod";

/**
 * Droid MCP server configuration schema
 */
export const DroidMcpServerSchema = z.object({
  type: z.literal("http"),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  disabled: z.boolean(),
});

/**
 * Droid MCP configuration schema
 */
export const DroidMcpConfigSchema = z.object({
  mcpServers: z.record(DroidMcpServerSchema),
});

export type DroidMcpConfig = z.infer<typeof DroidMcpConfigSchema>;
export type DroidMcpServer = z.infer<typeof DroidMcpServerSchema>;

/**
 * Path where Droid expects MCP config (relative to home directory)
 */
export const DROID_CONFIG_PATH = ".factory/mcp.json";

/**
 * Generate Droid MCP config from unified server list
 *
 * @param servers - MCP server definitions from tools/mcp-servers.json
 * @param env - Environment variables for auth token substitution
 * @returns Droid-formatted MCP config
 *
 * @public
 */
export const generateDroidConfig = (
  servers: Record<string, { name: string; url: string; auth?: { envVar: string } }>,
  env: Record<string, string | undefined>,
): DroidMcpConfig => {
  const droidServers: Record<string, DroidMcpServer> = {};

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

    droidServers[server.name] = {
      type: "http",
      url: server.url,
      disabled: false,
      ...(Object.keys(headers).length > 0 && { headers }),
    };
  }

  return { mcpServers: droidServers };
};
