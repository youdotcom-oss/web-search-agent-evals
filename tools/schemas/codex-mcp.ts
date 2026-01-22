#!/usr/bin/env bun
/**
 * Codex MCP Configuration Schema
 *
 * @remarks
 * Codex uses CLI commands to configure MCP servers, not a config file.
 * Format: `codex mcp add <name> --env KEY=VALUE -- <command>`
 * See: https://developers.openai.com/codex/mcp
 *
 * @public
 */

import { z } from "zod";

/**
 * Codex MCP server configuration schema
 */
export const CodexMcpServerSchema = z.object({
  type: z.literal("http"),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

/**
 * Codex MCP configuration schema (for reference, not written to file)
 */
export const CodexMcpConfigSchema = z.object({
  servers: z.record(CodexMcpServerSchema),
});

export type CodexMcpConfig = z.infer<typeof CodexMcpConfigSchema>;
export type CodexMcpServer = z.infer<typeof CodexMcpServerSchema>;

/**
 * Codex doesn't use a config file - it uses CLI commands
 */
export const CODEX_CONFIG_PATH = null;

/**
 * Generate Codex MCP CLI commands from unified server list
 *
 * @param servers - MCP server definitions from tools/mcp-servers.json
 * @param env - Environment variables for auth token substitution
 * @returns Array of CLI commands to execute
 *
 * @public
 */
export const generateCodexConfig = (
  servers: Record<string, { name: string; url: string; auth?: { envVar: string } }>,
  env: Record<string, string | undefined>,
): string[] => {
  const commands: string[] = [];

  for (const [key, server] of Object.entries(servers)) {
    const envVars: string[] = [];

    if (server.auth?.envVar) {
      const token = env[server.auth.envVar];
      if (token) {
        envVars.push(`--env ${server.auth.envVar}=${token}`);
      } else {
        console.warn(`Warning: ${server.auth.envVar} not set for ${key}`);
      }
    }

    // Codex MCP command format:
    // codex mcp add <name> --env VAR=VALUE -- <command>
    // For HTTP servers, we need to use an HTTP MCP client command
    const command = `codex mcp add ${server.name} ${envVars.join(" ")} -- http-mcp-client ${server.url}`;
    commands.push(command);
  }

  return commands;
};
