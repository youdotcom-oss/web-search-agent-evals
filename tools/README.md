# MCP Tools Configuration

Single source of truth for all MCP server configurations used across agents.

## Structure

```
tools/
├── mcp-servers.json    # Unified server definitions
└── schemas/            # Agent-specific Zod schemas
    ├── claude-mcp.ts   # Claude format (.mcp.json)
    ├── gemini-mcp.ts   # Gemini format (.gemini/settings.json)
    └── droid-mcp.ts    # Droid format (.factory/mcp.json)
```

## Adding MCP Servers

Edit `mcp-servers.json`:

```json
{
  "servers": {
    "server-key": {
      "name": "server-name",
      "type": "http",
      "url": "https://api.example.com/mcp",
      "auth": {
        "type": "bearer",
        "envVar": "API_KEY_NAME"
      }
    }
  }
}
```

The `generate-mcp-config.ts` script reads this file and generates agent-specific configs using the Zod schemas.

## Agent-Specific Formats

| Agent | Config Path | Schema |
|-------|-------------|--------|
| Claude Code | `.mcp.json` | `claude-mcp.ts` |
| Gemini | `.gemini/settings.json` | `gemini-mcp.ts` |
| Droid | `.factory/mcp.json` | `droid-mcp.ts` |

## Usage

Generate configs for specific agent+tool pairings:

```bash
# Generate Claude MCP config for You.com
bun scripts/generate-mcp-config.ts --agent claude-code --tool you --cwd /workspace

# Generate Gemini MCP config
bun scripts/generate-mcp-config.ts --agent gemini --tool you --cwd /workspace

# Generate Droid MCP config
bun scripts/generate-mcp-config.ts --agent droid --tool you --cwd /workspace
```

## Testing Schemas

Validate that Zod schemas compile correctly:

```bash
bun run tools/schemas/claude-mcp.ts
bun run tools/schemas/gemini-mcp.ts
bun run tools/schemas/droid-mcp.ts
```
