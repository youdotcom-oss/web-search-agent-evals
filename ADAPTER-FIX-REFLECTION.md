# Adapter Fix Reflection: Gemini, Droid, Codex

## Summary

Fixed 3 of 4 agents (Gemini, Droid, Codex) using a systematic debugging approach. All three now achieve 80% success rate (4/5 test prompts passing) with tool calls properly captured.

## Time Investment

| Agent | Time | Complexity | Root Cause |
|-------|------|------------|------------|
| **Gemini** | 2+ hours | High | CLI version mismatch (0.1.5 vs 0.25.1) |
| **Droid** | 10 minutes | Low | Schema incomplete (missing tool events) |
| **Codex** | 15 minutes | Medium | Schema incomplete + wrong contentPath |

**Key Insight**: First fix takes longest due to exploration. Once patterns are understood, subsequent fixes are quick.

## Systematic Debugging Process

### Phase 1: Diagnosis (Critical!)

1. **Check CLI version**
   - Container: `docker compose run --rm <agent> <cli> --version`
   - Latest: `npm view <package> version` OR `gh api repos/<org>/<repo>/releases/latest`

2. **Test output format support**
   - `<agent> --help | grep -i "format\|json"`
   - Verify flag exists and check available values

3. **Capture raw CLI output**
   ```bash
   <agent> <flags> "<test prompt>" 2>&1 | tee raw-output.txt
   # Filter to JSON lines
   cat raw-output.txt | grep '^{' | jq '.'
   ```

4. **Analyze event types**
   ```bash
   cat raw-output.txt | grep '^{' | jq '.type + " " + (.item.type // .message.type // "")' | sort | uniq
   ```

### Phase 2: Schema Update

1. **Add tool event mappings**
   - Identify: How are tool calls represented?
   - Match: What JSONPath filters for tool events?
   - Extract: What fields to capture (title, status)?

2. **Verify result section**
   - Does result event contain message content?
   - If not, use `contentPath: "$"` to collect from message events

3. **Check for multiple field matching needs**
   - Can't do `{type: X, item.type: Y}` - use nested path like `$.item.type`

### Phase 3: Testing

1. **Rebuild Docker image**
   ```bash
   docker build --no-cache -t <agent> -f docker/<agent>.Dockerfile .
   ```

2. **Test with Docker Compose**
   ```bash
   docker compose run --rm <agent>-builtin
   ```

3. **Verify tool capture**
   ```bash
   cat data/results/<agent>/builtin-test.jsonl | jq '{id, toolCount: (.trajectory | map(select(.type == "tool_call")) | length)}'
   ```

## Common Patterns Discovered

### 1. Tool Event Formats

| Agent | Pending Event | Completed Event | Name Source | Status Source |
|-------|---------------|-----------------|-------------|---------------|
| **Claude Code** | `message.content[*].type=tool_use` | `message.content[*].type=tool_result` | `$.name` | Hardcoded |
| **Gemini** | `type=tool_use` | `type=tool_result` | `$.tool_name` | Hardcoded |
| **Droid** | `type=tool_call` | `type=tool_result` | `$.toolName` | Hardcoded |
| **Codex** | `item.type=command_execution` | `item.type=command_execution` | `$.item.id` | `$.item.status` ✨ |

**Innovation**: Codex is the only adapter extracting dynamic status from events.

### 2. Result Content Location

| Agent | Signal Event | Contains Content? | ContentPath |
|-------|--------------|-------------------|-------------|
| **Claude Code** | `type=assistant` | ✅ Yes | `$.message.content[0].text` |
| **Gemini** | `type=result` | ✅ Yes | `$.output` |
| **Droid** | `type=completion` | ✅ Yes (finalText) | `$.finalText` |
| **Codex** | `type=turn.completed` | ❌ No (only usage stats) | `$` (use message events) |

**Pattern**: When result event lacks content, set `contentPath: "$"` and rely on collected message events.

### 3. CLI Installation Methods

| Agent | Method | Version Control | Benefits | Considerations |
|-------|--------|----------------|----------|----------------|
| **Gemini** | npm global | Explicit `@latest` | Reproducible, pinnable | Can drift if not pinned |
| **Droid** | curl installer | Always latest | Auto-updates | Less control over version |
| **Codex** | npm global | Explicit `@latest` | Reproducible, pinnable | Can drift if not pinned |

