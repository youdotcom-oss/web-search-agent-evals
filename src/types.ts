/**
 * Type definitions for Droid ACP Adapter
 */

import type { Subprocess } from "bun";

/**
 * Autonomy level for Droid CLI
 * Maps to ACP mode: low/medium/high
 *
 * @public
 */
export type AutonomyLevel = "low" | "medium" | "high";

/**
 * Droid JSON-RPC message types
 *
 * @public
 */
export type DroidMessage = {
  jsonrpc: "2.0";
  factoryApiVersion: "1.0.0";
  type: "request";
  method: string;
  params?: Record<string, unknown>;
  id: string;
};

/**
 * Droid JSON-RPC response
 *
 * @public
 */
export type DroidResponse = {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

/**
 * Droid notification types
 *
 * @public
 */
export type DroidNotification =
  | {
      type: "init";
      sessionId: string;
      modelId: string;
      availableModels?: Array<{ id: string; name: string }>;
    }
  | {
      type: "working";
      status: string;
    }
  | {
      type: "message";
      role: "assistant";
      content: string;
    }
  | {
      type: "toolCall";
      toolCallId: string;
      toolName: string;
      input: Record<string, unknown>;
    }
  | {
      type: "toolResult";
      toolCallId: string;
      output: string;
      error?: string;
    }
  | {
      type: "permissionRequest";
      requestId: string;
      tool: string;
      description: string;
    }
  | {
      type: "completed";
      stopReason: "end_turn" | "cancel" | "error";
      error?: string;
    };

/**
 * Session state tracked by the adapter
 *
 * @public
 */
export type SessionState = {
  /** ACP session ID */
  id: string;

  /** Droid subprocess (null until spawned) */
  process: Subprocess | null;

  /** Droid adapter instance */
  adapter: DroidAdapter | null;

  /** Droid session ID */
  droidSessionId: string | null;

  /** Current model ID */
  modelId: string | null;

  /** Available models */
  availableModels: Array<{ id: string; name: string }>;

  /** Current autonomy level */
  autonomy: AutonomyLevel;

  /** Working directory */
  cwd: string;

  /** MCP server keys added for this session (for cleanup) */
  mcpServerKeys: string[];

  /** Whether session has been cancelled */
  cancelled: boolean;

  /** Promise resolve function for current prompt */
  promptResolve: ((result: PromptResult) => void) | null;

  /** Promise reject function for current prompt */
  promptReject: ((error: Error) => void) | null;

  /** Active tool call IDs */
  activeToolCallIds: Set<string>;

  /** Buffer for partial NDJSON lines */
  lineBuffer: string;
};

/**
 * Result of a prompt request
 *
 * @public
 */
export type PromptResult = {
  stopReason: "end_turn" | "cancel" | "error";
  error?: string;
};

/**
 * MCP server configuration
 *
 * @public
 */
export type McpServerConfig = {
  name: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
};

/**
 * Configuration file format for .factory/mcp.json
 *
 * @public
 */
export type FactoryMcpConfig = {
  mcpServers?: Record<
    string,
    {
      transport: "stdio" | "http";
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      url?: string;
      headers?: Record<string, string>;
    }
  >;
};

/**
 * Droid adapter interface
 *
 * @public
 */
export type DroidAdapter = {
  /** Write data to droid's stdin */
  write: (data: string) => void;

  /** Kill the droid process */
  kill: () => void;

  /** Promise that resolves when process exits */
  exited: Promise<number>;

  /** Process object */
  process: Subprocess;

  /** Cleanup promises for stream readers */
  cleanupPromises: Promise<void>[];
};
