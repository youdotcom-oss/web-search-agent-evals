# Web Search Agent Evaluation Report
**Generated:** Friday, February 20, 2026 at 12:30 AM
**Prompts:** 46
**Trials per prompt:** 5

---

## Executive Summary

**Best Quality:** droid-you (0.90 avg score)

**Fastest:** droid-you (36.6s median latency)

**Most Reliable:** droid-you (12.7% flakiness)

---

## Quality Rankings

| Rank | Agent + Search | Avg Score | Median Score | P25 Score | P75 Score |
|------|----------------|-----------|--------------|-----------|----------|
| 1 | droid-you | 0.90 | 0.94 | 0.85 | 0.99 |
| 2 | droid-builtin | 0.81 | 0.89 | 0.74 | 0.97 |

## Performance Rankings (Latency)

| Rank | Agent + Search | P50 | P90 | P99 | Mean | Total Duration |
|------|----------------|-----|-----|-----|------|----------------|
| 1 | droid-you | 36.6s | 56.1s | 60.0s | 37.6s | 8645.4s |
| 2 | droid-builtin | 41.3s | 60.0s | 60.0s | 42.6s | 8956.1s |

## Capability Metrics (Pass@k)

| Agent + Search | Avg Pass@k | Median Pass@k | P25 Pass@k | P75 Pass@k |
|----------------|------------|---------------|------------|------------|
| droid-you | 99.8% | 100.0% | 100.0% | 100.0% |
| droid-builtin | 88.5% | 100.0% | 99.0% | 100.0% |

## Flakiness Analysis

| Agent + Search | Avg Flakiness | Median Flakiness | Flaky Prompt Count |
|----------------|---------------|------------------|--------------------|
| droid-you | 12.7% | 0.0% | 8 |
| droid-builtin | 26.9% | 0.0% | 15 |

### Most Flaky Prompts

| Prompt ID | Max Flakiness |
|-----------|---------------|
| websearch-2023 | 91.2% |
| websearch-2022 | 91.2% |
| websearch-2030 | 91.2% |
| websearch-2032 | 91.2% |
| websearch-2037 | 91.2% |
| websearch-2033 | 91.2% |
| websearch-2008 | 67.2% |
| websearch-2012 | 67.2% |
| websearch-2013 | 67.2% |
| websearch-2017 | 67.2% |

## MCP Tool Impact Analysis

| Agent | Quality (builtin → MCP) | Speed (builtin → MCP) | Reliability (builtin → MCP) |
|-------|------------------------|----------------------|----------------------------|
| droid (you) | ↑ 11.3% ± 1.9% | ↑ 11.3% ± 4.2% | ↑ 25.4pp |


## Tool Call Statistics

### DROID

| Metric | Builtin | you | Difference | % Change |
|--------|---------|-----|------------|----------|
| Median (P50) | 4.0 | 4.0 | → 0.0 | 0.0% |
| P90 | 8.0 | 7.0 | ↓ 1.0 | -12.5% |
| P99 | 12.0 | 9.7 | ↓ 2.3 | -19.1% |
| Mean | 4.5 | 4.5 | ↑ 0.1 | +1.5% |
| Min | 2.0 | 2.0 | → 0.0 | 0.0% |
| Max | 16.0 | 11.0 | ↓ 5.0 | -31.3% |

**Sample size:** 210 (builtin), 230 (you)

## Tool Call Distribution

### DROID

### you Distribution

```
 2 calls | ████████████████████████████████████ 48 (20.9%)
 3 calls | ████████████████████ 27 (11.7%)
 4 calls | ████████████████████████████████████████ 54 (23.5%)
 5 calls | ███████████████████████ 31 (13.5%)
 6 calls | ████████████████████ 27 (11.7%)
 7 calls | ████████████████ 22 (9.6%)
 8 calls | ████████ 11 (4.8%)
 9 calls | █████ 7 (3.0%)
10 calls | █ 2 (0.9%)
11 calls | █ 1 (0.4%)
```
### builtin Distribution

```
 2 calls | ████████████████████████████████████████ 59 (28.1%)
 3 calls | ██████████████████████ 33 (15.7%)
 4 calls | ███████████████████████ 34 (16.2%)
 5 calls | ██████████████████████ 33 (15.7%)
 6 calls | ██████████ 15 (7.1%)
 7 calls | ████ 6 (2.9%)
 8 calls | ███████ 10 (4.8%)
 9 calls | █████ 8 (3.8%)
10 calls | ██ 3 (1.4%)
11 calls | ███ 5 (2.4%)
12 calls | █ 2 (1.0%)
14 calls | █ 1 (0.5%)
16 calls | █ 1 (0.5%)
```
**Key Observations:**

- Zero tool calls: Builtin=0 (0.0%), you=0 (0.0%)
- Heavy users (5+ calls): Builtin=84 (40.0%), you=101 (43.9%)


## Individual Tool Call Latency

### droid — you

| Tool | n | P50 | P90 | P99 | Mean |
|------|---|-----|-----|-----|------|
| TodoWrite | 7 | 7.7s | 14.1s | 19.2s | 9.1s |
| WebSearch | 12 | 7.7s | 13.1s | 19.0s | 8.9s |
| ydc-server___you-contents | 86 | 999ms | 5.3s | 9.7s | 2.0s |
| ydc-server___you-search | 223 | 612ms | 764ms | 1.4s | 640ms |

### droid — builtin

| Tool | n | P50 | P90 | P99 | Mean |
|------|---|-----|-----|-----|------|
| FetchUrl | 43 | 5.2s | 10.0s | 15.2s | 5.7s |
| TodoWrite | 5 | 7.2s | 9.3s | 10.5s | 7.7s |
| WebSearch | 210 | 8.9s | 12.7s | 17.4s | 9.5s |


## Failing Prompts (pass@k = 0)

### droid-builtin

Total: 42 prompts, 3 complete failures, 0 low performers (<50%)

**Complete Failures (pass@k = 0%):**

| Prompt ID | Pass Rate | Pass@k | Pass^k |
|-----------|-----------|--------|--------|
| websearch-2007 | 0.0% | 0.0% | 0.0% |
| websearch-2010 | 0.0% | 0.0% | 0.0% |
| websearch-2011 | 0.0% | 0.0% | 0.0% |

**Failing Prompt Queries:**

**websearch-2007** (pass@k=0.0%)
> Use web search and answer
How do I use terraform-aws-modules EKS with access_entries, kubernetes resources, depends_on, and policy_associations in 2026?

**websearch-2010** (pass@k=0.0%)
> Use web search and answer
What are the advanced PDF compression techniques in Apache PDFBox including image downsampling and content stream optimization in 2026?

**websearch-2011** (pass@k=0.0%)
> Use web search and answer
How does AES-GCM dual key encryption work where the same ciphertext decrypts to different plaintexts, and how is this used in CTF challenges in 2026?



---

*Generated by `bun scripts/report.ts`*
