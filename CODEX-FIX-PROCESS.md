# Codex Adapter Fix Process

## Problem Statement

Codex adapter was not capturing tool calls and was returning token counts instead of actual message content.

## Root Cause Analysis

### Initial Investigation

1. **Observed Behavior**: Codex trajectory only contained message events, no tool calls
2. **Output Issue**: Final output showed token counts (e.g., "108") instead of actual responses
3. **CLI Version**: v0.89.0 (installed via npm)
4. **Diagnosis**:
   - Adapter schema missing tool event mappings
   - `result.contentPath` pointing to `$.usage.output_tokens` instead of message content

### Output Format Discovery

Codex CLI v0.89.0 supports `--json` with structured output:
- `{"type": "item.started", "item": {"type": "command_execution", "status": "in_progress", ...}}`
- `{"type": "item.completed", "item": {"type": "command_execution", "status": "completed", ...}}`
- `{"type": "item.completed", "item": {"type": "agent_message", "text": "..."}}`
- `{"type": "turn.completed", "usage": {...}}`

## Fix Process

### Step 1: Verify CLI Supports Required Output Format

```bash
# Check version
docker compose run --rm codex-builtin codex --version
# Output: 0.89.0 (after login message)

# Codex uses --json flag (not --output-format like others)
```

### Step 2: Capture Raw CLI Output

```bash
docker compose run --rm codex-builtin bash -c 'echo "<web-search>Find the CEO of Anthropic</web-search>" | codex exec --json --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox -'
```

**Output Format Observed**:
```jsonl
{"type":"thread.started","thread_id":"..."}
{"type":"turn.started"}
{"type":"item.started","item":{"id":"item_0","type":"command_execution","command":"...","status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_0","type":"command_execution","command":"...","status":"completed"}}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"The CEO of Anthropic is Dario Amodei..."}}
{"type":"turn.completed","usage":{"input_tokens":16206,"output_tokens":272}}
```

**Key Findings**:
- ✅ `--json` works correctly
- ✅ Tool events are emitted: `item.started` and `item.completed` with `type: "command_execution"`
- ✅ Messages are separate events: `item.completed` with `type: "agent_message"`
- ❌ `turn.completed` doesn't have message content, only token usage

### Step 3: Update Adapter Schema - Tool Events

**File**: `agent-schemas/codex.json`

**Added Tool Event Mapping**:
```json
{
  "match": { "path": "$.item.type", "value": "command_execution" },
  "emitAs": "tool_call",
  "extract": { "title": "$.item.id", "status": "$.item.status" }
}
```

**Key Decision**: Use `$.item.type` to filter for command_execution events only
- `item.started` only emits for command_execution (status: "in_progress")
- `item.completed` emits for reasoning, agent_message, AND command_execution
- Filtering by `$.item.type` avoids capturing non-tool events

**Tool Status Extraction**: Unlike other adapters that hardcode status ('pending', 'completed'), Codex's adapter extracts the actual status from `$.item.status`:
- "in_progress" for pending calls
- "completed" for successful calls
- "failed" for failed calls

### Step 4: Update Adapter Schema - Result Content

**Before**:
```json
"result": {
  "matchPath": "$.type",
  "matchValue": "turn.completed",
  "contentPath": "$.usage.output_tokens"
}
```

**After**:
```json
"result": {
  "matchPath": "$.type",
  "matchValue": "turn.completed",
  "contentPath": "$"
}
```

**Rationale**:
- `turn.completed` doesn't contain message content, only token usage
- Message content is in `agent_message` events captured by outputEvents
- Setting `contentPath` to `$` (root object) lets the harness use collected message events
- Previously `$.usage.output_tokens` returned numbers like "108" as the output

### Step 5: Rebuild Docker Image

```bash
# Rebuild with --no-cache
docker build --no-cache -t codex -f docker/codex.Dockerfile .

# Verify version in container
docker run --rm codex codex --version
# Output: codex-cli 0.89.0
```

**Dockerfile** (`docker/codex.Dockerfile`) already installs latest:
```dockerfile
FROM base

USER root

# Install Codex CLI
RUN npm install -g @openai/codex

USER evaluser

# Verify Codex CLI installed
RUN codex --version
```

### Step 6: Test Builtin Search

```bash
docker compose run --rm codex-builtin
```

**Results**:
- ✅ 4/5 prompts completed successfully
- ✅ Tool calls captured in trajectory (with correct statuses: "in_progress", "completed", "failed")
- ✅ Proper message content extracted (not token counts)
- ⚠️ 1 timeout (websearch-6 - Korean SSL question, same as Droid)
- ✅ websearch-7 completed without tools (agent provided search suggestions instead)

**Success Rate**: 80% (4/5 pass)

**Sample Trajectory**:
```json
{
  "type": "tool_call",
  "name": "item_0",
  "status": "in_progress"
},
{
  "type": "tool_call",
  "name": "item_0",
  "status": "completed"
}
```

**Tool Count Range**: 0-38 tool calls per prompt
- websearch-2: 32 tool calls (landing page research)
- websearch-3: 38 tool calls (OCR/AI research)
- websearch-6: 1 tool call (timed out)
- websearch-7: 0 tool calls (agent gave search tips instead)
- websearch-9: 10 tool calls (CFTC data research)

### Step 7: Test MCP Integration

Status: Not yet tested. Following same pattern as Gemini and Droid, test MCP after builtin works.

## Success Metrics

