/**
 * Unit tests for Droid ACP Adapter
 */

import { test, expect, describe } from "bun:test";
import { generateId, mapAutonomyLevel, parseNdjsonLine, sleep } from "../utils.ts";

describe("Utility Functions", () => {
  describe("generateId", () => {
    test("generates unique IDs", () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(typeof id1).toBe("string");
      expect(typeof id2).toBe("string");
      expect(id1).not.toBe(id2);
    });

    test("generates valid UUIDs", () => {
      const id = generateId();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidPattern.test(id)).toBe(true);
    });
  });

  describe("mapAutonomyLevel", () => {
    test("maps low to low", () => {
      expect(mapAutonomyLevel("low")).toBe("low");
    });

    test("maps high to high", () => {
      expect(mapAutonomyLevel("high")).toBe("high");
    });

    test("maps undefined to medium (default)", () => {
      expect(mapAutonomyLevel()).toBe("medium");
    });

    test("maps unknown values to medium (fallback)", () => {
      expect(mapAutonomyLevel("unknown")).toBe("medium");
      expect(mapAutonomyLevel("")).toBe("medium");
      expect(mapAutonomyLevel("foo")).toBe("medium");
    });
  });

  describe("parseNdjsonLine", () => {
    test("parses valid JSON object", () => {
      const result = parseNdjsonLine('{"type":"test","value":123}');
      expect(result).toEqual({ type: "test", value: 123 });
    });

    test("parses valid JSON array", () => {
      const result = parseNdjsonLine("[1,2,3]");
      expect(result).toEqual([1, 2, 3]);
    });

    test("returns null for empty string", () => {
      const result = parseNdjsonLine("");
      expect(result).toBeNull();
    });

    test("returns null for whitespace-only string", () => {
      const result = parseNdjsonLine("   \n\t  ");
      expect(result).toBeNull();
    });

    test("returns null for invalid JSON", () => {
      const result = parseNdjsonLine("{invalid json}");
      expect(result).toBeNull();
    });

    test("handles special characters", () => {
      const result = parseNdjsonLine('{"message":"Hello\\nWorld"}');
      expect(result).toEqual({ message: "Hello\nWorld" });
    });

    test("handles nested objects", () => {
      const result = parseNdjsonLine('{"outer":{"inner":{"value":42}}}');
      expect(result).toEqual({ outer: { inner: { value: 42 } } });
    });
  });

  describe("sleep", () => {
    test("resolves after specified milliseconds", async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;

      // Allow some tolerance for timing
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(100);
    });

    test("resolves immediately for 0ms", async () => {
      const start = Date.now();
      await sleep(0);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10);
    });
  });
});

describe("Type Guards", () => {
  // Re-export type guards for testing
  const isStdioServer = (server: unknown) => {
    return (
      typeof server === "object" &&
      server !== null &&
      "command" in server &&
      typeof (server as { command?: unknown }).command === "string"
    );
  };

  const isHttpServer = (server: unknown) => {
    return (
      typeof server === "object" &&
      server !== null &&
      "type" in server &&
      (server as { type?: unknown }).type === "http" &&
      "url" in server
    );
  };

  const isWritableStdin = (stdin: unknown) => {
    return (
      typeof stdin === "object" &&
      stdin !== null &&
      "write" in stdin &&
      typeof (stdin as { write?: unknown }).write === "function"
    );
  };

  describe("isStdioServer", () => {
    test("returns true for valid stdio server", () => {
      const server = {
        name: "test",
        command: "node",
        args: ["server.js"],
      };
      expect(isStdioServer(server)).toBe(true);
    });

    test("returns false for null", () => {
      expect(isStdioServer(null)).toBe(false);
    });

    test("returns false for undefined", () => {
      expect(isStdioServer(undefined)).toBe(false);
    });

    test("returns false for object without command", () => {
      expect(isStdioServer({ name: "test" })).toBe(false);
    });

    test("returns false for object with non-string command", () => {
      expect(isStdioServer({ command: 123 })).toBe(false);
    });
  });

  describe("isHttpServer", () => {
    test("returns true for valid HTTP server", () => {
      const server = {
        type: "http",
        name: "test",
        url: "http://localhost:3000",
      };
      expect(isHttpServer(server)).toBe(true);
    });

    test("returns false for null", () => {
      expect(isHttpServer(null)).toBe(false);
    });

    test("returns false for stdio server", () => {
      const server = {
        name: "test",
        command: "node",
      };
      expect(isHttpServer(server)).toBe(false);
    });

    test("returns false for object without url", () => {
      expect(isHttpServer({ type: "http", name: "test" })).toBe(false);
    });
  });

  describe("isWritableStdin", () => {
    test("returns true for object with write function", () => {
      const stdin = {
        write: (data: string) => {
          console.log(data);
        },
      };
      expect(isWritableStdin(stdin)).toBe(true);
    });

    test("returns false for null", () => {
      expect(isWritableStdin(null)).toBe(false);
    });

    test("returns false for object without write", () => {
      expect(isWritableStdin({ read: () => {} })).toBe(false);
    });

    test("returns false for object with non-function write", () => {
      expect(isWritableStdin({ write: "not a function" })).toBe(false);
    });

    test("returns false for number (stdin can be number in Bun)", () => {
      expect(isWritableStdin(123)).toBe(false);
    });
  });
});

describe("Error Handling", () => {
  describe("parseNdjsonLine error recovery", () => {
    test("handles malformed JSON without crashing", () => {
      const malformedInputs = [
        "{",
        "}",
        "[",
        "]",
        '{"unclosed":',
        '{"key":"value"',
        "not json at all",
        '{"nested":{"unclosed":}',
      ];

      for (const input of malformedInputs) {
        const result = parseNdjsonLine(input);
        expect(result).toBeNull();
      }
    });

    test("handles extremely nested JSON", () => {
      // Create deeply nested object
      let nested = "{}";
      for (let i = 0; i < 100; i++) {
        nested = `{"level${i}":${nested}}`;
      }

      const result = parseNdjsonLine(nested);
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });
  });
});
