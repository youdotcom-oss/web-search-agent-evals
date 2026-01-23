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
- **MCP configs** (mcp-servers.ts) - Type-safe TypeScript constants
- **TypeScript entrypoint** (docker/entrypoint) - Bun shell script for runtime config
- **CLI scripts** (scripts/) - Type-safe execution and comparison
- **Docker** (docker/, docker-compose.yml) - Isolated execution (4 services)

**Key simplification:** Flag-based architecture with TypeScript
- Single `mcp-servers.ts` for all MCP server definitions
- TypeScript entrypoint imports MCP constants directly
- 4 Docker services (not 8) - mode selected via `MCP_TOOL` env var
- 4 agent schemas (not 8) - base schemas work for both modes

## Quick Commands

### Test Workflow (5 prompts, ~30s per agent)

Run all 4 agents with both builtin and MCP search:

```bash
# Builtin search - test all agents
docker compose run --rm -e MCP_TOOL=builtin claude-code
docker compose run --rm -e MCP_TOOL=builtin gemini
docker compose run --rm -e MCP_TOOL=builtin droid
docker compose run --rm -e MCP_TOOL=builtin codex

# MCP search (39-45% faster) - test all agents
docker compose run --rm -e MCP_TOOL=you claude-code
docker compose run --rm -e MCP_TOOL=you gemini
docker compose run --rm -e MCP_TOOL=you droid
docker compose run --rm -e MCP_TOOL=you codex

# Or use the automated script (runs all 8 scenarios in parallel)
bun run run

# Run specific agent in both modes
bun run run --agent gemini

# Run all agents in specific mode only
bun run run --mcp builtin
bun run run --mcp you
```

### Full Workflow (1,254 prompts, ~10+ hours per agent)

**Step 1:** Update docker/entrypoint to use full prompts:

```bash
# Replace test prompts with full prompts
sed -i.bak 's|test.jsonl|full.jsonl|g' docker/entrypoint
sed -i.bak 's|test-mcp.jsonl|full-mcp.jsonl|g' docker/entrypoint

# Rebuild images to include updated entrypoint
docker compose build
```

**Step 2:** Run evaluations:

```bash
# Use automated script (runs all 8 scenarios in parallel)
bun run run

# Or run specific agent+tool combinations
docker compose run --rm -e MCP_TOOL=builtin claude-code
docker compose run --rm -e MCP_TOOL=you gemini

# Or run all agents in one mode
bun run run --mcp builtin
bun run run --mcp you
```

**Step 3:** Restore test prompts:

