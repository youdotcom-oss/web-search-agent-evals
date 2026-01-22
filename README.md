# Agentic Web Search Playoffs

Evaluate multiple agents (Claude Code, Gemini, Droid, Codex) with different web search tools (builtin, You.com MCP) in isolated Docker containers.

## Overview

The **playoffs** system runs a matrix evaluation: 4 agents × 2 tools = 8 pairings, capturing full trajectories for comparison.

**Key Features:**
- **Headless adapters** - No custom code, just JSON schemas ([@plaited/agent-eval-harness](https://www.npmjs.com/package/@plaited/agent-eval-harness))
- **Type-safe configs** - Zod schemas ensure MCP configs are correct
- **Single source of truth** - `tools/mcp-servers.json` drives all MCP config generation
- **Isolated execution** - Each pairing runs in its own Docker container
- **Transparent** - All schemas and configs are public, easily reviewable

```mermaid
flowchart TD
    Prompts[prompts.jsonl] --> Harness[agent-eval-harness]
    Schemas[agent-schemas/*.json] --> Harness
    MCP[tools/mcp-servers.json] --> Generate[generate-mcp-config]
    Generate --> ClaudeConfig[.mcp.json]
    Generate --> GeminiConfig[.gemini/settings.json]
    Generate --> DroidConfig[.factory/mcp.json]
    Harness --> Results[data/results/agent/tool.jsonl]
```

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Set API Keys

```bash
cp .env.example .env
# Edit .env and add:
# - ANTHROPIC_API_KEY
# - GEMINI_API_KEY
# - FACTORY_API_KEY
# - YOU_API_KEY
```

### 3. Run Evaluations

```bash
# Run all pairings (requires Docker)
bun run playoffs

# Run single pairing
bun run run-pairing -- -a claude-code -t builtin
bun run run-pairing -- -a gemini -t you

# Compare results
bun run compare -- -a claude-code --toolA builtin --toolB you
```

## Architecture

### Agent Schemas (agent-schemas/)

ACP headless adapter schemas - no custom code, just JSON configuration:

| Schema | Agent | Mode | Status |
|--------|-------|------|--------|
| `claude-code.json` | Claude Code | stream | ✅ Tested |
| `gemini.json` | Gemini CLI | iterative | ✅ Tested |
| `droid.json` | Droid CLI | stream | 🔄 New |
| `codex.json` | Codex CLI | stream | 🔄 New |

**Session Modes:**
- **stream**: Process stays alive, multi-turn via stdin
- **iterative**: New process per turn, history accumulated

### MCP Tools (tools/)

Single source of truth for MCP server configurations:

```
tools/
├── mcp-servers.json    # Unified server definitions
└── schemas/            # Zod schemas (agent-specific formats)
    ├── claude-mcp.ts   # .mcp.json
    ├── gemini-mcp.ts   # .gemini/settings.json
    ├── droid-mcp.ts    # .factory/mcp.json
    └── codex-mcp.ts    # CLI commands (codex mcp add)
```

**Available Tools:**
- `builtin` - Agent's native search (no MCP config)
- `you` - You.com MCP server (requires `YOU_API_KEY`)

### CLI Scripts (scripts/)

Type-safe, manually runnable scripts:

| Script | Purpose |
|--------|---------|
| `generate-mcp-config.ts` | Generate MCP config for agent+tool |
| `run-pairing.ts` | Run single agent×tool pairing via Docker |
| `compare-results.ts` | Compare results across tools |

### Docker Infrastructure

Isolated execution for reproducibility:

```
docker/
├── base.Dockerfile           # Shared base (Bun + Node 24)
├── claude-code.Dockerfile
├── gemini.Dockerfile
├── droid.Dockerfile
├── codex.Dockerfile
├── entrypoint.sh             # Calls generate-mcp-config.ts
└── docker-compose.yml        # 8 services (4 agents × 2 tools)
```

## Prompts

| File | Description | Count |
|------|-------------|-------|
| `data/prompts/search-test.jsonl` | Search-triggering test prompts | 5 |
| `data/prompts/test.jsonl` | Original test subset | 5 |
| `data/prompts/full.jsonl` | Full evaluation set | 1,254 |

**Search prompts** are designed to trigger web search:
- Natural language questions
- Time-sensitive queries (2025, latest, current)
- Recent events (CES 2025, API pricing)

## Results

Results are written to `data/results/<agent>/<tool>.jsonl`:

```
data/results/
├── claude-code/
│   ├── builtin.jsonl
│   └── you.jsonl
├── gemini/
│   ├── builtin.jsonl
│   └── you.jsonl
├── droid/
│   ├── builtin.jsonl
│   └── you.jsonl
└── codex/
    ├── builtin.jsonl
    └── you.jsonl
```

Each result includes full trajectory (messages, tool calls, timing, token usage).

## Usage Examples

### Generate MCP Configs

```bash
# Generate config for specific agent+tool
bun run generate-mcp -- -a claude-code -t you -c /workspace

# Test generation locally
bun run generate-mcp -- -a gemini -t you -c /tmp/test
cat /tmp/test/.gemini/settings.json
```

### Run Docker Services

```bash
# Build all images
docker compose build

# Run specific pairing
docker compose run --rm claude-code-builtin
docker compose run --rm gemini-you

# Debug: Shell into container
docker compose run --rm claude-code-builtin bash
```

### Analyze Results

```bash
# Generate summary
bunx @plaited/agent-eval-harness summarize data/results/claude-code/builtin.jsonl -o summary.jsonl
bunx @plaited/agent-eval-harness summarize data/results/claude-code/you.jsonl --markdown -o summary.md

# Count tool usage
cat data/results/claude-code/builtin.jsonl | jq -r '.trajectory[] | select(.type == "tool_call") | .name' | sort | uniq -c

# Check for tool errors
cat data/results/gemini/you.jsonl | jq 'select(.toolErrors == true)'
```

## Adding Agents

1. **Create adapter schema** (`agent-schemas/<agent>.json`)
   - Test CLI: `<agent> --help`
   - Map JSON events to ACP
   - Test: `bunx @plaited/agent-eval-harness adapter:check -- bunx @plaited/agent-eval-harness headless --schema agent-schemas/<agent>.json`

2. **Create MCP schema** (`tools/schemas/<agent>-mcp.ts`)
   - Research config location
   - Export Zod schema + path constant
   - Export `generate<Agent>Config` function

3. **Update generate-mcp-config.ts**
   - Import schema
   - Add to `AGENTS` array
   - Add switch case

4. **Create Dockerfile** (`docker/<agent>.Dockerfile`)
   - Install CLI
   - Copy entrypoint

5. **Add Docker Compose services**
   - `<agent>-builtin`
   - `<agent>-you`

See `.claude/skills/playoffs/SKILL.md` for detailed scaffolding guide.

## Adding MCP Tools

1. **Add to tools/mcp-servers.json**
   ```json
   {
     "servers": {
       "new-tool": {
         "name": "tool-name",
         "type": "http",
         "url": "https://api.example.com/mcp",
         "auth": { "type": "bearer", "envVar": "NEW_TOOL_API_KEY" }
       }
     }
   }
   ```

2. **Update generate-mcp-config.ts**
   - Add to `TOOLS` array

3. **Update .env and .env.example**
   ```
   NEW_TOOL_API_KEY=...
   ```

4. **Add Docker Compose services**
   - Add `<agent>-<tool>` for each agent

## Troubleshooting

### MCP Config Issues

1. **Test config generation**
   ```bash
   bun run generate-mcp -- -a <agent> -t <tool> -c /tmp/test
   ls /tmp/test/.mcp.json  # Claude
   ls /tmp/test/.gemini/settings.json  # Gemini
   ls /tmp/test/.factory/mcp.json  # Droid
   ```

2. **Verify API keys**
   ```bash
   cat .env | grep API_KEY
   ```

3. **Test inside container**
   ```bash
   docker compose run --rm <agent>-<tool> bash -c "cat /workspace/.mcp.json"
   ```

### Agent Schema Issues

1. **Capture raw CLI output**
   ```bash
   <agent> --help
   <agent> "test prompt" --output-format stream-json | head -20
   ```

2. **Test adapter compliance**
   ```bash
   bunx @plaited/agent-eval-harness adapter:check -- \
     bunx @plaited/agent-eval-harness headless --schema agent-schemas/<agent>.json
   ```

### Docker Build Failures

1. **Check base image**
   ```bash
   docker build -t base -f docker/base.Dockerfile .
   docker run --rm base bun --version
   ```

2. **Check agent CLI**
   ```bash
   docker build -t test-<agent> -f docker/<agent>.Dockerfile .
   docker run --rm test-<agent> <agent> --version
   ```

## Project Structure

```
acp-evals/
├── agent-schemas/          # ACP headless schemas (public)
│   ├── claude-code.json
│   ├── gemini.json
│   ├── droid.json
│   ├── codex.json
│   └── README.md
│
├── tools/                  # MCP configs (single source of truth)
│   ├── mcp-servers.json    # Unified server definitions
│   ├── schemas/            # Zod schemas per agent
│   └── README.md
│
├── scripts/                # CLI tools (type-safe, testable)
│   ├── generate-mcp-config.ts
│   ├── run-pairing.ts
│   └── compare-results.ts
│
├── docker/                 # Container infrastructure
│   ├── base.Dockerfile
│   ├── claude-code.Dockerfile
│   ├── gemini.Dockerfile
│   ├── droid.Dockerfile
│   ├── entrypoint.sh
│   └── docker-compose.yml
│
├── data/
│   ├── prompts/            # Evaluation prompts
│   │   ├── search-test.jsonl
│   │   ├── test.jsonl
│   │   └── full.jsonl
│   └── results/            # Agent outputs (gitignored)
│
├── .claude/skills/playoffs/  # Development assistant skill
└── .env                      # API keys (gitignored)
```

## Development

### Code Quality

```bash
# Type check
bun run typecheck

# Lint and format
bun run check

# Auto-fix
bun run check:write

# Run tests
bun test
```

### Skills

This project uses [AgentSkills](https://agentskills.io) for agent-first development:

- **playoffs** (`.claude/skills/playoffs/`) - Development assistant for extending playoffs
- **acp-adapters** - Schema creation and adapter testing
- **agent-eval-harness** - Capture, trials, and analysis commands

See [@AGENTS.md](AGENTS.md) for development rules and conventions.

## Built With

- **[@plaited/agent-eval-harness](https://www.npmjs.com/package/@plaited/agent-eval-harness)** - Trajectory capture framework
- **[Zod](https://zod.dev)** - TypeScript-first schema validation
- **[Bun](https://bun.sh)** - Fast TypeScript runtime
- **[Docker](https://www.docker.com)** - Isolated execution

## References

- [Agent Client Protocol](https://agentclientprotocol.com/) - Protocol specification
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
- [AgentSkills Spec](https://agentskills.io) - Agent skill conventions
- [Factory AI](https://factory.ai/) - Droid's platform
