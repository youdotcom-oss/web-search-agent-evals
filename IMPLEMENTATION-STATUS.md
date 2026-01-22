# Implementation Status - Playoffs Validation

## Summary

Successfully implemented Phases 1-9 of the playoffs validation plan, preparing the system for Docker testing and MCP format experiments.

## Completed Phases

### Phase 1: Fix Package References ✅
- **docker/base.Dockerfile**: Removed outdated `@plaited/acp-harness@^0.4.4` line
  - Package now installed dynamically via `bunx` in docker-compose commands
- **tsconfig.json**: Updated include pattern from `src/**/*` to `scripts/**/*`, `tools/**/*`
  - Reflects actual project structure

### Phase 2: Install Gemini SDK ✅
- Added `@google/generative-ai@0.24.1` to package.json
- Enables hybrid grading (deterministic + LLM)

### Phase 3: Create Hybrid Comparison Grader ✅
- **scripts/comparison-grader.ts**: New file with 2-phase grading
  - **Deterministic (60 pts)**: Completion (40) + Tool usage (20)
  - **LLM Quality (40 pts)**: Accuracy, relevance, completeness via Gemini Flash 2.0
  - Graceful fallback to deterministic-only if LLM fails

### Phase 4: Update Compare Script ✅
- **scripts/compare-results.ts**: Rewritten to use new `compare` command
  - Replaced `summarize()` function with `compare()` using hybrid grader
  - Output: Structured JSONL with rankings instead of separate markdown files
  - Requires `GEMINI_API_KEY` environment variable

### Phase 5: Create MCP Prompt Format Variants ✅
Created 3 test prompt files (3 prompts each) to find which XML attribute format agents recognize:

- **search-test-mcp-v1.jsonl**: `<web-search tool="ydc-server">query</web-search>`
- **search-test-mcp-v2.jsonl**: `<web-search mcp-server="ydc-server">query</web-search>`
- **search-test-mcp-v3.jsonl**: `<web-search>Use ydc-server MCP tool: query</web-search>`

### Phase 6: Add Variant Test Services ✅
- **docker-compose.yml**: Added 3 new services
  - `claude-code-you-v1`, `v2`, `v3` - each tests a different MCP prompt variant
  - Results output to `/eval/data/results/claude-code/you-v{1,2,3}.jsonl`

### Phase 7: Create Prompt Conversion Script ✅
- **scripts/convert-prompts-to-xml.ts**: Keyword → Natural language + XML
  - Adds time markers ("2026", "current", "latest")
  - Wraps in `<web-search>` tags
  - Preserves metadata

### Phase 8: Convert Existing Prompts ✅
- Backed up originals: `test-original.jsonl`, `full-original.jsonl`
- Converted to XML format:
  - `test.jsonl`: 5 prompts converted
  - `full.jsonl`: 1,254 prompts converted
- Example output: `<web-search>Find current information about: landing page strategy gallery pricing table responsive design patterns 2026</web-search>`

### Phase 9: Validate Environment ✅
- Verified `@plaited/agent-eval-harness@0.5.2` installed
- Confirmed all API keys present in .env:
  - ANTHROPIC_API_KEY, GEMINI_API_KEY, YOU_API_KEY, FACTORY_API_KEY, OPENAI_API_KEY
- Local test successful: Captured trajectory from Claude Code agent

## Next Steps (When Docker Daemon Available)

### Phase 10: Docker Validation Tests

**Rebuild images:**
```bash
docker compose build --no-cache claude-code-builtin
docker compose build --no-cache gemini-builtin
docker compose build --no-cache droid-builtin
docker compose build --no-cache codex-builtin
```

**Run builtin tests (all 4 agents):**
```bash
docker compose run --rm claude-code-builtin
docker compose run --rm gemini-builtin
docker compose run --rm droid-builtin
docker compose run --rm codex-builtin
```

**Expected results:**
- Files created: `data/results/{agent}/builtin.jsonl`
- Gemini: 5/5 success, ~20s avg
- Droid: 5/5 success, ~25s avg
- Claude Code: 4-5/5 success, ~30s avg (may timeout on 1 at 90s limit)
- Codex: 2/5 success, ~80s avg (slow, known timeouts)

**Verify XML prompts trigger searches:**
```bash
cat data/results/claude-code/builtin.jsonl | jq -r '.output' | head -3
# Should show actual search results, NOT echoing XML tags
```

### Phase 11: Test MCP Variant Formats

**Run variant tests:**
```bash
docker compose run --rm claude-code-you-v1 &
docker compose run --rm claude-code-you-v2 &
docker compose run --rm claude-code-you-v3 &
wait
```

