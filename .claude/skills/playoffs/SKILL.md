---
name: playoffs
description: Development assistant for running and extending the ACP evaluation playoffs system
compatibility: Bun >= 1.2.9
---

# Playoffs

Development assistant for running and extending the agent evaluation playoffs system.

## Overview

Evaluate 4 agents (Claude Code, Gemini, Droid, Codex) with 2 tools (builtin, You.com MCP) = 8 pairings.

**Key Features:**
- **Headless adapters** - Schema-driven CLI agent execution via [@plaited/agent-eval-harness](https://www.npmjs.com/package/@plaited/agent-eval-harness)
- **Flag-based architecture** - Single service per agent, mode selected via environment variables
- **Type-safe constants** - MCP server definitions in TypeScript
- **Isolated execution** - Each pairing runs in its own Docker container

**Architecture:**
- `agent-schemas/` - Headless adapter JSON schemas
- `mcp-servers.ts` - TypeScript MCP server constants
- `docker/entrypoint` - Bun shell script for runtime config
- `scripts/` - Type-safe execution and comparison CLI tools
- `docker/` - Container infrastructure

## Quick Commands

### Run Evaluations

```bash
# Test workflow (5 prompts, ~5 minutes)
bun run run                 # All 8 scenarios in parallel

# Full workflow (1,254 prompts, ~10+ hours)
bun run run:full            # All agents with full dataset

# Specific combinations
docker compose run --rm -e MCP_TOOL=builtin claude-code
docker compose run --rm -e MCP_TOOL=you gemini
docker compose run --rm -e MCP_TOOL=builtin -e DATASET=full droid
```

### Compare Results

```bash
# Flexible CLI tool (recommended)
bun scripts/compare.ts                          # All agents, test, weighted
bun scripts/compare.ts --mode full              # Full dataset
bun scripts/compare.ts --agent gemini           # Filter by agent
bun scripts/compare.ts --mcp builtin            # Filter by MCP mode
bun scripts/compare.ts --strategy statistical   # Statistical analysis

# Quick shortcuts (test data only)
bun run compare:all-weighted
bun run compare:all-statistical
bun run compare:builtin-agents
bun run compare:you-agents

# View results
cat data/comparison-all-weighted-test.json | jq '.meta, .quality'
cat data/comparison-all-weighted-test.json | jq '.headToHead.pairwise'
```

**Comparison strategies:**
- `weighted` - Balances quality (inline grader), latency, reliability
- `statistical` - Bootstrap sampling with significance testing (p<0.05)

### Pass@k Trials

Run multiple trials per prompt to measure reliability:

```bash
bun run trials              # Default: Droid, test set, k=5
bun run trials:capability   # k=10 for capability exploration
bun run trials:regression   # k=3 for faster regression checks

# Custom agent and k value
bun run trials -- --agent gemini -k 7 --mode full

# View results
cat data/results/trials/droid-test.jsonl | jq '{id, passRate, passAtK, passExpK}'
```

**Metrics:** `passAtK` = capability (can do task?), `passExpK` = reliability (always succeeds?)

See [@agent-eval-harness](../agent-eval-harness@plaited_agent-eval-harness/SKILL.md) skill for detailed trials command documentation.

## Prompts

| File | Prompts | Format | Use With |
|------|---------|--------|----------|
| `test.jsonl` | 5 | `<web-search>` | `MCP_TOOL=builtin` |
| `test-mcp.jsonl` | 5 | `<web-search mcp-server="ydc-server">` | `MCP_TOOL=you` |
| `full.jsonl` | 1,254 | `<web-search>` | `MCP_TOOL=builtin` |
| `full-mcp.jsonl` | 1,254 | `<web-search mcp-server="ydc-server">` | `MCP_TOOL=you` |

**MCP format is 39-45% faster** than builtin due to explicit server specification.

The entrypoint automatically selects the correct prompt file based on `MCP_TOOL` and `DATASET` environment variables.

## Results

Results are written to `data/results/<agent>/<tool>-<dataset>.jsonl`:

```
data/results/
├── claude-code/
│   ├── builtin-test.jsonl
│   └── you-test.jsonl
├── gemini/
│   ├── builtin-test.jsonl
│   └── you-test.jsonl
├── droid/
│   ├── builtin-test.jsonl
│   └── you-test.jsonl
└── codex/
    ├── builtin-test.jsonl
    └── you-test.jsonl
```

Results are committed to git for downstream data science analysis.

## Adding a New Agent

### 1. Create Headless Adapter Schema

Create `agent-schemas/<agent>.json`:

```json
{
  "command": ["<agent-cli>", "--flag", "{input}"],
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
- `command` - CLI invocation with `{input}` placeholder
- `outputEvents.match.path` - JSONPath to event type field
- `patterns` - Map event types to standard names
- `result.contentPath` - JSONPath to extract final output
- `mode` - `"stream"` (persistent) or `"iterative"` (new process per turn)
- `env` - Required environment variables

**Test schema:**
```bash
bunx @plaited/agent-eval-harness adapter:check -- \
  bunx @plaited/agent-eval-harness headless --schema agent-schemas/<agent>.json
```

### 2. Create Dockerfile

Create `docker/<agent>.Dockerfile`:

```dockerfile
FROM base

# Install agent CLI
RUN npm install -g <agent-cli>

# Copy entrypoint and MCP config
COPY docker/entrypoint /entrypoint
COPY mcp-servers.ts /eval/mcp-servers.ts

RUN chmod +x /entrypoint

CMD ["/entrypoint"]
```

**Verify installation:**
```bash
docker build -t test-<agent> -f docker/<agent>.Dockerfile .
docker run --rm test-<agent> <agent> --version
```

### 3. Add Docker Compose Service

Add to `docker-compose.yml`:

```yaml
<agent>:
  build:
    context: .
    dockerfile: docker/<agent>.Dockerfile
  volumes:
    - ./agent-schemas:/eval/agent-schemas:ro
    - ./data:/eval/data
    - ./scripts:/eval/scripts:ro
  working_dir: /workspace
  env_file: .env
  environment:
    - AGENT=<agent>
    - MCP_TOOL=${MCP_TOOL:-builtin}
    - DATASET=${DATASET:-test}
```

### 4. Update TypeScript Entrypoint

Edit `docker/entrypoint` to add agent to `configureMcp()` function:

```typescript
const configureMcp = async (agent: string, tool: McpServerKey): Promise<void> => {
  const server = MCP_SERVERS[tool]
  const apiKey = server.auth ? process.env[server.auth.envVar] : undefined
  
  switch (agent) {
    // ... existing cases ...
    
    case '<agent>': {
      await $`<agent> mcp add ${server.name} ${server.url} --header "Authorization: Bearer ${apiKey}"`.quiet()
      console.log('✓ Agent MCP server added')
      break
    }
  }
}
```

Add timeout if needed in `buildCaptureCommand()`:

```typescript
switch (AGENT) {
  case '<agent>':
    cmd.push('--timeout', '120000')  // 2 minutes
    break
}
```

### 5. Update Scripts

Edit `scripts/run.ts` to add agent to `ALL_AGENTS`:

```typescript
const ALL_AGENTS: Agent[] = ["claude-code", "gemini", "droid", "codex", "<agent>"]
```

Also update the `Agent` type:

```typescript
type Agent = "claude-code" | "gemini" | "droid" | "codex" | "<agent>"
```

### 6. Test

```bash
docker compose build <agent>
docker compose run --rm -e MCP_TOOL=builtin <agent>
docker compose run --rm -e MCP_TOOL=you <agent>
```

## Adding a New MCP Tool

### 1. Add to mcp-servers.ts

```typescript
export type McpServer = {
  name: string
  type: 'http'
  url: string
  auth?: {
    type: 'bearer'
    envVar: string
  }
}

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
  exa: {
    name: 'exa-server',
    type: 'http' as const,
    url: 'https://api.exa.ai/mcp',
    auth: {
      type: 'bearer' as const,
      envVar: 'EXA_API_KEY',
    },
  },
} as const

