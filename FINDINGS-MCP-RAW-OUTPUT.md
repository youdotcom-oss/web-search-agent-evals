# MCP Raw CLI Output Investigation - Findings

**Date**: 2026-01-22
**Goal**: Identify proper MCP indicators in raw JSON output from Claude Code and Codex CLIs
**Query Used**: "What is the weather in San Francisco?" with `MCP_TOOL=you` (You.com search MCP)

---

## Executive Summary

**EXCELLENT NEWS**: Both CLIs have clear, unambiguous MCP indicators in their raw output!

### Key Findings

1. **Claude Code**: Tool names are prefixed with `mcp__<server>__<tool>` pattern
2. **Codex**: MCP tool calls have dedicated event type `mcp_tool_call` with explicit `server` and `tool` fields
3. **Current schemas miss these indicators** - need updates to capture MCP-specific fields
4. **Current grader detection strategy is wrong** - should check these explicit fields, not use heuristics

---

## Claude Code Analysis

### MCP Indicators Found

#### 1. System Init Event
```json
{
  "type": "system",
  "subtype": "init",
  "tools": [
    "Task", "TaskOutput", "Bash", /* ...builtins... */,
    "mcp__ydc-server__you-search",
    "mcp__ydc-server__you-express",
    "mcp__ydc-server__you-contents"
  ],
  "mcp_servers": [
    {"name": "ydc-server", "status": "connected"}
  ]
}
```

**Key observations:**
- MCP tools follow naming pattern: `mcp__<server-name>__<tool-name>`
- `mcp_servers` array lists connected servers with status
- Builtin tools don't have `mcp__` prefix

#### 2. Tool Use Events
```json
{
  "type": "assistant",
  "message": {
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_014jkPfzpcbfEbN7XVQbYzEk",
        "name": "mcp__ydc-server__you-search",
        "input": {"query": "San Francisco weather today 2026", "count": 5}
      }
    ]
  }
}
```

**Key observations:**
- Tool name clearly shows MCP origin: `mcp__ydc-server__you-search`
- This is NOT a generic tool ID - it's the actual tool name
- Builtin tools would have names like `Bash`, `Read`, `Grep`, etc.

### Detection Strategy for Claude Code

**Primary indicator**: Check tool name for `mcp__` prefix

```typescript
const isMcpTool = (toolName: string): boolean => {
  return toolName.startsWith('mcp__')
}
```

**Verification**: Check system.init event for `mcp_servers` array

```typescript
const hasMcpServers = (initEvent: any): boolean => {
  return initEvent.mcp_servers && initEvent.mcp_servers.length > 0
}
```

### Schema Updates Needed

**Current schema** (`agent-schemas/claude-code.json`):
- Line 38: Maps to generic `type` field - captures "tool_use" but not MCP indicator

**Proposed update**:
```json
{
  "type": "tool_call",
  "name": "$.message.content[?(@.type=='tool_use')].name",
  "isMcpTool": "$.message.content[?(@.type=='tool_use')].name | startswith('mcp__')",
  "mcpServer": "$.message.content[?(@.type=='tool_use')].name | split('__')[1]",
  "mcpTool": "$.message.content[?(@.type=='tool_use')].name | split('__')[2]"
}
```

---

## Codex Analysis

### MCP Indicators Found

#### MCP Tool Call Events
```json
{
  "type": "item.started",
  "item": {
    "id": "item_1",
    "type": "mcp_tool_call",
    "server": "ydc-server",
    "tool": "you-express",
    "arguments": {
      "input": "current weather in San Francisco",
      "tools": [{"type": "web_search"}]
    },
    "result": null,
    "error": null,
    "status": "in_progress"
  }
}
```

```json
{
  "type": "item.completed",
  "item": {
    "id": "item_1",
    "type": "mcp_tool_call",
    "server": "ydc-server",
    "tool": "you-express",
    "arguments": { /* ... */ },
    "result": { /* ...full MCP result... */ },
    "error": null,
    "status": "completed"
  }
}
```

**Key observations:**
- **Dedicated event type**: `item.type: "mcp_tool_call"` (NOT `command_execution`!)
- **Explicit server field**: `server: "ydc-server"`
- **Explicit tool field**: `tool: "you-express"`
- **Full lifecycle**: Both `item.started` and `item.completed` events
- **Rich result data**: Includes structured content from MCP server

### Current Schema Problem

**Current schema** (`agent-schemas/codex.json` line 4):
```json
{
  "eventTypes": {
    "agent_message": "message",
    "command_execution": "tool_call"
  }
}
```

**Problem**: Schema expects `command_execution` for tool calls, but MCP tools emit `mcp_tool_call`!

This explains why current results show only message events - the schema doesn't capture MCP tool calls at all!

### Detection Strategy for Codex

**Primary indicator**: Check `item.type` for `mcp_tool_call`

```typescript
const isMcpToolCall = (event: any): boolean => {
  return event.type === 'item.completed' &&
         event.item?.type === 'mcp_tool_call'
}
```

**Extract MCP metadata**:
```typescript
const getMcpInfo = (event: any) => {
  return {
    server: event.item.server,
    tool: event.item.tool,
    status: event.item.status
  }
}
```

### Schema Updates Needed

