# Prompt Sets

This directory contains prompt sets for evaluating agents with different search tools.

## Quick Start

### Test Prompts (5 prompts, ~30s per agent)

```bash
# Builtin search - all agents
docker compose run --rm -e MCP_TOOL=builtin claude-code
docker compose run --rm -e MCP_TOOL=builtin gemini
docker compose run --rm -e MCP_TOOL=builtin droid
docker compose run --rm -e MCP_TOOL=builtin codex

# MCP search (39-45% faster) - all agents
docker compose run --rm -e MCP_TOOL=you claude-code
docker compose run --rm -e MCP_TOOL=you gemini
docker compose run --rm -e MCP_TOOL=you droid
docker compose run --rm -e MCP_TOOL=you codex
```

### Full Prompts (1,254 prompts, ~10+ hours per agent)

Use the `DATASET` environment variable to switch between test and full datasets:

```bash
# Builtin - all agents
docker compose run --rm -e MCP_TOOL=builtin -e DATASET=full claude-code
docker compose run --rm -e MCP_TOOL=builtin -e DATASET=full gemini
docker compose run --rm -e MCP_TOOL=builtin -e DATASET=full droid
docker compose run --rm -e MCP_TOOL=builtin -e DATASET=full codex

# MCP - all agents
docker compose run --rm -e MCP_TOOL=you -e DATASET=full claude-code
docker compose run --rm -e MCP_TOOL=you -e DATASET=full gemini
docker compose run --rm -e MCP_TOOL=you -e DATASET=full droid
docker compose run --rm -e MCP_TOOL=you -e DATASET=full codex

# Or use the automated script
bun scripts/run.ts --mode full --mcp builtin
bun scripts/run.ts --mode full --mcp you
```

## Prompt Files

### Builtin Search (Native Agent Tools)

| File | Prompts | Format | Use With |
|------|---------|--------|----------|
| `test.jsonl` | 5 | `<web-search>query</web-search>` | Builtin services |
| `full.jsonl` | 1,254 | `<web-search>query</web-search>` | Builtin services |

### MCP Search (You.com Server - 39-45% Faster)

| File | Prompts | Format | Use With |
|------|---------|--------|----------|
| `test-mcp.jsonl` | 5 | `<web-search mcp-server="ydc-server">` | MCP services |
| `full-mcp.jsonl` | 1,254 | `<web-search mcp-server="ydc-server">` | MCP services |

## MCP Format Performance

The MCP prompts use the **winning v2 format** from variant testing:

```xml
<web-search mcp-server="ydc-server">What is the weather in San Francisco?</web-search>
```

**Performance Benefits:**
- ⚡ **39-45% faster** than plain `<web-search>` format
- ✅ **100% success rate** in testing
- 🎯 **Explicit server specification** - no ambiguity
- 📝 **Semantically clear** - agents understand MCP intent immediately

See `data/MCP-VARIANT-ANALYSIS.md` for full testing results.

## Agent Tasks

### Run Test Workflow

Test with 5 prompts to validate setup:

```bash
# Run all builtin tests
docker compose run --rm -e MCP_TOOL=builtin claude-code
docker compose run --rm -e MCP_TOOL=builtin gemini
docker compose run --rm -e MCP_TOOL=builtin droid
docker compose run --rm -e MCP_TOOL=builtin codex

# Run all MCP tests
docker compose run --rm -e MCP_TOOL=you claude-code
docker compose run --rm -e MCP_TOOL=you gemini
docker compose run --rm -e MCP_TOOL=you droid
docker compose run --rm -e MCP_TOOL=you codex

# Or use the automated script
bun scripts/run.ts --mode test

# Or run in parallel (requires sufficient API quota)
docker compose run --rm -e MCP_TOOL=builtin claude-code &
docker compose run --rm -e MCP_TOOL=builtin gemini &
docker compose run --rm -e MCP_TOOL=builtin droid &
docker compose run --rm -e MCP_TOOL=builtin codex &
wait
```

### Run Full Workflow

Run evaluations with the full dataset (run sequentially to avoid rate limits):

```bash
# Builtin - all agents (run one at a time)
docker compose run --rm -e MCP_TOOL=builtin -e DATASET=full claude-code
docker compose run --rm -e MCP_TOOL=builtin -e DATASET=full gemini
docker compose run --rm -e MCP_TOOL=builtin -e DATASET=full droid
docker compose run --rm -e MCP_TOOL=builtin -e DATASET=full codex

# MCP - all agents
docker compose run --rm -e MCP_TOOL=you -e DATASET=full claude-code
docker compose run --rm -e MCP_TOOL=you -e DATASET=full gemini
docker compose run --rm -e MCP_TOOL=you -e DATASET=full droid
docker compose run --rm -e MCP_TOOL=you -e DATASET=full codex

# Or use the automated script (runs all agents sequentially)
bun scripts/run.ts --mode full --mcp builtin
bun scripts/run.ts --mode full --mcp you
```

