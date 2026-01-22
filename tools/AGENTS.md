# MCP Tools Configuration

Single source of truth for all MCP server configurations used across agents in the playoffs evaluation system.

## Structure

```
tools/
├── mcp-servers.json    # Unified server definitions
└── schemas/            # Agent-specific Zod schemas
    ├── claude-mcp.ts   # Claude format (.mcp.json)
    ├── gemini-mcp.ts   # Gemini format (.gemini/settings.json)
    ├── droid-mcp.ts    # Droid format (.factory/mcp.json)
    └── codex-mcp.ts    # Codex format (CLI commands)
```

## Agent Tasks

### Generate MCP Config for Evaluation

When running playoff evaluations with MCP tools:

```bash
# Generate Claude MCP config for You.com
bun scripts/generate-mcp-config.ts --agent claude-code --tool you --cwd /workspace

# Generate configs for all agents
for agent in claude-code gemini droid codex; do
  bun scripts/generate-mcp-config.ts --agent $agent --tool you --cwd /workspace
done
```

**What this does:**
- Reads `/tools/mcp-servers.json` for server definitions
- Uses agent-specific Zod schema from `/tools/schemas/<agent>-mcp.ts`
- Generates config file at agent's expected location:
  - Claude: `/workspace/.mcp.json`
  - Gemini: `/workspace/.gemini/settings.json`
  - Droid: `/workspace/.factory/mcp.json`
  - Codex: Runs CLI commands to configure

### Add New MCP Server

To add a new MCP tool (like Exa, Perplexity, etc.):

1. **Add server definition** to `mcp-servers.json`:
   ```json
   {
     "servers": {
       "exa": {
         "name": "exa-server",
         "type": "http",
         "url": "https://api.exa.ai/mcp",
         "auth": {
           "type": "bearer",
           "envVar": "EXA_API_KEY"
         }
       }
     }
   }
   ```

2. **Update generate-mcp-config.ts**:
   - Add `"exa"` to `TOOLS` array

3. **Add API key** to `.env` and `.env.example`:
   ```bash
   echo "EXA_API_KEY=..." >> .env
   echo "EXA_API_KEY=..." >> .env.example
   ```

4. **Create Docker services** in `docker-compose.yml`:
   ```yaml
   claude-code-exa:
     extends: claude-code-builtin
     environment:
       - MCP_TOOL=exa
       - AGENT=claude-code
     command:
       - bunx
       - "@plaited/agent-eval-harness"
       - capture
       - /eval/data/prompts/test-mcp.jsonl
       - --schema
       - /eval/agent-schemas/claude-code-mcp.json
       - -o
       - /eval/data/results/claude-code/exa.jsonl
   ```

5. **Test config generation**:
   ```bash
   bun scripts/generate-mcp-config.ts --agent claude-code --tool exa --cwd /tmp/test
   cat /tmp/test/.mcp.json  # Verify structure
   ```

### Create Schema for New Agent

When adding a new agent that needs MCP support:

1. **Research agent's MCP config format**:
   - Where does it store MCP config? (file path, CLI command, etc.)
   - What's the JSON structure?
   - Example: Claude uses `.mcp.json`, Gemini uses `.gemini/settings.json`

2. **Create Zod schema** (`tools/schemas/<agent>-mcp.ts`):
   ```typescript
   import { z } from 'zod'

   // Define schema matching agent's expected format
   export const NewAgentMcpConfigSchema = z.object({
     mcpServers: z.record(z.object({
       type: z.string(),
       url: z.string(),
       headers: z.record(z.string()).optional()
     }))
   })

   export const NEW_AGENT_CONFIG_PATH = '.newagent/mcp.json'

   export const generateNewAgentConfig = (servers: any, env: NodeJS.ProcessEnv) => {
     const mcpServers: Record<string, any> = {}

     for (const [key, server] of Object.entries(servers)) {
       const apiKey = env[server.auth.envVar]
       if (!apiKey) continue

       mcpServers[server.name] = {
         type: server.type,
         url: server.url,
         headers: {
           Authorization: `Bearer ${apiKey}`
         }
       }
     }

     return NewAgentMcpConfigSchema.parse({ mcpServers })
   }
   ```

