# Implementation Plan: Droid ACP Evaluations

**Project:** acp-evals (droid adapter + evaluation datasets)
**Goal:** Complete evaluation infrastructure with workarounds for current limitations
**Timeline:** 1-2 weeks
**Priority:** High (unblock evaluation work)

---

## Problem Statement

**Discovered Issues:**

1. **Droid CLI Bug:** Multiple prompts in same session execute out of order
   - First prompt: Completes immediately with no output
   - Second prompt: Returns first prompt's results
   - Pattern repeats for all odd/even pairs

2. **Adapter Limitation:** Droid only exposes `tool_result` notifications, not `tool_use_started`
   - This is droid API limitation, not adapter bug
   - Acceptable for evaluation purposes (results contain toolUseId)

3. **Evaluation Harness:** Current acp-harness reuses sessions, triggering droid bug

**Current Status:**
- ✅ Adapter correctly implements ACP protocol
- ✅ Adapter correctly handles droid notifications
- ✅ Found root cause of empty outputs (droid bug, not adapter)
- ✅ "Search the web for:" prefix triggers actual searches
- ⚠️ Need workarounds until harness updated

---

## Goals

### Short-term (Week 1)
1. Document droid bug thoroughly
2. Implement workarounds for current harness
3. Validate searches work with proper prompts
4. Create clean evaluation datasets

### Long-term (Week 2)
1. Test harness fix when available
2. Run full evaluations with corrected behavior
3. Compare MCP vs built-in search results
4. Document findings and methodology

---

## Implementation Tasks

### Phase 1: Documentation & Workarounds (Week 1, Days 1-3)

#### Task 1.1: Enhance bug documentation ✅
**File:** `DROID-ISSUES.md`
**Status:** DONE
**Content:**
- Root cause analysis
- Debug output examples
- Workaround strategies
- Testing instructions

#### Task 1.2: Create workaround script
**File:** `scripts/capture-isolated.sh` (NEW)
**Purpose:** Run each prompt in isolated adapter process
**Implementation:**
```bash
#!/usr/bin/env bash
# scripts/capture-isolated.sh - Fresh adapter per prompt workaround
# Usage: ./scripts/capture-isolated.sh prompts.jsonl output.jsonl

set -euo pipefail

PROMPTS_FILE="${1:?Missing prompts.jsonl}"
OUTPUT_FILE="${2:?Missing output.jsonl}"
ADAPTER_CMD="${3:-bun src/main.ts}"

# Ensure output directory exists
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Clear output file
> "$OUTPUT_FILE"

# Progress tracking
TOTAL=$(wc -l < "$PROMPTS_FILE")
CURRENT=0

echo "Running $TOTAL prompts with isolated sessions..." >&2

# Process each prompt individually
while IFS= read -r line; do
  ((CURRENT++))

  ID=$(echo "$line" | jq -r '.id')
  echo "[$CURRENT/$TOTAL] $ID" >&2

  # Create temp file for single prompt
  TEMP_PROMPT=$(mktemp)
  TEMP_RESULT=$(mktemp)
  echo "$line" > "$TEMP_PROMPT"

  # Run capture for single prompt (fresh adapter process)
  bunx @plaited/acp-harness capture "$TEMP_PROMPT" $ADAPTER_CMD \
    -o "$TEMP_RESULT" 2>&1 | grep -E "(✓|✗|Error)" >&2 || true

  # Append result to output
  cat "$TEMP_RESULT" >> "$OUTPUT_FILE"

  # Cleanup
  rm "$TEMP_PROMPT" "$TEMP_RESULT"
done < "$PROMPTS_FILE"

echo "Done! Results in $OUTPUT_FILE" >&2
```

