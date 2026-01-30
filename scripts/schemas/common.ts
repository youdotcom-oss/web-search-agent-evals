import type { ZodSchema, ZodError } from "zod";

/**
 * Result type for safe parsing operations
 */
export type ParseResult<T> = { data: T; errors: never[] } | { data: null; errors: string[] };

/**
 * Parse JSONL (JSON Lines) content with schema validation
 *
 * @remarks
 * Collects all validation errors instead of failing fast, allowing you to
 * see all issues at once. Empty lines are skipped.
 *
 * @param schema - Zod schema to validate each line against
 * @param content - JSONL string content (newline-separated JSON objects)
 * @returns Parsed data array or array of error messages with line numbers
 *
 * @public
 */
export const parseJsonl = <T>(schema: ZodSchema<T>, content: string): ParseResult<T[]> => {
  const lines = content.split("\n").filter((line) => line.trim() !== "");
  const results: T[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    if (!line) continue;

    try {
      const json = JSON.parse(line);
      const result = schema.safeParse(json);

      if (result.success) {
        results.push(result.data);
      } else {
        errors.push(formatZodError(result.error, `Line ${lineNum}`));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Line ${lineNum}: Invalid JSON - ${message}`);
    }
  }

  if (errors.length > 0) {
    return { data: null, errors };
  }

  return { data: results, errors: [] };
};

/**
 * Load and validate a JSON file with schema validation
 *
 * @remarks
 * Provides detailed error messages for file access or validation failures
 *
 * @param schema - Zod schema to validate the JSON content against
 * @param path - Absolute path to the JSON file
 * @returns Parsed data or error message
 *
 * @public
 */
export const loadJsonFile = async <T>(schema: ZodSchema<T>, path: string): Promise<ParseResult<T>> => {
  try {
    const file = Bun.file(path);
    const exists = await file.exists();

    if (!exists) {
      return { data: null, errors: [`File not found: ${path}`] };
    }

    const json = await file.json();
    const result = schema.safeParse(json);

    if (result.success) {
      return { data: result.data, errors: [] };
    }

    return {
      data: null,
      errors: [formatZodError(result.error, path)],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: null,
      errors: [`Failed to load ${path}: ${message}`],
    };
  }
};

/**
 * Format Zod validation errors into human-readable messages
 *
 * @param error - Zod error object
 * @param context - Optional context (file path, line number) to prepend
 * @returns Formatted error string
 *
 * @public
 */
export const formatZodError = (error: ZodError, context?: string | undefined): string => {
  const prefix = context ? `${context}: ` : "";
  const issues = error.issues.map((issue) => {
    const path = issue.path.join(".");
    return `${path ? `${path}: ` : ""}${issue.message}`;
  });

  return `${prefix}Validation failed - ${issues.join("; ")}`;
};
