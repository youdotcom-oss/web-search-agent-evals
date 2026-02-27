# Web Search Agent Evaluation Report
**Generated:** Friday, February 27, 2026 at 4:52 PM
**Prompts:** 151
**Trials per prompt:** 10

---

## Executive Summary

**Best Quality:** droid-you (0.74 avg score)

**Fastest:** droid-you (56.3s median latency)

**Most Reliable:** droid-builtin (32.4% flakiness)

---

## Quality Rankings

| Rank | Agent + Search | Avg Score | Median Score | P25 Score | P75 Score |
|------|----------------|-----------|--------------|-----------|----------|
| 1 | droid-you | 0.74 | 0.84 | 0.47 | 0.99 |
| 2 | gemini-builtin | 0.69 | 0.80 | 0.47 | 0.89 |
| 3 | gemini-you | 0.65 | 0.73 | 0.45 | 0.86 |
| 4 | droid-builtin | 0.63 | 0.47 | 0.47 | 0.90 |
| 5 | codex-you | 0.61 | 0.50 | 0.50 | 0.81 |
| 6 | claude-code-you | 0.54 | 0.80 | 0.08 | 0.93 |
| 7 | claude-code-builtin | 0.44 | 0.10 | 0.10 | 0.94 |
| 8 | codex-builtin | 0.40 | 0.40 | 0.00 | 0.79 |

## Performance Rankings (Latency)

| Rank | Agent + Search | P50 | P90 | P99 | Mean | Total Duration |
|------|----------------|-----|-----|-----|------|----------------|
| 1 | droid-you | 56.3s | 60.0s | 60.0s | 50.3s | 75920.2s |
| 2 | droid-builtin | 60.0s | 60.0s | 60.0s | 53.8s | 81265.0s |
| 3 | codex-builtin | 60.0s | 60.3s | 60.9s | 51.5s | 77710.0s |
| 4 | codex-you | 60.0s | 60.4s | 61.2s | 54.8s | 82775.4s |
| 5 | gemini-builtin | 77.7s | 120.3s | 121.2s | 82.8s | 125097.7s |
| 6 | claude-code-you | 85.1s | 90.2s | 90.9s | 76.2s | 114988.3s |
| 7 | claude-code-builtin | 90.0s | 90.3s | 91.0s | 81.0s | 122354.3s |
| 8 | gemini-you | 93.2s | 120.3s | 121.4s | 90.0s | 135826.3s |

## Capability Metrics (Pass@k)

| Agent + Search | Avg Pass@k | 95% CI | Median Pass@k | P25 Pass@k | P75 Pass@k | Std Dev |
|----------------|------------|--------|---------------|------------|------------|----------|
| gemini-builtin | 87.3% | [82.4%, 92.1%] | 100.0% | 99.4% | 100.0% | 0.3027 |
| gemini-you | 83.9% | [78.7%, 89.1%] | 100.0% | 89.3% | 100.0% | 0.3248 |
| claude-code-you | 82.5% | [76.9%, 88.1%] | 100.0% | 97.2% | 100.0% | 0.3519 |
| droid-you | 76.6% | [70.4%, 82.9%] | 100.0% | 65.1% | 100.0% | 0.3942 |
| codex-builtin | 69.6% | [63.0%, 76.2%] | 97.2% | 65.1% | 100.0% | 0.4142 |
| claude-code-builtin | 62.7% | [55.4%, 70.0%] | 97.2% | 0.0% | 100.0% | 0.4577 |
| droid-builtin | 51.0% | [43.5%, 58.5%] | 65.1% | 0.0% | 100.0% | 0.4724 |
| codex-you | 48.7% | [41.2%, 56.1%] | 65.1% | 0.0% | 99.9% | 0.4661 |

### Pass@k Comparison Chart

```
gemini-builtin            │████████████████████████████████████████████████████        │ 87.3%
                                                                           │────│      [82.4%, 92.1%]

gemini-you                │██████████████████████████████████████████████████          │ 83.9%
                                                                         │────│        [78.7%, 89.1%]

claude-code-you           │██████████████████████████████████████████████████          │ 82.5%
                                                                        │─────│        [76.9%, 88.1%]

droid-you                 │██████████████████████████████████████████████              │ 76.6%
                                                                    │──────│           [70.4%, 82.9%]

codex-builtin             │██████████████████████████████████████████                  │ 69.6%
                                                                │──────│               [63.0%, 76.2%]

claude-code-builtin       │██████████████████████████████████████                      │ 62.7%
                                                           │───────│                   [55.4%, 70.0%]

droid-builtin             │███████████████████████████████                             │ 51.0%
                                                    │───────│                          [43.5%, 58.5%]

codex-you                 │█████████████████████████████                               │ 48.7%
                                                   │───────│                           [41.2%, 56.1%]

                           └────────────────────────────────────────────────────────────┘
                           0%                                                        100%
```

## Flakiness Analysis

| Agent + Search | Avg Flakiness | Median Flakiness | Flaky Prompt Count |
|----------------|---------------|------------------|--------------------|
| droid-builtin | 32.4% | 0.0% | 59 |
| droid-you | 36.2% | 0.0% | 63 |
| codex-you | 37.3% | 0.0% | 68 |
| claude-code-builtin | 45.2% | 65.1% | 79 |
| codex-builtin | 50.8% | 65.1% | 91 |
| claude-code-you | 57.9% | 65.1% | 99 |
| gemini-builtin | 59.4% | 65.1% | 104 |
| gemini-you | 63.6% | 89.3% | 109 |

### Most Flaky Prompts

| Prompt ID | Max Flakiness |
|-----------|---------------|
| websearch-2012 | 99.8% |
| websearch-2019 | 99.8% |
| websearch-2025 | 99.8% |
| websearch-2062 | 99.8% |
| websearch-2067 | 99.8% |
| websearch-2082 | 99.8% |
| websearch-2083 | 99.8% |
| websearch-2087 | 99.8% |
| websearch-2131 | 99.8% |
| websearch-2132 | 99.8% |

## MCP Tool Impact Analysis

> **Caveat:** gemini-you, claude-code-you used built-in search tools instead of MCP (see MCP Adoption Analysis below). Rows marked \* compare prompt phrasing, not MCP tool quality.

| Agent | Quality (builtin → MCP) | Speed (builtin → MCP) | Reliability (builtin → MCP) |
|-------|------------------------|----------------------|----------------------------|
| claude-code (you) \* | ↑ 22.1% | ↑ 5.4% | ↑ 7.1pp |
| gemini (you) \* | ↓ 6.7% | ↓ 19.9% | ↓ 7.5pp |
| droid (you) | ↑ 18.5% | ↑ 6.2% | ↑ 21.9pp |
| codex (you) | ↑ 55.2% | ↓ 0.0% | ↓ 7.4pp |


## Tool Call Statistics

### CODEX

| Metric | Builtin | you | Difference | % Change |
|--------|---------|-----|------------|----------|
| Median (P50) | 0.0 | 12.0 | ↑ 12.0 | 0.0% |
| P90 | 0.0 | 19.0 | ↑ 19.0 | 0.0% |
| P99 | 8.0 | 23.0 | ↑ 15.0 | +187.5% |
| Mean | 0.3 | 11.9 | ↑ 11.6 | +3566.4% |
| Min | 0.0 | 1.0 | ↑ 1.0 | 0.0% |
| Max | 16.0 | 28.0 | ↑ 12.0 | +75.0% |

**Sample size:** 1510 (builtin), 1510 (you)

### GEMINI

| Metric | Builtin | you | Difference | % Change |
|--------|---------|-----|------------|----------|
| Median (P50) | 2.0 | 2.0 | → 0.0 | 0.0% |
| P90 | 4.0 | 7.0 | ↑ 3.0 | +75.0% |
| P99 | 8.9 | 11.0 | ↑ 2.1 | +23.5% |
| Mean | 2.5 | 2.9 | ↑ 0.4 | +16.2% |
| Min | 0.0 | 0.0 | → 0.0 | 0.0% |
| Max | 16.0 | 19.0 | ↑ 3.0 | +18.8% |

**Sample size:** 1510 (builtin), 1510 (you)

### CLAUDE-CODE

| Metric | Builtin | you | Difference | % Change |
|--------|---------|-----|------------|----------|
| Median (P50) | 4.0 | 3.0 | ↓ 1.0 | -25.0% |
| P90 | 8.0 | 7.0 | ↓ 1.0 | -12.5% |
| P99 | 11.0 | 20.9 | ↑ 9.9 | +90.1% |
| Mean | 4.7 | 4.4 | ↓ 0.3 | -7.1% |
| Min | 1.0 | 0.0 | ↓ 1.0 | -100.0% |
| Max | 18.0 | 32.0 | ↑ 14.0 | +77.8% |

**Sample size:** 1510 (builtin), 1510 (you)

### DROID

| Metric | Builtin | you | Difference | % Change |
|--------|---------|-----|------------|----------|
| Median (P50) | 7.0 | 7.0 | → 0.0 | 0.0% |
| P90 | 12.0 | 12.0 | → 0.0 | 0.0% |
| P99 | 15.0 | 17.0 | ↑ 2.0 | +13.3% |
| Mean | 7.6 | 7.3 | ↓ 0.3 | -3.6% |
| Min | 2.0 | 2.0 | → 0.0 | 0.0% |
| Max | 23.0 | 20.0 | ↓ 3.0 | -13.0% |

**Sample size:** 1510 (builtin), 1510 (you)

## Tool Call Distribution

### CODEX

### you Distribution