**Recommendation**: For production, pin versions. For eval environment, latest is acceptable.

### 4. Timeout Consistency

| Agent | websearch-6 (Korean SSL) | Timeout Setting | Notes |
|-------|--------------------------|-----------------|-------|
| **Claude Code** | ✅ Pass | 90s | No issues |
| **Gemini** | ⏱️ Timeout | 60s | Resolved with upgrade |
| **Droid** | ⏱️ Timeout | 60s (default) | Prompt complexity |
| **Codex** | ⏱️ Timeout | 180s | Prompt complexity |

**Pattern**: Complex technical questions in non-English may require longer timeouts or multiple tool attempts.

## Success Metrics

### Individual Results

| Agent | Before | After | Fix Type | Time |
|-------|--------|-------|----------|------|
| **Gemini** | 0/5 (0%) | 4/5 (80%) | CLI upgrade + schema | 2h |
| **Droid** | 0/5 (0%) | 4/5 (80%) | Schema only | 10m |
| **Codex** | 0/5 (0%) | 4/5 (80%) | Schema + contentPath | 15m |

### Combined Impact

- **3 agents fixed** in ~2.5 hours total
- **12 passing prompts** (was 0)
- **80% success rate** for all three agents
- **100% tool capture** for passing prompts

## Key Learnings

### 1. Version Checking is Critical

**Gemini Case Study**:
- Symptom: "Unknown arguments: output-format"
- Investigation: 5 minutes to discover CLI version
- Impact: 24 versions behind (0.1.5 vs 0.25.1)
- Resolution: Upgrade CLI, success rate 0% → 80%

**Lesson**: Always check CLI version first. Version mismatches can completely break adapters.

### 2. Schema Incompleteness is Common

**Pattern**: All three agents had schemas that matched their CLI version but were missing tool event mappings.

**Why?**: Schemas may have been created before tool support was added, or tools weren't initially prioritized.

**Detection**: Tool calls shown in raw CLI output but not in trajectory.

### 3. Result Content Varies by CLI Design

**Codex Discovery**: Result event (`turn.completed`) only contains metadata, not content.

**Impact**: Setting contentPath to `$.usage.output_tokens` returned "108" instead of actual response.

**Solution**: Use `contentPath: "$"` to signal harness should use collected message events.

**Lesson**: Don't assume result event contains content. Check raw output first.

### 4. Dynamic Status Extraction is Powerful

**Codex Innovation**: Extract `$.item.status` instead of hardcoding `'pending'` or `'completed'`.

**Benefits**:
- Richer trajectory data
- Can track failed tool calls
- More accurate representation of agent behavior

**Future**: Other adapters could be updated to extract dynamic status if their CLIs provide it.

### 5. Same Prompt, Different Strategies

**Observation**: websearch-7 (Pendlay row tutorial) handled differently by each agent:
- **Claude Code**: Searched and provided results
- **Gemini**: Searched and provided results
- **Droid**: Searched and provided results
- **Codex**: Chose not to search, provided search tips instead

**Insight**: Tool usage is a choice, not a requirement. Agents can decide tools aren't appropriate.

## Failure Patterns

### 1. Korean SSL Question (websearch-6)

**Agents Affected**: Droid (60s), Codex (180s)

**Hypothesis**: Complex technical question in Korean requires:
- More parsing/translation steps
- Multiple search attempts
- More careful result validation

**Not Affected**: Claude Code, Gemini (both passed within timeout)

**Implication**: Some agents may need longer timeouts for complex international queries.

### 2. Gemini MCP Permissions

**Status**: Not yet resolved

**Issue**: Gemini CLI blocking MCP tool execution with "Tool execution denied by policy"

**Next Step**: Investigate `--yolo` flag or permission configuration

**Lesson**: Fixing adapter schema doesn't guarantee MCP works - there may be separate permission systems.

## Recommendations for Future Agent Additions

### 1. Pre-flight Checklist

