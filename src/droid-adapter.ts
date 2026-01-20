/**
 * Droid adapter for spawning and communicating with droid CLI
 */

import type { Subprocess } from "bun";
import type { AutonomyLevel, DroidAdapter, DroidNotification } from "./types.ts";
import { log, logError, parseNdjsonLine } from "./utils.ts";

/**
 * Spawn droid process with stream-json format
 *
 * @param cwd - Working directory for droid process
 * @param autonomy - Autonomy level (low, medium, high)
 * @param onNotification - Callback for droid notifications
 * @returns Droid adapter interface
 *
 * @public
 */
export const spawnDroid = (
  cwd: string,
  autonomy: AutonomyLevel,
  onNotification: (notification: DroidNotification) => void,
): DroidAdapter => {
  log(`Spawning droid: cwd=${cwd}, autonomy=${autonomy}`);

  const args = [
    "exec",
    "--input-format",
    "stream-jsonrpc",
    "--output-format",
    "stream-jsonrpc",
    "--auto",
    autonomy,
    "--cwd",
    cwd,
  ];

  const proc = Bun.spawn(["droid", ...args], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const cleanupPromises: Promise<void>[] = [];

  // Set up NDJSON parser for stdout
  const stdoutPromise = setupStdoutParser(proc, onNotification);
  cleanupPromises.push(stdoutPromise);

  // Log stderr for debugging
  if (process.env.DROID_ACP_DEBUG === "1") {
    const stderrPromise = setupStderrLogging(proc);
    cleanupPromises.push(stderrPromise);
  }

  return {
    write: (data: string) => {
      proc.stdin.write(data);
    },
    kill: () => {
      proc.kill();
    },
    exited: proc.exited,
    process: proc,
    cleanupPromises,
  };
};

/**
 * Set up NDJSON parser for droid stdout
 */
const setupStdoutParser = (
  proc: Subprocess,
  onNotification: (notification: DroidNotification) => void,
): Promise<void> => {
  // Check if stdout is a ReadableStream
  if (!proc.stdout || typeof proc.stdout === "number") {
    logError("stdout is not a ReadableStream");
    return Promise.resolve();
  }

  const reader = proc.stdout.getReader();
  let buffer = "";

  return (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode chunk and add to buffer
        buffer += new TextDecoder().decode(value);

        // Process complete lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            const parsed = parseNdjsonLine(line);
            if (parsed) {
              try {
                handleDroidMessage(parsed, onNotification);
              } catch (error) {
                logError("Error handling droid message:", error);
              }
            }
          }
        }
      }
    } catch (error) {
      logError("Error reading droid stdout:", error);
    } finally {
      // Release the reader when done
      reader.releaseLock();
    }
  })();
};

/**
 * Set up stderr logging for debugging
 */
const setupStderrLogging = (proc: Subprocess): Promise<void> => {
  // Check if stderr is a ReadableStream
  if (!proc.stderr || typeof proc.stderr === "number") {
    return Promise.resolve();
  }

  const reader = proc.stderr.getReader();

  return (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        if (text.trim()) {
          logError("[droid stderr]", text);
        }
      }
    } catch (error) {
      logError("Error reading droid stderr:", error);
    } finally {
      // Release the reader when done
      reader.releaseLock();
    }
  })();
};

/**
 * Handle messages from droid
 */
