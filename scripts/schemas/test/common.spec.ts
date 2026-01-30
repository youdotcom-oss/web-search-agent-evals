import { describe, test, expect } from "bun:test";
import { z } from "zod";
import { parseJsonl, loadJsonFile, formatZodError } from "../common.ts";

describe("parseJsonl", () => {
  const TestSchema = z.object({
    id: z.string(),
    value: z.number(),
  });

  test("parses valid JSONL", () => {
    const jsonl = `{"id":"1","value":10}
{"id":"2","value":20}
{"id":"3","value":30}`;

    const result = parseJsonl(TestSchema, jsonl);

    expect(result.data).toEqual([
      { id: "1", value: 10 },
      { id: "2", value: 20 },
      { id: "3", value: 30 },
    ]);
    expect(result.errors).toEqual([]);
  });

  test("skips empty lines", () => {
    const jsonl = `{"id":"1","value":10}

{"id":"2","value":20}

`;

    const result = parseJsonl(TestSchema, jsonl);

    expect(result.data).toEqual([
      { id: "1", value: 10 },
      { id: "2", value: 20 },
    ]);
    expect(result.errors).toEqual([]);
  });

  test("collects all validation errors", () => {
    const jsonl = `{"id":"1","value":10}
{"id":2,"value":20}
{"id":"3","value":"invalid"}
{"id":"4","value":40}`;

    const result = parseJsonl(TestSchema, jsonl);

    expect(result.data).toBe(null);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain("Line 2");
    expect(result.errors[1]).toContain("Line 3");
  });

  test("handles invalid JSON syntax", () => {
    const jsonl = `{"id":"1","value":10}
{invalid json}
{"id":"3","value":30}`;

    const result = parseJsonl(TestSchema, jsonl);

    expect(result.data).toBe(null);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Line 2");
    expect(result.errors[0]).toContain("Invalid JSON");
  });

  test("handles missing required fields", () => {
    const jsonl = `{"id":"1"}
{"value":20}`;

    const result = parseJsonl(TestSchema, jsonl);

    expect(result.data).toBe(null);
    expect(result.errors).toHaveLength(2);
  });

  test("handles empty string", () => {
    const result = parseJsonl(TestSchema, "");

    expect(result.data).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});

describe("loadJsonFile", () => {
  const TestSchema = z.object({
    name: z.string(),
    count: z.number(),
  });

  test("loads and validates valid JSON file", async () => {
    const tempPath = "/tmp/test-valid.json";
    await Bun.write(tempPath, JSON.stringify({ name: "test", count: 42 }));

    const result = await loadJsonFile(TestSchema, tempPath);

    expect(result.data).toEqual({ name: "test", count: 42 });
    expect(result.errors).toEqual([]);
  });

  test("returns error for non-existent file", async () => {
    const result = await loadJsonFile(TestSchema, "/tmp/non-existent-file.json");

    expect(result.data).toBe(null);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("File not found");
  });

  test("returns error for invalid JSON", async () => {
    const tempPath = "/tmp/test-invalid.json";
    await Bun.write(tempPath, "{invalid json}");

    const result = await loadJsonFile(TestSchema, tempPath);

    expect(result.data).toBe(null);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Failed to load");
  });

  test("returns error for validation failure", async () => {
    const tempPath = "/tmp/test-validation.json";
    await Bun.write(tempPath, JSON.stringify({ name: "test" }));

    const result = await loadJsonFile(TestSchema, tempPath);

    expect(result.data).toBe(null);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Validation failed");
    expect(result.errors[0]).toContain("count");
  });

  test("validates against real data directory structure", async () => {
    const ComparisonMetaSchema = z.object({
      generatedAt: z.string(),
      runs: z.array(z.string()),
      promptCount: z.number(),
    });

    const validPath = "/tmp/test-comparison-meta.json";
    await Bun.write(
      validPath,
      JSON.stringify({
        generatedAt: "2026-01-29T00:00:00Z",
        runs: ["run1", "run2"],
        promptCount: 10,
      }),
    );

    const result = await loadJsonFile(ComparisonMetaSchema, validPath);

    expect(result.data).not.toBe(null);
    expect(result.errors).toEqual([]);
  });
});

describe("formatZodError", () => {
  test("formats single validation error", () => {
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({ name: 123 });

    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted).toContain("name");
      expect(formatted).toContain("Validation failed");
    }
  });

  test("formats error with context", () => {
    const schema = z.object({ value: z.number() });
    const result = schema.safeParse({ value: "not a number" });

    if (!result.success) {
      const formatted = formatZodError(result.error, "config.json");
      expect(formatted).toContain("config.json");
      expect(formatted).toContain("value");
    }
  });

  test("formats multiple validation errors", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    });
    const result = schema.safeParse({
      name: 123,
      age: "not a number",
      email: "invalid",
    });

    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted).toContain("name");
      expect(formatted).toContain("age");
      expect(formatted).toContain("email");
    }
  });

  test("formats nested path errors", () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string(),
        }),
      }),
    });
    const result = schema.safeParse({
      user: { profile: { name: 123 } },
    });

    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted).toContain("user.profile.name");
    }
  });
});
