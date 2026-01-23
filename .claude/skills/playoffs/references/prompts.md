# Prompt Sets

This directory contains prompt sets for evaluating agents with different search tools.

## Quick Start

### Test Prompts (5 prompts, ~30s per agent)

```bash
# Builtin search - all agents
docker compose run --rm claude-code-builtin
docker compose run --rm gemini-builtin
docker compose run --rm droid-builtin
docker compose run --rm codex-builtin

# MCP search (39-45% faster) - all agents
docker compose run --rm claude-code-you
docker compose run --rm gemini-you
docker compose run --rm droid-you
docker compose run --rm codex-you
```

### Full Prompts (1,254 prompts, ~10+ hours per agent)

**⚠️ Important:** Update docker-compose.yml first to use full prompts:

```yaml
# Change this line in each service:
- /eval/data/prompts/test.jsonl              # Test (5 prompts)
# To:
- /eval/data/prompts/full.jsonl              # Full (1,254 prompts)

# Or for MCP services:
- /eval/data/prompts/test-mcp.jsonl          # Test MCP
# To:
- /eval/data/prompts/full-mcp.jsonl          # Full MCP
```

Then run:

```bash
# Builtin - all agents
docker compose run --rm claude-code-builtin
docker compose run --rm gemini-builtin
docker compose run --rm droid-builtin
docker compose run --rm codex-builtin

# MCP - all agents
docker compose run --rm claude-code-you
docker compose run --rm gemini-you
docker compose run --rm droid-you
docker compose run --rm codex-you
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
docker compose run --rm claude-code-builtin
docker compose run --rm gemini-builtin
docker compose run --rm droid-builtin
docker compose run --rm codex-builtin

# Run all MCP tests
docker compose run --rm claude-code-you
docker compose run --rm gemini-you
docker compose run --rm droid-you
docker compose run --rm codex-you

# Or run in parallel (requires sufficient API quota)
docker compose run --rm claude-code-builtin &
docker compose run --rm gemini-builtin &
docker compose run --rm droid-builtin &
docker compose run --rm codex-builtin &
wait
```

### Run Full Workflow

**Step 1:** Update docker-compose.yml to use full prompt sets:

```bash
# Replace test.jsonl with full.jsonl for builtin services
sed -i.bak 's|/eval/data/prompts/test.jsonl|/eval/data/prompts/full.jsonl|g' docker-compose.yml

# Replace test-mcp.jsonl with full-mcp.jsonl for MCP services
sed -i.bak 's|/eval/data/prompts/test-mcp.jsonl|/eval/data/prompts/full-mcp.jsonl|g' docker-compose.yml
```

**Step 2:** Run evaluations (run sequentially to avoid rate limits):

```bash
# Builtin - all agents (run one at a time)
docker compose run --rm claude-code-builtin
docker compose run --rm gemini-builtin
docker compose run --rm droid-builtin
docker compose run --rm codex-builtin

# MCP - all agents
docker compose run --rm claude-code-you
docker compose run --rm gemini-you
docker compose run --rm droid-you
docker compose run --rm codex-you
```

**Step 3:** Restore test configuration:

```bash
# Restore test prompts
mv docker-compose.yml.bak docker-compose.yml
```

### Compare Builtin vs MCP Performance

```bash
# Compare results for same agent
bun run compare -- -a claude-code --toolA builtin --toolB you
bun run compare -- -a gemini --toolA builtin --toolB you

# Analyze specific results
bunx @plaited/agent-eval-harness summarize \
  data/results/claude-code/builtin.jsonl -o summary.jsonl
```

### Convert Prompts to MCP Format

Create new MCP prompt sets from existing prompts:

```bash
# Convert any prompts to MCP format
bun scripts/convert-to-mcp-format.ts -i custom.jsonl -o custom-mcp.jsonl

# Example: Convert new test prompts
bun scripts/convert-to-mcp-format.ts -i data/prompts/test.jsonl -o data/prompts/test-mcp-new.jsonl
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
cat data/results/claude-code/builtin.jsonl | \
  jq -r '.trajectory[] | select(.type == "tool_call") | .name' | sort | uniq -c

# Check for errors
cat data/results/gemini/you.jsonl | jq 'select(.toolErrors == true)'

# Extract outputs only
cat data/results/claude-code/builtin.jsonl | jq -r '.output' > outputs.txt
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

**Note:** Results are committed to git for downstream data science analysis.

## Timeouts

Different agents require different timeouts for complex searches:

| Agent | Builtin Timeout | MCP Timeout | Notes |
|-------|----------------|-------------|-------|
| Claude Code | 90s | 90s | Fast, reliable |
| Gemini | 60s | 60s | Fastest agent |
| Droid | Default | Default | Consistent performance |
| Codex | 180s | 180s | Slower, needs extra time |

Timeouts are configured in docker-compose.yml per service.

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
          docker compose run --rm claude-code-builtin
          docker compose run --rm gemini-builtin
```

## Skills Reference

- **@.claude/skills/playoffs** - Development assistant for running and extending playoffs
- **@scripts/convert-to-mcp-format.ts** - Convert prompts to MCP format
