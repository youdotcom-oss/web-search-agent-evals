#!/usr/bin/env bash
set -euo pipefail

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