### Before Fix
- **Builtin**: 0/5 pass (0% success, no tool capture, wrong output)
- **MCP**: Not tested
- **Root Causes**:
  - Missing tool event mappings
  - contentPath pointing to token count instead of message content

### After Fix
- **Builtin**: 4/5 pass (80% success) ✅
- **MCP**: Not yet tested
- **Root Causes**: Fixed both issues
- **Known Issue**: 1 timeout on Korean SSL question (may be prompt complexity or query length)

## Key Learnings

### 1. Result Content vs Event Collection

**Critical Discovery**: Some CLIs separate completion signal from content delivery.

**Pattern**:
- Codex: `turn.completed` = done signal, `agent_message` events = content
- Droid: `completion` event has `finalText` = content in result
- Gemini: `result` event has `output` = content in result

**Lesson**: Check if result event contains content or if content comes from collected message events.

**Solution**: When result event lacks content, use `contentPath: "$"` to let harness use collected message events.

### 2. Dynamic Status Extraction

**Observation**: Codex provides rich status information in tool events.

**Statuses**:
- `"in_progress"` - tool call started
- `"completed"` - tool call succeeded
- `"failed"` - tool call failed

**Innovation**: Extract actual status instead of hardcoding:
```json
"extract": { "title": "$.item.id", "status": "$.item.status" }
```

**Benefit**: Richer trajectory data showing failed tool calls.

### 3. Same Timeout Pattern as Droid

**Observation**: websearch-6 (Korean SSL question) timed out at 180s for both Codex and Droid.

**Hypothesis**: Complex technical question in Korean requires more processing or multiple retries.

**Data Point**: Other agents (Claude Code, Gemini) handled this prompt fine.

**Consideration**: May indicate different web search strategies or error handling approaches.

### 4. Agent Can Choose Not to Use Tools

**Observation**: websearch-7 completed without any tool calls - agent provided search tips instead.

**Output**: "I can't browse YouTube directly here, but you can find it quickly with targeted searches. Try: ..."

**Insight**: Codex recognized it couldn't perform web search and provided helpful alternative.

**Implication**: Tool usage is not guaranteed - agents can respond without tools if they determine it's appropriate.

### 5. Codex is Slow but Thorough

**Performance**:
- 107-129s per complex prompt (vs ~20-30s for Droid/Gemini)
- 32-38 tool calls for research tasks (vs 2-13 for other agents)
- More shell commands, more retries, more verification

**Trade-off**: Slower execution but potentially more thorough research.

## Comparison: Gemini vs Droid vs Codex Fixes

| Aspect | Gemini | Droid | Codex |
|--------|--------|-------|-------|
| **Root Cause** | CLI version + schema | Schema incomplete | Schema incomplete + wrong contentPath |
| **CLI Status** | Outdated (0.1.5 → 0.25.1) | Latest (0.54.1) | Latest (0.89.0) |
| **Fix Required** | Upgrade + schema update | Schema update only | Schema update + result fix |
| **Tool Events** | `tool_use`, `tool_result` | `tool_call`, `tool_result` | `item.started`, `item.completed` |
| **Status Field** | Hardcoded strings | Hardcoded strings | Extracted from event |
| **Content Location** | In result event | In result event (finalText) | In message events |
| **Success Rate** | 80% (4/5) | 80% (4/5) | 80% (4/5) |
| **Timeout Issue** | No | websearch-6 | websearch-6 |
| **Fix Time** | 2+ hours (investigation) | 10 minutes (pattern known) | 15 minutes (contentPath discovery) |

## Next Steps

### Codex MCP Troubleshooting

1. **Run MCP test**:
   ```bash
   docker compose run --rm codex-you
   ```

2. **Verify MCP config generation**:
   ```bash
   bun run generate-mcp -- -a codex -t you -c /tmp/test
   # Check where Codex expects MCP config
   ```

3. **Check for permission issues** (learned from Gemini):
   - Codex uses `--dangerously-bypass-approvals-and-sandbox` flag
   - May have different MCP integration than other agents

### Pattern Summary for Future Agents

**Systematic Debugging Checklist**:
1. ✅ Check CLI version (Gemini's lesson)
2. ✅ Verify output format flag support
3. ✅ Capture raw output to understand structure
4. ✅ Map tool events by filtering on nested type fields
5. ✅ Check if result event contains content or if content is in message events
6. ✅ Extract dynamic status when available
7. ✅ Rebuild Docker with --no-cache
8. ✅ Test builtin first
9. ⏳ Then test MCP

## Files Changed

- `agent-schemas/codex.json` - Added tool event mapping + fixed result contentPath
- `docker/codex.Dockerfile` - No changes (already correct)
- Docker image rebuilt with `--no-cache`

## Commit Message Template

```
fix(codex): add tool event capture and fix result content extraction

**Problem**: Codex adapter not capturing tool calls; output showing token counts instead of messages

**Root Causes**:
- Adapter schema missing tool event mappings for command_execution
- result.contentPath pointing to $.usage.output_tokens (token count) instead of message content

**Solution**:
- Added tool event mapping for item.type=command_execution (extracts item.id as title, item.status as status)
- Changed result.contentPath from $.usage.output_tokens to $ (root) to use collected message events
- Rebuilt Docker image to ensure latest CLI

**Results**:
- Builtin: 4/5 pass (80% success, was 0%)
- Tool calls now captured in trajectory with rich status (in_progress, completed, failed)
- Proper message content extracted (not token counts)
- 1 timeout (websearch-6, same as Droid - may be prompt complexity)

**Innovation**: First adapter to extract dynamic status from events instead of hardcoding
```
