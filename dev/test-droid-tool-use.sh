#!/bin/bash

export FACTORY_API_KEY=$(grep FACTORY_API_KEY .env | cut -d= -f2)

(
  echo '{"jsonrpc":"2.0","factoryApiVersion":"1.0.0","type":"request","method":"droid.initialize_session","params":{"machineId":"test","cwd":"/Users/edward/Workspace/acp-evals"},"id":"1"}'
  sleep 2
  echo '{"jsonrpc":"2.0","factoryApiVersion":"1.0.0","type":"request","method":"droid.add_user_message","params":{"text":"Search the web for the current stock price of Tesla"},"id":"2"}'
  sleep 30
) | droid exec --input-format stream-jsonrpc --output-format stream-jsonrpc --auto medium --cwd /Users/edward/Workspace/acp-evals 2>&1 | jq -c 'select(.type == "notification") | {method, notification_type: .params.notification.type}'
