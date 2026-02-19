# Web Search Agent Evaluation Summary
**Generated:** Thursday, February 19, 2026 at 4:13 AM
**Mode:** Test run
**Prompts:** 151
**Trials per prompt:** 10

---

## Executive Summary

**Best Quality:** droid-you (0.85 avg score)

**Fastest:** droid-you (36.2s median latency)

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
| droid (you) | ↑ 8.7% ± 1.2% | ↑ 14.9% ± 1.8% | ↑ 16.4pp ± 7.0pp |

## Recommendations

### For Production Use

- **Best Quality:** droid-you (0.85 avg score)
- **Fastest:** droid-you (36.2s P50 latency)
### Areas for Improvement

- **Lowest Quality:** droid-builtin (0.78 avg score)
- **Most Flaky:** droid-builtin (42.8% flakiness)

---

## Tool Call Statistics

Tool calls per trial observation (1510 observations per provider, k=10 × 151 prompts).

| Metric | Builtin | You.com MCP | Difference | % Change |
|--------|---------|-------------|------------|----------|
| Median (P50) | 4.0 | 4.0 | → 0.0 | 0.0% |
| P90 | 10.0 | 10.0 | → 0.0 | 0.0% |
| P99 | 14.0 | 15.0 | ↑ 1.0 | +7.1% |
| Mean | 5.2 | 5.6 | ↑ 0.5 | +8.8% |
| Min | 0.0 | 0.0 | → 0.0 | 0.0% |
| Max | 17.0 | 18.0 | ↑ 1.0 | +5.9% |

You.com MCP uses slightly more tool calls on average (+8.8%), particularly at the tail (P99 +7.1%), reflecting the additional MCP invocation overhead. Median and P90 are identical.

## Tool Call Distribution

### Builtin

```
 0 calls |  1 (0.1%)
 1 calls |  1 (0.1%)
 2 calls | ██████████████████████████████████████████████████ 443 (29.3%)
 3 calls | █████████████████ 147 (9.7%)
 4 calls | █████████████████████ 182 (12.1%)
 5 calls | ███████████████████ 169 (11.2%)
 6 calls | ████████████ 108 (7.2%)
 7 calls | ███████████ 95 (6.3%)
 8 calls | ████████████ 103 (6.8%)
 9 calls | ████████ 67 (4.4%)
10 calls | █████████ 77 (5.1%)
11 calls | ██████ 55 (3.6%)
12 calls | ███ 31 (2.1%)
13 calls | █ 13 (0.9%)
14 calls | █ 5 (0.3%)
15 calls | █ 6 (0.4%)
16 calls | █ 5 (0.3%)
17 calls |  2 (0.1%)
```

### You.com MCP

```
 0 calls | █ 4 (0.3%)
 2 calls | ████████████████████████████████████ 283 (18.7%)
 3 calls | █████████ 74 (4.9%)
 4 calls | ██████████████████████████████████████████████████ 396 (26.2%)
 5 calls | █████████████ 104 (6.9%)
 6 calls | █████████████████████ 163 (10.8%)
 7 calls | ██████████████ 114 (7.5%)
 8 calls | ██████████████ 108 (7.2%)
 9 calls | █████████ 68 (4.5%)
10 calls | ██████ 51 (3.4%)
11 calls | █████ 41 (2.7%)
12 calls | ████ 30 (2.0%)
13 calls | ███ 23 (1.5%)
14 calls | ███ 25 (1.7%)
15 calls | ██ 13 (0.9%)
16 calls | █ 9 (0.6%)
17 calls |  2 (0.1%)
18 calls |  2 (0.1%)
```

**Key observations:**
- **Zero tool calls:** Builtin=1 (0.1%), You=4 (0.3%) — nearly all trials invoke at least one tool
- **Modal value:** Builtin peaks at 2 calls (29.3%); You peaks at 4 calls (26.2%) — MCP shifts the mode right by 2
- **Heavy users (5+ calls):** Builtin=736 (48.7%), You=753 (49.9%) — similar tail behaviour

---

## Failing Prompts

### Droid-Builtin: 8 complete failures (5.3% of 151 prompts)

| Prompt ID | Pass Rate | Pass@k | Pass^k |
|-----------|-----------|--------|--------|
| websearch-2007 | 0% | 0.0% | 0.0% |
| websearch-2010 | 0% | 0.0% | 0.0% |
| websearch-2069 | 0% | 0.0% | 0.0% |
| websearch-2103 | 0% | 0.0% | 0.0% |
| websearch-2120 | 0% | 0.0% | 0.0% |
| websearch-2134 | 0% | 0.0% | 0.0% |
| websearch-2147 | 0% | 0.0% | 0.0% |
| websearch-2149 | 0% | 0.0% | 0.0% |

**Failing queries:**

**websearch-2007** — Terraform AWS EKS access_entries + policy_associations (niche module config, sparse docs)

**websearch-2010** — Apache PDFBox advanced compression techniques (deep API docs, limited coverage)

**websearch-2069** — OpenAI API spec: chat completions, embeddings, images, audio TTS, available models (competitor API docs)

**websearch-2103** — Jupiter swap versioned transaction with custom instruction + tip fee composition (Solana DeFi, very niche)

**websearch-2120** — Better Auth nextCookies magic link + SameSite None + Cloudflare Access (intersection of 3 niche configs)

**websearch-2134** — Cua (trycua) tool feature list (very niche/obscure tool, limited web presence)

**websearch-2147** — Stripe prepaid credit wallet with auto-recharge for multi-tenant (complex multi-concept integration)

**websearch-2149** — Onyx (onyx-dot-app) GitHub Slack file/image sharing support (obscure open-source app)

**Pattern:** All 8 failures are niche API documentation queries, obscure/new tools, or deeply specific integration questions where web coverage is thin. No general knowledge failures.

---

### Droid-You: 1 complete failure (0.7% of 151 prompts)

| Prompt ID | Pass Rate | Pass@k | Pass^k |
|-----------|-----------|--------|--------|
| websearch-2011 | 0% | 0.0% | 0.0% |

**websearch-2011** — AES-GCM dual key encryption where same ciphertext decrypts to different plaintexts (CTF challenge, cryptographic edge case — highly specialised, minimal search coverage)

You.com MCP resolves 7 of 8 builtin failures — the only persistent failure is a cryptographic CTF edge case with no reliable web sources.

---

*Generated by `bun scripts/summarize.ts` + `bun scripts/analyze-tool-calls.ts` + `bun scripts/visualize-tool-calls.ts` + `bun scripts/find-failing-prompts.ts`*
