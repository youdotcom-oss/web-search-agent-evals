# Test Results - Playoffs Validation

**Date:** January 21, 2026
**Migration:** @plaited/acp-harness → @plaited/agent-eval-harness@0.5.2

## Executive Summary

Successfully validated Phases 1-9 of the playoffs system with all unit tests passing and Docker validation tests showing agents correctly triggering web searches from XML-formatted prompts. MCP integration requires additional configuration (--mcp-config flag).

## Unit Tests ✅

**Status:** 18/18 tests passing

### Comparison Grader Tests (6 tests)
- ✅ Deterministic scoring (completion only): 40 pts for output
- ✅ Deterministic scoring (completion + tool): 60 pts total
- ✅ Tool usage detection (case insensitive): Recognizes "search", "web" in tool names
- ✅ Rankings sorted by score descending
- ✅ Metadata includes score breakdown (deterministic + llm)
- ✅ Reasoning includes winner and score

**Key Features Validated:**
- Graceful fallback to deterministic-only when GEMINI_API_KEY missing
- Module-level API key check moved to function level for testability
- Hybrid grading: 60pts deterministic + 40pts LLM quality

### Prompt Converter Tests (12 tests)
- ✅ Converts keyword query to XML format
- ✅ Adds time marker (2026) to queries without year
- ✅ Preserves existing years (2024, 2025)
- ✅ Uses "How do I..." prefix for how/tutorial queries
- ✅ Uses "Find current information about:" prefix for other queries
- ✅ Preserves metadata
- ✅ Skips already-XML prompts (no double-wrapping)
- ✅ Handles non-English characters
- ✅ Handles queries with question marks
- ✅ Maintains order in batch conversion
- ✅ Handles special characters (C++, &, etc.)

**Conversion Stats:**
- test.jsonl: 5 prompts converted
- full.jsonl: 1,254 prompts converted
- Total: 1,259 prompts

**Example Conversion:**
```
Before: "landing page design patterns"
After: "<web-search>Find current information about: landing page design patterns 2026</web-search>"
```

## Docker Validation Tests ✅

### Claude Code (builtin search)
- **Status:** 5/5 success (100%)
- **Average time:** ~27 seconds per prompt
- **Timeout setting:** 90 seconds
- **XML effectiveness:** ✅ Actual search results (not echoed XML)

**Sample times:**
- Prompt 1: 18.6s
- Prompt 2: 27.6s
- Prompt 3: 33.8s
- Prompt 4: 31.5s
- Prompt 5: 24.9s

**Output verification:**
```
Based on the search results, here's the current weather in San Francisco:
**Current Conditions:** 50°F with mostly cloudy skies (as of January 21-22, 2026)
```
✅ Shows actual weather data from search, not XML echo

### Gemini (builtin search)
- **Status:** 5/5 success (100%)
- **Average time:** ~15 seconds per prompt
- **Timeout setting:** 60 seconds
- **XML effectiveness:** ✅ Actual search results

**Sample times:**
- Prompt 1: 10.3s
- Prompt 2: 17.1s
- Prompt 3: 19.9s
- Prompt 4: 13.9s
- Prompt 5: 14.0s

**Performance notes:** Fastest agent, ~45% faster than Claude on average

### XML Prompt Format Effectiveness

**Key Finding:** XML `<web-search>` format successfully triggers actual web searches in both agents.

**Evidence:**
- Outputs contain current weather data, API pricing from 2025, CES 2025 announcements
- No XML tag echoing in responses
- Agents interpret `<web-search>` as action directive, not literal text

**Format:**
```xml
<web-search>What is the weather in San Francisco right now?</web-search>
<web-search>Latest Claude API features January 2025</web-search>
<web-search>Compare Anthropic vs OpenAI pricing 2025</web-search>
```

## MCP Variant Tests ⚠️

### Test Setup
Created 3 variants to test which XML attribute format agents recognize for MCP tool selection:

1. **Variant 1 (tool=)**: `<web-search tool="ydc-server">query</web-search>`
2. **Variant 2 (mcp-server=)**: `<web-search mcp-server="ydc-server">query</web-search>`
3. **Variant 3 (natural)**: `<web-search>Use ydc-server MCP tool: query</web-search>`

### Results
- **All 3 variants completed:** 3/3 prompts each
- **Tool usage:** All used internal tools (toolu_*), not MCP servers
- **MCP config generation:** ✅ Works when tested manually
- **MCP config discovery:** ❌ Not loaded by agents during runs

### Root Cause Analysis

**Issue:** Claude CLI requires explicit `--mcp-config` flag to load MCP servers from a file.

**Evidence:**
```bash
# Claude help output shows:
--mcp-config <configs...>  Load MCP servers from JSON files or strings
--strict-mcp-config        Only use MCP servers from --mcp-config
```

**What works:**
- ✅ MCP config generation script (scripts/generate-mcp-config.ts)
- ✅ Entrypoint creates /workspace/.mcp.json
- ✅ Config has correct structure and API key

**What doesn't work:**
- ❌ Claude doesn't auto-discover .mcp.json in CWD
- ❌ Claude doesn't auto-discover ~/.mcp.json in home directory
- ❌ Current schema doesn't include --mcp-config flag

