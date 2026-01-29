# Web Search Agent Evaluations

Evaluate multiple agents (Claude Code, Gemini, Droid, Codex) with different web search tools (builtin, You.com MCP) in isolated Docker containers.

## Overview

This evaluation system runs a matrix comparison: 4 agents × 2 tools = 8 pairings, capturing full trajectories for analysis.

**Key Features:**
- **Headless adapters** - No custom code, just JSON schemas ([@plaited/agent-eval-harness](https://www.npmjs.com/package/@plaited/agent-eval-harness))
- **Flag-based architecture** - Single service per agent, MCP mode selected via environment variable
- **Type-safe constants** - MCP server definitions in `mcp-servers.ts`
- **TypeScript entrypoint** - Bun shell script for runtime MCP configuration
- **Isolated execution** - Each pairing runs in its own Docker container

```mermaid
flowchart TD
    Env[MCP_TOOL & DATASET env vars] --> Entrypoint[docker/entrypoint]
    Entrypoint -->|builtin| SkipMCP[Skip MCP setup]
    Entrypoint -->|you| ConfigMCP[Configure MCP via CLI]

    SkipMCP --> Harness[agent-eval-harness capture]
    ConfigMCP --> Harness

    Prompts[prompts.jsonl] --> Harness
    Schemas[agent-schemas/*.json] --> Harness
    Harness --> Results[data/results/agent/tool.jsonl]
```

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Set API Keys

Create `.env` file (gitignored):

```bash
cp .env.example .env
nano .env
```

Required keys:
- `ANTHROPIC_API_KEY` - Claude Code agent
- `GEMINI_API_KEY` - Gemini agent + inline grader LLM scoring
- `FACTORY_API_KEY` - Droid agent
- `OPENAI_API_KEY` - Codex agent
- `YOU_API_KEY` - You.com MCP tool

### 3. Run Evaluations

#### Test Workflow (5 prompts, ~5 minutes)

```bash
# First, generate MCP prompt variants
bun run generate:mcp-you

# Then run all agents in parallel (8 scenarios: 4 agents × 2 tools)
bun run run

# Or run specific agent+tool combinations
docker compose run --rm -e SEARCH_PROVIDER=builtin claude-code
docker compose run --rm -e SEARCH_PROVIDER=you gemini
```

**Note:** MCP prompt files must be generated before running evaluations. Run `bun run generate:mcp-you` to create MCP variants, or use `bun run sample:test` to generate fresh test samples with MCP variants included.

#### Full Workflow (151 prompts, ~2 hours)

```bash
# Run all agents with full dataset
bun run run:full
```

### 4. Analyze Results

Compare results using the flexible CLI tool:

```bash
# Default: all agents, test mode, weighted strategy
bun scripts/compare.ts

# Compare full dataset
bun scripts/compare.ts --mode full

# Filter by agent or search provider
bun scripts/compare.ts --agent gemini --agent claude-code
bun scripts/compare.ts --search-provider builtin

# Use statistical strategy
bun scripts/compare.ts --strategy statistical

# Combine flags
bun scripts/compare.ts --mode full --search-provider you --strategy statistical

# Preview configuration
bun scripts/compare.ts --dry-run
```

Or use npm shortcuts for common comparisons:

```bash
# Test data comparisons
bun run compare:test-weighted       # All agents, both modes
bun run compare:test-statistical    # Statistical analysis
bun run compare:test-builtin        # Builtin only
bun run compare:test-you            # MCP only

# Flexible CLI shortcuts
bun run compare                     # Test mode, all agents, weighted
bun run compare:full                # Full mode, latest run
bun run compare:statistical         # Test mode, statistical strategy
```

View results:

```bash
cat data/comparison-all-weighted-test.json | jq '.meta, .quality'
cat data/comparison-all-weighted-test.json | jq '.headToHead.pairwise'
```

## Pass@k Analysis

Run multiple trials per prompt to measure agent reliability:

```bash
# Default: Droid agent, test set, k=5
bun run trials

# Capability exploration (k=10)
bun run trials:capability

# Regression safety (k=3, faster)
bun run trials:regression

# Custom: specify agent and k value
bun run trials -- --agent gemini -k 7

# View metrics
cat data/results/trials/droid-test.jsonl | jq '{id, passRate, passAtK, passExpK}'
```

**Metrics:** `passAtK` = capability (can do task?), `passExpK` = reliability (always succeeds?)

## Architecture

### Agent Schemas (agent-schemas/)

Headless adapter schemas - no custom code, just JSON configuration:

| Schema | Agent | Mode | Status |
|--------|-------|------|--------|
| `claude-code.json` | Claude Code | stream | ✅ Tested |
| `gemini.json` | Gemini CLI | iterative | ✅ Tested |
| `droid.json` | Droid CLI | stream | ✅ Tested |
| `codex.json` | Codex CLI | stream | ✅ Tested |

**Session Modes:**
- **stream**: Process stays alive, multi-turn via stdin
- **iterative**: New process per turn, history accumulated

### MCP Configuration (mcp-servers.ts)

Single source of truth for MCP server configurations. The TypeScript entrypoint (`docker/entrypoint`) imports these constants and configures agents at runtime via their official CLI commands.

**Available Tools:**
- `builtin` - Agent's native search (no MCP config)
- `you` - You.com MCP server (requires `YOU_API_KEY`)

To add new MCP tools, see `.claude/skills/web-search-agent-evals/SKILL.md`.

### CLI Scripts (scripts/)

| Script | Purpose |
|--------|---------|
| `run.ts` | Automated test runner (4 agents × 2 tools in parallel) |
| `compare.ts` | Flexible comparison tool with mode/agent/strategy flags |
| `run-trials.ts` | Multi-trial wrapper for pass@k/pass^k analysis |
| `inline-grader.ts` | Hybrid grader (deterministic + LLM scoring) |

See "Analyze Results" in Quick Start for comparison usage examples.

### Docker Infrastructure

Isolated execution for reproducibility:

```
docker/
├── base.Dockerfile           # Shared base (Bun + Node 24)
├── claude-code.Dockerfile
├── gemini.Dockerfile
├── droid.Dockerfile
├── codex.Dockerfile
├── entrypoint                # TypeScript entrypoint (Bun shell)
└── docker-compose.yml        # 4 services (one per agent)
```

The entrypoint script:
1. Reads `MCP_TOOL` environment variable (`builtin` or `you`)
2. Reads `DATASET` environment variable (`test` or `full`)
3. Configures MCP via agent CLI if needed (skips for `builtin`)
4. Runs `@plaited/agent-eval-harness capture` with appropriate prompts

## Prompts

Prompts are organized by dataset type, with each dataset in its own directory containing both builtin and MCP variants:

| File | Prompts | Format | Use With |
|------|---------|--------|----------|
| `full/prompts.jsonl` | 151 | Standard | `SEARCH_PROVIDER=builtin` |
| `full/prompts-you.jsonl` | 151 | MCP variant | `SEARCH_PROVIDER=you` |
| `test/prompts.jsonl` | 5 | Standard | `SEARCH_PROVIDER=builtin` |
| `test/prompts-you.jsonl` | 5 | MCP variant | `SEARCH_PROVIDER=you` |
| `trials/prompts.jsonl` | 30 | Standard | `SEARCH_PROVIDER=builtin` |
| `trials/prompts-you.jsonl` | 30 | MCP variant | `SEARCH_PROVIDER=you` |

**Test and trials prompts** are randomly sampled from the full dataset. All prompts use unified "Use web search to find:" format. MCP variants add metadata (`mcp_server`, `expected_tool`) without changing prompt text.

To regenerate test prompts with a new random sample:

```bash
bun run sample:test        # 5 prompts → data/prompts/test/
bun run sample:trials      # 30 prompts → data/prompts/trials/
```

Or use the script directly:

```bash
bun scripts/sample.ts --dir test --count 5
bun scripts/sample.ts --dir trials --count 30
```

All prompts are designed to trigger web search with time-sensitive queries and recent events.

## Results

Results are organized into two tiers:

### Test Results (Rapid Iteration)
Quick development cycles, not versioned:
```
data/results/test-runs/
├── claude-code/
│   ├── builtin.jsonl
│   └── you.jsonl
├── gemini/
├── droid/
└── codex/
```

### Full Runs (Historical Archive)
Dated snapshots for long-term analysis:
```
data/results/
├── runs/
│   ├── 2026-01-24/
│   │   ├── claude-code/
│   │   │   ├── builtin.jsonl
│   │   │   └── you.jsonl
│   │   ├── gemini/
│   │   ├── droid/
│   │   └── codex/
│   └── 2026-02-15/
├── latest.json           # Pointer to most recent run
└── MANIFEST.jsonl        # Run metadata
```

**Versioning:** Each full run is committed with a dated directory. See `MANIFEST.jsonl` for run metadata and commit history.

**Usage:**
```bash
# Compare latest run (default)
bun scripts/compare.ts --mode full

# Compare specific historical run
bun scripts/compare.ts --mode full --run-date 2026-01-24

# View run history
cat data/results/MANIFEST.jsonl | jq .
```

Each result includes full trajectory (messages, tool calls, timing, token usage).

## Comparisons

Comparison analyses are versioned alongside the raw results they evaluate.

### Comparison Metrics

Each comparison output includes:

**Quality Metrics (per agent+tool pairing):**
- `avgScore` - Mean inline grader score (0-1 scale)
- `passRate` - Percentage of prompts that passed (score ≥ 0.7)
- `passCount` / `failCount` - Number of passing/failing prompts
- `scoreDistribution` - Histogram of scores by quintile

**Performance Metrics:**
- `latency.p50/p90/p99` - Response time percentiles (milliseconds)
- `firstResponse` - Time to first output
- `totalDuration` - Total execution time across all prompts

**Head-to-Head Analysis:**
- Pairwise win/loss/tie records
- Statistical significance (when using `--strategy statistical`)

### Comparison Strategies

**Weighted Strategy (default):**
Balances multiple dimensions with configurable weights:
- `COMPARE_QUALITY` (default: 0.6) - Inline grader scores
- `COMPARE_LATENCY` (default: 0.3) - Response speed
- `COMPARE_RELIABILITY` (default: 0.1) - Pass rate consistency

**Statistical Strategy:**
Uses bootstrap sampling (1000 iterations by default) to compute:
- Confidence intervals for mean scores
- Statistical significance testing (p<0.05)
- Reduces false conclusions from small sample sizes

Configure via `COMPARE_BOOTSTRAP_ITERATIONS` environment variable.

### Output Structure

```
data/comparisons/test-runs/       # Test mode comparisons
├── all-weighted.json             # All agents, both tools
├── all-statistical.json          # Statistical analysis
├── builtin-weighted.json         # Builtin tool only
└── you-weighted.json             # MCP tool only

data/comparisons/runs/            # Full mode comparisons
└── 2026-01-24/
    ├── all-weighted.json
    ├── all-statistical.json
    └── ...
```

### Usage Examples

```bash
# Generate comparison (outputs to versioned directory)
bun scripts/compare.ts --mode full

# View quality rankings
cat data/comparisons/runs/2026-01-24/all-weighted.json | jq '.quality'

# View performance metrics
cat data/comparisons/test-runs/all-weighted.json | jq '.performance'

# View head-to-head win rates
cat data/comparisons/test-runs/all-statistical.json | jq '.headToHead.pairwise'
```

## Inline Grader

The project uses a hybrid grading approach in `scripts/inline-grader.ts` that evaluates agent responses on a 100-point scale.

### Scoring Breakdown (100 points total)

**Deterministic Scoring (60 points maximum):**
- **30 pts** - Completion: Has substantial output (>50 characters)
- **20 pts** - Tool usage: Called at least one tool during execution
- **10 pts** - Quality bonus: Has content and no execution errors

**LLM Scoring (40 points maximum):**
Uses Gemini Flash 2.0 to evaluate:
- **0-15 pts** - Accuracy: Is the information factually correct?
- **0-15 pts** - Relevance: Does it answer the query?
- **0-10 pts** - Completeness: Are all aspects addressed?

**Pass Threshold:** 70/100 (normalized score ≥ 0.7)

**Automatic Failures:**
- Execution timeouts → score 0
- Tool execution errors → score 0

**Fallback Mode:** Works without `GEMINI_API_KEY` (deterministic-only, max 60 points)

### MCP Tool Detection

The grader tracks whether agents used the expected MCP tools by checking trajectory metadata:
- **Claude Code**: Detects `mcp__<server>__<tool>` format
- **Codex**: Checks `mcpServer` field in trajectory
- **DROID**: Detects `<server>___<tool>` format (triple underscore)
- **GEMINI**: Matches tool names against expected tools list

This metadata enables analysis of tool selection patterns (e.g., Express vs. Search usage).

### Calibration

The LLM component may hallucinate facts. Always:
- Review sampled failures manually before trusting scores
- Use `bunx @plaited/agent-eval-harness calibrate` to validate grader accuracy
- Check for systematic biases in LLM scoring

For detailed grading concepts (validation, calibration, best practices), see the `agent-eval-harness` skill documentation.

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

### Adding Agents

1. **Create adapter schema** (`agent-schemas/<agent>.json`)
2. **Create Dockerfile** (`docker/<agent>.Dockerfile`)
3. **Add Docker Compose service**
4. **Update TypeScript entrypoint** (`docker/entrypoint`)

See `.claude/skills/web-search-agent-evals/SKILL.md` for detailed guide.

### Adding MCP Tools

1. **Add to mcp-servers.ts** - Define server configuration with name, URL, auth, and expectedTool
2. **Update docker/entrypoint** - Add case to `configureMcp()` function for each agent CLI
3. **Update .env and .env.example** - Add required API keys
4. **Generate MCP prompts** - Run `bun scripts/generate-mcp-prompts.ts --mcp-key <new-key>` to create MCP variants
5. **Sample test prompts** - Run `bun run sample:test` to include new MCP variants in test set

See `.claude/skills/web-search-agent-evals/SKILL.md` for detailed guide.

**Note:** Scripts (`run.ts`, `run-trials.ts`, `sample.ts`) automatically pick up new MCP servers from `mcp-servers.ts`, so no manual updates needed.

## Troubleshooting

### MCP Config Issues

```bash
# Verify API keys
cat .env | grep API_KEY

# Test inside container
docker compose run --rm -e MCP_TOOL=you claude-code bash -c "cat ~/.mcp.json"
```

### Agent Schema Issues

```bash
# Test adapter compliance
bunx @plaited/agent-eval-harness adapter:check -- \
  bunx @plaited/agent-eval-harness headless --schema agent-schemas/<agent>.json
```

### Docker Build Failures

```bash
# Check base image
docker build -t base -f docker/base.Dockerfile .
docker run --rm base bun --version

# Check agent CLI
docker build -t test-<agent> -f docker/<agent>.Dockerfile .
docker run --rm test-<agent> <agent> --version
```

## Project Structure

```
evals/
├── agent-schemas/          # Headless schemas
│   ├── claude-code.json
│   ├── gemini.json
│   ├── droid.json
│   └── codex.json
│
├── mcp-servers.ts          # MCP configuration (TypeScript constants)
│
├── scripts/                # CLI tools
│   ├── run.ts              # Automated test runner
│   ├── compare.ts          # Flexible comparison tool
│   ├── run-trials.ts       # Pass@k trials wrapper
│   └── inline-grader.ts    # Hybrid grader
│
├── docker/                 # Container infrastructure
│   ├── base.Dockerfile
│   ├── {agent}.Dockerfile  # One per agent
│   ├── entrypoint          # TypeScript entrypoint
│   └── docker-compose.yml
│
├── data/
│   ├── prompts/            # Evaluation prompts
│   └── results/            # Agent outputs (gitignored)
│
└── .claude/skills/web-search-agent-evals/  # Development assistant skill
```

## Skills

This project uses [AgentSkills](https://agentskills.io) for agent-first development:

- **web-search-agent-evals** - Development assistant for this evaluation system
- **agent-eval-harness** - Capture, trials, and analysis commands

See `@AGENTS.md` for development rules and conventions.

## Built With

- **[@plaited/agent-eval-harness](https://www.npmjs.com/package/@plaited/agent-eval-harness)** - Trajectory capture framework
- **[Zod](https://zod.dev)** - TypeScript-first schema validation
- **[Bun](https://bun.sh)** - Fast TypeScript runtime
- **[Docker](https://www.docker.com)** - Isolated execution
