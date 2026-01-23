#!/usr/bin/env bash
set -e

AGENT=$1
OUTPUT_DIR=${2:-/tmp}

if [ -z "$AGENT" ]; then
  echo "Usage: $0 <agent> [output-dir]"
  echo ""
  echo "Supported agents:"
  echo "  claude-code - Claude Code CLI with MCP"
  echo "  codex       - Codex CLI with MCP"
  exit 1
fi

# Test query that will definitely trigger MCP (You.com search)
QUERY="What is the weather in San Francisco?"

echo "Running $AGENT with MCP query..."
echo "Query: $QUERY"
echo ""

case "$AGENT" in
  claude-code)
    echo "Using Claude Code with --output-format stream-json..."
    echo "$QUERY" | claude -p --output-format stream-json --verbose --dangerously-skip-permissions 2>&1 | \
      tee "${OUTPUT_DIR}/claude-code-raw.jsonl"
    ;;
  codex)
    echo "Using Codex with --json..."
    codex exec --json --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox \
      "$QUERY" 2>&1 | \
      tee "${OUTPUT_DIR}/codex-raw.jsonl"
    ;;
  *)
    echo "Unknown agent: $AGENT"
    echo "Supported: claude-code, codex"
    exit 1
    ;;
esac

echo ""
echo "=================================================="
echo "Raw output saved to: ${OUTPUT_DIR}/${AGENT}-raw.jsonl"
echo "=================================================="
echo ""
echo "To analyze, use jq:"
echo "  # View formatted output"
echo "  cat ${OUTPUT_DIR}/${AGENT}-raw.jsonl | jq '.'"
echo ""
echo "  # Find all event types"
echo "  cat ${OUTPUT_DIR}/${AGENT}-raw.jsonl | jq '.type' | sort -u"
echo ""
echo "  # Search for tool names"
echo "  cat ${OUTPUT_DIR}/${AGENT}-raw.jsonl | jq '.name'"
echo ""
echo "  # Search for MCP server references"
echo "  cat ${OUTPUT_DIR}/${AGENT}-raw.jsonl | jq 'select(. | tostring | contains(\"ydc\"))'"
