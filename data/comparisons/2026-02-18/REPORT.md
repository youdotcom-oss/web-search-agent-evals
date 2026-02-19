# Web Search Agent Evaluation Report
**Generated:** Thursday, February 19, 2026 at 7:43 AM
**Prompts:** 151
**Trials per prompt:** 10

---

## Executive Summary

**Best Quality:** droid-you (0.85 avg score)

**Fastest:** droid-you (36.2s median latency)

**Most Reliable:** droid-you (32.4% flakiness)

---

## Quality Rankings

| Rank | Agent + Search | Avg Score | Median Score | P25 Score | P75 Score |
|------|----------------|-----------|--------------|-----------|----------|
| 1 | droid-you | 0.85 | 0.91 | 0.81 | 0.98 |
| 2 | droid-builtin | 0.78 | 0.86 | 0.50 | 0.95 |

## Performance Rankings (Latency)

| Rank | Agent + Search | P50 | P90 | P99 | Mean | Total Duration |
|------|----------------|-----|-----|-----|------|----------------|
| 1 | droid-you | 36.2s | 60.0s | 60.0s | 37.9s | 57191.9s |
| 2 | droid-builtin | 42.5s | 60.0s | 60.0s | 42.5s | 64225.1s |

## Capability Metrics (Pass@k)

| Agent + Search | Avg Pass@k | Median Pass@k | P25 Pass@k | P75 Pass@k |
|----------------|------------|---------------|------------|------------|
| droid-you | 97.5% | 100.0% | 100.0% | 100.0% |
| droid-builtin | 91.4% | 100.0% | 99.9% | 100.0% |

## Flakiness Analysis

| Agent + Search | Avg Flakiness | Median Flakiness | Flaky Prompt Count |
|----------------|---------------|------------------|--------------------|
| droid-you | 32.4% | 0.0% | 59 |
| droid-builtin | 42.8% | 65.1% | 78 |

### Most Flaky Prompts

| Prompt ID | Max Flakiness |
|-----------|---------------|
| websearch-2017 | 99.8% |
| websearch-2022 | 99.8% |
| websearch-2030 | 99.8% |
| websearch-2034 | 99.8% |
| websearch-2093 | 99.8% |
| websearch-2090 | 99.8% |
| websearch-2119 | 99.8% |
| websearch-2123 | 99.8% |
| websearch-2127 | 99.8% |
| websearch-2142 | 99.8% |

## MCP Tool Impact Analysis

| Agent | Quality (builtin → MCP) | Speed (builtin → MCP) | Reliability (builtin → MCP) |
|-------|------------------------|----------------------|----------------------------|
| droid (you) | ↑ 8.7% ± 1.1% | ↑ 14.9% ± 1.6% | ↑ 16.4pp |


## Tool Call Statistics

### DROID

| Metric | Builtin | you | Difference | % Change |
|--------|---------|-----|------------|----------|
| Median (P50) | 4.0 | 4.0 | → 0.0 | 0.0% |
| P90 | 10.0 | 10.0 | → 0.0 | 0.0% |
| P99 | 14.0 | 15.0 | ↑ 1.0 | +7.1% |
| Mean | 5.2 | 5.6 | ↑ 0.5 | +8.8% |
| Min | 0.0 | 0.0 | → 0.0 | 0.0% |
| Max | 17.0 | 18.0 | ↑ 1.0 | +5.9% |

**Sample size:** 1510 (builtin), 1510 (you)

## Tool Call Distribution

### DROID

### you Distribution

```
 0 calls |  4 (0.3%)
 2 calls | █████████████████████████████ 283 (18.7%)
 3 calls | ███████ 74 (4.9%)
 4 calls | ████████████████████████████████████████ 396 (26.2%)
 5 calls | ███████████ 104 (6.9%)
 6 calls | ████████████████ 163 (10.8%)
 7 calls | ████████████ 114 (7.5%)
 8 calls | ███████████ 108 (7.2%)
 9 calls | ███████ 68 (4.5%)
10 calls | █████ 51 (3.4%)
11 calls | ████ 41 (2.7%)
12 calls | ███ 30 (2.0%)
13 calls | ██ 23 (1.5%)
14 calls | ███ 25 (1.7%)
15 calls | █ 13 (0.9%)
16 calls | █ 9 (0.6%)
17 calls |  2 (0.1%)
18 calls |  2 (0.1%)
```
### builtin Distribution

