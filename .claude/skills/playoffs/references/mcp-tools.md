# MCP Tools Configuration

Single source of truth for MCP server definitions used in the playoffs evaluation system.

## Structure

```
tools/
└── mcp-servers.ts      # TypeScript MCP server definitions

docker/
└── entrypoint          # Bun shell script with TypeScript syntax (imports mcp-servers.ts)
```

## Overview

MCP (Model Context Protocol) server configurations are defined in `mcp-servers.ts` as TypeScript constants. At runtime, the Bun shell script with TypeScript syntax (`docker/entrypoint`) imports these constants directly and uses official CLI commands to configure MCP servers for each agent.

**Architecture:**
- **Build time:** TypeScript constants provide type safety
- **Runtime:** Bun shell script with TypeScript syntax imports MCP_SERVERS and configures agents dynamically
- **Single source of truth:** One file defines all MCP servers, imported by entrypoint
- **No intermediate files:** No JSON generation, no schema duplication

## MCP Server Definitions

### mcp-servers.ts

```typescript
export type McpServer = {
  name: string;        // Server name in MCP protocol
  type: 'http';        // Server type (only http supported)
  url: string;         // Server URL endpoint
  auth?: {
    type: 'bearer';    // Authentication type
    envVar: string;    // Environment variable with API key
  };
};

export const MCP_SERVERS = {
  you: {
    name: 'ydc-server',
    type: 'http' as const,
    url: 'https://api.you.com/mcp',
    auth: {
      type: 'bearer' as const,
      envVar: 'YOU_API_KEY',
    },
  },
  // Add more servers here...
} as const;

export type McpServerKey = keyof typeof MCP_SERVERS;
```

## Agent Tasks

### Run Evaluation with MCP Tool

```bash
# Run specific agent with MCP tool
docker compose run --rm -e MCP_TOOL=you claude-code
docker compose run --rm -e MCP_TOOL=you gemini

# Run all agents with MCP tool (automated script)
bun scripts/run.ts --mcp you
# OR using npm script:
bun run run -- --mcp you

# Run all agents in both modes (8 scenarios)
bun scripts/run.ts
# OR:
bun run run
```

**What happens:**
1. Bun shell script with TypeScript syntax (`docker/entrypoint`) reads `MCP_TOOL` environment variable
2. Imports `MCP_SERVERS` constant from `/eval/mcp-servers.ts`
3. If `MCP_TOOL != "builtin"`, runs `configureMcp()` function with type-safe server config
4. Agent runs with MCP server available

### Add New MCP Server

To add a new MCP tool (like Exa, Perplexity, etc.):

**1. Add server to `mcp-servers.ts`:**

```typescript
export const MCP_SERVERS = {
  you: { /* ... */ },
  exa: {
    name: 'exa-server',
    type: 'http' as const,
    url: 'https://api.exa.ai/mcp',
    auth: {
      type: 'bearer' as const,
      envVar: 'EXA_API_KEY',
    },
  },
} as const;
```

**2. Add API key to `.env` and `.env.example`:**

```bash
echo "EXA_API_KEY=..." >> .env
echo "EXA_API_KEY=..." >> .env.example
```

**3. Update `docker/entrypoint` Bun shell script:**

Add the new tool case to `configureMcp()` function for each agent:

```typescript
const configureMcp = async (agent: string, tool: McpServerKey): Promise<void> => {
  const server = MCP_SERVERS[tool]  // Type-safe access!
  const apiKey = server.auth ? process.env[server.auth.envVar] : undefined

  switch (agent) {
    case 'claude-code': {
      await $`claude mcp add --transport http ${server.name} ${server.url} --header "Authorization: Bearer ${apiKey}"`.quiet()
      break
    }
    // ... repeat for gemini, droid, codex
  }
}
```

**4. Update docker-compose.yml environment:**

Ensure the API key is passed to containers:

```yaml
services:
  claude-code:
    env_file: .env
    environment:
      - EXA_API_KEY=${EXA_API_KEY}
```

**5. Create MCP prompt set:**

Convert prompts to reference the new MCP server:

```bash
# Edit prompts to use mcp-server="exa-server"
# Save as data/prompts/test-exa.jsonl and full-exa.jsonl
```

**6. Test:**

```bash
docker compose run --rm -e MCP_TOOL=exa claude-code
```

### Configure Agent MCP via CLI

Each agent has its own CLI command format for adding MCP servers:

**Claude Code:**
```bash
claude mcp add --transport http <server-name> <url> \
  --header "Authorization: Bearer ${API_KEY}"
```

**Gemini:**
```bash
gemini mcp add --transport http \
  --header "Authorization: Bearer ${API_KEY}" \
  <server-name> <url>
```

**Droid:**
```bash
droid mcp add <server-name> <url> --type http \
  --header "Authorization: Bearer ${API_KEY}"
```

**Codex:**
```bash
# Codex uses config file (no simple CLI for HTTP)
mkdir -p ~/.codex
cat > ~/.codex/config.toml <<EOF
[mcp_servers.<server-name>]
url = "<url>"
bearer_token_env_var = "API_KEY_VAR"
EOF
```

These commands are executed in the Bun shell script with TypeScript syntax (`docker/entrypoint`) based on the `MCP_TOOL` environment variable. The entrypoint imports server configs from `mcp-servers.ts` for type safety.

## Troubleshooting

### MCP Server Not Configured

**Check entrypoint execution:**

```bash
docker compose run --rm -e MCP_TOOL=you claude-code bash -c '
  echo "MCP_TOOL: $MCP_TOOL"
  echo "API key set: ${YOU_API_KEY:+yes}"
  ls -la ~/.mcp.json 2>/dev/null || echo "No Claude config"
  ls -la ~/.gemini/settings.json 2>/dev/null || echo "No Gemini config"
'
```

**Check API key is passed:**

```bash
# Verify .env file
grep YOU_API_KEY .env

# Verify docker-compose passes it
docker compose config | grep YOU_API_KEY
```

### Agent Not Using MCP Tools

**Check trajectory for MCP tool calls:**

```bash
cat data/results/claude-code/you.jsonl | jq '.trajectory[] | select(.type == "tool_call") | .name'
# Should see MCP tool names like "ydc-server___you-search"
```

**Check if agent fell back to builtin:**

```bash
# If you see only builtin tool names (google_web_search, read_file, etc.),
# MCP server may not be configured or failed to connect
```

**Enable debug output:**

```bash
# Check entrypoint logic
docker compose run --rm -e MCP_TOOL=you claude-code bash -c 'cat /entrypoint | grep -A20 "configureMcp"'
```

### Container Errors

**Rebuild images after entrypoint changes:**

```bash
docker compose build --no-cache
```

**Check entrypoint is executable:**

```bash
docker compose run --rm claude-code bash -c 'ls -la /entrypoint'
# Should show: -rwxr-xr-x
```

## Related Files

- **Agent schemas**: `/agent-schemas/<agent>.json` - Headless adapter (no -mcp suffix needed)
- **TypeScript entrypoint**: `/docker/entrypoint` - Bun shell script with type-safe MCP configuration
- **MCP constants**: `/mcp-servers.ts` - Single source of truth for MCP servers
- **Docker compose**: `/docker-compose.yml` - Service definitions (4 services, one per agent)
- **Results**: `/data/results/<agent>/{builtin,you}-test.jsonl` - Evaluation results

## Skills Reference

- **@.claude/skills/playoffs** - Development assistant for playoffs system (main skill)
- **@.claude/skills/playoffs/references/prompts.md** - Prompt format documentation
- **@.claude/skills/playoffs/references/agent-schemas.md** - Agent schema documentation
