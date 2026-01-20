/**
 * Droid ACP Agent - implements Agent interface from @agentclientprotocol/sdk
 */

import type {
  Agent,
  AgentSideConnection,
  AuthenticateRequest,
  AuthenticateResponse,
  CancelNotification,
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  SetSessionModeRequest,
  SetSessionModelRequest,
  McpServerStdio,
  McpServerHttp,
  ContentBlock,
  SessionModeId,
} from "@agentclientprotocol/sdk";
import type { DroidNotification, McpServerConfig, PromptResult, SessionState } from "./types.ts";
import { spawnDroid } from "./droid-adapter.ts";
import { addMcpServers, generateId, log, logError, removeMcpServers } from "./utils.ts";

/**
 * Type guard for stdio MCP server
 */
function isStdioServer(server: unknown): server is McpServerStdio {
  return (
    typeof server === "object" &&
    server !== null &&
    "command" in server &&
    typeof (server as { command?: unknown }).command === "string"
  );
}

/**
 * Type guard for HTTP MCP server
 */
function isHttpServer(server: unknown): server is McpServerHttp & { type: "http" } {
  return (
    typeof server === "object" &&
    server !== null &&
    "type" in server &&
    (server as { type?: unknown }).type === "http" &&
    "url" in server
  );
}

/**
 * Type guard for writable stdin
 */
function isWritableStdin(stdin: unknown): stdin is { write: (data: string) => void } {
  return (
    typeof stdin === "object" &&
    stdin !== null &&
    "write" in stdin &&
    typeof (stdin as { write?: unknown }).write === "function"
  );
}

/**
 * Extract text from ContentBlock array
 */
function extractText(content: ContentBlock[]): string {
  return content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n");
}

/**
 * Map session mode ID to droid autonomy level
 */
function modeIdToAutonomy(modeId: SessionModeId): "low" | "medium" | "high" {
  if (modeId === "low") return "low";
  if (modeId === "high") return "high";
  return "medium";
}

/**
 * Droid ACP Agent implementation
 */
export class DroidAcpAgent implements Agent {
  private connection: AgentSideConnection;
  private sessions: Map<string, SessionState> = new Map();
  private authenticated = false;

  constructor(connection: AgentSideConnection) {
    this.connection = connection;
    log("DroidAcpAgent created");
  }

  /**
   * Initialize - advertise capabilities and agent info
   */
  async initialize(_request: InitializeRequest): Promise<InitializeResponse> {
    log("initialize");

    return {
      protocolVersion: 1,
      agentCapabilities: {
        promptCapabilities: {
          image: false, // Droid may not support images yet
          embeddedContext: true, // Support @-mentions
        },
        // Note: mcpCapabilities only has http and sse, not stdio
        // stdio is always supported by default
      },
      agentInfo: {
        name: "droid-acp",
        title: "Factory Droid",
        version: "0.1.0",
      },
      authMethods: [
        {
          id: "factory-api-key",
          name: "Factory API Key",
          description: "Set FACTORY_API_KEY environment variable",
        },
      ],
    };
  }

  /**
   * Authenticate - validate Factory API key
   */
  async authenticate(request: AuthenticateRequest): Promise<AuthenticateResponse> {
    log("authenticate:", request.methodId);

    if (request.methodId !== "factory-api-key") {
      throw new Error(`Unknown auth method: ${request.methodId}`);
    }

    const apiKey = process.env.FACTORY_API_KEY;
    if (!apiKey) {
      throw new Error("FACTORY_API_KEY environment variable not set");
    }

    if (!apiKey.startsWith("fk-")) {
      throw new Error("Invalid Factory API key format (should start with fk-)");
    }

    this.authenticated = true;
    log("authenticated successfully");

    return {};
  }

