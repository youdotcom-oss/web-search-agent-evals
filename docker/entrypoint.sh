#!/usr/bin/env bash
set -euo pipefail

# Configure Codex CLI if this is a Codex container
if [ "${AGENT:-}" = "codex" ] && [ -n "${OPENAI_API_KEY:-}" ]; then
  echo "Configuring Codex CLI with API key..."
  echo "${OPENAI_API_KEY}" | codex login --with-api-key
  echo "✓ Codex CLI configured"
fi

# Configure MCP if MCP_TOOL is set and not "builtin"
if [ -n "${MCP_TOOL:-}" ] && [ "$MCP_TOOL" != "builtin" ]; then
  echo "Configuring MCP for ${AGENT} with tool ${MCP_TOOL}..."

  case "${AGENT:-}" in
    droid)
      # Droid: droid mcp add <name> <url> --type http [--header "KEY: VALUE"...]
      if [ "${MCP_TOOL}" = "you" ] && [ -n "${YOU_API_KEY:-}" ]; then
        droid mcp add ydc-server https://api.you.com/mcp \
          --type http \
          --header "Authorization: Bearer ${YOU_API_KEY}"
        echo "✓ Droid MCP server added via CLI"
      else
        echo "⚠️  Skipping Droid MCP: missing API key or unsupported tool"
      fi
      ;;
    gemini)
      # Gemini: gemini mcp add --transport http [--header "KEY: VALUE"] <name> <url>
      if [ "${MCP_TOOL}" = "you" ] && [ -n "${YOU_API_KEY:-}" ]; then
        gemini mcp add --transport http \
          --header "Authorization: Bearer ${YOU_API_KEY}" \
          ydc-server https://api.you.com/mcp
        echo "✓ Gemini MCP server added via CLI"
      else
        echo "⚠️  Skipping Gemini MCP: missing API key or unsupported tool"
      fi
      ;;
    claude-code)
      # Claude Code: claude mcp add --transport http <name> <url> [--header "KEY: VALUE"]
      if [ "${MCP_TOOL}" = "you" ] && [ -n "${YOU_API_KEY:-}" ]; then
        claude mcp add --transport http ydc-server https://api.you.com/mcp \
          --header "Authorization: Bearer ${YOU_API_KEY}"
        echo "✓ Claude Code MCP server added via CLI"
      else
        echo "⚠️  Skipping Claude Code MCP: missing API key or unsupported tool"
      fi
      ;;
    codex)
      # Codex: Use config.toml (no simple CLI command for HTTP servers)
      # HTTP servers need: url (required), bearer_token_env_var or http_headers
      if [ "${MCP_TOOL}" = "you" ] && [ -n "${YOU_API_KEY:-}" ]; then
        mkdir -p ~/.codex
        cat > ~/.codex/config.toml <<EOF
[mcp_servers.ydc-server]
url = "https://api.you.com/mcp"
bearer_token_env_var = "YOU_API_KEY"
EOF
        echo "✓ Codex MCP server configured in ~/.codex/config.toml"
      else
        echo "⚠️  Skipping Codex MCP: missing API key or unsupported tool"
      fi
      ;;
    *)
      echo "⚠️  Unknown agent: ${AGENT}"
      ;;
  esac
fi

# Execute the command passed to the container
exec "$@"
