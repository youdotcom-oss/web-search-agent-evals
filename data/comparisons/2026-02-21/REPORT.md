# Web Search Agent Evaluation Report
**Generated:** Tuesday, February 24, 2026 at 9:04 PM
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
| 2 | droid-builtin | 0.63 | 0.47 | 0.47 | 0.90 |

## Performance Rankings (Latency)

| Rank | Agent + Search | P50 | P90 | P99 | Mean | Total Duration |
|------|----------------|-----|-----|-----|------|----------------|
| 1 | droid-you | 56.3s | 60.0s | 60.0s | 50.3s | 75920.2s |
| 2 | droid-builtin | 60.0s | 60.0s | 60.0s | 53.8s | 81265.0s |

## Capability Metrics (Pass@k)

| Agent + Search | Avg Pass@k | 95% CI | Median Pass@k | P25 Pass@k | P75 Pass@k | Std Dev |
|----------------|------------|--------|---------------|------------|------------|----------|
| droid-you | 76.6% | [70.4%, 82.9%] | 100.0% | 65.1% | 100.0% | 0.3942 |
| droid-builtin | 51.0% | [43.5%, 58.5%] | 65.1% | 0.0% | 100.0% | 0.4724 |

### Pass@k Comparison Chart

```
droid-you                 │██████████████████████████████████████████████              │ 76.6%
                                                                    │──────│           [70.4%, 82.9%]

droid-builtin             │███████████████████████████████                             │ 51.0%
                                                    │───────│                          [43.5%, 58.5%]

                           └────────────────────────────────────────────────────────────┘
                           0%                                                        100%
```

## Flakiness Analysis

| Agent + Search | Avg Flakiness | Median Flakiness | Flaky Prompt Count |
|----------------|---------------|------------------|--------------------|
| droid-builtin | 32.4% | 0.0% | 59 |
| droid-you | 36.2% | 0.0% | 63 |

### Most Flaky Prompts

| Prompt ID | Max Flakiness |
|-----------|---------------|
| websearch-2019 | 99.8% |
| websearch-2059 | 99.8% |
| websearch-2085 | 99.8% |
| websearch-2020 | 99.4% |
| websearch-2031 | 99.4% |
| websearch-2054 | 99.4% |
| websearch-2073 | 99.4% |
| websearch-2096 | 99.4% |
| websearch-2113 | 99.4% |
| websearch-2116 | 99.4% |

## MCP Tool Impact Analysis

| Agent | Quality (builtin → MCP) | Speed (builtin → MCP) | Reliability (builtin → MCP) |
|-------|------------------------|----------------------|----------------------------|
| droid (you) | ↑ 18.5% | ↑ 6.2% | ↑ 21.9pp |


## Tool Call Statistics

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


## Failing Prompts (pass@k = 0)

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
