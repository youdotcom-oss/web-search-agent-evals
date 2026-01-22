---
name: playoffs
description: Development assistant for running and extending the ACP evaluation playoffs system
compatibility: Bun >= 1.2.9
---

# Playoffs

Development assistant for running and extending the ACP evaluation playoffs system.

## Overview

The playoffs system evaluates multiple agents (Claude Code, Gemini, Droid, Codex) with different web search tools (builtin, You.com MCP) in isolated Docker containers.

**Architecture:**
- **Agent schemas** (agent-schemas/) - ACP headless adapter schemas
- **MCP configs** (tools/) - Single source of truth for MCP servers
- **CLI scripts** (scripts/) - Type-safe config generation and execution
- **Docker** (docker/, docker-compose.yml) - Isolated execution environments

## Quick Commands

### Test Workflow (5 prompts, ~30s per agent)

Run all 4 agents with both builtin and MCP search:

```bash
# Builtin search - test all agents
docker compose run --rm claude-code-builtin
docker compose run --rm gemini-builtin
docker compose run --rm droid-builtin
docker compose run --rm codex-builtin

# MCP search (39-45% faster) - test all agents
docker compose run --rm claude-code-you
docker compose run --rm gemini-you
docker compose run --rm droid-you
docker compose run --rm codex-you
```

**Parallel execution:**
```bash
# Run all builtin tests in parallel
docker compose run --rm claude-code-builtin &
docker compose run --rm gemini-builtin &
docker compose run --rm droid-builtin &
docker compose run --rm codex-builtin &
wait

# Run all MCP tests in parallel
docker compose run --rm claude-code-you &
docker compose run --rm gemini-you &
docker compose run --rm droid-you &
docker compose run --rm codex-you &
wait
```

### Full Workflow (1,254 prompts, ~10+ hours per agent)

**Step 1:** Update docker-compose.yml to use full prompts:

```yaml
# Change this line in each service:
- /eval/data/prompts/test.jsonl              # Current (5 prompts)
# To:
- /eval/data/prompts/full.jsonl              # Full (1,254 prompts)

# For MCP services, change:
- /eval/data/prompts/test-mcp.jsonl          # Current (5 prompts)
# To:
- /eval/data/prompts/full-mcp.jsonl          # Full (1,254 prompts)
```

**Step 2:** Run evaluations:

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

**Note:** Full evaluation takes significant time and API quota. Consider:
- Running sequentially to avoid rate limits
- Testing with test prompts (5) first to verify setup
- Monitoring API costs during execution

### Compare Results

```bash
# Compare builtin vs MCP for same agent
bun run compare -- -a claude-code --toolA builtin --toolB you
bun run compare -- -a gemini --toolA builtin --toolB you

# Analyze specific results
bunx @plaited/agent-eval-harness summarize \
  data/results/claude-code/builtin.jsonl -o summary.jsonl
```

### Generate MCP Configs

```bash
# Generate config for specific agent+tool
bun run generate-mcp -- -a claude-code -t you -c /workspace

# Test that configs are valid
bun run tools/schemas/claude-mcp.ts
bun run tools/schemas/gemini-mcp.ts
bun run tools/schemas/droid-mcp.ts
bun run tools/schemas/codex-mcp.ts
```

## Prompt Sets

| File | Prompts | Format | Use With |
|------|---------|--------|----------|
| `test.jsonl` | 5 | `<web-search>` | Builtin services |
| `test-mcp.jsonl` | 5 | `<web-search mcp-server="ydc-server">` | MCP services |
| `full.jsonl` | 1,254 | `<web-search>` | Builtin services |
| `full-mcp.jsonl` | 1,254 | `<web-search mcp-server="ydc-server">` | MCP services |

**Default:** Docker services use `test.jsonl` (5 prompts) and `test-mcp.jsonl` (5 prompts) for quick validation.

**Full eval:** Manually update docker-compose.yml to use `full.jsonl` (1,254 prompts) or `full-mcp.jsonl` (1,254 prompts).

See `data/prompts/README.md` for complete workflow documentation.

## Results Location

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

**Note:** Results are gitignored. Regenerate from prompts as needed.

## Agent Performance Reference

Based on test prompts (5 prompts):

| Agent | Builtin Success | MCP Success | Timeout |
|-------|----------------|-------------|---------|
| Claude Code | 5/5 (100%) | 5/5 (100%) | 90s |
| Gemini | 5/5 (100%) | 5/5 (100%) | 60s |
| Droid | 5/5 (100%) | 5/5 (100%) | Default |
| Codex | 4/5 (80%) | TBD | 180s |

**MCP is 39-45% faster** than builtin for the same prompts due to explicit server specification.

## Extending Playoffs

### Adding a New Agent

1. **Create adapter schema** (`agent-schemas/<agent>.json`)
   - Test CLI output format: `<agent> --help`
   - Map JSON events to ACP protocol
   - Test with `adapter:check`

2. **Create MCP config schema** (`tools/schemas/<agent>-mcp.ts`)
   - Research agent's MCP config location
   - Export Zod schema + config path constant
   - Export `generate<Agent>Config` function
   - Test compilation: `bun run tools/schemas/<agent>-mcp.ts`