```bash
mv docker/entrypoint.bak docker/entrypoint
docker compose build
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

## Prompt Sets

| File | Prompts | Format | Use With |
|------|---------|--------|----------|
| `test.jsonl` | 5 | `<web-search>` | Builtin services |
| `test-mcp.jsonl` | 5 | `<web-search mcp-server="ydc-server">` | MCP services |
| `full.jsonl` | 1,254 | `<web-search>` | Builtin services |
| `full-mcp.jsonl` | 1,254 | `<web-search mcp-server="ydc-server">` | MCP services |

**Default:** Docker entrypoint uses `test.jsonl` (5 prompts) and `test-mcp.jsonl` (5 prompts) for quick validation.

**Full eval:** Update docker/entrypoint to use `full.jsonl` (1,254 prompts) or `full-mcp.jsonl` (1,254 prompts).

See [references/prompts.md](references/prompts.md) for complete prompt documentation.

## Results Location

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

2. **Create Dockerfile** (`docker/<agent>.Dockerfile`)
   - Base from `base`
   - Install agent CLI
   - Copy TypeScript entrypoint and mcp-servers.ts
   - Verify with `<agent> --version`

3. **Add Docker Compose service**
   - Add single `<agent>` service
   - Use same pattern as existing services

4. **Update TypeScript entrypoint** (`docker/entrypoint`)
   - Add agent case to `configureMcp()` function
   - Add timeout to `buildCaptureCommand()` if needed

5. **Update documentation**
   - Add to references/agent-schemas.md
   - Update main README.md
   - Update this skill

See [references/agent-schemas.md](references/agent-schemas.md) for detailed agent schema documentation.

### Adding a New MCP Tool

1. **Add to mcp-servers.ts**
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

2. **Update docker/entrypoint**
   - Add `exa` case to each agent's configuration in `configureMcp()`

3. **Add to .env and .env.example**
   ```
   EXA_API_KEY=...
   ```

4. **Update scripts/run.ts**
   - Add `"exa"` to `McpTool` type union

5. **Create MCP prompt set**
   ```bash
   bun scripts/convert-to-mcp-format.ts -i test.jsonl -o test-exa.jsonl
   ```

6. **Test**
   ```bash
   docker compose build
   docker compose run --rm -e MCP_TOOL=exa claude-code
   ```

See [references/mcp-tools.md](references/mcp-tools.md) for detailed MCP configuration documentation.

## Troubleshooting

### MCP Config Not Working

1. **Verify TypeScript entrypoint builds command**
   ```bash
   docker compose run --rm -e MCP_TOOL=you claude-code bash -c 'cat /entrypoint.ts | grep -A10 "configureMcp"'
   ```

2. **Verify API keys are set**
   ```bash
   cat .env | grep API_KEY
   ```

3. **Test inside container**
   ```bash
   docker compose run --rm -e MCP_TOOL=you claude-code bash
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

3. **Check TypeScript entrypoint**
   ```bash
   docker compose run --rm <agent> bash -c "cat /entrypoint.ts | head -20"
   ```

### Timeout Issues

If agents timeout frequently:

1. **Check current timeout** in docker/entrypoint
2. **Increase timeout** for problematic agent in `buildCaptureCommand()`:
   ```typescript
   case 'slow-agent':
     cmd.push('--timeout', '240000')  // 4 minutes
     break
   ```
3. **Test with single prompt** first to verify it's not a config issue

## File Structure

```
acp-evals/
├── agent-schemas/          # ACP headless schemas (4 files)
│   ├── claude-code.json
│   ├── gemini.json
│   ├── droid.json
│   └── codex.json
├── tools/                  # MCP configuration
│   └── mcp-servers.ts      # TypeScript constants (single source)
├── scripts/                # CLI tools
│   ├── run.ts              # Automated test runner (--mcp flag)
│   └── compare.ts          # Results comparison
├── docker/                 # Container infrastructure
│   ├── entrypoint          # TypeScript entrypoint (Bun shell)
│   ├── base.Dockerfile
│   ├── claude-code.Dockerfile
│   ├── gemini.Dockerfile
│   ├── droid.Dockerfile
│   └── codex.Dockerfile
├── data/
│   ├── prompts/            # Evaluation prompts
│   │   ├── test.jsonl              # 5 builtin prompts
│   │   ├── test-mcp.jsonl          # 5 MCP prompts
│   │   ├── full.jsonl              # 1,254 builtin prompts
│   │   └── full-mcp.jsonl          # 1,254 MCP prompts
│   └── results/            # Agent outputs (gitignored)
├── docker-compose.yml      # 4 services (one per agent)
└── .claude/skills/playoffs/  # This skill
    ├── SKILL.md
    └── references/
        ├── mcp-tools.md         # MCP configuration guide
        ├── prompts.md           # Prompt format guide
        └── agent-schemas.md     # Agent schema guide
```

## Related Documentation

- [MCP Tools Configuration](references/mcp-tools.md) - TypeScript entrypoint and MCP server setup
- [Prompt Sets](references/prompts.md) - Prompt formats, conversion, and analysis
- [Agent Schemas](references/agent-schemas.md) - Headless adapter schemas and validation
- [Main README](../../../README.md) - Project overview and quick start
