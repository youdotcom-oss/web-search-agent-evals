#!/usr/bin/env bash
set -euo pipefail

#
# Full Workflow Runner - Agentic Web Search Playoffs
#
# Runs all 4 agents (Claude Code, Gemini, Droid, Codex) with both
# builtin and MCP (You.com) tools against the full prompt set (1,254 prompts).
#
# Total runs: 4 agents × 2 tools = 8 evaluation runs
# Estimated time: ~24-32 hours (see below for breakdown)
#

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check that docker-compose.yml uses full prompts
echo -e "${YELLOW}Checking docker-compose.yml configuration...${NC}"
if ! grep -q "/eval/data/prompts/full.jsonl" docker-compose.yml; then
  echo -e "${RED}Error: docker-compose.yml not configured for full prompts${NC}"
  echo ""
  echo "Please update docker-compose.yml to use full prompt sets:"
  echo "  - Replace test.jsonl with full.jsonl (builtin services)"
  echo "  - Replace test-mcp.jsonl with full-mcp.jsonl (MCP services)"
  echo ""
  echo "Run this command to update:"
  echo "  sed -i.bak 's|/eval/data/prompts/test.jsonl|/eval/data/prompts/full.jsonl|g' docker-compose.yml"
  echo "  sed -i.bak 's|/eval/data/prompts/test-mcp.jsonl|/eval/data/prompts/full-mcp.jsonl|g' docker-compose.yml"
  exit 1
fi

echo -e "${GREEN}✓ Configuration looks good${NC}"
echo ""

# Time estimates (based on 5-prompt test extrapolation)
# Test results: ~30s per agent for 5 prompts = 6s per prompt avg
# Full: 1,254 prompts × 6s = 7,524s = ~2.1 hours per agent
# With some overhead and variability: 2-4 hours per agent

cat << EOF
${YELLOW}=================================================================
Full Workflow Execution Plan
=================================================================${NC}

This script will run ${GREEN}8 evaluation runs${NC}:
  - 4 agents: Claude Code, Gemini, Droid, Codex
  - 2 tools per agent: builtin, MCP (You.com)
  - 1,254 prompts per run

${YELLOW}Estimated time per agent:${NC}
  - Claude Code: ~2.5 hours (builtin), ~1.5 hours (MCP, 40% faster)
  - Gemini: ~2 hours (builtin), ~1.2 hours (MCP)
  - Droid: ~2 hours (builtin), ~1.2 hours (MCP)
  - Codex: ~4 hours (builtin), ~2.5 hours (MCP, slower agent)

${YELLOW}Total estimated time: 24-32 hours${NC} (running sequentially)

${YELLOW}API costs estimate:${NC}
  - ~10,000 requests (1,254 prompts × 8 runs)
  - Check your API quota and rate limits
  - Consider running test prompts first to validate

EOF

read -p "Continue with full workflow? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted by user"
  exit 0
fi

echo ""
echo -e "${GREEN}Starting full workflow...${NC}"
echo ""

# Track start time
START_TIME=$(date +%s)

# Create results directory
mkdir -p data/results/{claude-code,gemini,droid,codex}

# Run all builtin evaluations
echo -e "${GREEN}=== Phase 1: Builtin Search Evaluations ===${NC}"
echo ""

echo -e "${YELLOW}Running Claude Code (builtin)...${NC}"
docker compose run --rm claude-code-builtin
echo -e "${GREEN}✓ Claude Code (builtin) complete${NC}"
echo ""

echo -e "${YELLOW}Running Gemini (builtin)...${NC}"
docker compose run --rm gemini-builtin
echo -e "${GREEN}✓ Gemini (builtin) complete${NC}"
echo ""

echo -e "${YELLOW}Running Droid (builtin)...${NC}"
docker compose run --rm droid-builtin
echo -e "${GREEN}✓ Droid (builtin) complete${NC}"
echo ""

echo -e "${YELLOW}Running Codex (builtin)...${NC}"
docker compose run --rm codex-builtin
echo -e "${GREEN}✓ Codex (builtin) complete${NC}"
echo ""

# Run all MCP evaluations
echo -e "${GREEN}=== Phase 2: MCP (You.com) Evaluations ===${NC}"
echo ""

echo -e "${YELLOW}Running Claude Code (MCP)...${NC}"
docker compose run --rm claude-code-you
echo -e "${GREEN}✓ Claude Code (MCP) complete${NC}"
echo ""

echo -e "${YELLOW}Running Gemini (MCP)...${NC}"
docker compose run --rm gemini-you
echo -e "${GREEN}✓ Gemini (MCP) complete${NC}"
echo ""

echo -e "${YELLOW}Running Droid (MCP)...${NC}"
docker compose run --rm droid-you
echo -e "${GREEN}✓ Droid (MCP) complete${NC}"
echo ""

echo -e "${YELLOW}Running Codex (MCP)...${NC}"
docker compose run --rm codex-you
echo -e "${GREEN}✓ Codex (MCP) complete${NC}"
echo ""

# Calculate elapsed time
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
HOURS=$((ELAPSED / 3600))
MINUTES=$(((ELAPSED % 3600) / 60))

echo -e "${GREEN}=================================================================
Full Workflow Complete!
=================================================================${NC}"
echo ""
echo "Total time: ${HOURS}h ${MINUTES}m"
echo ""
echo "Results saved to:"
echo "  data/results/claude-code/{builtin,you}.jsonl"
echo "  data/results/gemini/{builtin,you}.jsonl"
echo "  data/results/droid/{builtin,you}.jsonl"
echo "  data/results/codex/{builtin,you}.jsonl"
echo ""
echo "Next steps:"
echo "  1. Review results: ls -lh data/results/*/*.jsonl"
echo "  2. Compare tools: bun run compare -- -a claude-code --toolA builtin --toolB you"
echo "  3. Generate summaries: bunx @plaited/agent-eval-harness summarize <file>"
echo ""

# Offer to commit and push results
read -p "Commit results to git and push to remote? (yes/no): " commit_results
if [ "$commit_results" = "yes" ]; then
  BRANCH_NAME="results/full-workflow-$(date +%Y%m%d-%H%M%S)"

  echo ""
  echo -e "${YELLOW}Creating branch: ${BRANCH_NAME}${NC}"
  git checkout -b "$BRANCH_NAME"

  echo -e "${YELLOW}Adding results...${NC}"
  git add data/results/

  echo -e "${YELLOW}Committing...${NC}"
  git commit -m "results: full workflow evaluation

Completed full evaluation of 4 agents × 2 tools × 1,254 prompts.

- Runtime: ${HOURS}h ${MINUTES}m
- Agents: Claude Code, Gemini, Droid, Codex
- Tools: builtin, You.com MCP
- Prompts: 1,254 web search queries

Results ready for downstream data science analysis."

  echo -e "${YELLOW}Pushing to remote...${NC}"
  git push -u origin "$BRANCH_NAME"

  echo ""
  echo -e "${GREEN}✓ Results committed and pushed to branch: ${BRANCH_NAME}${NC}"
  echo ""
  echo "Create pull request at:"
  echo "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\).git/\1/')/compare/${BRANCH_NAME}"
fi

echo ""