const handleDroidMessage = (message: unknown, onNotification: (notification: DroidNotification) => void): void => {
  if (typeof message !== "object" || message === null) {
    logError("Invalid droid message:", message);
    return;
  }

  const msg = message as Record<string, unknown>;

  // Handle different message types based on structure
  // Note: Actual droid message format should be verified from droid CLI documentation

  // Init response (droid.initialize_session response)
  if (msg.type === "response" && typeof msg.result === "object" && msg.result !== null) {
    const result = msg.result as Record<string, unknown>;
    if (typeof result.sessionId === "string") {
      const settings =
        typeof result.settings === "object" && result.settings !== null
          ? (result.settings as Record<string, unknown>)
          : {};

      onNotification({
        type: "init",
        sessionId: result.sessionId,
        modelId: typeof settings.modelId === "string" ? settings.modelId : "unknown",
        availableModels: Array.isArray(result.availableModels) ? result.availableModels : undefined,
      });
      return;
    }
  }

  // Working status
  if (msg.type === "working" || msg.status === "thinking") {
    onNotification({
      type: "working",
      status: typeof msg.status === "string" ? msg.status : "thinking",
    });
    return;
  }

  // Assistant message
  if (msg.type === "message" && msg.role === "assistant" && typeof msg.content === "string") {
    onNotification({
      type: "message",
      role: "assistant",
      content: msg.content,
    });
    return;
  }

  // Tool call
  if (msg.type === "toolCall" && typeof msg.toolCallId === "string" && typeof msg.toolName === "string") {
    onNotification({
      type: "toolCall",
      toolCallId: msg.toolCallId,
      toolName: msg.toolName,
      input: typeof msg.input === "object" && msg.input !== null ? (msg.input as Record<string, unknown>) : {},
    });
    return;
  }

  // Tool result
  if (msg.type === "toolResult" && typeof msg.toolCallId === "string") {
    onNotification({
      type: "toolResult",
      toolCallId: msg.toolCallId,
      output: typeof msg.output === "string" ? msg.output : "",
      error: typeof msg.error === "string" ? msg.error : undefined,
    });
    return;
  }

  // Permission request
  if (msg.type === "permissionRequest" && typeof msg.requestId === "string" && typeof msg.tool === "string") {
    onNotification({
      type: "permissionRequest",
      requestId: msg.requestId,
      tool: msg.tool,
      description: typeof msg.description === "string" ? msg.description : msg.tool,
    });
    return;
  }

  // Completion
  if (msg.type === "completed" || msg.type === "done") {
    let stopReason: "end_turn" | "cancel" | "error" = "end_turn";

    if (typeof msg.stopReason === "string") {
      if (msg.stopReason === "cancel" || msg.stopReason === "cancelled") {
        stopReason = "cancel";
      } else if (msg.stopReason === "error") {
        stopReason = "error";
      }
    }

    onNotification({
      type: "completed",
      stopReason,
      error: typeof msg.error === "string" ? msg.error : undefined,
    });
    return;
  }

  // Handle droid.session_notification messages
  if (msg.type === "notification" && msg.method === "droid.session_notification") {
    const params = typeof msg.params === "object" && msg.params !== null ? (msg.params as Record<string, unknown>) : {};
    const notification =
      typeof params.notification === "object" && params.notification !== null
        ? (params.notification as Record<string, unknown>)
        : {};
    const notifType = typeof notification.type === "string" ? notification.type : "";

    // Assistant text delta (streaming response)
    if (notifType === "assistant_text_delta" && typeof notification.textDelta === "string") {
      onNotification({
        type: "message",
        role: "assistant",
        content: notification.textDelta,
      });
      return;
    }

    // Message creation complete (only complete on assistant messages)
    if (notifType === "create_message") {
      const message =
        typeof notification.message === "object" && notification.message !== null
          ? (notification.message as Record<string, unknown>)
          : {};

      // Only complete when the assistant's message is created, not the user's echo
      if (message.role === "assistant") {
        onNotification({
          type: "completed",
          stopReason: "end_turn",
        });
      }
      return;
    }

    // Working state changed
    if (notifType === "droid_working_state_changed" && typeof notification.newState === "string") {
      if (notification.newState === "working") {
        onNotification({
          type: "working",
          status: "thinking",
        });
      }
      return;
    }

    // Tool execution notifications
    if (
      notifType === "tool_use_started" &&
      typeof notification.toolCallId === "string" &&
      typeof notification.toolName === "string"
    ) {
      onNotification({
        type: "toolCall",
        toolCallId: notification.toolCallId,
        toolName: notification.toolName,
        input:
          typeof notification.input === "object" && notification.input !== null
            ? (notification.input as Record<string, unknown>)
            : {},
      });
      return;
    }

    if (notifType === "tool_use_completed" && typeof notification.toolCallId === "string") {
      onNotification({
        type: "toolResult",
        toolCallId: notification.toolCallId,
        output:
          typeof notification.output === "string" ? notification.output : JSON.stringify(notification.output || ""),
        error: typeof notification.error === "string" ? notification.error : undefined,
      });
      return;
    }
  }

  // Log unhandled messages
  log("Unhandled droid message:", msg);
};