```
 1 calls | █ 3 (0.2%)
 2 calls | ████████████ 33 (2.2%)
 3 calls | █████████████ 36 (2.4%)
 4 calls | █████████████████ 45 (3.0%)
 5 calls | ██████████████████████ 58 (3.8%)
 6 calls | ████████████████████████████ 74 (4.9%)
 7 calls | ████████████████████████████ 76 (5.0%)
 8 calls | ███████████████████████████████████ 93 (6.2%)
 9 calls | ████████████████████████████████████████ 107 (7.1%)
10 calls | ███████████████████████████████████████ 105 (7.0%)
11 calls | ████████████████████████████████████████ 107 (7.1%)
12 calls | ██████████████████████████████████████ 101 (6.7%)
13 calls | ██████████████████████████████████ 90 (6.0%)
14 calls | ███████████████████████████████ 84 (5.6%)
15 calls | ██████████████████████████████████ 91 (6.0%)
16 calls | ████████████████████████████████████ 96 (6.4%)
17 calls | ████████████████████████████ 75 (5.0%)
18 calls | ████████████████████████ 63 (4.2%)
19 calls | ██████████████████████ 59 (3.9%)
20 calls | ███████████████ 39 (2.6%)
21 calls | ██████████ 28 (1.9%)
22 calls | ████████ 21 (1.4%)
23 calls | ████ 11 (0.7%)
24 calls | ███ 9 (0.6%)
25 calls | █ 2 (0.1%)
26 calls | █ 2 (0.1%)
27 calls |  1 (0.1%)
28 calls |  1 (0.1%)
```
### builtin Distribution

```
 0 calls | ████████████████████████████████████████ 1419 (94.0%)
 1 calls |  11 (0.7%)
 2 calls |  9 (0.6%)
 3 calls |  7 (0.5%)
 4 calls |  13 (0.9%)
 5 calls |  8 (0.5%)
 6 calls |  13 (0.9%)
 7 calls |  6 (0.4%)
 8 calls |  10 (0.7%)
 9 calls |  7 (0.5%)
10 calls |  2 (0.1%)
11 calls |  2 (0.1%)
13 calls |  1 (0.1%)
15 calls |  1 (0.1%)
16 calls |  1 (0.1%)
```
**Key Observations:**

- Zero tool calls: Builtin=1419 (94.0%), you=0 (0.0%)
- Heavy users (5+ calls): Builtin=51 (3.4%), you=1393 (92.3%)

### GEMINI

### you Distribution

```
 0 calls | ███████████ 199 (13.2%)
 1 calls | ██ 38 (2.5%)
 2 calls | ████████████████████████████████████████ 738 (48.9%)
 3 calls | █████████ 160 (10.6%)
 4 calls | ███████ 120 (7.9%)
 5 calls | ███ 53 (3.5%)
 6 calls | ███ 47 (3.1%)
 7 calls | ██ 43 (2.8%)
 8 calls | ██ 43 (2.8%)
 9 calls | ██ 30 (2.0%)
10 calls | █ 16 (1.1%)
11 calls |  9 (0.6%)
12 calls |  8 (0.5%)
13 calls |  3 (0.2%)
14 calls |  1 (0.1%)
15 calls |  1 (0.1%)
19 calls |  1 (0.1%)
```
### builtin Distribution

```
 0 calls | █████████████ 216 (14.3%)
 1 calls | ██ 30 (2.0%)
 2 calls | ████████████████████████████████████████ 678 (44.9%)
 3 calls | █████████████████ 293 (19.4%)
 4 calls | █████████ 157 (10.4%)
 5 calls | ███ 51 (3.4%)
 6 calls | ███ 45 (3.0%)
 7 calls | █ 11 (0.7%)
 8 calls | █ 13 (0.9%)
 9 calls |  4 (0.3%)
10 calls |  6 (0.4%)
11 calls |  4 (0.3%)
12 calls |  1 (0.1%)
16 calls |  1 (0.1%)
```
**Key Observations:**

- Zero tool calls: Builtin=216 (14.3%), you=199 (13.2%)
- Heavy users (5+ calls): Builtin=136 (9.0%), you=255 (16.9%)

### CLAUDE-CODE

### you Distribution

```
 0 calls |  1 (0.1%)
 1 calls |  1 (0.1%)
 2 calls | ████████████████████████████████████████ 476 (31.5%)
 3 calls | ██████████████████████████ 313 (20.7%)
 4 calls | ███████████████ 179 (11.9%)
 5 calls | ████████████████ 190 (12.6%)
 6 calls | █████████ 113 (7.5%)
 7 calls | ███████ 89 (5.9%)
 8 calls | ████ 52 (3.4%)
 9 calls | ██ 29 (1.9%)
10 calls | ██ 18 (1.2%)
11 calls | █ 8 (0.5%)
12 calls |  4 (0.3%)
13 calls |  3 (0.2%)
14 calls |  2 (0.1%)
15 calls |  4 (0.3%)
16 calls |  3 (0.2%)
17 calls |  4 (0.3%)
19 calls |  2 (0.1%)
20 calls |  3 (0.2%)
21 calls |  3 (0.2%)
22 calls |  1 (0.1%)
23 calls |  5 (0.3%)
24 calls |  2 (0.1%)
25 calls |  3 (0.2%)
26 calls |  1 (0.1%)
32 calls |  1 (0.1%)
```
### builtin Distribution

```
 1 calls |  1 (0.1%)
 2 calls | █████ 50 (3.3%)
 3 calls | ████████████████████████████████████████ 431 (28.5%)
 4 calls | ██████████████████████████████████ 366 (24.2%)
 5 calls | ███████████████████████████ 289 (19.1%)
 6 calls | ████████████ 124 (8.2%)
 7 calls | █████████ 94 (6.2%)
 8 calls | ████████ 83 (5.5%)
 9 calls | ████ 44 (2.9%)
10 calls | █ 11 (0.7%)
11 calls | █ 14 (0.9%)
15 calls |  1 (0.1%)
16 calls |  1 (0.1%)
18 calls |  1 (0.1%)
```
**Key Observations:**

- Zero tool calls: Builtin=0 (0.0%), you=1 (0.1%)
- Heavy users (5+ calls): Builtin=662 (43.8%), you=540 (35.8%)

### DROID

### you Distribution

```
 2 calls | ████ 26 (1.7%)
 3 calls | ██████████ 66 (4.4%)
 4 calls | ███████████████████ 127 (8.4%)
 5 calls | ████████████████████████████████████████ 266 (17.6%)
 6 calls | ██████████████████████████████████████ 252 (16.7%)
 7 calls | ███████████████████████████████ 205 (13.6%)
 8 calls | ██████████████████████ 149 (9.9%)
 9 calls | █████████████████ 116 (7.7%)
10 calls | ████████████ 81 (5.4%)
11 calls | ████████ 51 (3.4%)
12 calls | ███████ 48 (3.2%)
13 calls | ██████ 40 (2.6%)
14 calls | ████ 27 (1.8%)
15 calls | ███ 19 (1.3%)
16 calls | ███ 17 (1.1%)
17 calls | █ 9 (0.6%)
18 calls | █ 7 (0.5%)
19 calls |  3 (0.2%)
20 calls |  1 (0.1%)
```
### builtin Distribution

```
 2 calls | ███ 18 (1.2%)
 3 calls | ██████████████████ 117 (7.7%)
 4 calls | ████████████ 79 (5.2%)
 5 calls | █████████████████████████████████ 208 (13.8%)
 6 calls | ████████████████████████████████████████ 256 (17.0%)
 7 calls | ███████████████████████ 150 (9.9%)
 8 calls | ███████████████████████ 147 (9.7%)
 9 calls | ██████████████████ 115 (7.6%)
10 calls | ███████████████████ 120 (7.9%)
11 calls | ████████████████ 104 (6.9%)
12 calls | ██████████████ 92 (6.1%)
13 calls | █████████ 56 (3.7%)
14 calls | ███ 22 (1.5%)
15 calls | ██ 14 (0.9%)
16 calls | █ 5 (0.3%)
17 calls |  3 (0.2%)
18 calls |  2 (0.1%)
22 calls |  1 (0.1%)
23 calls |  1 (0.1%)
```
**Key Observations:**

- Zero tool calls: Builtin=0 (0.0%), you=0 (0.0%)
- Heavy users (5+ calls): Builtin=1296 (85.8%), you=1291 (85.5%)


## Individual Tool Call Latency

### codex — you

| Tool | n | P50 | P90 | P99 | Mean |
|------|---|-----|-----|-----|------|
| item_22 | 5 | 688ms | 1.3s | 1.5s | 657ms |
| you-contents | 7575 | 898ms | 3.9s | 10.8s | 1.8s |
| you-search | 9900 | 570ms | 2.7s | 12.9s | 1.2s |

### codex — builtin

| Tool | n | P50 | P90 | P99 | Mean |
|------|---|-----|-----|-----|------|
| item_12 | 7 | 739ms | 2.0s | 2.0s | 978ms |
| item_13 | 5 | 604ms | 1.1s | 1.4s | 571ms |
| item_14 | 10 | 435ms | 2.2s | 2.8s | 891ms |
| item_15 | 6 | 602ms | 6.0s | 9.8s | 2.2s |
| item_16 | 7 | 403ms | 4.4s | 6.8s | 1.8s |
| item_17 | 7 | 1.8s | 2.3s | 2.6s | 1.4s |
| item_18 | 18 | 500ms | 2.6s | 3.9s | 1.0s |
| item_19 | 10 | 429ms | 3.0s | 6.1s | 1.4s |
| item_20 | 6 | 139ms | 2.2s | 3.5s | 791ms |
| item_21 | 20 | 399ms | 2.3s | 5.9s | 1.1s |
| item_22 | 18 | 326ms | 3.0s | 4.0s | 943ms |
| item_23 | 16 | 297ms | 2.2s | 3.2s | 692ms |
| item_24 | 13 | 54ms | 3.6s | 5.9s | 1.0s |
| item_25 | 19 | 364ms | 1.5s | 3.0s | 696ms |
| item_26 | 18 | 211ms | 1.7s | 4.3s | 726ms |
| item_27 | 15 | 431ms | 1.7s | 5.0s | 896ms |
| item_28 | 17 | 631ms | 2.2s | 4.9s | 940ms |
| item_29 | 19 | 133ms | 892ms | 2.5s | 437ms |
| item_30 | 14 | 654ms | 2.0s | 2.9s | 797ms |
| item_31 | 11 | 341ms | 1.9s | 3.2s | 776ms |
| item_32 | 9 | 250ms | 1.6s | 1.6s | 593ms |
| item_33 | 10 | 426ms | 2.0s | 2.6s | 810ms |
| item_34 | 6 | 349ms | 730ms | 753ms | 401ms |
| item_35 | 6 | 137ms | 525ms | 715ms | 238ms |
| item_36 | 5 | 55ms | 246ms | 355ms | 118ms |
| item_38 | 6 | 54ms | 885ms | 1.6s | 330ms |
| item_39 | 6 | 102ms | 1.1s | 1.8s | 412ms |