#### Task 1.3: Create parallel workaround script
**File:** `scripts/capture-parallel.sh` (NEW)
**Purpose:** Run prompts in parallel with isolated sessions
**Implementation:**
```bash
#!/usr/bin/env bash
# scripts/capture-parallel.sh - Parallel isolated sessions
# Usage: ./scripts/capture-parallel.sh prompts.jsonl output.jsonl [parallelism]

set -euo pipefail

PROMPTS_FILE="${1:?Missing prompts.jsonl}"
OUTPUT_FILE="${2:?Missing output.jsonl}"
PARALLELISM="${3:-4}"  # Default 4 parallel jobs
ADAPTER_CMD="${4:-bun src/main.ts}"

# Ensure output directory exists
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Clear output file
> "$OUTPUT_FILE"

# Create work directory
WORK_DIR=$(mktemp -d)
trap "rm -rf $WORK_DIR" EXIT

# Split prompts into individual files
split -l 1 "$PROMPTS_FILE" "$WORK_DIR/prompt-"

# Function to run single prompt
run_prompt() {
  local prompt_file="$1"
  local result_file="$2"

  bunx @plaited/acp-harness capture "$prompt_file" $ADAPTER_CMD \
    -o "$result_file" 2>/dev/null
}

export -f run_prompt
export ADAPTER_CMD

# Run in parallel
find "$WORK_DIR" -name "prompt-*" -print0 | \
  xargs -0 -P "$PARALLELISM" -I {} bash -c \
    'run_prompt "{}" "{}.result"'

# Combine results
cat "$WORK_DIR"/*.result > "$OUTPUT_FILE"

echo "Done! Results in $OUTPUT_FILE" >&2
```

#### Task 1.4: Update README with workarounds
**File:** `README.md`
**Section to add:**
```markdown
## Known Issues

### Droid Session Bug

Droid CLI has a bug where multiple prompts in the same session execute out of order. This causes odd-numbered prompts to have empty outputs. See [DROID-ISSUES.md](DROID-ISSUES.md) for details.

**Workaround 1: Isolated Sessions (Sequential)**

```bash
# Run each prompt in fresh adapter process
./scripts/capture-isolated.sh eval/prompts.jsonl eval/results.jsonl
```

**Workaround 2: Isolated Sessions (Parallel)**

```bash
# Run 4 prompts at once with isolated sessions
./scripts/capture-parallel.sh eval/prompts.jsonl eval/results.jsonl 4
```

**Future:** acp-harness v0.4.0 will fix this by using fresh sessions per prompt by default.
```

### Phase 2: Dataset Improvements (Week 1, Days 4-5)

#### Task 2.1: Validate search-optimized prompts
**File:** `eval/prompts-search.jsonl` (CREATE from prompts.jsonl)
**Purpose:** Full dataset with "Search the web for:" prefix
**Implementation:**
```bash
# Create search-optimized version
cat eval/prompts.jsonl | jq -c '.input = "Search the web for: " + .input' \
  > eval/prompts-search.jsonl

# Validate format
cat eval/prompts-search.jsonl | jq -e '.input | startswith("Search the web for:")' > /dev/null
echo "✓ All prompts have search prefix"
```

#### Task 2.2: Create conversation test cases
**File:** `eval/conversations.jsonl` (NEW)
**Purpose:** Test multi-turn conversation support (future harness feature)
**Format:**
```jsonl
{"id":"conv-search-001","conversation":[{"role":"user","content":"What is Anthropic?"},{"role":"user","content":"Who is the CEO?"}],"metadata":{"category":"Learning","type":"multi-turn"}}
{"id":"conv-debug-001","conversation":[{"role":"user","content":"I'm getting SSL errors"},{"role":"user","content":"The error is SSL_ERROR_SYSCALL"},{"role":"user","content":"Can you search for solutions?"}],"metadata":{"category":"Debugging","type":"progressive"}}
```

#### Task 2.3: Add metadata analysis script
**File:** `scripts/analyze-dataset.sh` (NEW)
**Purpose:** Understand dataset distribution
**Implementation:**
```bash
#!/usr/bin/env bash
# scripts/analyze-dataset.sh - Dataset distribution analysis

DATASET="${1:-eval/prompts.jsonl}"

echo "Dataset Analysis: $DATASET"
echo "================================"
echo

echo "Total prompts: $(wc -l < "$DATASET")"
echo

echo "By category:"
cat "$DATASET" | jq -r '.metadata.category' | sort | uniq -c | sort -rn
echo

echo "By subcategory:"
cat "$DATASET" | jq -r '.metadata.subcategory' | sort | uniq -c | sort -rn
echo

echo "By language:"
cat "$DATASET" | jq -r '.metadata.lang' | sort | uniq -c | sort -rn
echo

echo "Dev vs non-dev:"
cat "$DATASET" | jq -r 'if .metadata.is_dev then "dev" else "non-dev" end' | \
  sort | uniq -c | sort -rn
```

### Phase 3: Validation & Testing (Week 2, Days 1-2)

