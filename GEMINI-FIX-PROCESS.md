# Gemini Adapter Fix Process

## Problem Statement

Gemini adapter was not capturing tool calls, resulting in 0% success rate for web search tasks.

## Root Cause Analysis

### Initial Investigation

1. **Observed Behavior**: Gemini output was either empty or just echoed the prompt
2. **Error in Logs**: `Unknown arguments: output-format, outputFormat, <web-search>...`
3. **Diagnosis**: Gemini CLI v0.1.5 did not support `--output-format` flag

### Version Mismatch

- **Installed**: `@google/gemini-cli@0.1.5`
- **Latest**: `@google/gemini-cli@0.25.1`
- **Gap**: 24 minor versions behind!

## Fix Process

### Step 1: Verify Latest Version Supports Required Flags

```bash
# Check latest version
npm view @google/gemini-cli version
# Output: 0.25.1

# Check GitHub docs
# Confirmed: --output-format stream-json is supported
```

### Step 2: Upgrade Gemini CLI

```bash
# Upgrade globally (for testing)
npm install -g @google/gemini-cli@latest

# Verify version
gemini --version
# Output: 0.25.1

# Verify flag exists
gemini --help | grep output-format
# Output: -o, --output-format  The format of the CLI output. [string] [choices: "text", "json", "stream-json"]
```

### Step 3: Test Raw CLI Output

```bash
GEMINI_API_KEY=$API_KEY gemini --output-format stream-json --sandbox false "<web-search>Find the CEO of Anthropic</web-search>"
```

**Output Format Observed**:
```jsonl
{"type":"init","timestamp":"...","session_id":"...","model":"auto-gemini-2.5"}
{"type":"message","timestamp":"...","role":"user","content":"..."}
{"type":"tool_use","timestamp":"...","tool_name":"google_web_search","tool_id":"...","parameters":{...}}
{"type":"tool_result","timestamp":"...","tool_id":"...","status":"success","output":"..."}
{"type":"message","timestamp":"...","role":"assistant","content":"...","delta":true}
{"type":"result","timestamp":"...","status":"success","stats":{...}}
```

**Key Findings**:
- ✅ `--output-format stream-json` works correctly
- ✅ Tool events are emitted: `tool_use` and `tool_result`
- ✅ Messages are streamed with `delta: true`

### Step 4: Update Adapter Schema

**File**: `agent-schemas/gemini.json`

**Added Tool Event Mappings**:
```json
{
  "match": { "path": "$.type", "value": "tool_use" },
  "emitAs": "tool_call",
  "extract": { "title": "$.tool_name", "status": "'pending'" }
},
{
  "match": { "path": "$.type", "value": "tool_result" },
  "emitAs": "tool_call",
  "extract": { "title": "$.tool_id", "status": "'completed'" }
}
```

**Before**: Only captured "message" events
**After**: Captures "message", "tool_use", and "tool_result" events

### Step 5: Rebuild Docker Image

```bash
# Rebuild with --no-cache to force fresh npm install
docker build --no-cache -t gemini -f docker/gemini.Dockerfile .

# Verify version in container
docker run --rm gemini gemini --version
# Output: 0.25.1
```

