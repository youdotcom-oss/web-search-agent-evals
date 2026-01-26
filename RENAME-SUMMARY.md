# Project Rename Summary

## Changes Made

Renamed the project from "agentic-web-search-playoffs" (aka "playoffs") to **"web-search-agent-evals"** following the `{task}-agent-evals` naming convention.

### Why This Naming Convention?

Following the pattern: `{task}-agent-evals`

**Benefits:**
- ✅ **Scales perfectly** - Works for any task domain (coding, reasoning, tool-use, etc.)
- ✅ **Self-documenting** - Clear what's being evaluated
- ✅ **Groups logically** - All end in `-agent-evals`, easy to find
- ✅ **Flexible graders** - Doesn't lock you into specific grading methods
- ✅ **Professional** - Standard naming in ML/AI evaluation space

**Future projects can follow the same pattern:**
- `coding-agent-evals/` - Coding task evaluations
- `reasoning-agent-evals/` - Reasoning benchmarks
- `tool-use-agent-evals/` - Tool usage evaluations
- `multimodal-agent-evals/` - Multimodal capabilities

## Files Updated

### 1. Skill Renamed
```
.claude/skills/playoffs/ → .claude/skills/web-search-agent-evals/
```

**Changes in SKILL.md:**
- Frontmatter `name: playoffs` → `name: web-search-agent-evals`
- Frontmatter `description` updated to reference web search evaluations
- Title changed from "Playoffs" to "Web Search Agent Evaluations"

**Validation:** ✅ Passed `bunx @plaited/development-skills validate-skill`

### 2. README.md

- Title: "Agentic Web Search Playoffs" → "Web Search Agent Evaluations"
- Description updated to remove "playoffs" terminology
- All skill references updated from `playoffs` to `web-search-agent-evals`

### 3. notebooks/summary.ipynb

- Title updated in cell-0
- GitHub URLs updated: `agentic-web-search-playoffs` → `web-search-agent-evals`
- Colab repository references updated in cell-2

### 4. package.json

- No changes needed (no `name` field present)

## Files NOT Changed

- `AGENTS.md` - Generic rules reference, no project-specific naming
- `CLAUDE.md` - Just references AGENTS.md
- `.plaited/rules/*` - Generic development rules

## Verification

```bash
# Validate skill structure
bunx @plaited/development-skills validate-skill .claude/skills/web-search-agent-evals
# ✅ 1/1 skills valid

# Check git status
git status
# Shows renamed skill and updated documentation
```

## Next Steps

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "refactor: rename project to web-search-agent-evals

   - Rename skill from playoffs to web-search-agent-evals
   - Update README and notebook references
   - Follow {task}-agent-evals naming convention for future scalability"
   ```

2. **Update repository settings** (if applicable):
   - Repository name on GitHub
   - Repository description
   - Topics/tags

3. **Future projects:** Use the same `{task}-agent-evals` pattern for consistency

## Migration Path Example

```
Current:
  web-search-agent-evals/

Future:
  coding-agent-evals/      # Coding task evals with unit test grader
  reasoning-agent-evals/   # Reasoning benchmarks with LLM grader
  tool-use-agent-evals/    # Tool usage capabilities
```

Each would follow the same structure:
- Docker-based execution
- Headless adapters for agents
- Type-safe scripts
- Versioned results
- Comparison tooling
