# Agent Schemas

ACP headless adapter schemas for evaluating agents.

| Schema | Agent | Mode | Source | Status |
|--------|-------|------|--------|--------|
| claude-code.json | Claude Code | stream | [acp-adapters](../.claude/skills/acp-adapters@plaited_acp-harness/schemas/claude-headless.json) | ✅ Updated (wildcard paths for tool capture) |
| gemini.json | Gemini CLI | iterative | [acp-adapters](../.claude/skills/acp-adapters@plaited_acp-harness/schemas/gemini-headless.json) | ✅ Tested |
| droid.json | Droid CLI | stream | Created for playoffs | ✅ Tested |
| codex.json | Codex CLI | stream | Created for playoffs | 🔄 Updated (added --skip-git-repo-check) |

**Session Modes:**
- **stream**: Process stays alive, multi-turn conversations via stdin
- **iterative**: New process per turn, history passed as context

## Testing Schemas

Validate schemas with acp-harness:

```bash
# Test Claude Code schema
bunx @plaited/acp-harness adapter:check bunx @plaited/acp-harness headless --schema agent-schemas/claude-code.json

# Test Gemini schema
GEMINI_API_KEY=... bunx @plaited/acp-harness adapter:check bunx @plaited/acp-harness headless --schema agent-schemas/gemini.json

# Test Droid schema
FACTORY_API_KEY=... bunx @plaited/acp-harness adapter:check bunx @plaited/acp-harness headless --schema agent-schemas/droid.json

# Test Codex schema
OPENAI_API_KEY=... bunx @plaited/acp-harness adapter:check bunx @plaited/acp-harness headless --schema agent-schemas/codex.json
```