Before creating a schema:
- [ ] Check CLI version is latest
- [ ] Verify JSON output flag exists
- [ ] Capture raw output for 2-3 test prompts
- [ ] Identify all event types (tool calls, messages, results)
- [ ] Verify result event contains content (or doesn't)

### 2. Schema Validation Steps

After creating schema:
- [ ] Test with single prompt first
- [ ] Verify tool calls are captured (check trajectory)
- [ ] Verify output content is correct (not metadata)
- [ ] Test with multiple prompts
- [ ] Check timeout adequacy for slow agents

### 3. Documentation Requirements

For each fix:
- [ ] Root cause analysis
- [ ] Step-by-step debugging process
- [ ] Before/after comparison
- [ ] Key learnings
- [ ] Commit message with clear problem/solution

### 4. GitHub Issue Template

Include in agent-eval-harness issues:
- [ ] Link to fix documentation
- [ ] Common failure patterns discovered
- [ ] Debugging checklist used
- [ ] Recommendations for schema creation guide updates

## Open Questions

### 1. Tool Name Preservation

**Issue**: Adapter deduplication overwrites tool names with tool IDs
- Pending: `name: "WebSearch"`
- Completed: `name: "toolu_014LCiXQXpXRuVpAxZgLaPsM"`

**Impact**: Makes MCP detection harder (can't check for "you-search" tool name)

**Workaround**: Check for ANY completed tool calls in MCP runs

**Question**: Should harness preserve both name and ID?

### 2. MCP Permission Systems

**Gemini Issue**: Tool execution blocked despite correct config

**Question**: Do all agents have different permission/policy systems for MCP?

**Research Needed**:
- Gemini: `--yolo` flag?
- Droid: `--skip-permissions-unsafe` sufficient?
- Codex: `--dangerously-bypass-approvals-and-sandbox` sufficient?

### 3. Timeout Strategy

**Observation**: Codex takes 2-3x longer than other agents

**Question**: Should timeout be:
- Global per-agent (Codex gets 180s, others get 60s)?
- Per-prompt (complex prompts get longer timeout)?
- Dynamic (adjust based on observed behavior)?

### 4. Status Standardization

**Codex Innovation**: Dynamic status extraction (`in_progress`, `completed`, `failed`)

**Question**: Should other adapters be updated to extract status when available?

**Benefit**: More accurate trajectory representation

**Cost**: Schema updates for all agents

## Next Steps

### Immediate

1. **Document all three fixes** ✅
   - Gemini: GEMINI-FIX-PROCESS.md
   - Droid: DROID-FIX-PROCESS.md
   - Codex: CODEX-FIX-PROCESS.md
   - Reflection: This document

2. **Create GitHub issue** on agent-eval-harness
   - Link to fix documentation
   - Recommend updates to schema creation guide
   - Highlight common failure patterns

### Short-term

3. **Investigate Gemini MCP permissions**
   - Research `--yolo` flag
   - Check MCP config format
   - Test permission variations

4. **Test MCP for Droid and Codex**
   - Apply same systematic approach
   - Document any permission issues
   - Compare MCP success rates

### Medium-term

5. **Update schema creation guide** in agent-eval-harness
   - Add version checking step
   - Add contentPath verification step
   - Add common failure patterns section

6. **Consider dynamic status extraction** for other agents
   - Check if Claude Code, Gemini, Droid provide status in events
   - Update schemas if beneficial
   - Document pattern in guide

### Long-term

7. **Investigate tool name preservation** in harness
   - File issue if not already exists
   - Discuss architectural trade-offs
   - Consider dual-field approach (name + id)

8. **Standardize timeout strategy**
   - Analyze timeout patterns across agents
   - Recommend per-agent or per-prompt timeouts
   - Update documentation

## Conclusion

**Success**: Fixed 3/4 agents using systematic debugging process
**Time**: 2.5 hours total (includes learning time)
**Impact**: 80% success rate for all three agents
**Pattern**: First fix teaches process, subsequent fixes are fast

**Key Insight**: Adapter issues fall into predictable categories:
1. CLI version mismatches
2. Incomplete schema mappings
3. Wrong result content paths
4. Permission/policy configurations

**Value of Documentation**: Detailed fix documentation enables:
- Faster diagnosis for future issues
- Pattern recognition across agents
- Knowledge transfer to other developers
- Continuous improvement of debugging process

**Recommendation**: Always document fixes thoroughly - the time invested pays back quickly when debugging similar issues.
