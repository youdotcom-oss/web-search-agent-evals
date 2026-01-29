/**
 * MCP Server Definitions
 *
 * Single source of truth for all MCP server configurations.
 * Used by docker/entrypoint.sh to configure agents at runtime.
 *
 * @remarks
 * Each server defines connection details and authentication requirements.
 * Add new servers here to extend the evaluation system.
 *
 * @public
 */

/**
 * MCP Server configuration
 *
 * @public
 */
export type McpServer = {
  /** Server name used in MCP protocol */
  name: string;
  /** Server type (currently only http supported) */
  type: "http";
  /** Server URL endpoint */
  url: string;
  /** Optional authentication configuration */
  auth?: {
    /** Authentication type */
    type: "bearer";
    /** Environment variable containing the API key */
    envVar: string;
  };
  expectedTool: string;
};

/**
 * Available MCP servers registry
 *
 * @remarks
 * To add a new server:
 * 1. Add entry to this object
 * 2. Add corresponding API key to .env
 * 3. Update docker-compose.yml to pass environment variable
 *
 * @public
 */
export const MCP_SERVERS = {
  you: {
    name: "ydc-server",
    type: "http" as const,
    url: "https://api.you.com/mcp",
    auth: {
      type: "bearer" as const,
      envVar: "YOU_API_KEY",
    },
    expectedTool: "you-search",
  },
  // Future: Add more servers here
  // exa: { name: "exa-server", type: "http", url: "...", auth: {...} },
  // perplexity: { name: "perplexity-server", type: "http", url: "...", auth: {...} },
} as const;

/**
 * Valid MCP server keys
 *
 * @public
 */
export type McpServerKey = keyof typeof MCP_SERVERS;