```
 0 calls |  1 (0.1%)
 1 calls |  1 (0.1%)
 2 calls | ████████████████████████████████████████ 443 (29.3%)
 3 calls | █████████████ 147 (9.7%)
 4 calls | ████████████████ 182 (12.1%)
 5 calls | ███████████████ 169 (11.2%)
 6 calls | ██████████ 108 (7.2%)
 7 calls | █████████ 95 (6.3%)
 8 calls | █████████ 103 (6.8%)
 9 calls | ██████ 67 (4.4%)
10 calls | ███████ 77 (5.1%)
11 calls | █████ 55 (3.6%)
12 calls | ███ 31 (2.1%)
13 calls | █ 13 (0.9%)
14 calls |  5 (0.3%)
15 calls | █ 6 (0.4%)
16 calls |  5 (0.3%)
17 calls |  2 (0.1%)
```
**Key Observations:**

- Zero tool calls: Builtin=1 (0.1%), you=4 (0.3%)
- Heavy users (5+ calls): Builtin=736 (48.7%), you=753 (49.9%)


## Failing Prompts (pass@k = 0)

### droid-you

Total: 151 prompts, 1 complete failures, 0 low performers (<50%)

**Complete Failures (pass@k = 0%):**

| Prompt ID | Pass Rate | Pass@k | Pass^k |
|-----------|-----------|--------|--------|
| websearch-2011 | 0.0% | 0.0% | 0.0% |

**Failing Prompt Queries:**

**websearch-2011** (pass@k=0.0%)
> Use web search and answer
How does AES-GCM dual key encryption work where the same ciphertext decrypts to different plaintexts, and how is this used in CTF challenges in 2026?

### droid-builtin

Total: 151 prompts, 8 complete failures, 0 low performers (<50%)

**Complete Failures (pass@k = 0%):**

| Prompt ID | Pass Rate | Pass@k | Pass^k |
|-----------|-----------|--------|--------|
| websearch-2007 | 0.0% | 0.0% | 0.0% |
| websearch-2010 | 0.0% | 0.0% | 0.0% |
| websearch-2069 | 0.0% | 0.0% | 0.0% |
| websearch-2103 | 0.0% | 0.0% | 0.0% |
| websearch-2120 | 0.0% | 0.0% | 0.0% |
| websearch-2134 | 0.0% | 0.0% | 0.0% |
| websearch-2147 | 0.0% | 0.0% | 0.0% |
| websearch-2149 | 0.0% | 0.0% | 0.0% |

**Failing Prompt Queries:**

**websearch-2007** (pass@k=0.0%)
> Use web search and answer
How do I use terraform-aws-modules EKS with access_entries, kubernetes resources, depends_on, and policy_associations in 2026?

**websearch-2010** (pass@k=0.0%)
> Use web search and answer
What are the advanced PDF compression techniques in Apache PDFBox including image downsampling and content stream optimization in 2026?

**websearch-2069** (pass@k=0.0%)
> Use web search and answer
What are the OpenAI API specifications for chat completions, embeddings, images, audio TTS, and available models and endpoints as of 2024?

**websearch-2103** (pass@k=0.0%)
> Use web search and answer
How do I add a custom instruction and tip fee to the same Jupiter swap transaction by composing a versioned transaction in 2026?

**websearch-2120** (pass@k=0.0%)
> Use web search and answer
How do I debug Better Auth nextCookies magic link session cookie issues with SameSite None, partitioned cookies, and Cloudflare Access login in 2026?

**websearch-2134** (pass@k=0.0%)
> Use web search and answer
What are the full features of the Cua (trycua) tool including screen capture, mouse, keyboard, browser, and file system capabilities in 2026?

**websearch-2147** (pass@k=0.0%)
> Use web search and answer
How do I implement a prepaid credit wallet with auto-recharge using Stripe payment intents for a multi-tenant architecture in 2026?

**websearch-2149** (pass@k=0.0%)
> Use web search and answer
Does the Onyx (onyx-dot-app) application on GitHub support Slack file attachment, image, and screenshot sharing in 2026?



---

*Generated by `bun scripts/report.ts`*
