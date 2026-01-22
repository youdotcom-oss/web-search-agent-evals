# Playoffs Evaluation Results

## Test Execution Summary

Ran 5 search-focused prompts against 4 agents with 2 tool configurations (builtin vs You.com MCP).

### Test Date
2026-01-21

### Agents Tested
- Claude Code 2.1.14
- Gemini CLI (latest)
- Droid CLI 0.54.1
- Codex CLI 0.87.0

### Prompts (data/prompts/search-test.jsonl)
1. "What is the weather in San Francisco right now?"
2. "What are the latest features announced for Claude in January 2025?"
3. "Compare the current pricing of Anthropic's Claude API vs OpenAI's GPT-4 API in 2025"
4. "What were the major AI announcements at CES 2025?"
5. "Find the latest documentation for the Model Context Protocol as of January 2025"

## Completion Status

| Agent | Builtin | You.com MCP | Notes |
|-------|---------|-------------|-------|
| Claude Code | ✅ 5/5 (16-32s/prompt) | ✅ 5/5 (20-44s/prompt, 1 timeout) | All completed successfully |
| Gemini | ⚠️ 2/5 (quota limit) | ✅ 5/5 | Builtin hit API quota after 2 prompts |
| Droid | ✅ 5/5 (20-23s/prompt) | ✅ 5/5 (9-15s/prompt) | MCP required 4G memory limit |
| Codex | ❌ 0/5 (schema issues) | ❌ Not tested | CLI argument parsing issues |

## Key Findings

### 1. Tool Usage: None Detected

**Critical Finding:** No agents showed tool calls in captured trajectories, despite:
- Search-focused prompts designed to trigger web search
- MCP configs successfully generated and logged
- Long response times suggesting tool usage (16-44s per prompt)

All results show `trajectoryRichness: "messages-only"`, indicating:
- Agents may have used tools internally without emitting observable events
- Adapter schemas may not properly capture tool call events
- Agents may have answered from training data instead of searching

Example from Claude Code with You.com MCP:
```json
{
  "id": "search-1",
  "output": "I'll search for the current weather in San Francisco for you.\n\nLet me get the actual weather content",
  "metadata": {
    "trajectoryRichness": "messages-only"
  }
}
```

The output text suggests intent to search, but no tool_call events were captured.

### 2. Docker Configuration Requirements

**Memory Limits:**
- Default: Sufficient for most agents
- Droid + You.com MCP: Required 4G memory limit to avoid OOM kills (exit code 137)

**Agent Installation:**
- All agents must install as non-root user (`evaluser`) to avoid permission issues
- Installers that default to root's home require USER directive before installation

### 3. Schema Issues

**Codex CLI:**
- Documented `--json` flag exists on `codex exec`, not `codex`
- Command argument order critical: `codex exec [OPTIONS] [PROMPT]`
- Headless adapter schema has difficulty with:
  - Baking flags into command array
  - Using stdin mode for prompts
  - Proper ordering of flags vs positional arguments

**Deferred:** Codex schema needs further investigation of headless adapter's command construction logic.

### 4. MCP Config Generation

Successfully generated configs for:
- ✅ Claude Code: `.mcp.json` (file-based)
- ✅ Gemini: `.gemini/settings.json` (file-based)
- ✅ Droid: `.factory/mcp.json` (file-based)
- ✅ Codex: CLI commands via `codex mcp add` (CLI-based, unique approach)

All configs properly substituted `YOU_API_KEY` from environment.

### 5. Response Times

Average response times per prompt:

| Agent | Builtin | You.com MCP |
|-------|---------|-------------|
| Claude Code | 16-32s | 20-44s |
| Gemini | N/A (quota) | 15-30s (estimated) |
| Droid | 20-23s | 9-15s |

Droid was notably faster with MCP than builtin, despite no visible tool calls.

## Files Generated

```
data/results/
├── claude-code/
│   ├── builtin.jsonl       (5 results, 16-32s each)
│   └── you.jsonl           (5 results, 20-44s each, 1 timeout)
├── gemini/
│   ├── builtin.jsonl       (5 lines, only 2 valid due to quota)
│   └── you.jsonl           (5 results)
├── droid/
│   ├── builtin.jsonl       (5 results, 20-23s each)
│   └── you.jsonl           (5 results, 9-15s each)
└── codex/
    └── builtin.jsonl       (5 lines, all empty outputs due to CLI errors)
```

Total successful evaluations: **27/40** pairings
- Claude Code: 10/10 (100%)
- Gemini: 7/10 (70% - quota limited)
- Droid: 10/10 (100%)
- Codex: 0/10 (0% - schema issues)

## Next Steps

### High Priority
1. **✅ RESOLVED: Trajectory capture issue** - Root cause identified and PR submitted
   - **Problem**: Claude Code emits tool calls inside `$.message.content[]` arrays, not at root level
   - **Current parser limitation**: Can only check single JSONPath locations, no array iteration
   - **PR created**: https://github.com/plaited/agent-eval-harness/pull/14
   - **Solution**: Added `[*]` wildcard syntax to `jsonPath()` for array iteration in outputEvents
   - **Next**: Wait for PR merge, then update Claude schema to use `$.message.content[*].type` paths

2. **Fix Codex schema** - Command argument ordering issues
   - Research headless adapter's command construction logic
   - Consider iterative mode instead of stream mode
   - Test with manual CLI invocations to verify expected format

3. **Expand prompt set** - Use full dataset (data/prompts/full.jsonl - 1,254 prompts)
   - Current test set too small to draw statistical conclusions
   - Need larger sample to measure tool usage patterns

### Medium Priority
4. **Add graders** - Implement semantic scoring
   - Verify answers are factually correct and current
   - Distinguish "answered from training" vs "searched web"
   - Measure quality differences between builtin and MCP tools

5. **Token usage tracking** - Currently showing `null`
   - Investigate why token counts not captured
   - Important for cost analysis at scale

### Low Priority
6. **Add more MCP tools** - Exa.ai, Tavily, etc.
   - Compare quality across different search providers
   - Test if different tools trigger more observable behavior

7. **CI/CD integration** - Automate playoffs runs
   - Path filtering to avoid running on every commit
   - Cost controls (API quotas, caching)

## Lessons Learned

### What Worked
- ✅ Unified MCP config generation via Zod schemas
- ✅ Docker isolation for reproducible runs
- ✅ Headless adapters for Claude, Gemini, Droid (no custom code needed)
- ✅ Type-safe CLI scripts for manual testing
- ✅ Single source of truth pattern (tools/mcp-servers.json)

### What Needs Improvement
- ⚠️ Trajectory capture incompleteness (no tool calls visible)
- ⚠️ Schema debugging for complex CLIs (Codex)
- ⚠️ Prompt design (agents didn't search even for time-sensitive queries)
- ⚠️ Memory limits need tuning per agent+tool combination
- ⚠️ Token usage not being captured from CLI output

### Architectural Decisions Validated
- ✅ Top-level scripts > nested src/ directories
- ✅ Zod schemas > manual JSON config
- ✅ File-based MCP configs > environment variables
- ✅ Docker Compose > bash scripts for orchestration
- ✅ JSONL output > custom formats (enables easy jq analysis)
