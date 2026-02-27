import type { McpServerKey } from "../../mcp-servers.ts";

export type Agent = "claude-code" | "gemini" | "droid" | "codex";
export type SearchProvider = McpServerKey | "builtin";
export type RunConfig = { agent: Agent; searchProvider: SearchProvider };

/** Per-trial classification of which search tools were used */
export type TrialSearchBehavior = "mcp_only" | "builtin_only" | "both" | "neither";