### gemini — you

| Tool | n | P50 | P90 | P99 | Mean |
|------|---|-----|-----|-----|------|
| cli_help | 122 | 47.6s | 63.6s | 70.0s | 50.4s |
| codebase_investigator | 7 | 32.8s | 41.6s | 45.7s | 33.4s |
| glob | 11 | 557ms | 663ms | 892ms | 502ms |
| google_web_search | 1269 | 16.4s | 26.3s | 60.4s | 18.4s |
| grep_search | 14 | 707ms | 925ms | 35.5s | 3.5s |
| list_directory | 142 | 486ms | 770ms | 1.3s | 480ms |
| run_shell_command | 150 | 411ms | 669ms | 7.3s | 558ms |

### gemini — builtin

| Tool | n | P50 | P90 | P99 | Mean |
|------|---|-----|-----|-----|------|
| google_web_search | 1264 | 16.6s | 31.4s | 75.1s | 19.8s |
| grep_search | 5 | 691ms | 819ms | 830ms | 681ms |
| list_directory | 23 | 566ms | 763ms | 1.0s | 501ms |
| run_shell_command | 35 | 307ms | 686ms | 1.6s | 371ms |

### claude-code — you

| Tool | n | P50 | P90 | P99 | Mean |
|------|---|-----|-----|-----|------|
| Bash | 40 | 180ms | 2.0s | 6.2s | 787ms |
| Glob | 8 | 1.1s | 4.1s | 6.2s | 1.9s |
| Read | 95 | 141ms | 764ms | 1.1s | 272ms |
| WebFetch | 445 | 4.5s | 8.7s | 19.4s | 4.9s |
| WebSearch | 1475 | 29.3s | 40.4s | 51.8s | 29.9s |

### claude-code — builtin

| Tool | n | P50 | P90 | P99 | Mean |
|------|---|-----|-----|-----|------|
| Read | 13 | 196ms | 375ms | 501ms | 224ms |
| WebFetch | 480 | 4.5s | 8.1s | 20.6s | 4.8s |
| WebSearch | 1509 | 27.9s | 38.1s | 45.1s | 28.4s |

### droid — you

| Tool | n | P50 | P90 | P99 | Mean |
|------|---|-----|-----|-----|------|
| FetchUrl | 87 | 1.0s | 6.4s | 13.0s | 3.1s |
| Grep | 108 | 17ms | 561ms | 622ms | 116ms |
| Read | 46 | 7ms | 276ms | 635ms | 70ms |
| TodoWrite | 5 | 8.6s | 15.2s | 16.5s | 10.6s |
| WebSearch | 32 | 8.2s | 10.0s | 15.6s | 8.4s |
| ydc-server___you-contents | 853 | 717ms | 1.1s | 10.1s | 1.1s |
| ydc-server___you-search | 1502 | 593ms | 715ms | 1.1s | 629ms |

### droid — builtin

| Tool | n | P50 | P90 | P99 | Mean |
|------|---|-----|-----|-----|------|
| Execute | 16 | 652ms | 8.2s | 8.4s | 3.3s |
| FetchUrl | 727 | 5.1s | 10.0s | 22.6s | 5.2s |
| Grep | 77 | 20ms | 3.9s | 9.2s | 1.1s |
| Read | 30 | 8ms | 4.4s | 10.0s | 1.3s |
| TodoWrite | 13 | 6.6s | 9.6s | 12.9s | 5.9s |
| WebSearch | 1510 | 6.9s | 10.7s | 14.9s | 5.4s |


## MCP Adoption Analysis

_Per-trial classification based on which search tools were actually invoked._