#### Task 3.1: Test isolated session workaround
**Test:** Run full search-optimized dataset with isolation
**Command:**
```bash
# Test with 10-prompt sample first
head -10 eval/prompts-search.jsonl > eval/test-10.jsonl
./scripts/capture-isolated.sh eval/test-10.jsonl eval/results-isolated-test.jsonl

# Validate all have output
cat eval/results-isolated-test.jsonl | jq -e 'select(.output == "") | .id' && \
  echo "ERROR: Found empty outputs" || echo "✓ All prompts have output"

# Count tool usage
cat eval/results-isolated-test.jsonl | \
  jq -s 'map(select(.trajectory | length > 0)) | length'
```

#### Task 3.2: Compare session modes
**Purpose:** Document performance and correctness differences
**Files:** `eval/comparison-report.md` (NEW)
**Tests:**
```bash
# Test 1: Session reuse (buggy behavior)
bunx @plaited/acp-harness capture eval/test-10.jsonl bun src/main.ts \
  -o eval/results-reused.jsonl --progress

# Test 2: Isolated sessions (correct behavior)
./scripts/capture-isolated.sh eval/test-10.jsonl eval/results-isolated.jsonl

# Compare
echo "## Session Mode Comparison" > eval/comparison-report.md
echo "" >> eval/comparison-report.md
echo "### Session Reuse (Current Harness)" >> eval/comparison-report.md
echo "- Prompts with output: $(cat eval/results-reused.jsonl | jq -s 'map(select(.output != "")) | length')" >> eval/comparison-report.md
echo "- Empty outputs: $(cat eval/results-reused.jsonl | jq -s 'map(select(.output == "")) | length')" >> eval/comparison-report.md
echo "" >> eval/comparison-report.md
echo "### Isolated Sessions (Workaround)" >> eval/comparison-report.md
echo "- Prompts with output: $(cat eval/results-isolated.jsonl | jq -s 'map(select(.output != "")) | length')" >> eval/comparison-report.md
echo "- Empty outputs: $(cat eval/results-isolated.jsonl | jq -s 'map(select(.output == "")) | length')" >> eval/comparison-report.md
```

#### Task 3.3: Add adapter race condition test
**File:** `src/test/race-condition.spec.ts` (NEW)
**Purpose:** Ensure adapter handles rapid prompt sequences
**Implementation:**
```typescript
import { test, expect } from 'bun:test'
import { DroidAcpAgent } from '../agent.ts'
import { AgentSideConnection } from '@agentclientprotocol/sdk'

test('adapter handles rapid prompt completion', async () => {
  // This tests the race condition fix where promptResolve
  // was set AFTER sending message to droid

  const connection = // ... create connection
  const agent = new DroidAcpAgent(connection)

  await agent.initialize({})
  const session = await agent.newSession({ cwd: process.cwd() })

  // Send rapid prompts
  const prompts = [
    '2 + 2',
    '3 + 3',
    '4 + 4',
  ]

  const results = []
  for (const prompt of prompts) {
    const result = await agent.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: 'text', text: prompt }]
    })
    results.push(result)
  }

  // All should complete (not hang)
  expect(results).toHaveLength(3)

  // All should have stopReason
  for (const result of results) {
    expect(result.stopReason).toBeDefined()
  }
})
```

### Phase 4: Full Evaluation Run (Week 2, Days 3-5)

#### Task 4.1: Run baseline evaluation
**Purpose:** Capture droid's baseline search performance
**Commands:**
```bash
# Run full dataset with isolated sessions
./scripts/capture-parallel.sh \
  eval/prompts-search.jsonl \
  eval/results-baseline.jsonl \
  8  # 8 parallel sessions

# Generate summary
bunx @plaited/acp-harness summarize \
  eval/results-baseline.jsonl \
  -o eval/summary-baseline.md \
  --markdown
```

#### Task 4.2: Test with MCP server (future)
**Purpose:** Compare built-in search vs MCP search provider
**Commands:**
```bash
# With MCP server (when available)
./scripts/capture-parallel.sh \
  eval/prompts-search.jsonl \
  eval/results-mcp.jsonl \
  8

# Compare toolUseId patterns
cat eval/results-baseline.jsonl | jq '.trajectory[] | select(.type == "tool_result") | .toolUseId' | sort | uniq
cat eval/results-mcp.jsonl | jq '.trajectory[] | select(.type == "tool_result") | .toolUseId' | sort | uniq
```

