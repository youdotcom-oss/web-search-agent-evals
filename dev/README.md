# Development Scripts

Manual testing scripts for debugging the droid ACP adapter.

## Scripts

### test-adapter.sh
Tests the ACP adapter directly with manual JSON-RPC messages.

**Usage:**
```bash
./dev/test-adapter.sh
```

**Tests:**
- `initialize` request
- `session/new` request
- Verifies adapter responds correctly

### test-droid-direct.sh
Tests droid CLI directly (bypassing adapter) with a simple prompt.

**Usage:**
```bash
./dev/test-droid-direct.sh
```

**Tests:**
- `droid.initialize_session`
- `droid.add_user_message` with simple question ("What is 2+2?")
- Shows droid's raw notification format

### test-droid-tool-use.sh
Tests droid with a web search prompt to observe tool notifications.

**Usage:**
```bash
./dev/test-droid-tool-use.sh
```

**Tests:**
- `droid.add_user_message` with search prompt
- Captures all notification types
- Demonstrates tool_result format

## When to Use

- **Adapter broken?** → Run `test-adapter.sh` to isolate adapter vs droid issues
- **Protocol unclear?** → Run `test-droid-direct.sh` to see raw droid responses
- **Tool tracking issues?** → Run `test-droid-tool-use.sh` to see what droid exposes

## Prerequisites

- `FACTORY_API_KEY` set in `.env` file
- `droid` CLI installed (`which droid`)
- Bun runtime available

## See Also

- [../src/agent.ts](../src/agent.ts) - Main ACP agent implementation
- [../src/droid-adapter.ts](../src/droid-adapter.ts) - Droid protocol adapter
