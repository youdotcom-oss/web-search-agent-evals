#!/usr/bin/env node

/**
 * Droid ACP Adapter Entry Point
 *
 * This file sets up the Agent Side Connection using stdio (NDJSON format)
 * and initializes the DroidAcpAgent.
 */

import { AgentSideConnection, ndJsonStream } from "@agentclientprotocol/sdk";
import { DroidAcpAgent } from "./agent.ts";
import { log, logError } from "./utils.ts";

// Redirect console.log to stderr (stdout reserved for ACP protocol)
console.log = (..._args: unknown[]) => {};

// Main function
async function main() {
  log("Starting droid-acp adapter");

  // Convert Node.js streams to Web Streams for ACP SDK
  // Use ReadableStream.from() to convert Node.js stream to Web Stream
  const input = new ReadableStream({
    start(controller) {
      process.stdin.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      });
      process.stdin.on("end", () => {
        controller.close();
      });
      process.stdin.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      // Gracefully pause stdin instead of destroying
      process.stdin.pause();
    },
  });

  const output = new WritableStream({
    write(chunk) {
      process.stdout.write(chunk);
    },
    close() {
      process.stdout.end();
    },
    abort(reason) {
      // Gracefully end stdout instead of destroying
      logError("Output stream aborted:", reason);
      process.stdout.end();
    },
  });

  // Create NDJSON stream from stdin/stdout
  // Note: ndJsonStream expects (output, input) not (input, output)!
  const stream = ndJsonStream(output, input);

  // Create agent instance (stored for cleanup)
  let agent: DroidAcpAgent | null = null;

  // Create agent connection
  // The SDK takes a factory function that receives the connection
  const connection = new AgentSideConnection((conn) => {
    agent = new DroidAcpAgent(conn);
    return agent;
  }, stream);

  // Hook cleanup to connection close
  connection.closed.finally(async () => {
    if (agent) {
      await agent.cleanup();
    }
  });

  // Set up signal handlers for cleanup
  const cleanup = async () => {
    log("Received shutdown signal, cleaning up...");
    if (agent) {
      await agent.cleanup();
    }
    process.exit(0);
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);

  // Note: Can't use stdin.on('close') with Web Streams

  // Wait for connection to close
  try {
    await connection.closed;
    log("Connection closed");
  } catch (error) {
    logError("Connection error:", error);
    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  logError("Fatal error:", error);
  process.exit(1);
});