#### Task 4.3: Create evaluation report
**File:** `eval/EVALUATION-REPORT.md` (NEW)
**Sections:**
```markdown
# Droid Search Evaluation Report

## Executive Summary
- Total prompts evaluated: X
- Successful searches: Y
- Average response time: Z seconds
- Tool usage: N tool calls

## Methodology
- Dataset: 1,254 real user search queries
- Prompt format: "Search the web for: {query}"
- Session mode: Isolated (fresh session per prompt)
- Adapter: droid-acp v0.0.1

## Key Findings

### Search Quality
- [Analysis of search result quality]

### Performance
- [Response time distribution]
- [Session creation overhead]

### Tool Usage
- [Built-in vs MCP comparison]
- [Tool error rates]

### Droid Limitations
- [Session bug details]
- [Tool visibility limitations]

## Recommendations
- [Improvements for droid CLI]
- [Evaluation methodology suggestions]

## Appendix
- Raw data: eval/results-baseline.jsonl
- Summary: eval/summary-baseline.md
- Comparison: eval/comparison-report.md
```

### Phase 5: Integration with Harness v0.4.0 (Post-Update)

#### Task 5.1: Test with updated harness
**When:** After acp-harness v0.4.0 released
**Commands:**
```bash
# Test default behavior (should work correctly now)
bunx @plaited/acp-harness@latest capture \
  eval/prompts-search.jsonl \
  bun src/main.ts \
  -o eval/results-harness-v0.4.jsonl \
  --progress

# Validate no empty outputs
cat eval/results-harness-v0.4.jsonl | \
  jq -e 'select(.output == "") | .id' && \
  echo "ERROR: Found empty outputs" || echo "✓ Fixed!"
```

#### Task 5.2: Deprecate workaround scripts
**Update:** Add deprecation notice to scripts
```bash
#!/usr/bin/env bash
# scripts/capture-isolated.sh - DEPRECATED
# This script is no longer needed with acp-harness v0.4.0+

echo "WARNING: This workaround is deprecated." >&2
echo "Use acp-harness v0.4.0+ which fixes session isolation." >&2
echo "Command: bunx @plaited/acp-harness capture ..." >&2
echo "" >&2
echo "Continuing with legacy behavior..." >&2

# ... rest of script
```

#### Task 5.3: Update documentation
**Files:**
- README.md - Remove workaround section, add harness version requirement
- DROID-ISSUES.md - Add "RESOLVED in harness v0.4.0" note
- test-adapter.sh - Update comments

---

## File Structure After Completion

```
acp-evals/
├── eval/
│   ├── data.jsonl                    # Original dataset (1,995 entries)
│   ├── prompts.jsonl                 # WebSearch prompts (1,254)
│   ├── prompts-test.jsonl            # Test subset (5)
│   ├── prompts-search.jsonl          # NEW: Search-optimized full set
│   ├── prompts-search-test.jsonl     # Search-optimized test set
│   ├── conversations.jsonl           # NEW: Multi-turn test cases
│   ├── results-baseline.jsonl        # Full evaluation results
│   ├── results-isolated-test.jsonl   # Validation results
│   ├── comparison-report.md          # NEW: Session mode comparison
│   └── EVALUATION-REPORT.md          # NEW: Full evaluation writeup
│
├── scripts/                          # NEW directory
│   ├── capture-isolated.sh           # Sequential workaround
│   ├── capture-parallel.sh           # Parallel workaround
│   └── analyze-dataset.sh            # Dataset statistics
│
├── dev/                              # Debug scripts (existing)
│   ├── README.md
│   ├── test-adapter.sh
│   ├── test-droid-direct.sh
│   └── test-droid-tool-use.sh
│
├── src/                              # Adapter code (existing)
│   ├── main.ts
│   ├── agent.ts                      # ✅ Race condition fixed
│   ├── droid-adapter.ts
│   ├── types.ts
│   └── utils.ts
│
├── DROID-ISSUES.md                   # ✅ Bug documentation
├── PLAN-ACP-HARNESS.md               # ✅ Upstream plan
├── PLAN-DROID-EVALS.md               # ✅ This file
├── README.md                         # Update with workarounds
├── AGENTS.md                         # Agent instructions
└── CLAUDE.md                         # Project context
```

---

## Success Criteria