export type McpServerKey = keyof typeof MCP_SERVERS
```

### 2. Update docker/entrypoint

Add the new tool case to `configureMcp()` for each agent:

```typescript
case 'claude-code': {
  await $`claude mcp add --transport http ${server.name} ${server.url} --header "Authorization: Bearer ${apiKey}"`.quiet()
  break
}

case 'gemini': {
  await $`gemini mcp add --transport http --header "Authorization: Bearer ${apiKey}" ${server.name} ${server.url}`.quiet()
  break
}

case 'droid': {
  await $`droid mcp add ${server.name} ${server.url} --type http --header "Authorization: Bearer ${apiKey}"`.quiet()
  break
}

case 'codex': {
  const configDir = `${process.env.HOME}/.codex`
  await $`mkdir -p ${configDir}`.quiet()
  const config = `[mcp_servers.${server.name}]
url = "${server.url}"
bearer_token_env_var = "${server.auth?.envVar}"
`
  await Bun.write(`${configDir}/config.toml`, config)
  break
}
```

### 3. Update Environment Files

Add to `.env` and `.env.example`:

```bash
EXA_API_KEY=your_api_key_here
```

### 4. Update Scripts

Edit `scripts/run.ts` and `scripts/compare.ts`:

```typescript
type McpTool = "builtin" | "you" | "exa"
```

### 5. Create MCP Prompt Sets

```bash
# Convert test prompts
sed 's/mcp-server="ydc-server"/mcp-server="exa-server"/g' \
  data/prompts/test-mcp.jsonl > data/prompts/test-exa.jsonl

# Convert full prompts
sed 's/mcp-server="ydc-server"/mcp-server="exa-server"/g' \
  data/prompts/full-mcp.jsonl > data/prompts/full-exa.jsonl
```

Update `docker/entrypoint` to handle the new prompt files:

```typescript
const promptFile = MCP_TOOL === "builtin"
  ? `/eval/data/prompts/${DATASET}.jsonl`
  : `/eval/data/prompts/${DATASET}-${MCP_TOOL}.jsonl`  // e.g., test-exa.jsonl
```

### 6. Test

```bash
docker compose build
docker compose run --rm -e MCP_TOOL=exa claude-code
bun run run -- --mcp exa
```

## Schema Format Reference

Current agent schemas:

| Schema | Agent | Mode | Status |
|--------|-------|------|--------|
| `claude-code.json` | Claude Code | stream | ✅ Tested |
| `gemini.json` | Gemini CLI | iterative | ✅ Tested |
| `droid.json` | Droid CLI | stream | ✅ Tested |
| `codex.json` | Codex CLI | stream | ✅ Tested |

**Session Modes:**
- `stream` - Process stays alive, multi-turn conversations via stdin
- `iterative` - New process per turn, history passed as context

## Related Skills

- [@agent-eval-harness](../agent-eval-harness@plaited_agent-eval-harness/SKILL.md) - Capture, trials, compare commands
- [@headless-adapters](../headless-adapters@plaited_agent-eval-harness/SKILL.md) - Schema creation and validation
