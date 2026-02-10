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
# Test workflow (5 prompts, ~9 minutes with default concurrency)
bun run run                 # All 8 scenarios at once (default: unlimited containers, sequential prompts)

# Full workflow (151 prompts, ~2.5 hours with default concurrency)
bun run run:full            # All agents with full dataset

# Control parallelism (both container and prompt levels)
bun run run -- -j 4                              # Limit to 4 containers
bun run run -- --prompt-concurrency 4            # 4 prompts per container
bun run run -- -j 2 --prompt-concurrency 4       # Conservative (low-resource machines)

# Specific combinations
bun run run -- --agent claude-code --mcp builtin
bun run run -- --agent gemini --mcp you -j 1     # Single container for debugging

# Direct Docker commands (for manual testing)
docker compose run --rm -e SEARCH_PROVIDER=builtin claude-code
docker compose run --rm -e SEARCH_PROVIDER=you -e PROMPT_CONCURRENCY=8 gemini
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

### Generate Summary Reports

Generate human-readable markdown summaries from comparison results:

```bash
# Generate summary for latest full run
bun run summarize                   # → data/comparisons/runs/YYYY-MM-DD/SUMMARY.md
bun run summarize:full              # Same as above

# Generate summary for test results
bun run summarize:test              # → data/comparisons/test-runs/SUMMARY.md

# Generate summary for latest trial results (NEW!)
bun run summarize:trials            # → data/comparisons/trials/YYYY-MM-DD/SUMMARY.md

# Custom options
bun scripts/summarize.ts --mode full --run-date 2026-01-24
bun scripts/summarize.ts --output my-summary.md
bun scripts/summarize-trials.ts --run-date 2026-02-10
bun scripts/summarize-trials.ts --trial-type capability

# Preview without writing (dry-run)
bun scripts/summarize.ts --dry-run
bun scripts/summarize-trials.ts --dry-run
```

**Summary includes:**
- Executive summary with best quality, fastest, most reliable
- Quality rankings with scores and pass rates
- Performance rankings (latency P50/P90/P99)
- Reliability metrics (errors, timeouts, completion rates)
- Capability metrics (Pass@k) if trials data available
- Flakiness analysis with top flaky prompts
- MCP tool impact analysis (builtin vs MCP comparison)
- Recommendations for production, cost-conscious use, and what to avoid

### Calibrate Grader

Interactive wizard to sample failures and review grader accuracy. Helps distinguish between agent failures (agent got it wrong) and grader bugs (agent was correct, grader too strict).

```bash
# Interactive calibration (recommended)
bun run calibrate
```

**Interactive prompts:**
1. **Mode** - test-runs or dated runs (with list of available dates)
2. **Agents** - Multi-select via numbers or "all" (e.g., `1 3` or `all`)
3. **Search providers** - Multi-select via numbers or "all" (e.g., `1 2` or `all`)
4. **Sample count** - Number of failures to sample (default: 5)

**Output:** `data/calibration/{prefix}-{agent}-{provider}.md`

**Example session:**
```bash
$ bun run calibrate

🎯 Grader Calibration Tool

Select mode:
  1. test-runs (quick test results)
  2. runs (dated full evaluation runs)

Enter choice (1 or 2) [1]: 1

Select agents (space-separated numbers, or 'all'):
  1. claude-code
  2. gemini
  3. droid
  4. codex

Enter choices (e.g., "1 3" or "all") [all]: 1

Select search providers (space-separated numbers, or 'all'):
  1. builtin
  2. you

Enter choices (e.g., "1 2" or "all") [all]: all

Number of samples [5]: 10

📊 Will generate 2 calibration report(s):
   - claude-code with builtin
   - claude-code with you

Proceed? (y/n) [y]: y
```

**What calibration reveals:**
- ❌ **Grader too strict** - Agent gave correct answer, grader rejected valid paraphrasing
- ❌ **Hint too vague** - Grader can't tell good from bad answers
- ✅ **Real failures** - Agent genuinely gave wrong/incomplete answer

