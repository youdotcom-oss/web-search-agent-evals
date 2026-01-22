# MCP Prompt Format Variant Analysis

## Test Setup

Tested 3 XML attribute formats with Claude Code + You.com MCP to determine which triggers MCP usage most reliably.

**Test Variants:**
1. **v1**: `<web-search tool="ydc-server">query</web-search>`
2. **v2**: `<web-search mcp-server="ydc-server">query</web-search>`
3. **v3**: `<web-search>Use the ydc-server MCP tool to find: query</web-search>`

**Test Method:**
- 3 prompts per variant (weather, Claude API features, pricing comparison)
- Claude Code with --mcp-config flag pointing to ydc-server
- 90s timeout per prompt

## Results

### Success Rates
| Variant | Success | Avg Time | MCP Usage |
|---------|---------|----------|-----------|
| v1 (tool=) | 3/3 (100%) | 38s | Yes ✓ |
| v2 (mcp-server=) | 3/3 (100%) | 23s | Yes ✓ |
| v3 (natural) | 3/3 (100%) | 42s | Yes ✓ |

**All 3 variants successfully triggered MCP usage!**

### MCP Indicators Found

Checked outputs for MCP-specific content (sources with URLs):

**v1 output example:**
```
Sources:
- [Yahoo Weather - San Francisco](https://weather.yahoo.com/us/ca/san-francisco)
- [Weather.com - San Francisco 10-Day Forecast](https://weather.com/weather/tenday/l/San+Francisco+CA+USCA0987:1:US)
```

✅ All variants produced outputs with source URLs (MCP web search)

### Performance

| Variant | Prompt 1 | Prompt 2 | Prompt 3 | Total Time |
|---------|----------|----------|----------|------------|
| v1 | 20.5s | 43.3s | 50.9s | 114.7s |
| v2 | 17.6s | 22.2s | 30.6s | 70.4s |
| v3 | 17.3s | 40.2s | 67.9s | 125.4s |

**Winner: v2 (mcp-server=) - Fastest overall**

## Conclusion

**Recommended Format: `<web-search mcp-server="ydc-server">query</web-search>`**

**Reasons:**
1. ✅ 100% success rate (3/3 prompts)
2. ⚡ Fastest average time (23s vs 38s/42s)
3. 🎯 Explicit about MCP usage (clearer than "tool=")
4. 📝 More semantic (mcp-server vs generic tool)

**All 3 formats work**, but `mcp-server="ydc-server"` is most efficient and semantically clear.

## Alternative: POML

Investigated POML (Prompt Orchestration Markup Language) from Microsoft as alternative syntax.

**Finding:** POML is a **prompt structuring language**, not a tool invocation protocol. It's designed for organizing prompt templates with components like `<role>`, `<task>`, `<example>`, not for triggering runtime tool calls in agents.

**Verdict:** XML-style `<web-search>` tags remain the best approach for trigger-based prompts. POML is more suitable for complex multi-part prompt engineering, not evaluation harnesses.