  /**
   * Create new session
   */
  async newSession(request: NewSessionRequest): Promise<NewSessionResponse> {
    // Auto-authenticate if not already authenticated but API key is available
    if (!this.authenticated) {
      const apiKey = process.env.FACTORY_API_KEY;
      if (!apiKey) {
        throw new Error("Not authenticated: FACTORY_API_KEY environment variable not set");
      }
      if (!apiKey.startsWith("fk-")) {
        throw new Error("Not authenticated: Invalid Factory API key format (should start with fk-)");
      }

      // Auto-authenticate
      log("Auto-authenticating with Factory API key");
      this.authenticated = true;
    }

    const sessionId = generateId();
    const cwd = request.cwd || process.cwd();
    const autonomy = "medium"; // Default autonomy level

    log(`newSession: id=${sessionId}, cwd=${cwd}`);

    // Handle MCP server configuration
    let mcpServerKeys: string[] = [];
    if (request.mcpServers && request.mcpServers.length > 0) {
      const servers: McpServerConfig[] = [];

      for (const server of request.mcpServers) {
        // Handle different MCP server types
        if (isStdioServer(server)) {
          // McpServerStdio
          servers.push({
            name: server.name,
            transport: "stdio",
            command: server.command,
            args: server.args,
            env: server.env ? Object.fromEntries(server.env.map((ev) => [ev.name, ev.value])) : undefined,
          });
        } else if (isHttpServer(server)) {
          // McpServerHttp
          servers.push({
            name: server.name,
            transport: "http",
            url: server.url,
            headers: server.headers ? Object.fromEntries(server.headers.map((h) => [h.name, h.value])) : undefined,
          });
        }
      }

      mcpServerKeys = await addMcpServers(servers, sessionId, cwd);
      log(`Added ${mcpServerKeys.length} MCP servers`);
    }

    // Create session state
    const session: SessionState = {
      id: sessionId,
      process: null, // Will be set when spawning droid
      adapter: null, // Will be set when spawning droid
      droidSessionId: null,
      modelId: null,
      availableModels: [],
      autonomy,
      cwd,
      mcpServerKeys,
      cancelled: false,
      promptResolve: null,
      promptReject: null,
      activeToolCallIds: new Set(),
      lineBuffer: "",
    };

    // Spawn droid subprocess
    const adapter = spawnDroid(cwd, autonomy, (notification) => this.handleDroidNotification(sessionId, notification));

    session.process = adapter.process;
    session.adapter = adapter;
    this.sessions.set(sessionId, session);

    // Send init message to droid
    const initMessage = {
      jsonrpc: "2.0",
      factoryApiVersion: "1.0.0",
      type: "request",
      method: "droid.initialize_session",
      params: {
        machineId: "acp-adapter",
        cwd,
      },
      id: generateId(),
    };

    adapter.write(`${JSON.stringify(initMessage)}\n`);
    log("Sent init message to droid");

    // Wait for droid to initialize (with timeout)
    const initTimeout = 10000; // 10 seconds
    const startTime = Date.now();

    while (!session.droidSessionId && Date.now() - startTime < initTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!session.droidSessionId) {
      // Clean up and throw error
      await this.cleanupSession(sessionId);
      throw new Error("Droid failed to initialize within timeout");
    }

    // Return session response
    return {
      sessionId,
      modes: {
        currentModeId: "medium",
        availableModes: [
          {
            id: "low",
            name: "Low",
            description: "Read-only and basic file operations",
          },
          {
            id: "medium",
            name: "Medium",
            description: "Development operations",
          },
          {
            id: "high",
            name: "High",
            description: "Production operations including destructive commands",
          },
        ],
      },
      models: {
        availableModels: session.availableModels.map((model) => ({
          modelId: model.id,
          name: model.name,
        })),
        currentModelId: session.modelId || "unknown",
      },
    };
  }

  /**
   * Handle prompt request
   */
  async prompt(request: PromptRequest): Promise<PromptResponse> {
    const session = this.sessions.get(request.sessionId);
    if (!session) {
      throw new Error(`Unknown session: ${request.sessionId}`);
    }

    if (session.cancelled) {
      throw new Error("Session has been cancelled");
    }

    if (!session.process) {
      throw new Error("Session process not initialized");
    }

    // Reject concurrent prompts to prevent race conditions
    if (session.promptResolve !== null || session.promptReject !== null) {
      throw new Error("Another prompt is already in progress for this session");
    }

    // Extract text from prompt content blocks
    const text = extractText(request.prompt);
    log(`prompt: sessionId=${request.sessionId}, text=${text.substring(0, 100)}...`);

    // Send message to droid
    const message = {
      jsonrpc: "2.0",
      factoryApiVersion: "1.0.0",
      type: "request",
      method: "droid.add_user_message",
      params: {
        text,
      },
      id: generateId(),
    };

    // Write to droid's stdin
    if (session.process.stdin && isWritableStdin(session.process.stdin)) {
      session.process.stdin.write(`${JSON.stringify(message)}\n`);
      log("Sent message to droid");
    } else {
      throw new Error("Cannot write to droid stdin");
    }

    // Wait for completion
    return new Promise<PromptResponse>((resolve, reject) => {
      session.promptResolve = (result: PromptResult) => {
        // Map droid stop reasons to ACP stop reasons
        if (result.stopReason === "cancel") {
          resolve({ stopReason: "cancelled" });
        } else if (result.stopReason === "error") {
          // Reject on error rather than resolving with error in response
          reject(new Error(result.error || "Unknown error"));
        } else {
          resolve({ stopReason: "end_turn" });
        }
      };

      session.promptReject = reject;
    });
  }

  /**
   * Handle cancellation
   */
  async cancel(notification: CancelNotification): Promise<void> {
    const session = this.sessions.get(notification.sessionId);
    if (!session) {
      log(`cancel: session ${notification.sessionId} not found`);
      return;
    }

    log(`cancel: sessionId=${notification.sessionId}`);
    session.cancelled = true;

    if (session.promptResolve) {
      // Resolve with cancelled stop reason
      session.promptResolve({
        stopReason: "cancel",
      });
      session.promptResolve = null;
      session.promptReject = null;
    }
  }