### Implications

**XML attributes (tool=, mcp-server=) are NOT directives:**
- They're just natural language text in the prompt
- Agents don't parse them to select specific tools
- Tool selection is based on what's available in agent's tool repertoire

**For MCP to work:**
1. Agent must load MCP config at startup
2. Claude needs: `--mcp-config /workspace/.mcp.json` in command
3. Schema needs to be updated OR entrypoint needs to configure globally

## Key Findings

### ✅ What Works

1. **Package Migration**
   - @plaited/agent-eval-harness@0.5.2 installed successfully
   - No issues with updated base Dockerfile (removed old package)
   - tsconfig.json fixed (scripts/, tools/ paths)

2. **Hybrid Grading**
   - Deterministic scoring: 60 pts (completion + tool usage)
   - LLM scoring: 40 pts (via Gemini Flash 2.0)
   - Graceful fallback when GEMINI_API_KEY missing

3. **Prompt Conversion**
   - Keyword → Natural language + XML successful
   - 1,259 prompts converted without errors
   - Time markers added automatically

4. **XML Format**
   - `<web-search>` successfully triggers web searches
   - Both Claude and Gemini interpret correctly
   - Outputs show actual search results

5. **Docker Infrastructure**
   - All images build successfully
   - Environment variables properly propagated
   - Volume mounts working (data/, scripts/, tools/)

### ⚠️ What Needs Work

1. **MCP Integration**
   - Requires --mcp-config flag in Claude command
   - Options:
     - Update agent schema to conditionally add flag
     - Use entrypoint to configure via `claude mcp add`
     - Create wrapper script that calls claude with --mcp-config

2. **Droid/Codex Testing**
   - Only tested Claude Code and Gemini
   - Droid and Codex images not yet tested
   - May have different MCP config requirements

## Recommendations

### Immediate Actions

1. **Fix MCP Integration**
   ```bash
   # Option A: Update schema args
   --mcp-config /workspace/.mcp.json

   # Option B: Entrypoint configures globally
   claude mcp add ydc-server --config /workspace/.mcp.json
   ```

2. **Test Remaining Agents**
   ```bash
   docker compose run --rm droid-builtin
   docker compose run --rm codex-builtin
   ```

3. **Validate MCP Fix**
   ```bash
   # After fix, verify MCP tools appear in trajectory
   cat results/claude-code/you.jsonl | \
     jq -r '.trajectory[] | select(.type == "tool_call") | .name'
   # Should show "ydc-server" or "you_search", not "toolu_*"
   ```

### Future Improvements

1. **Automated Testing**
   - Add CI workflow for Docker tests
   - Gated by path filters (src/ changes only)
   - Avoids API costs on doc-only changes

2. **MCP Server Expansion**
   - Add Exa.ai to tools/mcp-servers.json
   - Test multiple MCP servers simultaneously
   - Compare MCP server quality

3. **Grader Calibration**
   - Use `agent-eval-harness calibrate` to sample failures
   - Identify grader bugs vs agent failures
   - Tune deterministic weights (currently 60/40 split)

## Files Modified

### New Files (Test Suite)
- `scripts/comparison-grader.spec.ts` - 6 tests for hybrid grader
- `scripts/convert-prompts-to-xml.spec.ts` - 12 tests for converter
- `TEST-RESULTS.md` - This document

### Modified Files (Testability)
- `scripts/comparison-grader.ts` - Moved API key check to function level

### Converted Prompts
- `data/prompts/test.jsonl` - 5 XML prompts (backup: test-original.jsonl)
- `data/prompts/full.jsonl` - 1,254 XML prompts (backup: full-original.jsonl)

### Test Results
- `data/results/claude-code/builtin.jsonl` - 5 successful captures
- `data/results/gemini/builtin.jsonl` - 5 successful captures
- `data/results/claude-code/you-v1.jsonl` - 3 captures (internal tools)
- `data/results/claude-code/you-v2.jsonl` - 3 captures (internal tools)
- `data/results/claude-code/you-v3.jsonl` - 3 captures (internal tools)

## Next Steps

1. ✅ **Phase 1-9:** Complete (package fixes, tests, Docker validation)
2. ⚠️ **Phase 10-11:** MCP integration needs --mcp-config flag fix
3. ⏸️ **Phase 12:** Pending MCP fix and full 4-agent testing

**Status:** 9/12 phases complete, MCP integration blocked on config flag

## Commands Reference

### Run Tests
```bash
# Unit tests
bun test scripts/ --timeout 10000

# Docker validation
docker compose run --rm claude-code-builtin
docker compose run --rm gemini-builtin

# MCP variants (after fix)
docker compose run --rm claude-code-you-v1
```

### Verify Results
```bash
# Check tool usage
cat data/results/claude-code/builtin.jsonl | \
  jq -r '.trajectory[] | select(.type == "tool_call") | .name' | sort | uniq -c

# Sample outputs
cat data/results/claude-code/builtin.jsonl | jq -r '.output' | head -5
```

### Compare Tools
```bash
# After MCP fix
bun run compare -- -a claude-code --toolA builtin --toolB you
```
