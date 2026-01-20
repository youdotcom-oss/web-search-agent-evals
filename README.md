# Droid ACP Evaluations

Evaluate Droid's capabilities using [@plaited/acp-harness](https://www.npmjs.com/package/@plaited/acp-harness) through the Agent Client Protocol (ACP).

## What This Does

Runs evaluation prompts through Droid and captures full trajectories (messages, tool calls, responses, timing) for analysis. Currently contains web search queries for testing Droid's search capabilities.

## Quick Start

```bash
# Install dependencies
bun install

# Set your Factory API key
cp .env.example .env
# Edit .env and add your FACTORY_API_KEY=fk-...

# Run test evaluation (5 queries)
bunx @plaited/acp-harness capture eval/prompts-test.jsonl bun src/main.ts -o eval/test-results.jsonl --progress

# Run full evaluation (1,254 queries)
bunx @plaited/acp-harness capture eval/prompts.jsonl bun src/main.ts -o eval/results.jsonl --progress

# Multi-run analysis (pass@k)
bunx @plaited/acp-harness trials eval/prompts-test.jsonl bun src/main.ts -k 5 -o eval/trials.jsonl --progress
```

## How It Works

```mermaid
flowchart LR
    A[prompts.jsonl] --> B[@plaited/acp-harness]
    B --> C[Droid ACP Adapter]
    C --> D[Droid CLI]
    D --> E[Factory Agent]
    E --> F[WebSearch Tool]
    F --> G[Search Provider]
    E --> B
    B --> H[results.jsonl]
```

1. **ACP Harness** reads prompts from `eval/prompts.jsonl`
2. **Droid Adapter** (`src/`) translates ACP protocol to Droid CLI
3. **Droid** executes searches via Factory agent
4. **Results** captured as JSONL with full trajectories

## Datasets

| File | Description | Count |
|------|-------------|-------|
| `eval/prompts.jsonl` | Full evaluation set (WebSearch) | 1,254 |
| `eval/prompts-test.jsonl` | Quick test subset | 5 |
| `eval/data.jsonl` | Raw dataset with embeddings | 1,995 |

**Categories:** Learning, Debugging, API_Reference, Documentation, General_Knowledge, Product_Info, etc.

**Prompt Format:**
```jsonl
{"id":"websearch-1","input":"search query text","metadata":{"category":"Learning","subcategory":"Web_Design_Patterns","tool":"WebSearch","is_dev":false}}
```

Each prompt includes metadata for filtering by category, subcategory, language, tool type, and dev/non-dev classification.

## Analyzing Results

```bash
# Count tool usage
cat eval/results.jsonl | jq -s 'map(.trajectory | map(select(.type == "tool_call")) | length) | add'

# Filter by category
cat eval/results.jsonl | jq 'select(.metadata.category == "Debugging")'

# Check for errors
cat eval/results.jsonl | jq 'select(.toolErrors == true)'

# Generate summary
bunx @plaited/acp-harness summarize eval/results.jsonl -o eval/summary.jsonl
bunx @plaited/acp-harness summarize eval/results.jsonl --markdown -o eval/report.md
```

## Comparing Search Providers

```bash
# Baseline: Droid with Factory built-in search
bunx @plaited/acp-harness capture eval/prompts.jsonl bun src/main.ts -o eval/factory.jsonl

# Alternative: Droid with You.com MCP server
bunx @plaited/acp-harness capture eval/prompts.jsonl bun src/main.ts \
  --mcp-server '{"type":"http","name":"you","url":"https://api.you.com/mcp"}' \
  -o eval/you.jsonl

# Compare outputs
diff <(jq -s 'map(.output)' eval/factory.jsonl) <(jq -s 'map(.output)' eval/you.jsonl)
```

## Working with This Codebase

**Recommended:** Use an AI coding agent to explore and work with this repository.

This project was built with agent-first development using Plaited skills. Ask your agent to:

```
"Explain how the Droid ACP adapter works"
"Show me the evaluation dataset structure"
"How do I add a new test case to prompts.jsonl?"
"What's the difference between capture and trials commands?"
```

**Supported agents:**
- [Claude Code](https://claude.ai/code) - Reads [@AGENTS.md](AGENTS.md) automatically
- [Cursor](https://cursor.sh) - AI-first code editor
- [Droid](https://github.com/plaited/droid) - Can explore its own eval repo!

### Project Structure

```
.
├── eval/                   # Evaluation datasets and results
│   ├── prompts.jsonl       # Full evaluation set (1,254 prompts)
│   ├── prompts-test.jsonl  # Quick test subset (5 prompts)
│   ├── data.jsonl          # Raw dataset with embeddings
│   └── results-*.jsonl     # Captured trajectories from runs
│
├── src/                    # Droid ACP adapter
│   ├── main.ts             # ACP stdio server entry point
│   ├── agent.ts            # Agent interface implementation
│   ├── droid-adapter.ts    # Droid CLI protocol communication
│   ├── types.ts            # TypeScript type definitions
│   └── utils.ts            # Utility functions
│
├── dev/                    # Development/debugging scripts
│   ├── README.md           # Script documentation
│   ├── test-adapter.sh     # Manual ACP adapter testing
│   ├── test-droid-direct.sh    # Direct droid CLI testing
│   └── test-droid-tool-use.sh  # Tool notification testing
│
├── .plaited/rules/         # Development conventions (see @AGENTS.md)
├── .claude/skills/         # Agent Skills for this project
└── .env                    # API keys (create from .env.example)
```

## Development

### Code Quality

```bash
# Type check
bun run typecheck

# Lint and format
bun run check

# Auto-fix issues
bun run check:write

# Run tests
bun test
```

**Before committing:** Pre-commit hooks run automatically. Never bypass with `--no-verify`.

### Debugging the Adapter

The `dev/` directory contains manual testing scripts for debugging adapter issues:

```bash
# Test ACP adapter with manual JSON-RPC messages
./dev/test-adapter.sh

# Test droid CLI directly (bypassing adapter)
./dev/test-droid-direct.sh

# Test droid with search to observe tool notifications
./dev/test-droid-tool-use.sh
```

See [`dev/README.md`](dev/README.md) for detailed documentation of each script.

### Development Rules

See [@AGENTS.md](AGENTS.md) for complete development rules and conventions.

## Built With

- **[@plaited/acp-harness](https://www.npmjs.com/package/@plaited/acp-harness)** - Evaluation framework
- **[@agentclientprotocol/sdk](https://www.npmjs.com/package/@agentclientprotocol/sdk)** - ACP protocol SDK
- **[Droid CLI](https://github.com/plaited/droid)** - Agent being evaluated
- **[Bun](https://bun.sh)** - TypeScript runtime

## References

- [Agent Client Protocol](https://agentclientprotocol.com/) - Protocol specification
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
- [ACP Harness Docs](https://www.npmjs.com/package/@plaited/acp-harness) - Full harness documentation
- [Factory AI](https://factory.ai/) - Droid's agent platform