3. **Update generate-mcp-config.ts**
   - Import new schema
   - Add agent to `AGENTS` array
   - Add case to switch statement

4. **Create Dockerfile** (`docker/<agent>.Dockerfile`)
   - Base from `base`
   - Install agent CLI
   - Verify with `<agent> --version`
   - Copy entrypoint script

5. **Add Docker Compose services**
   - Add `<agent>-builtin` service
   - Add `<agent>-you` service (or other MCP tool)
   - Follow existing service patterns

6. **Update documentation**
   - Add to agent-schemas/README.md
   - Update main README.md
   - Update this skill

### Adding a New MCP Tool

1. **Add to mcp-servers.json**
   ```json
   {
     "servers": {
       "new-tool": {
         "name": "tool-server-name",
         "type": "http",
         "url": "https://api.example.com/mcp",
         "auth": {
           "type": "bearer",
           "envVar": "NEW_TOOL_API_KEY"
         }
       }
     }
   }
   ```

2. **Update scripts/generate-mcp-config.ts**
   - Add tool to `TOOLS` array

3. **Add to .env and .env.example**
   ```
   NEW_TOOL_API_KEY=...
   ```

4. **Add Docker Compose services**
   - Add `<agent>-<tool>` services for each agent
   - Set `MCP_TOOL=<tool>` environment variable

5. **Test config generation**
   ```bash
   bun run generate-mcp -- -a claude-code -t <new-tool> -c /tmp/test
   cat /tmp/test/.mcp.json  # Verify structure
   ```

6. **Create MCP prompt set**
   ```bash
   # Convert existing prompts to use new MCP server
   # Edit scripts/convert-to-mcp-format.ts to support new server
   bun scripts/convert-to-mcp-format.ts -i test.jsonl -o test-<tool>.jsonl
   ```

## Troubleshooting

### MCP Config Not Working

1. **Verify config generation**
   ```bash
   # Generate config in temp directory
   bun run generate-mcp -- -a <agent> -t <tool> -c /tmp/test

   # Check file was created at correct location
   ls /tmp/test/.mcp.json  # Claude
   ls /tmp/test/.gemini/settings.json  # Gemini
   ls /tmp/test/.factory/mcp.json  # Droid
   ```

2. **Verify API keys are set**
   ```bash
   cat .env | grep API_KEY
   ```

3. **Test inside container**
   ```bash
   docker compose run --rm <agent>-<tool> bash
   # Inside container:
   ls -la /workspace/.mcp.json  # Check config exists
   cat /workspace/.mcp.json  # Verify structure
   ```

### Agent Schema Issues

1. **Test schema compliance**
   ```bash
   bunx @plaited/agent-eval-harness adapter:check -- \
     bunx @plaited/agent-eval-harness headless --schema agent-schemas/<agent>.json
   ```

2. **Capture raw CLI output**
   ```bash
   <agent> <prompt-flag> "Say hello" --output-format stream-json | head -20
   ```

3. **Check JSONPath patterns**
   - Verify `outputEvents.match.path` points to correct field
   - Verify `result.contentPath` extracts final output

### Docker Build Failures

1. **Check base image**
   ```bash
   docker build -t base -f docker/base.Dockerfile .
   docker run --rm base bun --version
   docker run --rm base node --version
   ```

2. **Check agent CLI installation**
   ```bash
   docker build -t test-<agent> -f docker/<agent>.Dockerfile .
   docker run --rm test-<agent> <agent> --version
   ```

3. **Check entrypoint script**
   ```bash
   docker compose run --rm <agent>-<tool> bash -c "cat /entrypoint.sh"
   ```

### Timeout Issues

If agents timeout frequently:

1. **Check current timeout** in docker-compose.yml
2. **Increase timeout** for problematic agent:
   ```yaml
   - --timeout
   - "180000"  # 3 minutes (Codex needs this)
   ```
3. **Test with single prompt** first to verify it's not a config issue

## File Structure

```
acp-evals/
├── agent-schemas/          # ACP headless schemas (public)
├── tools/                  # MCP configs (single source of truth)
│   ├── mcp-servers.json    # Server definitions
│   └── schemas/            # Zod schemas per agent
├── scripts/                # CLI tools (type-safe, testable)
├── docker/                 # Container infrastructure
├── data/
│   ├── prompts/            # Evaluation prompts
│   │   ├── test.jsonl              # 5 builtin prompts
│   │   ├── test-mcp.jsonl          # 5 MCP prompts
│   │   ├── full.jsonl              # 1,254 builtin prompts
│   │   └── full-mcp.jsonl          # 1,254 MCP prompts
│   └── results/            # Agent outputs (gitignored)
└── .claude/skills/playoffs/  # This skill
```

## Related Documentation

- [Agent Schemas README](../../../agent-schemas/README.md)
- [MCP Tools README](../../../tools/README.md)
- [Prompts README](../../../data/prompts/README.md)
- [Main README](../../../README.md)
- [MCP Variant Analysis](../../../data/MCP-VARIANT-ANALYSIS.md)
- [Final Results](../../../FINAL-RESULTS.md)
- [Plan Completion](../../../PLAN-COMPLETION-SUMMARY.md)