| Agent + Provider | MCP Only | Builtin Only | Both | Neither | Total |
|------------------|----------|--------------|------|---------|-------|
| codex-you | 1510 (100.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 1510 |
| gemini-you | 0 (0.0%) | 1309 (86.7%) | 0 (0.0%) | 201 (13.3%) | 1510 |
| claude-code-you | 0 (0.0%) | 1478 (97.9%) | 0 (0.0%) | 32 (2.1%) | 1510 |
| droid-you | 1478 (97.9%) | 6 (0.4%) | 26 (1.7%) | 0 (0.0%) | 1510 |

### Diagnostic Notes

- **codex-you** (100.0% MCP): Full MCP adoption. Agent reliably uses configured MCP tools.
- **gemini-you** (86.7% builtin): MCP tools never loaded. Gemini runs in iterative mode (new process per prompt) and the MCP server connection is not established for short-lived commands. Trajectory shows the model attempting hallucinated tool names (e.g. `ydc_search`, `ydc_server__web_search`) after failing to discover real MCP tools via `cli_help` and `list_directory`.
- **claude-code-you** (97.9% builtin): MCP server configured but model exclusively prefers its built-in `WebSearch` tool. The prompt "Use ydc-server" is not specific enough to override Claude Code's strong affinity for native tools.
- **droid-you** (99.6% MCP): Full MCP adoption. Agent reliably uses configured MCP tools.

### gemini-you — Prompts Using Builtin Fallback

| Prompt ID | Trials with Builtin | Total Trials | Rate |
|-----------|---------------------|--------------|------|
| websearch-2000 | 10 | 10 | 100.0% |
| websearch-2004 | 10 | 10 | 100.0% |
| websearch-2003 | 10 | 10 | 100.0% |
| websearch-2001 | 10 | 10 | 100.0% |
| websearch-2002 | 10 | 10 | 100.0% |
| websearch-2005 | 10 | 10 | 100.0% |
| websearch-2006 | 10 | 10 | 100.0% |
| websearch-2007 | 10 | 10 | 100.0% |
| websearch-2008 | 10 | 10 | 100.0% |
| websearch-2010 | 10 | 10 | 100.0% |

### claude-code-you — Prompts Using Builtin Fallback

| Prompt ID | Trials with Builtin | Total Trials | Rate |
|-----------|---------------------|--------------|------|
| websearch-2000 | 10 | 10 | 100.0% |
| websearch-2006 | 10 | 10 | 100.0% |
| websearch-2003 | 10 | 10 | 100.0% |
| websearch-2004 | 10 | 10 | 100.0% |
| websearch-2007 | 10 | 10 | 100.0% |
| websearch-2001 | 10 | 10 | 100.0% |
| websearch-2002 | 10 | 10 | 100.0% |
| websearch-2005 | 10 | 10 | 100.0% |
| websearch-2010 | 10 | 10 | 100.0% |
| websearch-2015 | 10 | 10 | 100.0% |

### droid-you — Prompts Using Builtin Fallback

| Prompt ID | Trials with Builtin | Total Trials | Rate |
|-----------|---------------------|--------------|------|
| websearch-2000 | 1 | 10 | 10.0% |
| websearch-2003 | 1 | 10 | 10.0% |
| websearch-2001 | 1 | 10 | 10.0% |
| websearch-2004 | 1 | 10 | 10.0% |
| websearch-2002 | 1 | 10 | 10.0% |
| websearch-2010 | 1 | 10 | 10.0% |
| websearch-2034 | 1 | 10 | 10.0% |
| websearch-2033 | 1 | 10 | 10.0% |
| websearch-2040 | 1 | 10 | 10.0% |
| websearch-2046 | 1 | 10 | 10.0% |


## Failing Prompts (pass@k = 0)

### codex-you

Total: 151 prompts, 70 complete failures, 0 low performers (<50%)

**Complete Failures (pass@k = 0%):**

| Prompt ID | Pass Rate | Pass@k | Pass^k |
|-----------|-----------|--------|--------|
| websearch-2001 | 0.0% | 0.0% | 0.0% |
| websearch-2003 | 0.0% | 0.0% | 0.0% |
| websearch-2004 | 0.0% | 0.0% | 0.0% |
| websearch-2005 | 0.0% | 0.0% | 0.0% |
| websearch-2007 | 0.0% | 0.0% | 0.0% |
| websearch-2008 | 0.0% | 0.0% | 0.0% |
| websearch-2009 | 0.0% | 0.0% | 0.0% |
| websearch-2010 | 0.0% | 0.0% | 0.0% |
| websearch-2011 | 0.0% | 0.0% | 0.0% |
| websearch-2013 | 0.0% | 0.0% | 0.0% |
| websearch-2020 | 0.0% | 0.0% | 0.0% |
| websearch-2023 | 0.0% | 0.0% | 0.0% |
| websearch-2026 | 0.0% | 0.0% | 0.0% |
| websearch-2029 | 0.0% | 0.0% | 0.0% |
| websearch-2030 | 0.0% | 0.0% | 0.0% |
| websearch-2032 | 0.0% | 0.0% | 0.0% |
| websearch-2033 | 0.0% | 0.0% | 0.0% |
| websearch-2039 | 0.0% | 0.0% | 0.0% |
| websearch-2041 | 0.0% | 0.0% | 0.0% |
| websearch-2043 | 0.0% | 0.0% | 0.0% |
| websearch-2046 | 0.0% | 0.0% | 0.0% |
| websearch-2047 | 0.0% | 0.0% | 0.0% |
| websearch-2049 | 0.0% | 0.0% | 0.0% |
| websearch-2050 | 0.0% | 0.0% | 0.0% |
| websearch-2051 | 0.0% | 0.0% | 0.0% |
| websearch-2053 | 0.0% | 0.0% | 0.0% |
| websearch-2054 | 0.0% | 0.0% | 0.0% |
| websearch-2055 | 0.0% | 0.0% | 0.0% |
| websearch-2056 | 0.0% | 0.0% | 0.0% |
| websearch-2058 | 0.0% | 0.0% | 0.0% |
| websearch-2059 | 0.0% | 0.0% | 0.0% |
| websearch-2062 | 0.0% | 0.0% | 0.0% |
| websearch-2065 | 0.0% | 0.0% | 0.0% |
| websearch-2069 | 0.0% | 0.0% | 0.0% |
| websearch-2073 | 0.0% | 0.0% | 0.0% |
| websearch-2079 | 0.0% | 0.0% | 0.0% |
| websearch-2086 | 0.0% | 0.0% | 0.0% |
| websearch-2089 | 0.0% | 0.0% | 0.0% |
| websearch-2090 | 0.0% | 0.0% | 0.0% |
| websearch-2091 | 0.0% | 0.0% | 0.0% |
| websearch-2092 | 0.0% | 0.0% | 0.0% |
| websearch-2093 | 0.0% | 0.0% | 0.0% |
| websearch-2094 | 0.0% | 0.0% | 0.0% |
| websearch-2095 | 0.0% | 0.0% | 0.0% |
| websearch-2096 | 0.0% | 0.0% | 0.0% |
| websearch-2097 | 0.0% | 0.0% | 0.0% |
| websearch-2098 | 0.0% | 0.0% | 0.0% |
| websearch-2099 | 0.0% | 0.0% | 0.0% |
| websearch-2100 | 0.0% | 0.0% | 0.0% |
| websearch-2101 | 0.0% | 0.0% | 0.0% |
| websearch-2104 | 0.0% | 0.0% | 0.0% |
| websearch-2105 | 0.0% | 0.0% | 0.0% |
| websearch-2106 | 0.0% | 0.0% | 0.0% |
| websearch-2111 | 0.0% | 0.0% | 0.0% |
| websearch-2115 | 0.0% | 0.0% | 0.0% |
| websearch-2118 | 0.0% | 0.0% | 0.0% |
| websearch-2119 | 0.0% | 0.0% | 0.0% |
| websearch-2121 | 0.0% | 0.0% | 0.0% |
| websearch-2123 | 0.0% | 0.0% | 0.0% |
| websearch-2124 | 0.0% | 0.0% | 0.0% |
| websearch-2125 | 0.0% | 0.0% | 0.0% |
| websearch-2127 | 0.0% | 0.0% | 0.0% |
| websearch-2131 | 0.0% | 0.0% | 0.0% |
| websearch-2132 | 0.0% | 0.0% | 0.0% |
| websearch-2138 | 0.0% | 0.0% | 0.0% |
| websearch-2142 | 0.0% | 0.0% | 0.0% |
| websearch-2143 | 0.0% | 0.0% | 0.0% |
| websearch-2144 | 0.0% | 0.0% | 0.0% |
| websearch-2146 | 0.0% | 0.0% | 0.0% |
| websearch-2149 | 0.0% | 0.0% | 0.0% |

**Failing Prompt Queries:**

**websearch-2001** (pass@k=0.0%)
> Use web search and answer
How long does it take to become job-ready as a self-taught software engineer, and what does a realistic 12-month timeline look like in 2026?

**websearch-2003** (pass@k=0.0%)
> Use web search and answer
What are the Microsoft AutoGen 2025 multi-agent framework updates, including any merging with Semantic Kernel and durable orchestrator features?

**websearch-2004** (pass@k=0.0%)
> Use web search and answer
What are the AI agent architecture best practices for 2025, including LangGraph multi-agent orchestration and cybersecurity applications?

**websearch-2005** (pass@k=0.0%)
> Use web search and answer
How do I implement a Flutter horizontal scroll number picker with iOS wheel selector style, center highlight, and best practices for 2026?

**websearch-2007** (pass@k=0.0%)
> Use web search and answer
How do I use terraform-aws-modules EKS with access_entries, kubernetes resources, depends_on, and policy_associations in 2026?

**websearch-2008** (pass@k=0.0%)
> Use web search and answer
What are the LLM tool calling architecture best practices for router vs planner-executor patterns in customer support RAG systems in 2026?

**websearch-2009** (pass@k=0.0%)
> Use web search and answer
What are the Terms of Use page requirements for SaaS products including acknowledgement tracking, version history, and compliance considerations for 2025?

**websearch-2010** (pass@k=0.0%)
> Use web search and answer
What are the advanced PDF compression techniques in Apache PDFBox including image downsampling and content stream optimization in 2026?

**websearch-2011** (pass@k=0.0%)
> Use web search and answer
How does AES-GCM dual key encryption work where the same ciphertext decrypts to different plaintexts, and how is this used in CTF challenges in 2026?

**websearch-2013** (pass@k=0.0%)
> Use web search and answer
How does NSPasteboard type priority order work for cross-application compatibility in macOS terminals and browsers in 2026?

**websearch-2020** (pass@k=0.0%)
> Use web search and answer
What lightweight game engines support isometric 2D turn-based RPG development, including Godot and alternatives, in 2026?

**websearch-2023** (pass@k=0.0%)
> Use web search and answer
What are the best practices for production RAG system architecture including monitoring, backup, and disaster recovery in 2026?

**websearch-2026** (pass@k=0.0%)
> Use web search and answer
How do I implement EF Core 9 with SQLite using clean architecture and repository pattern in 2026?

**websearch-2029** (pass@k=0.0%)
> Use web search and answer
What are the common security vulnerabilities and mistakes in AI-generated code including hallucinations and security patterns in 2026?

**websearch-2030** (pass@k=0.0%)
> Use web search and answer
What are the best practices for building an integration marketplace with a credential manager, API key and OAuth onboarding in 2026?

**websearch-2032** (pass@k=0.0%)
> Use web search and answer
How do I implement YouTube API OAuth 2.0 with refresh token security best practices in Node.js in 2026?

**websearch-2033** (pass@k=0.0%)
> Use web search and answer
How do I implement Swift Combine framework WebSocket real-time chat with MVVM architecture and best practices in 2026?

**websearch-2039** (pass@k=0.0%)
> Use web search and answer
What are the 2025 RAG reranking best practices including hybrid search with Reciprocal Rank Fusion for production implementation in 2026?

**websearch-2041** (pass@k=0.0%)
> Use web search and answer
What is the ranking or comparison of Winchester College, Charterhouse, St Paul's School, Westminster School, and Marlborough College in 2026?

**websearch-2043** (pass@k=0.0%)
> Use web search and answer
What does Vietnamese Insurance Business Law 2022 say about insurance enterprise dissolution, bankruptcy, and portfolio transfer in 2026?

### codex-builtin

Total: 151 prompts, 37 complete failures, 0 low performers (<50%)

**Complete Failures (pass@k = 0%):**

| Prompt ID | Pass Rate | Pass@k | Pass^k |
|-----------|-----------|--------|--------|
| websearch-2001 | 0.0% | 0.0% | 0.0% |
| websearch-2004 | 0.0% | 0.0% | 0.0% |
| websearch-2007 | 0.0% | 0.0% | 0.0% |
| websearch-2008 | 0.0% | 0.0% | 0.0% |
| websearch-2009 | 0.0% | 0.0% | 0.0% |
| websearch-2010 | 0.0% | 0.0% | 0.0% |
| websearch-2011 | 0.0% | 0.0% | 0.0% |
| websearch-2013 | 0.0% | 0.0% | 0.0% |
| websearch-2023 | 0.0% | 0.0% | 0.0% |
| websearch-2030 | 0.0% | 0.0% | 0.0% |
| websearch-2033 | 0.0% | 0.0% | 0.0% |
| websearch-2047 | 0.0% | 0.0% | 0.0% |
| websearch-2048 | 0.0% | 0.0% | 0.0% |
| websearch-2049 | 0.0% | 0.0% | 0.0% |
| websearch-2051 | 0.0% | 0.0% | 0.0% |
| websearch-2054 | 0.0% | 0.0% | 0.0% |
| websearch-2056 | 0.0% | 0.0% | 0.0% |
| websearch-2058 | 0.0% | 0.0% | 0.0% |
| websearch-2063 | 0.0% | 0.0% | 0.0% |
| websearch-2074 | 0.0% | 0.0% | 0.0% |
| websearch-2077 | 0.0% | 0.0% | 0.0% |
| websearch-2086 | 0.0% | 0.0% | 0.0% |
| websearch-2089 | 0.0% | 0.0% | 0.0% |
| websearch-2092 | 0.0% | 0.0% | 0.0% |
| websearch-2093 | 0.0% | 0.0% | 0.0% |
| websearch-2094 | 0.0% | 0.0% | 0.0% |
| websearch-2096 | 0.0% | 0.0% | 0.0% |
| websearch-2097 | 0.0% | 0.0% | 0.0% |
| websearch-2098 | 0.0% | 0.0% | 0.0% |
| websearch-2100 | 0.0% | 0.0% | 0.0% |
| websearch-2104 | 0.0% | 0.0% | 0.0% |
| websearch-2117 | 0.0% | 0.0% | 0.0% |
| websearch-2118 | 0.0% | 0.0% | 0.0% |
| websearch-2119 | 0.0% | 0.0% | 0.0% |
| websearch-2120 | 0.0% | 0.0% | 0.0% |
| websearch-2125 | 0.0% | 0.0% | 0.0% |
| websearch-2127 | 0.0% | 0.0% | 0.0% |

**Failing Prompt Queries:**

**websearch-2001** (pass@k=0.0%)
> Use web search and answer
How long does it take to become job-ready as a self-taught software engineer, and what does a realistic 12-month timeline look like in 2026?

**websearch-2004** (pass@k=0.0%)
> Use web search and answer
What are the AI agent architecture best practices for 2025, including LangGraph multi-agent orchestration and cybersecurity applications?

**websearch-2007** (pass@k=0.0%)
> Use web search and answer
How do I use terraform-aws-modules EKS with access_entries, kubernetes resources, depends_on, and policy_associations in 2026?

**websearch-2008** (pass@k=0.0%)
> Use web search and answer
What are the LLM tool calling architecture best practices for router vs planner-executor patterns in customer support RAG systems in 2026?

**websearch-2009** (pass@k=0.0%)
> Use web search and answer
What are the Terms of Use page requirements for SaaS products including acknowledgement tracking, version history, and compliance considerations for 2025?

**websearch-2010** (pass@k=0.0%)
> Use web search and answer
What are the advanced PDF compression techniques in Apache PDFBox including image downsampling and content stream optimization in 2026?

**websearch-2011** (pass@k=0.0%)
> Use web search and answer
How does AES-GCM dual key encryption work where the same ciphertext decrypts to different plaintexts, and how is this used in CTF challenges in 2026?

**websearch-2013** (pass@k=0.0%)
> Use web search and answer
How does NSPasteboard type priority order work for cross-application compatibility in macOS terminals and browsers in 2026?

**websearch-2023** (pass@k=0.0%)
> Use web search and answer
What are the best practices for production RAG system architecture including monitoring, backup, and disaster recovery in 2026?

**websearch-2030** (pass@k=0.0%)
> Use web search and answer
What are the best practices for building an integration marketplace with a credential manager, API key and OAuth onboarding in 2026?

**websearch-2033** (pass@k=0.0%)
> Use web search and answer
How do I implement Swift Combine framework WebSocket real-time chat with MVVM architecture and best practices in 2026?

**websearch-2047** (pass@k=0.0%)
> Use web search and answer
What are the historical precedents for Russian territorial gains of 40–50 km in Ukraine during rapid advances in 2022, 2023, and 2024?

**websearch-2048** (pass@k=0.0%)
> Use web search and answer
What is the Week 11 2025 NFL analysis and betting outlook for the 49ers, Cardinals, Seahawks, Rams, Ravens, Browns, Chiefs, and Broncos in 2026?

**websearch-2049** (pass@k=0.0%)
> Use web search and answer
What are the ACA marketplace health insurance options and prices in Austin, Texas for a single adult in 2025, including HDHP, bronze, and silver plans?

**websearch-2051** (pass@k=0.0%)
> Use web search and answer
What is known about the Arcadia Finance hack in July 2025, including whether the attacker was identified by Chainalysis or Elliptic in 2026?

**websearch-2054** (pass@k=0.0%)
> Use web search and answer
What are the best VPN services for 2024–2025 with a focus on privacy, speed, latency, Brazil servers, and port forwarding support?

**websearch-2056** (pass@k=0.0%)
> Use web search and answer
What are the common reasons for Australian visitor visa (subclass 600) rejections for Indonesian applicants in 2026?

**websearch-2058** (pass@k=0.0%)
> Use web search and answer
Who are Saints Aurelius, Innocent, and Florentina, and what is their connection to the Theban Legion relics in 2026?

**websearch-2063** (pass@k=0.0%)
> Use web search and answer
What is the official GitHub repository URL and available releases or tags for the dYdX v4-clients-rs Rust client library in 2026?

**websearch-2074** (pass@k=0.0%)
> Use web search and answer
What is the difference between the CKAN datastore API and direct resource file download, and what are the authentication requirements in 2026?

### gemini-you

Total: 151 prompts, 18 complete failures, 0 low performers (<50%)

**Complete Failures (pass@k = 0%):**

| Prompt ID | Pass Rate | Pass@k | Pass^k |
|-----------|-----------|--------|--------|
| websearch-2048 | 0.0% | 0.0% | 0.0% |
| websearch-2051 | 0.0% | 0.0% | 0.0% |
| websearch-2055 | 0.0% | 0.0% | 0.0% |
| websearch-2057 | 0.0% | 0.0% | 0.0% |
| websearch-2073 | 0.0% | 0.0% | 0.0% |
| websearch-2076 | 0.0% | 0.0% | 0.0% |
| websearch-2079 | 0.0% | 0.0% | 0.0% |
| websearch-2084 | 0.0% | 0.0% | 0.0% |
| websearch-2085 | 0.0% | 0.0% | 0.0% |
| websearch-2086 | 0.0% | 0.0% | 0.0% |
| websearch-2093 | 0.0% | 0.0% | 0.0% |
| websearch-2096 | 0.0% | 0.0% | 0.0% |
| websearch-2110 | 0.0% | 0.0% | 0.0% |
| websearch-2114 | 0.0% | 0.0% | 0.0% |
| websearch-2125 | 0.0% | 0.0% | 0.0% |
| websearch-2127 | 0.0% | 0.0% | 0.0% |
| websearch-2133 | 0.0% | 0.0% | 0.0% |
| websearch-2134 | 0.0% | 0.0% | 0.0% |

**Failing Prompt Queries:**

**websearch-2048** (pass@k=0.0%)
> Use web search and answer
What is the Week 11 2025 NFL analysis and betting outlook for the 49ers, Cardinals, Seahawks, Rams, Ravens, Browns, Chiefs, and Broncos in 2026?

**websearch-2051** (pass@k=0.0%)
> Use web search and answer
What is known about the Arcadia Finance hack in July 2025, including whether the attacker was identified by Chainalysis or Elliptic in 2026?

**websearch-2055** (pass@k=0.0%)
> Use web search and answer
What has ASML CEO Christophe Fouquet said about the contradiction between US chip export controls on China and ASML's business in interviews in 2026?

**websearch-2057** (pass@k=0.0%)
> Use web search and answer
What is the price of the Express Corner Workstation in 1500, 1600, and 1700mm sizes at Office Stock Australia in 2026?

**websearch-2073** (pass@k=0.0%)
> Use web search and answer
What does the output format look like for grep_search or search_files tool results when matches are found and output is truncated in 2026?

**websearch-2076** (pass@k=0.0%)
> Use web search and answer
What are the best practices for securely storing Shopify Admin API 2025-10 custom app access tokens in 2024?

**websearch-2079** (pass@k=0.0%)
> Use web search and answer
How do I implement Tradovate API WebSocket connection with heartbeat, keepalive, and subscriptions for positions and orders in 2026?

**websearch-2084** (pass@k=0.0%)
> Use web search and answer
What does the 2020 Translational Psychiatry paper DOI 10.1038/s41398-020-00865-8 by Barr PB say about polygenic scores using LDpred versus clumping and thresholding methods in 2026?

**websearch-2085** (pass@k=0.0%)
> Use web search and answer
What does the Ham 2019 Nature paper on deep learning for multi-year ENSO forecasts say about CMIP5, CMIP6, CNN, and transfer learning for 18-month lead times in 2026?

**websearch-2086** (pass@k=0.0%)
> Use web search and answer
What is the size and growth outlook for the US insulation market from 2024 to 2030 across residential and commercial construction segments in 2026?

**websearch-2093** (pass@k=0.0%)
> Use web search and answer
What are the historical precedents for Russian territorial capture rates around Siversk and Donetsk during winter 2025 in the Ukraine war in 2026?

**websearch-2096** (pass@k=0.0%)
> Use web search and answer
What AI document extraction startups received funding in 2024, including emerging competitors to Instabase, Ocrolus, and Eden AI in 2026?

**websearch-2110** (pass@k=0.0%)
> Use web search and answer
How do I use the @anthropic-ai/agent-sdk TypeScript package to create an agent client and run a conversation in 2026?

**websearch-2114** (pass@k=0.0%)
> Use web search and answer
What does the Microsoft Graph API documentation at learn.microsoft.com say about authentication methods overview in 2026?

**websearch-2125** (pass@k=0.0%)
> Use web search and answer
What are the Microsoft Dynamics 365 Business Central CVE vulnerabilities and security advisories from 2024 to 2025 in 2026?

**websearch-2127** (pass@k=0.0%)
> Use web search and answer
What is the compatibility issue between @gluestack-ui/core 3.0.10 and @legendapp/motion 2.4.0 causing toast delay problems in 2026?

**websearch-2133** (pass@k=0.0%)
> Use web search and answer
What are the latest NuGet package versions for Microsoft.EntityFrameworkCore, Azure.Identity, System.Data.SqlClient, and HtmlSanitizer in 2026?

**websearch-2134** (pass@k=0.0%)
> Use web search and answer
What are the full features of the Cua (trycua) tool including screen capture, mouse, keyboard, browser, and file system capabilities in 2026?

### gemini-builtin

Total: 151 prompts, 15 complete failures, 0 low performers (<50%)

**Complete Failures (pass@k = 0%):**

| Prompt ID | Pass Rate | Pass@k | Pass^k |
|-----------|-----------|--------|--------|
| websearch-2084 | 0.0% | 0.0% | 0.0% |
| websearch-2085 | 0.0% | 0.0% | 0.0% |
| websearch-2086 | 0.0% | 0.0% | 0.0% |
| websearch-2090 | 0.0% | 0.0% | 0.0% |
| websearch-2092 | 0.0% | 0.0% | 0.0% |
| websearch-2093 | 0.0% | 0.0% | 0.0% |
| websearch-2096 | 0.0% | 0.0% | 0.0% |
| websearch-2099 | 0.0% | 0.0% | 0.0% |
| websearch-2100 | 0.0% | 0.0% | 0.0% |
| websearch-2103 | 0.0% | 0.0% | 0.0% |
| websearch-2104 | 0.0% | 0.0% | 0.0% |
| websearch-2106 | 0.0% | 0.0% | 0.0% |
| websearch-2110 | 0.0% | 0.0% | 0.0% |
| websearch-2132 | 0.0% | 0.0% | 0.0% |
| websearch-2134 | 0.0% | 0.0% | 0.0% |

**Failing Prompt Queries:**

**websearch-2084** (pass@k=0.0%)
> Use web search and answer
What does the 2020 Translational Psychiatry paper DOI 10.1038/s41398-020-00865-8 by Barr PB say about polygenic scores using LDpred versus clumping and thresholding methods in 2026?

**websearch-2085** (pass@k=0.0%)
> Use web search and answer
What does the Ham 2019 Nature paper on deep learning for multi-year ENSO forecasts say about CMIP5, CMIP6, CNN, and transfer learning for 18-month lead times in 2026?

**websearch-2086** (pass@k=0.0%)
> Use web search and answer
What is the size and growth outlook for the US insulation market from 2024 to 2030 across residential and commercial construction segments in 2026?

**websearch-2090** (pass@k=0.0%)
> Use web search and answer
What are the current multi-agent reinforcement learning frameworks for urban simulation and city-scale MARL including RLlib and PettingZoo in 2026?

**websearch-2092** (pass@k=0.0%)
> Use web search and answer
What are the WS-Discovery printer device types including dn:PrintAll, dn:Printer, and DeviceCategory:PrintAll used in Windows printer discovery in 2026?

**websearch-2093** (pass@k=0.0%)
> Use web search and answer
What are the historical precedents for Russian territorial capture rates around Siversk and Donetsk during winter 2025 in the Ukraine war in 2026?

**websearch-2096** (pass@k=0.0%)
> Use web search and answer
What AI document extraction startups received funding in 2024, including emerging competitors to Instabase, Ocrolus, and Eden AI in 2026?

**websearch-2099** (pass@k=0.0%)
> Use web search and answer
What are the AI token optimization strategies for reducing costs with million-token contexts including context pruning in 2025 in 2026?

**websearch-2100** (pass@k=0.0%)
> Use web search and answer
What are the best examples of micro lead generation quizzes, landing pages, and newsletter monetization through sponsorships in 2025 in 2026?

**websearch-2103** (pass@k=0.0%)
> Use web search and answer
How do I add a custom instruction and tip fee to the same Jupiter swap transaction by composing a versioned transaction in 2026?

**websearch-2104** (pass@k=0.0%)
> Use web search and answer
How does the Frappe framework workflow engine work including Server Scripts, automation, document hooks, and architecture in 2026?

**websearch-2106** (pass@k=0.0%)
> Use web search and answer
How do I configure conditional stage skipping and automation for dismissal and resignation workflows in Jira Service Management in 2026?

**websearch-2110** (pass@k=0.0%)
> Use web search and answer
How do I use the @anthropic-ai/agent-sdk TypeScript package to create an agent client and run a conversation in 2026?

**websearch-2132** (pass@k=0.0%)
> Use web search and answer
What is the pricing for brightwheel, Procare, and Lillio childcare management software per student per month in 2025 in 2026?

**websearch-2134** (pass@k=0.0%)
> Use web search and answer
What are the full features of the Cua (trycua) tool including screen capture, mouse, keyboard, browser, and file system capabilities in 2026?

### claude-code-you

Total: 151 prompts, 22 complete failures, 0 low performers (<50%)

**Complete Failures (pass@k = 0%):**

| Prompt ID | Pass Rate | Pass@k | Pass^k |
|-----------|-----------|--------|--------|
| websearch-2011 | 0.0% | 0.0% | 0.0% |
| websearch-2018 | 0.0% | 0.0% | 0.0% |
| websearch-2046 | 0.0% | 0.0% | 0.0% |
| websearch-2048 | 0.0% | 0.0% | 0.0% |
| websearch-2052 | 0.0% | 0.0% | 0.0% |
| websearch-2058 | 0.0% | 0.0% | 0.0% |
| websearch-2065 | 0.0% | 0.0% | 0.0% |
| websearch-2066 | 0.0% | 0.0% | 0.0% |
| websearch-2072 | 0.0% | 0.0% | 0.0% |
| websearch-2073 | 0.0% | 0.0% | 0.0% |
| websearch-2079 | 0.0% | 0.0% | 0.0% |
| websearch-2089 | 0.0% | 0.0% | 0.0% |
| websearch-2090 | 0.0% | 0.0% | 0.0% |
| websearch-2092 | 0.0% | 0.0% | 0.0% |
| websearch-2096 | 0.0% | 0.0% | 0.0% |
| websearch-2100 | 0.0% | 0.0% | 0.0% |
| websearch-2103 | 0.0% | 0.0% | 0.0% |
| websearch-2104 | 0.0% | 0.0% | 0.0% |
| websearch-2119 | 0.0% | 0.0% | 0.0% |
| websearch-2120 | 0.0% | 0.0% | 0.0% |
| websearch-2129 | 0.0% | 0.0% | 0.0% |
| websearch-2147 | 0.0% | 0.0% | 0.0% |

**Failing Prompt Queries:**

**websearch-2011** (pass@k=0.0%)
> Use web search and answer
How does AES-GCM dual key encryption work where the same ciphertext decrypts to different plaintexts, and how is this used in CTF challenges in 2026?

**websearch-2018** (pass@k=0.0%)
> Use web search and answer
How do Rust user-space applications leverage optimized kernels like CachyOS with the BORE scheduler in 2026?

**websearch-2046** (pass@k=0.0%)
> Use web search and answer
What is the official name of the Hilbert Treasury on the first floor of St. Vitus Cathedral at Prague Castle in 2026?

**websearch-2048** (pass@k=0.0%)
> Use web search and answer
What is the Week 11 2025 NFL analysis and betting outlook for the 49ers, Cardinals, Seahawks, Rams, Ravens, Browns, Chiefs, and Broncos in 2026?

**websearch-2052** (pass@k=0.0%)
> Use web search and answer
What are the Wikipedia coordinates for the Basilica of Saints Lawrence and Zdislava in Jablonné v Podještědí in the Czech Republic in 2026?

**websearch-2058** (pass@k=0.0%)
> Use web search and answer
Who are Saints Aurelius, Innocent, and Florentina, and what is their connection to the Theban Legion relics in 2026?

**websearch-2065** (pass@k=0.0%)
> Use web search and answer
What are the main modules and trading order placement documentation for the dYdX v4-clients-rs Rust client library in 2026?

**websearch-2066** (pass@k=0.0%)
> Use web search and answer
What are the Huobi/HTX API endpoints for historical funding rates including swap-api/v1/swap_historical_funding_rate and linear-swap-api in 2026?

**websearch-2072** (pass@k=0.0%)
> Use web search and answer
How do I use @solana/kit's appendTransactionMessageInstructions with address lookup tables and AccountLookupMeta in 2026?

**websearch-2073** (pass@k=0.0%)
> Use web search and answer
What does the output format look like for grep_search or search_files tool results when matches are found and output is truncated in 2026?

**websearch-2079** (pass@k=0.0%)
> Use web search and answer
How do I implement Tradovate API WebSocket connection with heartbeat, keepalive, and subscriptions for positions and orders in 2026?

**websearch-2089** (pass@k=0.0%)
> Use web search and answer
What academic surveys cover cyber risk quantification from 2020–2024 using Bayesian networks, attack graphs, actuarial methods, and heavy-tailed distributions in 2026?

**websearch-2090** (pass@k=0.0%)
> Use web search and answer
What are the current multi-agent reinforcement learning frameworks for urban simulation and city-scale MARL including RLlib and PettingZoo in 2026?

**websearch-2092** (pass@k=0.0%)
> Use web search and answer
What are the WS-Discovery printer device types including dn:PrintAll, dn:Printer, and DeviceCategory:PrintAll used in Windows printer discovery in 2026?

**websearch-2096** (pass@k=0.0%)
> Use web search and answer
What AI document extraction startups received funding in 2024, including emerging competitors to Instabase, Ocrolus, and Eden AI in 2026?

**websearch-2100** (pass@k=0.0%)
> Use web search and answer
What are the best examples of micro lead generation quizzes, landing pages, and newsletter monetization through sponsorships in 2025 in 2026?

**websearch-2103** (pass@k=0.0%)
> Use web search and answer
How do I add a custom instruction and tip fee to the same Jupiter swap transaction by composing a versioned transaction in 2026?

**websearch-2104** (pass@k=0.0%)
> Use web search and answer
How does the Frappe framework workflow engine work including Server Scripts, automation, document hooks, and architecture in 2026?

**websearch-2119** (pass@k=0.0%)
> Use web search and answer
How do I troubleshoot WS-Discovery Hello message size exceeding the 1500-byte MTU limit causing fragmentation, and which optional fields like wsdp:ThisDevice can be removed in 2026?

**websearch-2120** (pass@k=0.0%)
> Use web search and answer
How do I debug Better Auth nextCookies magic link session cookie issues with SameSite None, partitioned cookies, and Cloudflare Access login in 2026?

### claude-code-builtin

Total: 151 prompts, 51 complete failures, 0 low performers (<50%)

**Complete Failures (pass@k = 0%):**

| Prompt ID | Pass Rate | Pass@k | Pass^k |
|-----------|-----------|--------|--------|
| websearch-2002 | 0.0% | 0.0% | 0.0% |
| websearch-2005 | 0.0% | 0.0% | 0.0% |
| websearch-2007 | 0.0% | 0.0% | 0.0% |
| websearch-2008 | 0.0% | 0.0% | 0.0% |
| websearch-2009 | 0.0% | 0.0% | 0.0% |
| websearch-2010 | 0.0% | 0.0% | 0.0% |
| websearch-2011 | 0.0% | 0.0% | 0.0% |
| websearch-2013 | 0.0% | 0.0% | 0.0% |
| websearch-2017 | 0.0% | 0.0% | 0.0% |
| websearch-2018 | 0.0% | 0.0% | 0.0% |
| websearch-2029 | 0.0% | 0.0% | 0.0% |
| websearch-2030 | 0.0% | 0.0% | 0.0% |
| websearch-2033 | 0.0% | 0.0% | 0.0% |
| websearch-2037 | 0.0% | 0.0% | 0.0% |
| websearch-2039 | 0.0% | 0.0% | 0.0% |
| websearch-2043 | 0.0% | 0.0% | 0.0% |
| websearch-2046 | 0.0% | 0.0% | 0.0% |
| websearch-2047 | 0.0% | 0.0% | 0.0% |
| websearch-2048 | 0.0% | 0.0% | 0.0% |
| websearch-2049 | 0.0% | 0.0% | 0.0% |
| websearch-2050 | 0.0% | 0.0% | 0.0% |
| websearch-2051 | 0.0% | 0.0% | 0.0% |
| websearch-2052 | 0.0% | 0.0% | 0.0% |
| websearch-2058 | 0.0% | 0.0% | 0.0% |
| websearch-2059 | 0.0% | 0.0% | 0.0% |
| websearch-2066 | 0.0% | 0.0% | 0.0% |
| websearch-2072 | 0.0% | 0.0% | 0.0% |
| websearch-2073 | 0.0% | 0.0% | 0.0% |
| websearch-2077 | 0.0% | 0.0% | 0.0% |
| websearch-2079 | 0.0% | 0.0% | 0.0% |
| websearch-2080 | 0.0% | 0.0% | 0.0% |
| websearch-2084 | 0.0% | 0.0% | 0.0% |
| websearch-2089 | 0.0% | 0.0% | 0.0% |
| websearch-2090 | 0.0% | 0.0% | 0.0% |
| websearch-2091 | 0.0% | 0.0% | 0.0% |
| websearch-2092 | 0.0% | 0.0% | 0.0% |
| websearch-2093 | 0.0% | 0.0% | 0.0% |
| websearch-2095 | 0.0% | 0.0% | 0.0% |
| websearch-2096 | 0.0% | 0.0% | 0.0% |
| websearch-2097 | 0.0% | 0.0% | 0.0% |
| websearch-2099 | 0.0% | 0.0% | 0.0% |
| websearch-2100 | 0.0% | 0.0% | 0.0% |
| websearch-2103 | 0.0% | 0.0% | 0.0% |
| websearch-2104 | 0.0% | 0.0% | 0.0% |
| websearch-2106 | 0.0% | 0.0% | 0.0% |
| websearch-2111 | 0.0% | 0.0% | 0.0% |
| websearch-2119 | 0.0% | 0.0% | 0.0% |
| websearch-2120 | 0.0% | 0.0% | 0.0% |
| websearch-2129 | 0.0% | 0.0% | 0.0% |
| websearch-2143 | 0.0% | 0.0% | 0.0% |
| websearch-2147 | 0.0% | 0.0% | 0.0% |

**Failing Prompt Queries:**

**websearch-2002** (pass@k=0.0%)
> Use web search and answer
What is the best way to convert UI screenshots to pixel-perfect Next.js code in 2026 for a website like an advanced car dealership site?

**websearch-2005** (pass@k=0.0%)
> Use web search and answer
How do I implement a Flutter horizontal scroll number picker with iOS wheel selector style, center highlight, and best practices for 2026?

**websearch-2007** (pass@k=0.0%)
> Use web search and answer
How do I use terraform-aws-modules EKS with access_entries, kubernetes resources, depends_on, and policy_associations in 2026?

**websearch-2008** (pass@k=0.0%)
> Use web search and answer
What are the LLM tool calling architecture best practices for router vs planner-executor patterns in customer support RAG systems in 2026?

**websearch-2009** (pass@k=0.0%)
> Use web search and answer
What are the Terms of Use page requirements for SaaS products including acknowledgement tracking, version history, and compliance considerations for 2025?

**websearch-2010** (pass@k=0.0%)
> Use web search and answer
What are the advanced PDF compression techniques in Apache PDFBox including image downsampling and content stream optimization in 2026?

**websearch-2011** (pass@k=0.0%)
> Use web search and answer
How does AES-GCM dual key encryption work where the same ciphertext decrypts to different plaintexts, and how is this used in CTF challenges in 2026?

**websearch-2013** (pass@k=0.0%)
> Use web search and answer
How does NSPasteboard type priority order work for cross-application compatibility in macOS terminals and browsers in 2026?

**websearch-2017** (pass@k=0.0%)
> Use web search and answer
What is the RTL design verification workflow and best practices for Verilog and SystemVerilog using iverilog and GTKWave in 2026?

**websearch-2018** (pass@k=0.0%)
> Use web search and answer
How do Rust user-space applications leverage optimized kernels like CachyOS with the BORE scheduler in 2026?

**websearch-2029** (pass@k=0.0%)
> Use web search and answer
What are the common security vulnerabilities and mistakes in AI-generated code including hallucinations and security patterns in 2026?

**websearch-2030** (pass@k=0.0%)
> Use web search and answer
What are the best practices for building an integration marketplace with a credential manager, API key and OAuth onboarding in 2026?

**websearch-2033** (pass@k=0.0%)
> Use web search and answer
How do I implement Swift Combine framework WebSocket real-time chat with MVVM architecture and best practices in 2026?

**websearch-2037** (pass@k=0.0%)
> Use web search and answer
How do I migrate from Tauri with Rust backend to Wails v2 with a Go backend while preserving my React frontend in 2026?

**websearch-2039** (pass@k=0.0%)
> Use web search and answer
What are the 2025 RAG reranking best practices including hybrid search with Reciprocal Rank Fusion for production implementation in 2026?

**websearch-2043** (pass@k=0.0%)
> Use web search and answer
What does Vietnamese Insurance Business Law 2022 say about insurance enterprise dissolution, bankruptcy, and portfolio transfer in 2026?

**websearch-2046** (pass@k=0.0%)
> Use web search and answer
What is the official name of the Hilbert Treasury on the first floor of St. Vitus Cathedral at Prague Castle in 2026?

**websearch-2047** (pass@k=0.0%)
> Use web search and answer
What are the historical precedents for Russian territorial gains of 40–50 km in Ukraine during rapid advances in 2022, 2023, and 2024?

**websearch-2048** (pass@k=0.0%)
> Use web search and answer
What is the Week 11 2025 NFL analysis and betting outlook for the 49ers, Cardinals, Seahawks, Rams, Ravens, Browns, Chiefs, and Broncos in 2026?

**websearch-2049** (pass@k=0.0%)
> Use web search and answer
What are the ACA marketplace health insurance options and prices in Austin, Texas for a single adult in 2025, including HDHP, bronze, and silver plans?

### droid-you

Total: 151 prompts, 30 complete failures, 0 low performers (<50%)

**Complete Failures (pass@k = 0%):**

| Prompt ID | Pass Rate | Pass@k | Pass^k |
|-----------|-----------|--------|--------|
| websearch-2005 | 0.0% | 0.0% | 0.0% |
| websearch-2007 | 0.0% | 0.0% | 0.0% |
| websearch-2011 | 0.0% | 0.0% | 0.0% |
| websearch-2017 | 0.0% | 0.0% | 0.0% |
| websearch-2023 | 0.0% | 0.0% | 0.0% |
| websearch-2029 | 0.0% | 0.0% | 0.0% |
| websearch-2030 | 0.0% | 0.0% | 0.0% |
| websearch-2033 | 0.0% | 0.0% | 0.0% |
| websearch-2036 | 0.0% | 0.0% | 0.0% |
| websearch-2037 | 0.0% | 0.0% | 0.0% |
| websearch-2039 | 0.0% | 0.0% | 0.0% |
| websearch-2046 | 0.0% | 0.0% | 0.0% |
| websearch-2048 | 0.0% | 0.0% | 0.0% |
| websearch-2049 | 0.0% | 0.0% | 0.0% |
| websearch-2058 | 0.0% | 0.0% | 0.0% |
| websearch-2069 | 0.0% | 0.0% | 0.0% |
| websearch-2079 | 0.0% | 0.0% | 0.0% |
| websearch-2090 | 0.0% | 0.0% | 0.0% |
| websearch-2092 | 0.0% | 0.0% | 0.0% |
| websearch-2099 | 0.0% | 0.0% | 0.0% |
| websearch-2100 | 0.0% | 0.0% | 0.0% |
| websearch-2101 | 0.0% | 0.0% | 0.0% |
| websearch-2103 | 0.0% | 0.0% | 0.0% |
| websearch-2104 | 0.0% | 0.0% | 0.0% |
| websearch-2119 | 0.0% | 0.0% | 0.0% |
| websearch-2120 | 0.0% | 0.0% | 0.0% |
| websearch-2134 | 0.0% | 0.0% | 0.0% |
| websearch-2143 | 0.0% | 0.0% | 0.0% |
| websearch-2146 | 0.0% | 0.0% | 0.0% |
| websearch-2147 | 0.0% | 0.0% | 0.0% |

**Failing Prompt Queries:**

**websearch-2005** (pass@k=0.0%)
> Use web search and answer
How do I implement a Flutter horizontal scroll number picker with iOS wheel selector style, center highlight, and best practices for 2026?

**websearch-2007** (pass@k=0.0%)
> Use web search and answer
How do I use terraform-aws-modules EKS with access_entries, kubernetes resources, depends_on, and policy_associations in 2026?

**websearch-2011** (pass@k=0.0%)
> Use web search and answer
How does AES-GCM dual key encryption work where the same ciphertext decrypts to different plaintexts, and how is this used in CTF challenges in 2026?

**websearch-2017** (pass@k=0.0%)
> Use web search and answer
What is the RTL design verification workflow and best practices for Verilog and SystemVerilog using iverilog and GTKWave in 2026?

**websearch-2023** (pass@k=0.0%)
> Use web search and answer
What are the best practices for production RAG system architecture including monitoring, backup, and disaster recovery in 2026?

**websearch-2029** (pass@k=0.0%)
> Use web search and answer
What are the common security vulnerabilities and mistakes in AI-generated code including hallucinations and security patterns in 2026?

**websearch-2030** (pass@k=0.0%)
> Use web search and answer
What are the best practices for building an integration marketplace with a credential manager, API key and OAuth onboarding in 2026?

**websearch-2033** (pass@k=0.0%)
> Use web search and answer
How do I implement Swift Combine framework WebSocket real-time chat with MVVM architecture and best practices in 2026?

**websearch-2036** (pass@k=0.0%)
> Use web search and answer
What does a professional Next.js 15 and React 19 navigation header component look like with TypeScript in 2026?

**websearch-2037** (pass@k=0.0%)
> Use web search and answer
How do I migrate from Tauri with Rust backend to Wails v2 with a Go backend while preserving my React frontend in 2026?

**websearch-2039** (pass@k=0.0%)
> Use web search and answer
What are the 2025 RAG reranking best practices including hybrid search with Reciprocal Rank Fusion for production implementation in 2026?

**websearch-2046** (pass@k=0.0%)
> Use web search and answer
What is the official name of the Hilbert Treasury on the first floor of St. Vitus Cathedral at Prague Castle in 2026?

**websearch-2048** (pass@k=0.0%)
> Use web search and answer
What is the Week 11 2025 NFL analysis and betting outlook for the 49ers, Cardinals, Seahawks, Rams, Ravens, Browns, Chiefs, and Broncos in 2026?

**websearch-2049** (pass@k=0.0%)
> Use web search and answer
What are the ACA marketplace health insurance options and prices in Austin, Texas for a single adult in 2025, including HDHP, bronze, and silver plans?

**websearch-2058** (pass@k=0.0%)
> Use web search and answer
Who are Saints Aurelius, Innocent, and Florentina, and what is their connection to the Theban Legion relics in 2026?

**websearch-2069** (pass@k=0.0%)
> Use web search and answer
What are the OpenAI API specifications for chat completions, embeddings, images, audio TTS, and available models and endpoints as of 2024?

**websearch-2079** (pass@k=0.0%)
> Use web search and answer
How do I implement Tradovate API WebSocket connection with heartbeat, keepalive, and subscriptions for positions and orders in 2026?

**websearch-2090** (pass@k=0.0%)
> Use web search and answer
What are the current multi-agent reinforcement learning frameworks for urban simulation and city-scale MARL including RLlib and PettingZoo in 2026?

**websearch-2092** (pass@k=0.0%)
> Use web search and answer
What are the WS-Discovery printer device types including dn:PrintAll, dn:Printer, and DeviceCategory:PrintAll used in Windows printer discovery in 2026?

**websearch-2099** (pass@k=0.0%)
> Use web search and answer
What are the AI token optimization strategies for reducing costs with million-token contexts including context pruning in 2025 in 2026?

### droid-builtin

Total: 151 prompts, 68 complete failures, 0 low performers (<50%)

**Complete Failures (pass@k = 0%):**

| Prompt ID | Pass Rate | Pass@k | Pass^k |
|-----------|-----------|--------|--------|
| websearch-2005 | 0.0% | 0.0% | 0.0% |
| websearch-2006 | 0.0% | 0.0% | 0.0% |
| websearch-2007 | 0.0% | 0.0% | 0.0% |
| websearch-2008 | 0.0% | 0.0% | 0.0% |
| websearch-2009 | 0.0% | 0.0% | 0.0% |
| websearch-2010 | 0.0% | 0.0% | 0.0% |
| websearch-2011 | 0.0% | 0.0% | 0.0% |
| websearch-2012 | 0.0% | 0.0% | 0.0% |
| websearch-2013 | 0.0% | 0.0% | 0.0% |
| websearch-2016 | 0.0% | 0.0% | 0.0% |
| websearch-2017 | 0.0% | 0.0% | 0.0% |
| websearch-2021 | 0.0% | 0.0% | 0.0% |
| websearch-2022 | 0.0% | 0.0% | 0.0% |
| websearch-2023 | 0.0% | 0.0% | 0.0% |
| websearch-2024 | 0.0% | 0.0% | 0.0% |
| websearch-2026 | 0.0% | 0.0% | 0.0% |
| websearch-2028 | 0.0% | 0.0% | 0.0% |
| websearch-2029 | 0.0% | 0.0% | 0.0% |
| websearch-2030 | 0.0% | 0.0% | 0.0% |
| websearch-2032 | 0.0% | 0.0% | 0.0% |
| websearch-2033 | 0.0% | 0.0% | 0.0% |
| websearch-2034 | 0.0% | 0.0% | 0.0% |
| websearch-2035 | 0.0% | 0.0% | 0.0% |
| websearch-2036 | 0.0% | 0.0% | 0.0% |
| websearch-2037 | 0.0% | 0.0% | 0.0% |
| websearch-2039 | 0.0% | 0.0% | 0.0% |
| websearch-2043 | 0.0% | 0.0% | 0.0% |
| websearch-2047 | 0.0% | 0.0% | 0.0% |
| websearch-2049 | 0.0% | 0.0% | 0.0% |
| websearch-2051 | 0.0% | 0.0% | 0.0% |
| websearch-2055 | 0.0% | 0.0% | 0.0% |
| websearch-2058 | 0.0% | 0.0% | 0.0% |
| websearch-2067 | 0.0% | 0.0% | 0.0% |
| websearch-2068 | 0.0% | 0.0% | 0.0% |
| websearch-2069 | 0.0% | 0.0% | 0.0% |
| websearch-2070 | 0.0% | 0.0% | 0.0% |
| websearch-2072 | 0.0% | 0.0% | 0.0% |
| websearch-2079 | 0.0% | 0.0% | 0.0% |
| websearch-2080 | 0.0% | 0.0% | 0.0% |
| websearch-2089 | 0.0% | 0.0% | 0.0% |
| websearch-2090 | 0.0% | 0.0% | 0.0% |
| websearch-2092 | 0.0% | 0.0% | 0.0% |
| websearch-2094 | 0.0% | 0.0% | 0.0% |
| websearch-2095 | 0.0% | 0.0% | 0.0% |
| websearch-2097 | 0.0% | 0.0% | 0.0% |
| websearch-2099 | 0.0% | 0.0% | 0.0% |
| websearch-2100 | 0.0% | 0.0% | 0.0% |
| websearch-2101 | 0.0% | 0.0% | 0.0% |
| websearch-2103 | 0.0% | 0.0% | 0.0% |
| websearch-2104 | 0.0% | 0.0% | 0.0% |
| websearch-2106 | 0.0% | 0.0% | 0.0% |
| websearch-2107 | 0.0% | 0.0% | 0.0% |
| websearch-2108 | 0.0% | 0.0% | 0.0% |
| websearch-2110 | 0.0% | 0.0% | 0.0% |
| websearch-2112 | 0.0% | 0.0% | 0.0% |
| websearch-2115 | 0.0% | 0.0% | 0.0% |
| websearch-2117 | 0.0% | 0.0% | 0.0% |
| websearch-2118 | 0.0% | 0.0% | 0.0% |
| websearch-2119 | 0.0% | 0.0% | 0.0% |
| websearch-2120 | 0.0% | 0.0% | 0.0% |
| websearch-2123 | 0.0% | 0.0% | 0.0% |
| websearch-2129 | 0.0% | 0.0% | 0.0% |
| websearch-2131 | 0.0% | 0.0% | 0.0% |
| websearch-2134 | 0.0% | 0.0% | 0.0% |
| websearch-2142 | 0.0% | 0.0% | 0.0% |
| websearch-2143 | 0.0% | 0.0% | 0.0% |
| websearch-2146 | 0.0% | 0.0% | 0.0% |
| websearch-2147 | 0.0% | 0.0% | 0.0% |

**Failing Prompt Queries:**

**websearch-2005** (pass@k=0.0%)
> Use web search and answer
How do I implement a Flutter horizontal scroll number picker with iOS wheel selector style, center highlight, and best practices for 2026?

**websearch-2006** (pass@k=0.0%)
> Use web search and answer
How do I use an LLM to rewrite text without changing facts, preserving numbers, names, URLs, and maintaining method and entity consistency in 2026?

**websearch-2007** (pass@k=0.0%)
> Use web search and answer
How do I use terraform-aws-modules EKS with access_entries, kubernetes resources, depends_on, and policy_associations in 2026?

**websearch-2008** (pass@k=0.0%)
> Use web search and answer
What are the LLM tool calling architecture best practices for router vs planner-executor patterns in customer support RAG systems in 2026?

**websearch-2009** (pass@k=0.0%)
> Use web search and answer
What are the Terms of Use page requirements for SaaS products including acknowledgement tracking, version history, and compliance considerations for 2025?

**websearch-2010** (pass@k=0.0%)
> Use web search and answer
What are the advanced PDF compression techniques in Apache PDFBox including image downsampling and content stream optimization in 2026?

**websearch-2011** (pass@k=0.0%)
> Use web search and answer
How does AES-GCM dual key encryption work where the same ciphertext decrypts to different plaintexts, and how is this used in CTF challenges in 2026?

**websearch-2012** (pass@k=0.0%)
> Use web search and answer
How do I use ASP.NET Core model binding with FromHeader on complex type properties at the attribute level in an ApiController in 2026?

**websearch-2013** (pass@k=0.0%)
> Use web search and answer
How does NSPasteboard type priority order work for cross-application compatibility in macOS terminals and browsers in 2026?

**websearch-2016** (pass@k=0.0%)
> Use web search and answer
How do I set up local AI development testing with Vercel environment variables to switch between the OpenAI API and Ollama in 2026?

**websearch-2017** (pass@k=0.0%)
> Use web search and answer
What is the RTL design verification workflow and best practices for Verilog and SystemVerilog using iverilog and GTKWave in 2026?

**websearch-2021** (pass@k=0.0%)
> Use web search and answer
How do I use GCC Makefile optimization for incremental builds and dependency checking to achieve faster linking in 2026?

**websearch-2022** (pass@k=0.0%)
> Use web search and answer
How does the Hocuspocus Document class manage connections as a Set of DirectConnection objects and handle lifecycle internals in 2026?

**websearch-2023** (pass@k=0.0%)
> Use web search and answer
What are the best practices for production RAG system architecture including monitoring, backup, and disaster recovery in 2026?

**websearch-2024** (pass@k=0.0%)
> Use web search and answer
What are the latest versions of key NuGet packages including AutoMapper, Serilog, and Microsoft.EntityFrameworkCore as of 2024?

**websearch-2026** (pass@k=0.0%)
> Use web search and answer
How do I implement EF Core 9 with SQLite using clean architecture and repository pattern in 2026?

**websearch-2028** (pass@k=0.0%)
> Use web search and answer
What are the best practices for organizing Emacs configuration using org-babel literate programming in 2026?

**websearch-2029** (pass@k=0.0%)
> Use web search and answer
What are the common security vulnerabilities and mistakes in AI-generated code including hallucinations and security patterns in 2026?

**websearch-2030** (pass@k=0.0%)
> Use web search and answer
What are the best practices for building an integration marketplace with a credential manager, API key and OAuth onboarding in 2026?

**websearch-2032** (pass@k=0.0%)
> Use web search and answer
How do I implement YouTube API OAuth 2.0 with refresh token security best practices in Node.js in 2026?



---

*Generated by `bun scripts/report.ts`*