### Week 1
- [x] Document droid bug thoroughly
- [ ] Create and test workaround scripts
- [ ] Generate search-optimized dataset
- [ ] Run validation tests (10-prompt sample)

### Week 2
- [ ] Run full baseline evaluation (1,254 prompts)
- [ ] Generate evaluation report
- [ ] Compare session modes
- [ ] Document findings

### Post-Harness Update
- [ ] Validate fix in harness v0.4.0
- [ ] Deprecate workarounds
- [ ] Update documentation

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Empty outputs | 0% | With workaround/fix |
| Search success rate | >90% | Actually executes WebSearch |
| Avg response time | 5-20s | Per prompt |
| Session overhead | <3s | Per prompt |
| Parallel throughput | 4-8x | vs sequential |

---

## Dependencies

### External
- @plaited/acp-harness - Current v0.3.x, need v0.4.0 for permanent fix
- droid CLI - No changes needed, bug is documented
- Bun - Current version sufficient

### Internal
- Adapter race condition fix - ✅ DONE
- Bug documentation - ✅ DONE
- Workaround scripts - TODO

---

## Risk Mitigation

### Risk 1: Workarounds too slow
**Impact:** Full dataset takes too long
**Mitigation:** Use parallel workaround (4-8x speedup)

### Risk 2: Search prompts still don't work
**Impact:** Results still empty despite isolation
**Mitigation:** Already validated with test-2.jsonl, prefix works

### Risk 3: Harness update delayed
**Impact:** Stuck with workarounds longer
**Mitigation:** Workarounds are production-ready, can use indefinitely

---

## Testing Checklist

### Adapter
- [x] Race condition fix tested
- [ ] Rapid prompt sequence test added
- [ ] Integration test with fresh sessions

### Workarounds
- [ ] Sequential script tested (10 prompts)
- [ ] Parallel script tested (10 prompts)
- [ ] Full dataset run completed

### Datasets
- [ ] Search-optimized prompts created
- [ ] Conversation format created
- [ ] Dataset analysis run

### Documentation
- [ ] README updated with workarounds
- [ ] DROID-ISSUES.md completed
- [ ] Evaluation report template created

---

## Future Work

### Droid Improvements (Report to Factory)
1. Fix session bug (prompts execute out of order)
2. Expose tool_use_started notifications (parity with Claude)
3. Add explicit session cleanup method

### Evaluation Extensions
1. Add grader for search quality
2. Compare against Claude Code search
3. Test with different MCP servers (You.com, Brave, etc.)
4. Multi-turn conversation evaluations

### Adapter Enhancements
1. Add streaming text support
2. Improve error handling
3. Add telemetry/metrics
4. Support droid's reasoning modes

---

## Commands Reference

```bash
# Run validation test (10 prompts)
head -10 eval/prompts-search.jsonl > eval/test-10.jsonl
./scripts/capture-isolated.sh eval/test-10.jsonl eval/results-test.jsonl

# Run full evaluation (parallel)
./scripts/capture-parallel.sh eval/prompts-search.jsonl eval/results-full.jsonl 8

# Analyze results
bunx @plaited/acp-harness summarize eval/results-full.jsonl --markdown -o eval/summary.md

# Count successful searches
cat eval/results-full.jsonl | jq -s 'map(select(.output != "")) | length'

# Check tool usage
cat eval/results-full.jsonl | jq '[.trajectory[] | select(.type == "tool_result")] | length'

# Dataset statistics
./scripts/analyze-dataset.sh eval/prompts-search.jsonl
```

---

## Questions for Review

1. **Workaround approach:** Sequential + parallel scripts sufficient?
2. **Dataset naming:** `prompts-search.jsonl` vs `prompts-optimized.jsonl`?
3. **Evaluation scope:** Just search or expand to other tools?
4. **MCP testing:** Wait for harness v0.4.0 or test now with workarounds?
5. **Report format:** Markdown sufficient or need Jupyter notebook?

---

## Timeline Summary

**Week 1:**
- Days 1-2: Documentation + workaround scripts
- Days 3-4: Dataset improvements + validation
- Day 5: Testing and refinement

**Week 2:**
- Days 1-2: Full evaluation runs
- Days 3-4: Analysis and reporting
- Day 5: Documentation updates

**Post-update:**
- Test harness v0.4.0 fix
- Deprecate workarounds
- Final report updates
