---
name: web-search-agent-evals
description: Development assistant for web search agent evaluations across multiple CLI agents
compatibility: Bun >= 1.2.9
---

# Web Search Agent Evaluations

Development assistant for running and comparing web search capabilities across CLI agents.

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

# Full workflow (151 prompts, ~2 hours)
bun run run:full            # All agents with full dataset

# Specific combinations
docker compose run --rm -e MCP_TOOL=builtin claude-code
docker compose run --rm -e MCP_TOOL=you gemini
docker compose run --rm -e MCP_TOOL=builtin -e DATASET=full droid
```

### Compare Results

Comparisons are versioned alongside the results they analyze.

**Test mode:** Outputs to `data/comparisons/test-runs/`
**Full mode:** Outputs to `data/comparisons/runs/YYYY-MM-DD/`

```bash
# Flexible CLI tool (recommended)
bun scripts/compare.ts                          # All agents, test, weighted
bun scripts/compare.ts --mode full              # Latest full run
bun scripts/compare.ts --mode full --run-date 2026-01-24  # Specific run

# Quick shortcuts
bun run compare:test-weighted       # → test-runs/all-weighted.json
bun run compare:test-statistical    # → test-runs/all-statistical.json
bun run compare:test-builtin        # → test-runs/builtin-weighted.json
bun run compare:test-you            # → test-runs/you-weighted.json

# View results
cat data/comparisons/test-runs/all-weighted.json | jq '.meta, .quality'
cat data/comparisons/runs/2026-01-24/all-weighted.json | jq '.headToHead.pairwise'
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

**Unified prompt format:** All prompts use "Use web search to find:\n<query>" regardless of mode (builtin or MCP).

Prompts are organized by dataset type, with each in its own directory:

| File | Prompts | Metadata | Use With |
|------|---------|----------|----------|
| `full/prompts.jsonl` | 151 | No MCP | `SEARCH_PROVIDER=builtin` |
| `full/prompts-you.jsonl` | 151 | `mcp_server="ydc-server"`, `expected_tool="you-search"` | `SEARCH_PROVIDER=you` |
| `test/prompts.jsonl` | 5 | No MCP | `SEARCH_PROVIDER=builtin` |
| `test/prompts-you.jsonl` | 5 | `mcp_server="ydc-server"`, `expected_tool="you-search"` | `SEARCH_PROVIDER=you` |
| `trials/prompts.jsonl` | 30 | No MCP | `SEARCH_PROVIDER=builtin` |
| `trials/prompts-you.jsonl` | 30 | `mcp_server="ydc-server"`, `expected_tool="you-search"` | `SEARCH_PROVIDER=you` |

**Key insight:** The prompt text is identical across modes. MCP metadata tells the grader which tool to expect, but agents interpret "Use web search" naturally.

The entrypoint automatically selects the correct prompt file based on `SEARCH_PROVIDER` and `DATASET` environment variables.

### Refreshing Test Prompts

Test and trials prompts are randomly sampled from the full dataset. Refresh them when:
- Full dataset is updated with new prompts
- Test prompts feel stale or unrepresentative
- Debugging edge cases (re-sample until interesting prompts appear)

```bash
bun run sample:test        # 5 prompts → test/
bun run sample:trials      # 30 prompts → trials/
```

Or use the script directly:

```bash
bun scripts/sample.ts --dir test --count 5
bun scripts/sample.ts --dir trials --count 30
```

**What it does:**
1. Randomly samples prompts from `full/prompts.jsonl` (151 prompts) using Fisher-Yates shuffle
2. Creates `<dir>/prompts.jsonl` without MCP metadata (builtin mode)
3. Creates `<dir>/prompts-<key>.jsonl` for each MCP server in `mcp-servers.ts`
4. All use identical "Use web search to find:" prompt text

**Use cases:**
- **After updating full dataset** - Get fresh test samples reflecting new prompts
- **Before committing** - Ensure test set represents current full dataset
- **Rapid iteration** - Test different scenarios without running full evaluation (~5 min vs ~2 hours)

## Results

### Test Results (Rapid Iteration)
Written to `data/results/test-runs/<agent>/<searchProvider>.jsonl` for quick development cycles. Not versioned.

### Full Run Results (Historical Archive)
Stored in dated directories: `data/results/runs/YYYY-MM-DD/<agent>/<searchProvider>.jsonl`

**Latest run pointer:** `data/results/latest.json` points to most recent full run.

**Versioning workflow:**
1. Run full evaluation: `bun run run:full`
2. Finalize run metadata: `bun run finalize-run`
3. Commit results: `git add data/results/ && git commit -m "feat: full evaluation run YYYY-MM-DD"`

**Directory structure:**
- Test mode: `test-runs/<agent>/<searchProvider>.jsonl`
- Full mode: `runs/YYYY-MM-DD/<agent>/<searchProvider>.jsonl`

**Compare historical runs:**
```bash
# Latest run (default)
bun scripts/compare.ts --mode full

# Specific run
bun scripts/compare.ts --mode full --run-date 2026-01-24

# View run manifest
cat data/results/MANIFEST.jsonl | jq .
```

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

### 5. Generate MCP Prompt Sets

Use the generate-mcp-prompts script to create MCP variant files with proper metadata:

```bash
# Generate variants for new MCP server (uses exa key from mcp-servers.ts)
bun scripts/generate-mcp-prompts.ts --mcp-key exa

# This creates MCP variants for all datasets:
# - data/prompts/full/prompts-exa.jsonl
# - data/prompts/test/prompts-exa.jsonl
# - data/prompts/trials/prompts-exa.jsonl
```

The script automatically reads server configuration from `mcp-servers.ts` and adds MCP metadata without changing prompt text (unified "Use web search to find:" format).

Then regenerate test samples to include the new MCP variants:

```bash
bun run sample:test
```

The entrypoint automatically handles provider-specific prompt files:

```typescript
const promptFile = SEARCH_PROVIDER === "builtin"
  ? `/eval/data/prompts/${DATASET}/prompts.jsonl`
  : `/eval/data/prompts/${DATASET}/prompts-${SEARCH_PROVIDER}.jsonl`  // e.g., test/prompts-exa.jsonl
```

**Note:** Scripts (`run.ts`, `run-trials.ts`, `sample.ts`) automatically pick up new MCP servers from `mcp-servers.ts`, so no manual updates needed.

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
