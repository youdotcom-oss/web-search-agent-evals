# Grader Calibration Report

Generated: 2026-01-29T06:55:51.904Z
Samples: 2

## Instructions

Review each failure below and mark whether:
- [ ] **Valid failure** - Grader correctly identified a problem
- [ ] **Grader bug** - Output was actually correct, grader was wrong
- [ ] **Ambiguous** - Unclear if the output is correct or not

---

## Sample 1: websearch-1576

**Input:** Use ydc-server and answer"
2026名侦探柯南独眼的残像百度网盘或夸克网盘提取码是多少？

**Output:** Use ydc-server and answer"
2026名侦探柯南独眼的残像百度网盘或夸克网盘提取码是多少？
2026年的《名侦
探柯南：独眼的残像》目前还没有上映，因此没有百度网盘或夸克网盘的
提取码。该系列电影通常在每年的4月份在日本首映，随后才会在其他地区上映或发行
数字版。请您关注官方渠道的上映信息，并通过正版途径观看。

**Original Score:** FAIL (0.56)
**Reasoning:** Deterministic: 35/70 (basic=10, tools=0, clean=25, sources=0). LLM: 21/30. Match: 15/15, Evidence: 0/5, Substance: 4/5, Format: 2/5

**Trajectory Snippet:**
```
[message] Use ydc-server and answer"
2026名侦探柯南独眼的残像百度网盘或夸克网盘提取码是多少？...
[message] 2026年的《名侦...
[message] 探柯南：独眼的残像》目前还没有上映，因此没有百度网盘或夸克网盘的...
[message] 提取码。该系列电影通常在每年的4月份在日本首映，随后才会在其他地区上映或发行...
[message] 数字版。请您关注官方渠道的上映信息，并通过正版途径观看。...
```

**Review:**
- [ ] Valid failure
- [ ] Grader bug
- [ ] Ambiguous

---

## Sample 2: websearch-1302

**Input:** Use ydc-server and answer"
Where can I find the Easy LMS participant API documentation and its GraphQL schema for 2026?

**Output:** Use ydc-server and answer"
Where can I find the Easy LMS participant API documentation and its GraphQL schema for 2026?
I was unable to find specific documentation for an "Easy LMS participant API GraphQL schema" for 202
6 through a web search.

Please refer to the official documentation provided by your Easy LMS vendor, check their developer portal or API section, or contact Easy LMS support directly for this information.

**Original Score:** FAIL (0.64)
**Reasoning:** Deterministic: 50/70 (basic=10, tools=15, clean=25, sources=0). LLM: 14/30. Match: 10/15, Evidence: 0/5, Substance: 1/5, Format: 3/5

**Trajectory Snippet:**
```
[message] Use ydc-server and answer"
Where can I find the Easy LMS participant API documentation and its Graph...
[tool_call] google_web_search: pending
[tool_call] google_web_search-1769669386465-a45b6b5208e72: completed
[message] I was unable to find specific documentation for an "Easy LMS participant API GraphQL schema" for 202...
[message] 6 through a web search.

Please refer to the official documentation provided by your Easy LMS vendor...
```

**Review:**
- [ ] Valid failure
- [ ] Grader bug
- [ ] Ambiguous

---
