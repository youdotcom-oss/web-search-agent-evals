# Grader Calibration Report

Generated: 2026-01-28T22:02:23.757Z
Samples: 3

## Instructions

Review each failure below and mark whether:
- [ ] **Valid failure** - Grader correctly identified a problem
- [ ] **Grader bug** - Output was actually correct, grader was wrong
- [ ] **Ambiguous** - Unclear if the output is correct or not

---

## Sample 1: websearch-1770

**Input:** <web-search mcp-server="ydc-server">Find current information about: baseten training "/mnt/code" file paths directory structure 2026</web-search>

**Output:** <web-search mcp-server="ydc-server">Find current information about: baseten training "/mnt/code" file paths directory structure 2026</web-search>
I am unable to perform the web search as the `you-search` tool execution was denied by policy. Therefore, I cannot find
 current information about "baseten training '/mnt/code' file paths directory structure 2026" at this time.

**Original Score:** FAIL (0.55)
**Reasoning:** Deterministic: 55/70 (quality=20, tools=25, clean=true). LLM: 0/30. Match: 0/15, Evidence: 0/5, Substance: 0/5, Format: 0/5. The result is a system error/policy denial message. It provides no information regarding the query, cites no sources, and lacks any content substance or search result formatting.

**Trajectory Snippet:**
```
[message] <web-search mcp-server="ydc-server">Find current information about: baseten training "/mnt/code" fil...
[tool_call] you-search: pending
[tool_call] you-search-1769637257297-26fd170b600968: completed
[message] I am unable to perform the web search as the `you-search` tool execution was denied by policy. There...
[message]  current information about "baseten training '/mnt/code' file paths directory structure 2026" at thi...
```

**Review:**
- [ ] Valid failure
- [ ] Grader bug
- [ ] Ambiguous

---

## Sample 2: websearch-120

**Input:** <web-search mcp-server="ydc-server">Find current information about: crypto fear greed index today current November 2025</web-search>

**Output:** <web-search mcp-server="ydc-server">Find current information about: crypto fear greed index today current November 2025</web-search>
In November 2025, the crypto market experienced "extreme fear" according to the Crypto Fear & Greed Index. The index dropped to 21/100
 on November 4, 2025, and reached a yearly low of 10 on November 15, 2025. Bitcoin also entered "Daily Extreme Fear" on November 23, 20
25. This period marked the lowest level for the Fear and Greed Index since July 2022.

**Original Score:** FAIL (0.68)
**Reasoning:** Deterministic: 45/70 (quality=20, tools=15, clean=true). LLM: 23/30. Match: 15/15 (Directly addresses the specific date and metric requested). Evidence: 0/5 (No URLs or clickable citations are provided in the result). Substance: 5/5 (Provides highly specific data points including index values and specific dates). Format: 3/5 (Presented as a clear, basic paragraph but lacks advanced structure like lists or bolding).

**Trajectory Snippet:**
```
[message] <web-search mcp-server="ydc-server">Find current information about: crypto fear greed index today cu...
[tool_call] google_web_search: pending
[message] In November 2025, the crypto market experienced "extreme fear" according to the Crypto Fear & Greed ...
[message]  on November 4, 2025, and reached a yearly low of 10 on November 15, 2025. Bitcoin also entered "Dai...
[message] 25. This period marked the lowest level for the Fear and Greed Index since July 2022....
```

**Review:**
- [ ] Valid failure
- [ ] Grader bug
- [ ] Ambiguous

---

## Sample 3: websearch-1063

**Input:** <web-search mcp-server="ydc-server">Find current information about: Az.Storage PowerShell module latest version 2024</web-search>

**Output:** <web-search mcp-server="ydc-server">Find current information about: Az.Storage PowerShell module latest version 2024</web-search>
The latest version of
 the `Az.Storage` PowerShell module released in 2024 is
 8.0.0, updated on November 19, 2024.

**Original Score:** FAIL (0.68)
**Reasoning:** Deterministic: 45/70 (quality=20, tools=15, clean=true). LLM: 23/30. Match: 15/15, Evidence: 0/5, Substance: 5/5, Format: 3/5. The result perfectly answers the query by providing the specific version (8.0.0) and release date (Nov 19, 2024). However, it provides no URLs or source citations, which is a significant omission for a search result evaluation. The content is dense and specific with no fluff, and the format is basic but clear.

**Trajectory Snippet:**
```
[message] <web-search mcp-server="ydc-server">Find current information about: Az.Storage PowerShell module lat...
[tool_call] google_web_search: pending
[message] The latest version of...
[message]  the `Az.Storage` PowerShell module released in 2024 is...
[message]  8.0.0, updated on November 19, 2024....
```

**Review:**
- [ ] Valid failure
- [ ] Grader bug
- [ ] Ambiguous

---
