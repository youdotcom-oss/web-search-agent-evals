/**
 * Integration test for Droid ACP Adapter with @plaited/acp harness
 */

import { test, expect, describe } from "bun:test";
import { createACPClient, createPrompt } from "@plaited/acp-harness";
import * as path from "node:path";

const hasFactoryApiKey = !!process.env.FACTORY_API_KEY;

describe("Droid ACP Adapter Integration", () => {
  test("should connect to adapter", async () => {
    const adapterPath = path.join(__dirname, "..", "main.ts");

    console.log("Creating ACP client...");
    const client = createACPClient({
      command: ["bun", adapterPath],
      cwd: process.cwd(),
    });

    console.log("Connecting...");
    const initResponse = await client.connect();

    console.log("Initialize response:", initResponse);

    expect(initResponse).toBeDefined();
    expect(initResponse.protocolVersion).toBe(1);
    expect(initResponse.agentInfo).toBeDefined();
    expect(initResponse.agentInfo).not.toBeNull();
    expect(initResponse.agentInfo?.name).toBe("droid-acp");
    expect(initResponse.agentInfo?.title).toBe("Factory Droid");
    expect(initResponse.agentCapabilities).toBeDefined();

    await client.disconnect();
  });

  test.skipIf(!hasFactoryApiKey)("should authenticate with Factory API key", async () => {
    const adapterPath = path.join(__dirname, "..", "main.ts");

    const client = createACPClient({
      command: ["bun", adapterPath],
      cwd: process.cwd(),
    });

    await client.connect();

    // Authentication happens implicitly
    // Try to create a session (requires auth)
    console.log("Creating session...");
    const session = await client.createSession({
      cwd: process.cwd(),
      mcpServers: [],
    });

    console.log("Session created:", session);

    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(typeof session.id).toBe("string");

    await client.disconnect();
  });

  test.skipIf(!hasFactoryApiKey)("should create session successfully", async () => {
    const adapterPath = path.join(__dirname, "..", "main.ts");

    const client = createACPClient({
      command: ["bun", adapterPath],
      cwd: process.cwd(),
    });

    await client.connect();

    const session = await client.createSession({
      cwd: process.cwd(),
      mcpServers: [],
    });

    console.log("Session response:", JSON.stringify(session, null, 2));

    // Session should have an ID
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(typeof session.id).toBe("string");

    // Check metadata if present
    if (session._meta) {
      console.log("Session metadata:", session._meta);
    }

    await client.disconnect();
  });

  test.skipIf(!hasFactoryApiKey)(
    "should send prompt and receive response",
    async () => {
      const adapterPath = path.join(__dirname, "..", "main.ts");

      const client = createACPClient({
        command: ["bun", adapterPath],
        cwd: process.cwd(),
      });

      await client.connect();

      const session = await client.createSession({
        cwd: process.cwd(),
        mcpServers: [],
      });

      console.log("Sending prompt...");

      // Send a simple prompt
      const { updates, result } = await client.promptSync(session.id, createPrompt("echo hello"));

      console.log("Updates received:", updates.length);
      console.log("Result:", result);

      expect(updates).toBeDefined();
      expect(Array.isArray(updates)).toBe(true);
      expect(result).toBeDefined();
      expect(result.stopReason).toBeDefined();
      expect(["end_turn", "cancel"].includes(result.stopReason)).toBe(true);

      await client.disconnect();
    },
    30000,
  ); // 30 second timeout for prompt

  test.skip("adapter should report missing API key gracefully", async () => {
    // NOTE: This test is skipped due to an SDK limitation in @plaited/acp-harness@0.3.3.
    // The adapter correctly throws "Not authenticated: FACTORY_API_KEY environment variable not set"
    // (src/agent.ts:161), but the SDK's client.createSession() promise does not reject.
    // The createSession() call succeeds when it should fail, making the test unreliable.
    // Save and clear API key
    const originalKey = process.env.FACTORY_API_KEY;
    delete process.env.FACTORY_API_KEY;

    const adapterPath = path.join(__dirname, "..", "main.ts");

    const client = createACPClient({
      command: ["bun", adapterPath],
      cwd: process.cwd(),
    });

    try {
      await client.connect();

      // Try to create session without API key - should fail
      let errorCaught = false;
      try {
        await client.createSession({
          cwd: process.cwd(),
          mcpServers: [],
        });
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error: unknown) {
        errorCaught = true;
        const message = error instanceof Error ? error.message : String(error);
        console.log("Expected error:", message);
        // Check that error mentions authentication or API key
        const errorMsg = message.toLowerCase();
        const isAuthError =
          errorMsg.includes("factory_api_key") || errorMsg.includes("not authenticated") || errorMsg.includes("auth");
        expect(isAuthError).toBe(true);
      }

      expect(errorCaught).toBe(true);
    } finally {
      await client.disconnect();

      // Restore API key
      if (originalKey) {
        process.env.FACTORY_API_KEY = originalKey;
      }
    }
  }, 5000); // 5 second timeout
});

// Print helpful message if API key not set
if (!hasFactoryApiKey) {
  console.warn("\n⚠️  FACTORY_API_KEY not set - some tests will be skipped");
  console.warn("To run full integration tests:");
  console.warn("  export FACTORY_API_KEY=fk-your-key-here");
  console.warn("  bun test:integration\n");
}
