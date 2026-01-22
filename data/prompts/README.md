# Prompt Sets

This directory contains prompt sets for evaluating agents with different search tools.

## Builtin Search Prompts

Use with agents' native search capabilities (no MCP):

| File | Description | Count | Format |
|------|-------------|-------|--------|
| `test.jsonl` | Test subset | 5 | `<web-search>query</web-search>` |
| `full.jsonl` | Full dataset | 1,254 | `<web-search>query</web-search>` |
| `search-test.jsonl` | Search-focused tests | 5 | `<web-search>query</web-search>` |

## MCP Search Prompts

Use with MCP servers (You.com, Exa, etc.) for optimal performance:

| File | Description | Count | Format |
|------|-------------|-------|--------|
| `test-mcp.jsonl` | Test subset (MCP) | 5 | `<web-search mcp-server="ydc-server">` |
| `full-mcp.jsonl` | Full dataset (MCP) | 1,254 | `<web-search mcp-server="ydc-server">` |
| `search-test-mcp.jsonl` | Search tests (MCP) | 5 | `<web-search mcp-server="ydc-server">` |

## MCP Format

The MCP prompts use the **winning v2 format** from variant testing:

```xml
<web-search mcp-server="ydc-server">What is the weather in San Francisco?</web-search>
```

**Why this format?**
- ⚡ **39-45% faster** than other variants (v1, v3)
- ✅ **100% success rate** in testing
- 🎯 **Most explicit** about MCP usage
- 📝 **Semantically clear** (mcp-server vs generic tool)

See `data/MCP-VARIANT-ANALYSIS.md` for full testing results.

## Original Backups

| File | Description |
|------|-------------|
| `test-original.jsonl` | Pre-XML test prompts (keyword format) |
| `full-original.jsonl` | Pre-XML full prompts (keyword format) |
| `mcp-variant-v2.jsonl` | Historical reference (variant testing winner) |

## Usage Examples

### Quick Testing (5 prompts)

```bash
# Builtin search
docker compose run --rm claude-code-builtin  # Uses search-test.jsonl

# MCP search (faster)
docker compose run --rm claude-code-you      # Uses search-test.jsonl (works with MCP)
```

### Full Evaluation (1,254 prompts)

```bash
# Update docker-compose.yml to use full.jsonl or full-mcp.jsonl
# Then run:
docker compose run --rm claude-code-builtin
docker compose run --rm claude-code-you
```

### Custom Prompts

```bash
# Convert existing prompts to MCP format
bun scripts/convert-to-mcp-format.ts -i custom.jsonl -o custom-mcp.jsonl
```

## Format Details

### Plain Format (Builtin)
```json
{"id":"test-1","input":"<web-search>What is AI?</web-search>","metadata":{...}}
```

### MCP Format (Optimal)
```json
{"id":"test-1","input":"<web-search mcp-server=\"ydc-server\">What is AI?</web-search>","metadata":{...}}
```

Both formats work with MCP servers, but the MCP format is **39-45% faster** due to explicit server specification.