**Dockerfile** (`docker/gemini.Dockerfile`):
```dockerfile
FROM base

USER root

# Install Gemini CLI (installs latest by default)
RUN npm install -g @google/gemini-cli

USER evaluser

# Verify Gemini CLI installed
RUN gemini --version

COPY --chown=evaluser:evaluser docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

### Step 6: Test Builtin Search

```bash
docker compose run --rm gemini-builtin
```

**Results**:
- ✅ 5/5 prompts completed successfully
- ✅ Tool calls captured in trajectory
- ✅ Grader scores: 4/5 pass (80% success rate)
- ✅ Deterministic score: 60/60 (content + tools)
- ✅ LLM score: 35/40 average

**Sample Trajectory**:
```json
{
  "type": "tool_call",
  "name": "google_web_search",
  "status": "pending"
},
{
  "type": "tool_call",
  "name": "google_web_search-1769122699471-2064e185519c98",
  "status": "completed"
}
```

### Step 7: Test MCP Integration

```bash
docker compose run --rm gemini-you
```

**Results**:
- ⚠️ 5/5 prompts completed, but with errors
- ❌ Tool execution denied by policy
- ❌ MCP detection: 0/5 pass
- **Issue**: Gemini CLI permission system blocking MCP tool calls

**Error Logs**:
```
Error executing tool you-search: Tool execution denied by policy.
```

**Diagnosis**: This is a **separate issue** from the adapter schema fix. Gemini CLI has a permission/policy system that's blocking MCP tool execution. This requires further investigation of Gemini's `--yolo` or permission flags.

## Success Metrics

### Before Fix
- **Builtin**: 0/5 pass (0% success)
- **MCP**: 0/5 pass (0% success)
- **Root Cause**: Adapter schema incompatible with CLI version

### After Fix
- **Builtin**: 4/5 pass (80% success) ✅
- **MCP**: 0/5 pass (0% success, but different root cause)
- **Root Cause (Builtin)**: Fixed - upgraded CLI version
- **Root Cause (MCP)**: Permission system blocking tool execution

## Key Learnings

### 1. Always Check CLI Version

**Lesson**: Adapter schemas can become outdated as CLIs evolve. Always verify:
- Current installed version
- Latest available version
- Breaking changes in CLI flags/output format

**Command**:
```bash
<agent-cli> --version
npm view <package-name> version
```

### 2. Test CLI Standalone First

**Lesson**: Before blaming the adapter schema, test if the CLI works standalone with the expected flags.

**Command**:
```bash
<agent-cli> --output-format stream-json -p "test prompt" 2>&1 | head -20
```

### 3. Capture Raw Output to Understand Format

**Lesson**: Always capture the full raw output to see what events are emitted and their structure.

**Command**:
```bash
<agent-cli> ... | jq -c '.' > raw-output.jsonl
cat raw-output.jsonl | jq '.type' | sort | uniq
```

### 4. Tool Name vs Tool ID Deduplication

**Observation**: Same as Claude Code, Gemini has two tool events:
- `tool_use`: Has `tool_name` (e.g., "google_web_search")
- `tool_result`: Has `tool_id` (e.g., "google_web_search-1769122699471-...")

**Impact**: The harness uses `title` field for deduplication, so the final trajectory shows the tool ID, not the tool name. This makes MCP detection harder.

**Workaround**: Check for ANY completed tool calls in MCP runs, not just MCP-specific tool names.

### 5. Separate Config Issues from Adapter Issues

**Lesson**: MCP not working can be due to:
- ❌ Adapter schema (parsing issues)
- ❌ CLI version (missing features)
- ❌ Permission system (policy blocks)
- ❌ MCP config (server not accessible)

**Diagnosis Strategy**:
1. Fix adapter schema first
2. Verify builtin works
3. Then debug MCP-specific issues

## Next Steps

### Gemini MCP Troubleshooting

1. **Research Gemini permission system**:
   - Check `--yolo` flag (auto-approve all actions)
   - Check if there's a `--allow-tools` flag
   - Check MCP config format for Gemini

2. **Verify MCP config generation**:
   ```bash
   bun run generate-mcp -- -a gemini -t you -c /tmp/test
   cat /tmp/test/.gemini/settings.json
   ```

3. **Test MCP in container**:
   ```bash
   docker compose run --rm gemini-you bash
   # Inside container:
   cat /workspace/.gemini/settings.json
   gemini --help | grep -i permission
   ```

### Droid & Codex Fixes

Apply the same systematic process:
1. Check CLI version
2. Test standalone with flags
3. Capture raw output format
4. Update adapter schema
5. Rebuild Docker image
6. Test builtin first
7. Then test MCP

## Files Changed

- `agent-schemas/gemini.json` - Added tool event mappings
- `docker/gemini.Dockerfile` - Already correct (uses latest npm install)
- Docker image rebuilt with `--no-cache`

## Commit Message Template

```
fix(gemini): upgrade CLI to v0.25.1 and add tool event capture

**Problem**: Gemini adapter not capturing tool calls (0% success rate)

**Root Cause**: CLI v0.1.5 didn't support --output-format flag

**Solution**:
- Upgraded Gemini CLI from v0.1.5 to v0.25.1
- Added tool_use and tool_result event mappings to adapter schema
- Rebuilt Docker image with latest CLI version

**Results**:
- Builtin: 4/5 pass (80% success, was 0%)
- Tool calls now captured in trajectory
- Deterministic + LLM scoring working correctly

**Known Issue**: MCP still failing due to Gemini permission system blocking tool execution (separate issue to investigate)
```
