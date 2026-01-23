# Skills

## Project Skills

This project uses two types of skills:

1. **Generic skills** (from npm packages) - Universal tools like `agent-eval-harness`, `code-documentation`
2. **Project-specific skills** - Custom skills like `playoffs` that document project-specific workflows

## Documentation Conventions

### Generic Skills

Generic skills (e.g., `agent-eval-harness@plaited_agent-eval-harness`) provide universal functionality:

- **Do not modify** with project-specific information
- Keep documentation generic and reusable
- Reference from project skills as needed

### Project-Specific Skills

Project skills (e.g., `playoffs`) document project-specific workflows and scripts:

- **Always document project scripts** in project skills, not generic skills
- Include usage examples for custom scripts like `bun run trials`
- Keep generic skill references clean and universal

### Example

**Good:**

```markdown
# playoffs skill (project-specific)
### Pass@k Trials
Run multiple trials per prompt:
```bash
bun run trials                    # Project script
bun run trials -- --agent gemini  # Project usage
```

# agent-eval-harness skill (generic)
## Trials Command
Run each prompt multiple times:
```bash
bunx @plaited/agent-eval-harness trials prompts.jsonl ...  # Generic usage
```
```

**Bad:**

```markdown
# agent-eval-harness skill (generic)
### acp-evals Project Scripts  ❌ Don't add project-specific content
```bash
bun run trials  # Wrong - this belongs in playoffs skill
```
```

## Skill Updates

When adding new project functionality:

1. ✅ **Document in project skill** (e.g., `playoffs`)
2. ✅ **Reference generic skills** as needed
3. ❌ **Don't modify generic skills** with project-specific info
4. ✅ **Keep README.md updated** with high-level usage

## Skill Discovery

Users can discover skills via:

```bash
# List available skills
ls .claude/skills/

# Read skill documentation
cat .claude/skills/playoffs/SKILL.md
```

Project skills should reference generic skills in their "Related" sections for discoverability.
