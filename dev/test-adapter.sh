#!/bin/bash

export FACTORY_API_KEY=$(grep FACTORY_API_KEY .env | cut -d= -f2)
export DROID_ACP_DEBUG=1

(
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1}}'
  sleep 1
  echo '{"jsonrpc":"2.0","id":2,"method":"session/new","params":{"cwd":"/Users/edward/Workspace/acp-evals","mcpServers":[]}}'
  sleep 15
) | bun src/main.ts
