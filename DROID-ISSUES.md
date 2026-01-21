# Known Droid CLI Issues

## Multiple Prompts in Same Session (Out-of-Order Execution)

**Issue:** When sending multiple prompts to the same droid session via `stream-jsonrpc`, droid processes them out of order:

1. First prompt: Droid immediately sends `completed` notification with no message streaming or tool execution
2. Second prompt: Droid executes the search for the FIRST prompt and streams those results
3. Pattern continues: odd-numbered prompts get skipped, even-numbered prompts get previous results

**Example Debug Output:**

```
# First prompt sent
[droid-acp] prompt: text=Search the web for: landing page strategy...
[droid-acp] Sent message to droid
[droid-acp] Unhandled: session_title_updated
[droid-acp] Notification: completed { stopReason: "end_turn" }  # ← Premature completion!

# Second prompt sent
[droid-acp] prompt: text=Search the web for: document image augmentation...
[droid-acp] Sent message to droid
[droid-acp] Unhandled: tool_result for "landing page strategy"  # ← First prompt's results!
[droid-acp] Notification: message { content: "Here are the search results..." }  # ← First prompt's answer!
```

**Impact:**
- First prompt: Empty output (appears to fail)
- Second prompt: Contains first prompt's results
- Third prompt: Empty output
- Fourth prompt: Contains third prompt's results
- etc.

**Root Cause:**
Droid's internal message queue doesn't properly serialize prompt execution. It sends completion signals before tool execution finishes, then executes tools asynchronously.

**Workarounds:**

1. **Create fresh session per prompt** (RECOMMENDED)
   - Don't reuse sessions across multiple prompts
   - Spawn new droid process for each evaluation
   - Ensures clean state

2. **Add inter-prompt delay**
   - Wait 5-10 seconds between prompts
   - Not reliable - depends on search complexity

3. **Use single-prompt sessions only**
   - Design evaluation harness to spawn fresh process per prompt
   - Higher overhead but guaranteed correct behavior

**Status:** Droid CLI bug - not an adapter issue. Adapter correctly handles droid's notifications, but droid's notifications are out of order.

**Testing:**
```bash
# Reproduce with 2 prompts
source .env && DROID_ACP_DEBUG=1 bunx @plaited/acp-harness capture eval/test-2.jsonl bun src/main.ts -o results.jsonl 2>&1 | grep "Notification:"

# Will show first prompt completes with no messages, second prompt has first prompt's messages
```

**Reported:** 2026-01-20