### Compare Builtin vs MCP Performance

```bash
# Compare results for same agent (test dataset)
bunx @plaited/agent-eval-harness compare \
  data/results/claude-code/builtin-test.jsonl \
  data/results/claude-code/you-test.jsonl

bunx @plaited/agent-eval-harness compare \
  data/results/gemini/builtin-test.jsonl \
  data/results/gemini/you-test.jsonl

# Compare full dataset results
bunx @plaited/agent-eval-harness compare \
  data/results/claude-code/builtin-full.jsonl \
  data/results/claude-code/you-full.jsonl

# Analyze specific results
bunx @plaited/agent-eval-harness summarize \
  data/results/claude-code/builtin-test.jsonl -o summary.jsonl
```

### Convert Prompts to MCP Format

Create new MCP prompt sets by modifying the `<web-search>` tags:

```bash
# Manually edit or use sed to add MCP server attribute
sed 's/<web-search>/<web-search mcp-server="ydc-server">/g' \
  custom.jsonl > custom-mcp.jsonl

# For different MCP server
sed 's/<web-search>/<web-search mcp-server="exa-server">/g' \
  test.jsonl > test-exa.jsonl
```

### Create Custom Prompts

**For builtin search:**
```json
{"id":"custom-1","input":"<web-search>Your query here</web-search>","metadata":{...}}
```

**For MCP (faster):**
```json
{"id":"custom-1","input":"<web-search mcp-server=\"ydc-server\">Your query here</web-search>","metadata":{...}}
```

**Best practices:**
- Use natural language questions
- Include time markers (2025, latest, current)
- Reference recent events or data
- Ensure query requires web search (not answerable from training data)

### Analyze Results

```bash
# Generate summary
bunx @plaited/agent-eval-harness summarize \
  data/results/claude-code/builtin.jsonl -o summary.jsonl

# Count tool usage
cat data/results/claude-code/builtin-test.jsonl | \
  jq -r '.trajectory[] | select(.type == "tool_call") | .name' | sort | uniq -c

# Check for errors
cat data/results/gemini/you-test.jsonl | jq 'select(.toolErrors == true)'

# Extract outputs only
cat data/results/claude-code/builtin-test.jsonl | jq -r '.output' > outputs.txt
```

## Format Comparison

### Plain Format (Builtin)
Works with native agent search capabilities.

```json
{"id":"test-1","input":"<web-search>What is AI?</web-search>"}
```

### MCP Format (Optimal)
Works with MCP servers. **39-45% faster** due to explicit server specification.

```json
{"id":"test-1","input":"<web-search mcp-server=\"ydc-server\">What is AI?</web-search>"}
```

## Results Location

Results are written to `data/results/<agent>/<tool>.jsonl`:

```
data/results/
├── claude-code/
│   ├── builtin-test.jsonl
│   ├── builtin-full.jsonl
│   ├── you-test.jsonl
│   └── you-full.jsonl
├── gemini/
│   ├── builtin-test.jsonl
│   ├── builtin-full.jsonl
│   ├── you-test.jsonl
│   └── you-full.jsonl
├── droid/
│   ├── builtin-test.jsonl
│   ├── builtin-full.jsonl
│   ├── you-test.jsonl
│   └── you-full.jsonl
└── codex/
    ├── builtin-test.jsonl
    ├── builtin-full.jsonl
    ├── you-test.jsonl
    └── you-full.jsonl
```

**Note:** Results are committed to git for downstream data science analysis.

## Timeouts

Different agents require different timeouts for complex searches:

| Agent | Default Timeout | Notes |
|-------|----------------|-------|
| Claude Code | 90s | Fast, reliable |
| Gemini | 60s | Fastest agent |
| Droid | 120s | Consistent performance |
| Codex | 180s | Slower, needs extra time |

Timeouts are configured in the agent schemas (agent-schemas/*.json) and can be overridden via the harness CLI.

## CI/CD Considerations

For automated testing:

1. **Path filtering** - Only run on prompt/agent changes
2. **API quotas** - Stagger parallel runs to avoid rate limits
3. **Cost controls** - Use test prompts (5) for PRs, full (1,254) for main branch only
4. **Caching** - Cache Docker images between runs

Example GitHub Actions workflow pattern:

```yaml
on:
  push:
    paths:
      - 'agent-schemas/**'
      - 'data/prompts/**'
      - 'docker/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: dorny/paths-filter@v3
        id: changes
        with:
          filters: |
            agents:
              - 'agent-schemas/**'

      - name: Run test prompts
        if: steps.changes.outputs.agents == 'true'
        run: |
          docker compose run --rm -e MCP_TOOL=builtin claude-code
          docker compose run --rm -e MCP_TOOL=builtin gemini
```

## Skills Reference

- **@.claude/skills/playoffs** - Development assistant for running and extending playoffs