**Proposed update**:
```json
{
  "eventTypes": {
    "agent_message": "message",
    "command_execution": "tool_call",
    "mcp_tool_call": "mcp_tool_call"
  },
  "jsonPaths": {
    "mcp_tool_call": {
      "server": "$.item.server",
      "tool": "$.item.tool",
      "arguments": "$.item.arguments",
      "result": "$.item.result",
      "status": "$.item.status"
    }
  }
}
```

---

## Comparison with Current Trajectories

### Claude Code Current State

**Problem**: Current grader shows generic tool IDs like `toolu_01...` and can't distinguish MCP from builtin tools

**Root cause**: Schema captures the tool call but doesn't extract the `name` field that contains MCP indicator

**Fix**: Add `name` field extraction to schema, then grader can check for `mcp__` prefix

### Codex Current State

**Problem**: Current results only show message events, no tool calls at all (see `data/results/codex/you-test.jsonl`)

**Root cause**: Schema maps `command_execution` → `tool_call`, but MCP uses `mcp_tool_call` event type instead

**Fix**: Add `mcp_tool_call` to event type mapping in schema

---

## Event Type Inventories

### Claude Code Event Types
```
- system (subtype: init)
- assistant (with message.content array)
- user (with tool_result)
- result (subtype: success)
```

### Codex Event Types
```
- thread.started
- turn.started
- item.completed (with item.type: "reasoning")
- item.started (with item.type: "mcp_tool_call")
- item.completed (with item.type: "mcp_tool_call")
- item.completed (with item.type: "agent_message")
- turn.completed
```

---

## Recommended Implementation Strategy

### Option C: Hybrid Approach (RECOMMENDED)

**Phase 1: Update Schemas** (High Priority)
1. **Claude Code schema**: Add `name` field extraction for tool calls
2. **Codex schema**: Add `mcp_tool_call` event type mapping
3. Test schema changes with `adapter:check` command
4. Validate that harness parses trajectories correctly

**Phase 2: Update Grader** (High Priority)
1. **Claude Code detection**: Check if tool name starts with `mcp__`
2. **Codex detection**: Check if event type is `mcp_tool_call`
3. Remove fallback heuristics (URL checking, etc.) - no longer needed
4. Test detection with existing trajectory files

**Phase 3: Re-run Evaluations** (Medium Priority)
1. Run full evaluation with updated schemas and grader
2. Validate that MCP detection now works reliably
3. Compare results with previous runs to verify improvement

### Why This Approach?

- **High confidence**: Both indicators are explicit and unambiguous
- **Future-proof**: Based on actual CLI output, not assumptions
- **Clean code**: No more heuristics or guesswork
- **Reliable**: Won't produce false positives or false negatives

---

## Success Metrics

After implementing these changes, we should see:

1. **Claude Code**: 100% MCP detection accuracy for tool calls with `mcp__` prefix
2. **Codex**: Tool call events appear in trajectories (currently missing entirely)
3. **Grader**: No more "fallback" detections, all detections based on explicit indicators
4. **Output quality**: Results correctly show when MCP was actually used vs. when it wasn't

---

## Risk Assessment

**Schema Changes**:
- Risk: Low - additive changes, won't break existing parsing
- Mitigation: Test with existing trajectory files first

**Grader Changes**:
- Risk: Low - explicit indicators are more reliable than heuristics
- Mitigation: Keep old grader as backup, compare results

**Re-running Evals**:
- Risk: Medium - API costs for full re-run
- Mitigation: Test with single prompts first, then decide on full run

---

## Next Steps

1. **Immediate**: Update schemas to capture MCP indicators
2. **Immediate**: Update grader to check explicit MCP fields
3. **Short-term**: Test with existing trajectory files
4. **Medium-term**: Run test queries to validate detection
5. **Long-term**: Consider full evaluation re-run if needed

---

## Appendix: Raw Output Samples

### Claude Code - First 3 Events

```json
{"type":"system","subtype":"init","tools":["Task","TaskOutput","Bash","Glob","Grep","ExitPlanMode","Read","Edit","Write","NotebookEdit","WebFetch","TodoWrite","WebSearch","KillShell","AskUserQuestion","Skill","EnterPlanMode","mcp__ydc-server__you-search","mcp__ydc-server__you-express","mcp__ydc-server__you-contents"],"mcp_servers":[{"name":"ydc-server","status":"connected"}]}

{"type":"assistant","message":{"content":[{"type":"text","text":"I'll search for the current weather in San Francisco."}]}}

{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_014jkPfzpcbfEbN7XVQbYzEk","name":"mcp__ydc-server__you-search","input":{"query":"San Francisco weather today 2026","count":5}}]}}
```

### Codex - MCP Tool Call Events

```json
{"type":"item.started","item":{"id":"item_1","type":"mcp_tool_call","server":"ydc-server","tool":"you-express","arguments":{"input":"current weather in San Francisco","tools":[{"type":"web_search"}]},"result":null,"error":null,"status":"in_progress"}}

{"type":"item.completed","item":{"id":"item_1","type":"mcp_tool_call","server":"ydc-server","tool":"you-express","arguments":{"input":"current weather in San Francisco","tools":[{"type":"web_search"}]},"result":{/* large result object */},"error":null,"status":"completed"}}
```

---

## Conclusion

This investigation successfully identified clear, unambiguous MCP indicators in both Claude Code and Codex raw output. The current schemas and grader need updates to leverage these explicit indicators. With these changes, MCP detection will be 100% reliable with no false positives or false negatives.