3. **Update generate-mcp-config.ts**:
   - Import new schema
   - Add agent to `AGENTS` array
   - Add case in switch statement:
     ```typescript
     case 'new-agent': {
       const config = generateNewAgentConfig(servers, process.env)
       const configPath = join(cwd, NEW_AGENT_CONFIG_PATH)
       await Bun.write(configPath, JSON.stringify(config, null, 2))
       break
     }
     ```

4. **Test schema compiles**:
   ```bash
   bun run tools/schemas/new-agent-mcp.ts
   ```

5. **Test config generation**:
   ```bash
   bun scripts/generate-mcp-config.ts --agent new-agent --tool you --cwd /tmp/test
   ls /tmp/test/.newagent/mcp.json
   cat /tmp/test/.newagent/mcp.json | jq .
   ```

### Validate Existing Schema

Test that Zod schemas compile and generate correct configs:

```bash
# Compile all schemas
bun run tools/schemas/claude-mcp.ts
bun run tools/schemas/gemini-mcp.ts
bun run tools/schemas/droid-mcp.ts
bun run tools/schemas/codex-mcp.ts

# Generate and inspect configs
for agent in claude-code gemini droid codex; do
  echo "=== $agent ==="
  bun scripts/generate-mcp-config.ts --agent $agent --tool you --cwd /tmp/test-$agent
  find /tmp/test-$agent -name "*.json" -exec cat {} \;
done
```

### Troubleshoot MCP Config Issues

**Problem: Config not generated**

```bash
# Check if API key is set
echo $YOU_API_KEY

# Test config generation with verbose output
bun scripts/generate-mcp-config.ts --agent claude-code --tool you --cwd /tmp/debug
cat /tmp/debug/.mcp.json
```

**Problem: Agent doesn't find MCP config**

```bash
# Test inside Docker container
docker compose run --rm claude-code-you bash

# Inside container, check config location
ls -la /workspace/.mcp.json
cat /workspace/.mcp.json

# Verify entrypoint ran
echo $MCP_TOOL  # Should be "you"
echo $AGENT     # Should be "claude-code"
```

**Problem: MCP server authentication fails**

```bash
# Verify API key is substituted
cat /workspace/.mcp.json | jq '.mcpServers[].headers'
# Should show: { "Authorization": "Bearer sk-..." }

# Check .env file has key
grep YOU_API_KEY .env
```

## Config Format Reference

### mcp-servers.json Structure

```json
{
  "servers": {
    "tool-key": {
      "name": "server-name",
      "type": "http",
      "url": "https://api.example.com/mcp",
      "auth": {
        "type": "bearer",
        "envVar": "API_KEY_ENV_VAR"
      }
    }
  }
}
```

### Agent-Specific Formats

**Claude** (`.mcp.json`):
```json
{
  "mcpServers": {
    "ydc-server": {
      "type": "http",
      "url": "https://api.you.com/mcp/v1",
      "headers": {
        "Authorization": "Bearer sk-..."
      }
    }
  }
}
```

**Gemini** (`.gemini/settings.json`):
```json
{
  "mcp": {
    "servers": {
      "ydc-server": {
        "type": "http",
        "url": "https://api.you.com/mcp/v1",
        "auth": {
          "type": "bearer",
          "token": "sk-..."
        }
      }
    }
  }
}
```

## Related Files

- **Agent schemas**: `/agent-schemas/<agent>-mcp.json` - Headless adapter for MCP mode
- **Docker entrypoint**: `/docker/entrypoint.sh` - Calls generate-mcp-config.ts at startup
- **Results**: `/data/results/<agent>/you.jsonl` - MCP evaluation results

## Skills Reference

- **@.claude/skills/playoffs** - Development assistant for playoffs system
