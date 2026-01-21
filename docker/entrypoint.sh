#!/usr/bin/env bash
set -euo pipefail

# Configure Codex CLI if this is a Codex container
if [ "${AGENT:-}" = "codex" ] && [ -n "${OPENAI_API_KEY:-}" ]; then
  echo "Configuring Codex CLI with API key..."
  echo "${OPENAI_API_KEY}" | codex login --with-api-key
  echo "✓ Codex CLI configured"
fi

# Generate MCP config if MCP_TOOL is set and not "builtin"
if [ -n "${MCP_TOOL:-}" ] && [ "$MCP_TOOL" != "builtin" ]; then
  echo "Generating MCP config for ${AGENT} with tool ${MCP_TOOL}..."
  bun /eval/scripts/generate-mcp-config.ts \
    --agent "${AGENT}" \
    --tool "${MCP_TOOL}" \
    --cwd /workspace
  echo "✓ MCP config generated"
fi

# Execute the command passed to the container
exec "$@"