**Check which variant used MCP:**
```bash
for variant in v1 v2 v3; do
  echo "=== Variant $variant ==="
  cat data/results/claude-code/you-$variant.jsonl | \
    jq -r '.trajectory[] | select(.type == "tool_call") | .name' | \
    sort | uniq -c
done
```

**Expected:** One variant should show `ydc-server` or You.com-specific tool name instead of builtin tool names.

**Compare builtin vs MCP:**
```bash
echo "=== Claude builtin tools ==="
cat data/results/claude-code/builtin.jsonl | \
  jq -r '.trajectory[] | select(.type == "tool_call") | .name' | \
  sort | uniq -c

echo "=== Claude You.com MCP tools ==="
cat data/results/claude-code/you-v1.jsonl | \
  jq -r '.trajectory[] | select(.type == "tool_call") | .name' | \
  sort | uniq -c
```

### Phase 12: Analyze Results and Document

**Generate test report:**
```bash
for agent in claude-code gemini droid codex; do
  for tool in builtin you; do
    file="data/results/$agent/$tool.jsonl"
    if [ -f "$file" ]; then
      count=$(cat "$file" | wc -l | tr -d ' ')
      size=$(ls -lh "$file" | awk '{print $5}')
      echo "$agent + $tool: $count results, $size"
    else
      echo "$agent + $tool: MISSING"
    fi
  done
done
```

**Test comparison script:**
```bash
bun run compare -- -a claude-code --toolA builtin --toolB you
# Should generate: data/results/claude-code/builtin-vs-you.jsonl
```

**Update RESULTS.md** with findings:
- Agent performance summary (pass rates, avg times)
- XML prompt effectiveness
- Winning MCP variant format
- Known issues

## Files Created

### New Files
- `scripts/comparison-grader.ts` - Hybrid grader (deterministic + Gemini LLM)
- `scripts/convert-prompts-to-xml.ts` - Prompt conversion utility
- `data/prompts/search-test-mcp-v1.jsonl` - Variant 1: tool= format
- `data/prompts/search-test-mcp-v2.jsonl` - Variant 2: mcp-server= format
- `data/prompts/search-test-mcp-v3.jsonl` - Variant 3: natural format
- `data/prompts/test-original.jsonl` - Backup of original test prompts
- `data/prompts/full-original.jsonl` - Backup of original full prompts

### Modified Files
- `docker/base.Dockerfile` - Removed old package reference
- `tsconfig.json` - Fixed include pattern
- `package.json` - Added @google/generative-ai dependency
- `scripts/compare-results.ts` - Uses new compare command with hybrid grader
- `docker-compose.yml` - Added 3 variant test services
- `data/prompts/test.jsonl` - Converted to XML format (5 prompts)
- `data/prompts/full.jsonl` - Converted to XML format (1,254 prompts)

## Verification Commands

### Package References
```bash
# Should return nothing (old package removed)
grep "@plaited/acp-harness" docker/base.Dockerfile

# Should show scripts and tools
cat tsconfig.json | grep "include"
```

### Environment
```bash
# Should show 0.5.2
bunx @plaited/agent-eval-harness --version

# Should show all 5 keys
cat .env | grep -E "API_KEY" | wc -l
```

### Prompt Conversion
```bash
# Should show XML format
head -1 data/prompts/test.jsonl | jq -r '.input'

# Should show <web-search>...</web-search>
head -1 data/prompts/full.jsonl | jq -r '.input'
```

### TypeScript Compilation
```bash
# Should pass without errors
bun run typecheck
```

## Critical Success Criteria

### Local Validation (Completed ✅)
- [x] Base Dockerfile no longer references old package
- [x] tsconfig.json updated with correct paths
- [x] Gemini SDK installed
- [x] Hybrid grader compiles successfully
- [x] Prompts converted to XML format
- [x] Local capture test works

### Docker Validation (Pending - Requires Docker Daemon)
- [ ] All 4 Docker images rebuild without errors
- [ ] All 4 agents complete at least 1 prompt successfully
- [ ] Result files created with valid JSON structure
- [ ] XML prompts trigger actual searches (not echoed)

### MCP Validation (Pending - Requires Docker Daemon)
- [ ] MCP configs generate correctly for all agents
- [ ] At least one XML variant shows MCP tool usage
- [ ] Tool calls show different names (builtin vs ydc-server)

### Final Validation (Pending - Requires Docker Results)
- [ ] Test report generated showing all runs
- [ ] Pass rates documented
- [ ] Winning MCP variant identified
- [ ] Changes committed with proper message

## Notes

- Docker daemon was not running during implementation - Phases 10-12 require Docker to be started
- All code changes and local tests are complete
- System is ready for Docker testing once daemon is available
- Comparison grader uses Gemini Flash 2.0 for cost efficiency
