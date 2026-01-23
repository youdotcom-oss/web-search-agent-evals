# Agent Schemas

ACP headless adapter schemas for evaluating agents. This directory contains JSON schemas that map CLI agent outputs to the Agent Client Protocol format.

## Current Schemas

| Schema | Agent | Mode | Status |
|--------|-------|------|--------|
| claude-code.json | Claude Code | stream | ✅ Tested (wildcard tool capture) |
| gemini.json | Gemini CLI | iterative | ✅ Tested |
| droid.json | Droid CLI | stream | ✅ Tested |
| codex.json | Codex CLI | stream | ✅ Tested (--skip-git-repo-check) |

**Session Modes:**
- **stream**: Process stays alive, multi-turn conversations via stdin
- **iterative**: New process per turn, history passed as context

**Note:** There are no separate `-mcp.json` schema files. MCP configuration is handled at runtime by the Docker entrypoint based on the `MCP_TOOL` environment variable.

## Agent Tasks

### Validate Existing Schema

Test that a schema correctly parses agent CLI output:

```bash
# Test Claude Code schema (dry run without API key)
bunx @plaited/agent-eval-harness headless --schema agent-schemas/claude-code.json --help

# Test with API key for live validation
echo '{"id":"test-1","input":"Hello"}' | \
  ANTHROPIC_API_KEY=... bunx @plaited/agent-eval-harness headless \
  --schema agent-schemas/claude-code.json

# Test other agents
echo '{"id":"test-1","input":"Hello"}' | \
  GEMINI_API_KEY=... bunx @plaited/agent-eval-harness headless \
  --schema agent-schemas/gemini.json

echo '{"id":"test-1","input":"Hello"}' | \
  FACTORY_API_KEY=... bunx @plaited/agent-eval-harness headless \
  --schema agent-schemas/droid.json

echo '{"id":"test-1","input":"Hello"}' | \
  OPENAI_API_KEY=... bunx @plaited/agent-eval-harness headless \
  --schema agent-schemas/codex.json
```

### Create Schema for New Agent

When adding a new agent to playoffs:

1. **Research the agent's CLI**:
   ```bash
   # Check available flags and output formats
   <agent-cli> --help

   # Test output format
   <agent-cli> "Say hello" --output-format json
   <agent-cli> "Say hello" --output-format stream-json
   ```

2. **Capture sample output**:
   ```bash
   # Capture raw output to analyze structure
   <agent-cli> "List files in current directory" --output-format stream-json > sample-output.jsonl

   # Review the structure
   cat sample-output.jsonl | jq .
   ```

3. **Create schema JSON**:
   - Copy an existing schema as template (claude-code.json or gemini.json)
   - Update `command` array with agent CLI invocation
   - Update `outputEvents.match.path` to point to event type field
   - Update `result.contentPath` to extract final text output
   - Add any required environment variables

4. **Test the schema**:
   ```bash
   # Validate it parses correctly
   echo '{"id":"test-1","input":"test prompt"}' | \
     API_KEY=... bunx @plaited/agent-eval-harness headless \
     --schema agent-schemas/new-agent.json
   ```

5. **Add to Docker setup**:
   - Create Dockerfile: `docker/new-agent.Dockerfile`
   - Add service to `docker-compose.yml`
   - MCP configuration is handled automatically by the entrypoint at runtime

### Update Schema for CLI Changes

When an agent CLI updates and breaks the schema:

1. **Capture new output format**:
   ```bash
   <agent-cli> "test prompt" --output-format stream-json > new-output.jsonl
   ```

2. **Compare with old schema**:
   - Check if `outputEvents.match.path` still points to correct field
   - Check if `result.contentPath` still extracts output
   - Check if command flags changed

3. **Update schema** and test:
   ```bash
   # Edit agent-schemas/<agent>.json

   # Validate changes
   echo '{"id":"test-1","input":"test prompt"}' | \
     API_KEY=... bunx @plaited/agent-eval-harness headless \
     --schema agent-schemas/<agent>.json
   ```

4. **Update timeout in schema** if needed (in the schema's JSON file)

### Troubleshoot Schema Issues

**Problem: Schema validation fails**

```bash
# Capture raw agent output
<agent-cli> "test" --output-format stream-json | tee debug-output.jsonl

# Check JSONPath expressions
cat debug-output.jsonl | jq '<path-from-schema>'

# Example: Check if outputEvents.match.path is correct
cat debug-output.jsonl | jq '.type'  # If schema uses $.type
```

**Problem: Agent times out in Docker**

- Check timeout in the agent schema JSON file
- Increase timeout for slower agents by editing `agent-schemas/<agent>.json`:
  ```json
  {
    "timeout": 180000,  // 3 minutes for Codex
    ...
  }
  ```

**Problem: Tool calls not captured**

- Check `outputEvents` section captures tool_call events
- Use wildcard paths if tool names vary: `$.type == "tool_call"`

## Schema Structure Reference

```json
{
  "command": ["agent-cli", "--flag", "{input}"],
  "outputEvents": {
    "match": { "path": "$.type" },
    "patterns": {
      "text": { "value": "text" },
      "tool_call": { "value": "tool_call" },
      "tool_result": { "value": "tool_result" }
    }
  },
  "result": {
    "contentPath": "$.output",
    "errorPath": "$.error"
  },
  "mode": "stream",
  "env": ["AGENT_API_KEY"]
}
```

**Key fields:**
- `command`: CLI invocation with `{input}` placeholder for prompt
- `outputEvents.match.path`: JSONPath to event type field
- `patterns`: Map event types to ACP event names
- `result.contentPath`: JSONPath to extract final output text
- `mode`: "stream" (persistent) or "iterative" (new process per turn)
- `env`: Required environment variables

## Related Files

- **Docker configs**: `/docker/<agent>.Dockerfile` - Agent CLI installation
- **MCP configuration**: `/tools/mcp-servers.ts` - MCP server definitions
- **Docker entrypoint**: `/docker/entrypoint` - Runtime MCP configuration
- **Compose services**: `/docker-compose.yml` - Service definitions

## Skills Reference

- **@.claude/skills/playoffs** - Development assistant for playoffs system
- **headless-adapters@plaited_agent-eval-harness** - Schema templates and validation
