/**
 * Utility functions for Droid ACP Adapter
 */

import type { AutonomyLevel, FactoryMcpConfig, McpServerConfig } from "./types.ts";
import * as path from "node:path";
import * as os from "node:os";

/**
 * Debug logging enabled via DROID_ACP_DEBUG env var
 */
const DEBUG = process.env.DROID_ACP_DEBUG === "1";

/**
 * Log message to stderr (stdout reserved for ACP protocol)
 *
 * @public
 */
export const log = (...args: unknown[]): void => {
  if (DEBUG) {
    // biome-ignore lint/suspicious/noConsole: stderr logging for debugging (stdout reserved for ACP protocol)
    console.error("[droid-acp]", ...args);
  }
};

/**
 * Log error to stderr
 *
 * @public
 */
export const logError = (...args: unknown[]): void => {
  // biome-ignore lint/suspicious/noConsole: stderr logging for errors (stdout reserved for ACP protocol)
  console.error("[droid-acp ERROR]", ...args);
};

/**
 * Read file using Bun's file API
 *
 * @public
 */
export const readFile = async (filePath: string): Promise<string> => {
  const file = Bun.file(filePath);
  return await file.text();
};

/**
 * Write file using Bun's file API
 *
 * @public
 */
export const writeFile = async (filePath: string, data: string): Promise<void> => {
  await Bun.write(filePath, data);
};

/**
 * Check if file exists
 *
 * @public
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
  const file = Bun.file(filePath);
  return await file.exists();
};

/**
 * Map ACP mode to Droid autonomy level
 *
 * @public
 */
export const mapAutonomyLevel = (mode?: string): AutonomyLevel => {
  switch (mode) {
    case "low":
      return "low";
    case "high":
      return "high";
    default:
      return "medium";
  }
};

/**
 * Generate unique ID using crypto
 *
 * @public
 */
export const generateId = (): string => {
  return crypto.randomUUID();
};

/**
 * Get Factory MCP config path
 *
 * @public
 */
export const getMcpConfigPath = (_cwd?: string): string => {
  const homeDir = os.homedir();
  return path.join(homeDir, ".factory", "mcp.json");
};

/**
 * Read Factory MCP config
 *
 * @public
 */
export const readMcpConfig = async (cwd?: string): Promise<FactoryMcpConfig> => {
  const configPath = getMcpConfigPath(cwd);

  if (!(await fileExists(configPath))) {
    return { mcpServers: {} };
  }

  try {
    const content = await readFile(configPath);
    return JSON.parse(content) as FactoryMcpConfig;
  } catch (error) {
    logError("Failed to read MCP config:", error);
    return { mcpServers: {} };
  }
};

/**
 * Write Factory MCP config
 *
 * @public
 */
export const writeMcpConfig = async (config: FactoryMcpConfig, cwd?: string): Promise<void> => {
  const configPath = getMcpConfigPath(cwd);
  const configDir = path.dirname(configPath);

  // Ensure directory exists
  try {
    await Bun.$`mkdir -p ${configDir}`.quiet();
  } catch (error) {
    logError("Failed to create config directory:", error);
    throw new Error(`Failed to create config directory: ${configDir}`);
  }

  await writeFile(configPath, JSON.stringify(config, null, 2));
  log("Wrote MCP config to", configPath);
};

/**
 * Add MCP servers to Factory config with session-specific keys
 *
 * @public
 */
export const addMcpServers = async (servers: McpServerConfig[], sessionId: string, cwd?: string): Promise<string[]> => {
  const config = await readMcpConfig(cwd);
  const keys: string[] = [];

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  for (const server of servers) {
    // Use session-specific key to avoid conflicts
    const key = `${server.name}-${sessionId}`;
    keys.push(key);

    config.mcpServers[key] = {
      transport: server.transport,
      command: server.command,
      args: server.args,
      env: server.env,
      url: server.url,
      headers: server.headers,
    };

    log(`Added MCP server: ${key}`);
  }

  await writeMcpConfig(config, cwd);
  return keys;
};

/**
 * Remove MCP servers by keys
 *
 * @public
 */
export const removeMcpServers = async (keys: string[], cwd?: string): Promise<void> => {
  const config = await readMcpConfig(cwd);

  if (!config.mcpServers) {
    return;
  }

  for (const key of keys) {
    delete config.mcpServers[key];
    log(`Removed MCP server: ${key}`);
  }

  await writeMcpConfig(config, cwd);
};

/**
 * Parse NDJSON line
 *
 * @public
 */
export const parseNdjsonLine = (line: string): unknown | null => {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    logError("Failed to parse NDJSON line:", trimmed, error);
    return null;
  }
};

/**
 * Sleep for specified milliseconds
 *
 * @public
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
