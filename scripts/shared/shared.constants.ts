import { MCP_SERVERS } from "../../mcp-servers.ts";
import type { Agent } from "./shared.types.ts";

export const ALL_AGENTS: Agent[] = ["claude-code", "gemini", "droid", "codex"];

/**
 * MCP tool name patterns derived from server expectedTools.
 *
 * @remarks
 * Tool names may appear with server prefix (e.g. `ydc-server___you-search`)
 * or bare (e.g. `you-search`), so callers should use `includes()` matching.
 *
 * @internal
 */
export const MCP_TOOL_PATTERNS: readonly string[] = Object.values(MCP_SERVERS).flatMap((s) => [...s.expectedTools]);

/**
 * Built-in search tools per agent framework.
 *
 * @remarks
 * Tool names may have suffixes (Gemini appends timestamps like
 * `google_web_search_1772171958077_0`), so callers should use
 * `startsWith()` matching.
 *
 * @internal
 */
export const BUILTIN_SEARCH_TOOLS: Readonly<Record<Agent, readonly string[]>> = {
  "claude-code": ["WebSearch"],
  gemini: ["google_web_search"],
  droid: ["WebSearch"],
  codex: [],
};