**View results:**
```bash
ls data/calibration/
cat data/calibration/test-claude-code-builtin.md
```

See [@agent-eval-harness calibration docs](../agent-eval-harness@plaited_agent-eval-harness/SKILL.md#calibrate-command) for grader calibration concepts.

### Pass@k Trials

Run multiple trials per prompt across all agents and search providers to measure reliability:

```bash
# Run all agents × all providers (8 combinations, default: unlimited containers, sequential prompts)
bun run trials                      # All agents/providers, k=5 (default)
bun run trials:capability           # All agents/providers, k=10
bun run trials:regression           # All agents/providers, k=3 (faster)

# Filter to specific agents or providers
bun run trials -- --agent gemini                    # Single agent, all providers
bun run trials -- --search-provider you             # All agents, MCP only
bun run trials -- --agent claude-code --search-provider builtin

# Custom k value
bun run trials -- -k 7              # All agents/providers, k=7

# Control parallelism (dramatically speeds up trials)
bun run trials -- -j 4                              # Limit to 4 containers
bun run trials -- --prompt-concurrency 8            # 8 prompts per container
bun run trials -- -j 4 --prompt-concurrency 4       # Conservative
# Note: With k=5, prompt concurrency reduces 151 prompts from ~37min to ~10min per container

# View results
cat data/results/trials/2026-01-29/droid/builtin.jsonl | jq '{id, passRate, passAtK, passExpK}'
cat data/results/trials/*/gemini/you.jsonl | jq '.passRate'
```

**Metrics:**
- `passAtK` = capability (can do task?), computed as 1 - (1 - p)^k
- `passExpK` = reliability (always succeeds?), computed as p^k

**Output:** Results written to `data/results/trials/YYYY-MM-DD/{agent}/{provider}.jsonl` (same nested structure as runs)

See [@agent-eval-harness](../agent-eval-harness@plaited_agent-eval-harness/SKILL.md) skill for detailed trials command documentation.

## Parallelization

The evaluation harness supports **two-level parallelization** for optimal performance:

### Container-Level Concurrency (`-j`, `--concurrency`)

Controls how many Docker containers (agent×provider scenarios) run simultaneously.

```bash
bun run run              # Unlimited (default, all 8 scenarios at once)
bun run run -- -j 4     # Limit to 4 containers
bun run run -- -j 1     # Sequential (debugging)
```

**Use cases:**
- Unlimited (default) - All scenarios at once, I/O-bound workload handles it fine
- `-j 4` - Limit concurrency if hitting API rate limits
- `-j 2` - Conservative, for low-resource machines
- `-j 1` - Sequential execution for debugging

### Prompt-Level Concurrency (`--prompt-concurrency`)

Controls how many prompts run in parallel **within each container**.

```bash
bun run run -- --prompt-concurrency 4    # 4 prompts (moderate parallelism)
bun run run -- --prompt-concurrency 1    # Sequential (default, safest)
bun run run -- --prompt-concurrency 8    # 8 prompts (high memory, CI only)
```

**How it works:**
- Uses harness `-j` flag with `--workspace-dir` for isolation
- Each prompt gets its own workspace directory: `/workspace/runs/{prompt-id}/`
- Workspace cleanup happens automatically after container finishes

**Performance impact:**
- Web searches are **I/O-bound** (high network latency, low CPU usage)
- Parallel prompts maximize network bandwidth utilization
- **Example**: 151 prompts @ 3s avg → 7.5min sequential → **~1min with `-j 8`**

### Combined Usage

```bash
# All containers, sequential prompts (default — safe for all agents)
bun run run

# Faster: add prompt parallelism (watch memory usage)
bun run run -- --prompt-concurrency 4

# Debugging: Single container, sequential prompts
bun run run -- -j 1 --prompt-concurrency 1 --agent claude-code --mcp builtin
```

**Performance comparison:**

| Config | Containers | Prompts/Container | Test (5 prompts) | Full (151 prompts) |
|--------|-----------|-------------------|------------------|-------------------|
| **Default** | **unlimited** | **1** | **~9 min** | **~2.5 hrs** |
| Faster | unlimited | 4 | ~4 min | ~40 min |
| CI (high memory) | unlimited | 8 | ~3 min | ~20 min |

**Scale up if resources allow:**
- `--prompt-concurrency 4` for faster runs (needs ~2GB per container)
- `--prompt-concurrency 8` for CI runners with 16GB+ RAM
- **Warning:** Stream-mode agents (claude-code, droid) use ~400-500MB RSS per prompt process. With `-j 8` that's 3-4GB per container — OOM kills likely in Docker (see [issue #45](https://github.com/plaited/agent-eval-harness/issues/45))

## Prompts

Prompts are organized by dataset type, with each in its own directory. The format differs by search provider:
- **Builtin mode**: Just the query (e.g., "What are the best free icon libraries...")
- **MCP mode**: "Use {server-name} and answer\n{query}" (e.g., "Use ydc-server and answer\nWhat are...")

Prompts are organized by dataset type, with each in its own directory:

| File | Prompts | Metadata | Use With |
| ------ | --------- | ---------- | ---------- |
| `full/prompts.jsonl` | 151 | No MCP | `SEARCH_PROVIDER=builtin` |
| `full/prompts-you.jsonl` | 151 | `mcp_server="ydc-server"`, `expected_tool="you-search"` | `SEARCH_PROVIDER=you` |
| `test/prompts.jsonl` | 5 | No MCP | `SEARCH_PROVIDER=builtin` |
| `test/prompts-you.jsonl` | 5 | `mcp_server="ydc-server"`, `expected_tool="you-search"` | `SEARCH_PROVIDER=you` |
| `trials/prompts.jsonl` | 30 | No MCP | `SEARCH_PROVIDER=builtin` |
| `trials/prompts-you.jsonl` | 30 | `mcp_server="ydc-server"`, `expected_tool="you-search"` | `SEARCH_PROVIDER=you` |

**Key difference:**
- **Builtin prompts** have no prefix - agents use their native web search capability
- **MCP prompts** have "Use {server-name} and answer\n" prefix to explicitly invoke the MCP tool
- **MCP metadata** in MCP variants tells the grader which tool to expect (e.g., `"mcpServer": "ydc-server"`, `"expectedTools": ["you-search"]`)

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
2. Creates `<dir>/prompts.jsonl` with plain queries (builtin mode)
3. Creates `<dir>/prompts-<key>.jsonl` for each MCP server with "Use {server-name} and answer\n" prefix and MCP metadata

**Use cases:**
- **After updating full dataset** - Get fresh test samples reflecting new prompts
- **Before committing** - Ensure test set represents current full dataset
- **Rapid iteration** - Test different scenarios without running full evaluation (~9 min vs ~2.5 hrs)

## Results

### Test Results (Rapid Iteration)
Written to `data/results/test-runs/<agent>/<searchProvider>.jsonl` for quick development cycles. Not versioned.

### Full Run Results (Historical Archive)
Stored in dated directories: `data/results/runs/YYYY-MM-DD/<agent>/<searchProvider>.jsonl`

**Versioning workflow:**
1. Run full evaluation: `bun run run:full`
2. Commit results: `git add data/results/ && git commit -m "feat: full evaluation run YYYY-MM-DD"`

**Directory structure:**
- Test mode: `test-runs/<agent>/<searchProvider>.jsonl`
- Full mode: `runs/YYYY-MM-DD/<agent>/<searchProvider>.jsonl`

**Compare runs:**
```bash
# Latest run (automatically detected from runs/ directory)
bun scripts/compare.ts --mode full

# Specific run
bun scripts/compare.ts --mode full --run-date 2026-01-24
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
      envVar: 'YDC_API_KEY',
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

The script automatically reads server configuration from `mcp-servers.ts`, prepends "Use {server-name} and answer\n" to each query, and adds MCP metadata (server name and expected tools).

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