  /**
   * Set session mode
   *
   * @remarks
   * Mode changes are not supported after session creation because they would
   * require restarting the droid subprocess with different autonomy settings.
   * The mode should be set via the session/new request instead.
   */
  async setSessionMode(request: SetSessionModeRequest): Promise<void> {
    const session = this.sessions.get(request.sessionId);
    if (!session) {
      throw new Error(`Unknown session: ${request.sessionId}`);
    }

    // Changing mode would require restarting droid with different autonomy level
    throw new Error("Changing session mode is not supported. Mode must be set during session creation.");
  }

  /**
   * Set session model
   */
  async setSessionModel(_request: SetSessionModelRequest): Promise<void> {
    // Model changes would require coordination with droid
    throw new Error("Changing session model is not supported");
  }

  /**
   * Handle notifications from droid
   */
  private handleDroidNotification(sessionId: string, notification: DroidNotification): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logError(`Notification for unknown session: ${sessionId}`);
      return;
    }

    log(`Notification: ${notification.type}`, notification);

    switch (notification.type) {
      case "init":
        session.droidSessionId = notification.sessionId;
        session.modelId = notification.modelId;
        if (notification.availableModels) {
          session.availableModels = notification.availableModels;
        }
        break;

      case "working":
        // Note: ACP doesn't have a direct "thinking" status equivalent
        // We could use tool_call_update with status "in_progress" if needed
        break;

      case "message":
        this.connection.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              type: "text",
              text: notification.content,
            },
          },
        });
        break;

      case "toolCall":
        session.activeToolCallIds.add(notification.toolCallId);
        this.connection.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: "tool_call",
            toolCallId: notification.toolCallId,
            title: notification.toolName,
            rawInput: notification.input,
          },
        });
        break;

      case "toolResult":
        session.activeToolCallIds.delete(notification.toolCallId);
        this.connection.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: notification.toolCallId,
            status: notification.error ? "failed" : "completed",
            rawOutput: notification.output,
          },
        });
        break;

      case "permissionRequest":
        // Forward permission request to client
        this.connection
          .requestPermission({
            sessionId,
            toolCall: {
              toolCallId: notification.requestId,
              title: notification.tool,
            },
            options: [
              { optionId: "allow", kind: "allow_once", name: "Allow" },
              { optionId: "deny", kind: "reject_once", name: "Deny" },
            ],
          })
          .then((response) => {
            // Send response back to droid
            const granted = response.outcome.outcome === "selected" && response.outcome.optionId === "allow";
            const responseMessage = {
              jsonrpc: "2.0",
              factoryApiVersion: "1.0.0",
              type: "response",
              id: notification.requestId,
              result: { granted },
            };

            if (session.process?.stdin && isWritableStdin(session.process.stdin)) {
              session.process.stdin.write(`${JSON.stringify(responseMessage)}\n`);
            }
          })
          .catch((error) => {
            logError("Permission request error:", error);
          });
        break;

      case "completed":
        if (session.promptResolve) {
          session.promptResolve({
            stopReason: notification.stopReason,
            error: notification.error,
          });
          session.promptResolve = null;
          session.promptReject = null;
        }
        break;
    }
  }

  /**
   * Clean up session
   */
  private async cleanupSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    log(`Cleaning up session: ${sessionId}`);

    // Wait for cleanup promises to complete before killing process
    if (session.adapter?.cleanupPromises && session.adapter.cleanupPromises.length > 0) {
      try {
        // Give cleanup promises a chance to complete gracefully
        await Promise.race([
          Promise.allSettled(session.adapter.cleanupPromises),
          new Promise((resolve) => setTimeout(resolve, 2000)), // 2 second timeout
        ]);
      } catch (error) {
        logError("Error waiting for cleanup promises:", error);
      }
    }

    // Kill droid process
    if (session.process) {
      try {
        session.process.kill();

        // Wait for exit with timeout
        await Promise.race([session.process.exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
      } catch (error) {
        logError("Error killing droid process:", error);
      }
    }

    // Remove MCP servers
    if (session.mcpServerKeys.length > 0) {
      try {
        await removeMcpServers(session.mcpServerKeys, session.cwd);
      } catch (error) {
        logError("Error removing MCP servers:", error);
      }
    }

    // Remove from sessions map
    this.sessions.delete(sessionId);
    log(`Session cleaned up: ${sessionId}`);
  }

  /**
   * Cleanup all sessions (called on shutdown)
   */
  async cleanup(): Promise<void> {
    log("Cleaning up all sessions");

    const cleanupPromises = Array.from(this.sessions.keys()).map((sessionId) => this.cleanupSession(sessionId));

    await Promise.all(cleanupPromises);
  }
}
