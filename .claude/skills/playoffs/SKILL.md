---
name: playoffs
description: Run and extend ACP evaluation playoffs
---

# Playoffs

Development assistant for running and extending the ACP evaluation playoffs system.

## Overview

The playoffs system evaluates multiple agents (Claude Code, Gemini, Droid) with different web search tools (builtin, You.com MCP) in isolated Docker containers.

**Architecture:**
- **Agent schemas** (agent-schemas/) - ACP headless adapter schemas
- **MCP configs** (tools/) - Single source of truth for MCP servers
- **CLI scripts** (scripts/) - Type-safe config generation and execution
- **Docker** (docker/, docker-compose.yml) - Isolated execution environments

## Quick Commands

### Run Evaluations

```bash
# Run all pairings (3 agents × 2 tools = 6 runs)
bun run playoffs

# Run single pairing
bun run run-pairing -- -a claude-code -t you
bun run run-pairing -- -a gemini -t builtin

# Compare results for same agent
bun run compare -- -a claude-code --toolA builtin --toolB you
```

### Generate MCP Configs

```bash
# Generate config for specific agent+tool
bun run generate-mcp -- -a claude-code -t you -c /workspace

# Test that configs are valid
bun run tools/schemas/claude-mcp.ts
bun run tools/schemas/gemini-mcp.ts
bun run tools/schemas/droid-mcp.ts
```

### Docker Operations

```bash
# Build images
docker compose build

# Run specific service
docker compose run --rm claude-code-builtin
docker compose run --rm gemini-you

# Debug: Shell into container
docker compose run --rm claude-code-builtin bash
```

## Extending Playoffs

### Adding a New Agent

1. **Create adapter schema** (`agent-schemas/<agent>.json`)
   - Test CLI output format: `<agent> --help`
   - Map JSON events to ACP protocol
   - Test with `adapter:check`

2. **Create MCP config schema** (`tools/schemas/<agent>-mcp.ts`)
   - Research agent's MCP config location
   - Export Zod schema + config path constant
   - Export `generate<Agent>Config` function
   - Test compilation: `bun run tools/schemas/<agent>-mcp.ts`

3. **Update generate-mcp-config.ts**
   - Import new schema
   - Add agent to `AGENTS` array
   - Add case to switch statement

4. **Create Dockerfile** (`docker/<agent>.Dockerfile`)
   - Base from `base`
   - Install agent CLI
   - Verify with `<agent> --version`
   - Copy entrypoint script

5. **Add Docker Compose services**
   - Add `<agent>-builtin` service
   - Add `<agent>-you` service
   - Follow existing service patterns

6. **Update documentation**
   - Add to agent-schemas/README.md
   - Update main README.md

### Adding a New MCP Tool

1. **Add to mcp-servers.json**
   ```json
   {
     "servers": {
       "new-tool": {
         "name": "tool-server-name",
         "type": "http",
         "url": "https://api.example.com/mcp",
         "auth": {
           "type": "bearer",
           "envVar": "NEW_TOOL_API_KEY"
         }
       }
     }
   }
   ```

2. **Update scripts/generate-mcp-config.ts**
   - Add tool to `TOOLS` array

3. **Add to .env and .env.example**
   ```
   NEW_TOOL_API_KEY=...
   ```

4. **Add Docker Compose services**
   - Add `<agent>-<tool>` services for each agent
   - Set `MCP_TOOL=<tool>` environment variable

5. **Test config generation**
   ```bash
   bun run generate-mcp -- -a claude-code -t <new-tool> -c /tmp/test
   cat /tmp/test/.mcp.json  # Verify structure
   ```

## Troubleshooting

### MCP Config Not Working

1. **Verify config generation**
   ```bash
   # Generate config in temp directory
   bun run generate-mcp -- -a <agent> -t <tool> -c /tmp/test

   # Check file was created at correct location
   ls /tmp/test/.mcp.json  # Claude
   ls /tmp/test/.gemini/settings.json  # Gemini
   ls /tmp/test/.factory/mcp.json  # Droid
   ```

2. **Verify API keys are set**
   ```bash
   cat .env | grep API_KEY
   ```

3. **Test inside container**
   ```bash
   docker compose run --rm <agent>-<tool> bash
   # Inside container:
   ls -la /workspace/.mcp.json  # Check config exists
   cat /workspace/.mcp.json  # Verify structure
   ```

### Agent Schema Issues

1. **Test schema compliance**
   ```bash
   bunx @plaited/agent-eval-harness adapter:check -- \
     bunx @plaited/agent-eval-harness headless --schema agent-schemas/<agent>.json
   ```

2. **Capture raw CLI output**
   ```bash
   <agent> <prompt-flag> "Say hello" --output-format stream-json | head -20
   ```

3. **Check JSONPath patterns**
   - Verify `outputEvents.match.path` points to correct field
   - Verify `result.contentPath` extracts final output

### Docker Build Failures

1. **Check base image**
   ```bash
   docker build -t base -f docker/base.Dockerfile .
   docker run --rm base bun --version
   docker run --rm base node --version
   ```

2. **Check agent CLI installation**
   ```bash
   docker build -t test-<agent> -f docker/<agent>.Dockerfile .
   docker run --rm test-<agent> <agent> --version
   ```

3. **Check entrypoint script**
   ```bash
   docker compose run --rm <agent>-<tool> bash -c "cat /entrypoint.sh"
   ```

## File Structure

```
acp-evals/
├── agent-schemas/          # ACP headless schemas (public)
├── tools/                  # MCP configs (single source of truth)
│   ├── mcp-servers.json    # Server definitions
│   └── schemas/            # Zod schemas per agent
├── scripts/                # CLI tools (type-safe, testable)
├── docker/                 # Container infrastructure
├── data/
│   ├── prompts/            # Evaluation prompts
│   └── results/            # Agent outputs
└── .claude/skills/playoffs/  # This skill
```

## Related Documentation

- [Agent Schemas README](../../../agent-schemas/README.md)
- [MCP Tools README](../../../tools/README.md)
- [Main README](../../../README.md)
