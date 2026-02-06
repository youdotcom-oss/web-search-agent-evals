---
name: golden-hints
description: Generate grading hints for eval prompts using AI-powered deep research
---

# Golden Hints

Generate semantic grading hints for evaluation prompts using AI deep-search APIs. Hints help graders distinguish good responses from poor ones without requiring exact string matches.

**Use when:**
- Building new evaluation suites with agent-eval-harness
- Adding grading context to existing prompts
- Creating reference-free evaluation datasets
- Improving grader accuracy with semantic guidance

## What Are Golden Hints?

**Not golden answers.** Golden hints provide grader context about what key information a correct response MUST include, without prescribing the exact format.

| Approach | Example | Problem |
|----------|---------|---------|
| ❌ Golden Answer | `"Dario Amodei"` | Too strict - rejects valid paraphrases |
| ❌ Vague Hint | `"should mention the CEO"` | Too loose - accepts wrong answers |
| ✅ Golden Hint | `"Must identify Dario Amodei as CEO of Anthropic"` | Semantic constraint, format-flexible |

**Purpose:** Help LLM-as-Judge or rule-based graders identify essential concepts without overfitting to specific phrasings.

## Quick Start

### 1. Generate Hints

```bash
# Generate hints for all prompts (uses You.com deep-search)
bun scripts/generate-hints.ts prompts.jsonl -o prompts-with-hints.jsonl

# With checkpoint support (resumable)
bun scripts/generate-hints.ts prompts.jsonl -o prompts-with-hints.jsonl --resume

# Preview without API calls
bun scripts/generate-hints.ts prompts.jsonl --dry-run
```

### 2. Use Hints in Graders

```typescript
// grader.ts - LLM-as-Judge with hint guidance
import type { Grader } from '@plaited/agent-eval-harness/schemas'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export const grade: Grader = async ({ input, output, hint }) => {
  if (!hint) {
    return { pass: true, score: 1, reasoning: 'No hint to validate against' }
  }

  const judgePrompt = `You are evaluating an AI agent's response to a user query.

**User Query:** ${input}

**Agent Response:** ${output}

**Grading Criteria:** ${hint}

Does the agent's response satisfy the grading criteria? The response doesn't need to match exactly, but must contain the key information specified in the criteria.

Respond with JSON:
{
  "pass": true/false,
  "score": 0.0-1.0,
  "reasoning": "Brief explanation of your decision"
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 300,
    messages: [{ role: 'user', content: judgePrompt }]
  })

  const result = JSON.parse(message.content[0].text)
  return {
    pass: result.pass,
    score: result.score,
    reasoning: result.reasoning
  }
}
```

### 3. Validate Hints

```bash
# Check that hints make sense
bunx @plaited/agent-eval-harness validate-refs prompts-with-hints.jsonl --grader ./grader.ts -o validation.jsonl

# Review failures
cat validation.jsonl | jq 'select(.pass == false)'
```

## Script Template

Create `scripts/generate-hints.ts` in your eval suite:

```typescript
#!/usr/bin/env bun
import { parseJsonl } from './schemas/common.ts'
import { z } from 'zod'
import { join } from 'node:path'
import { appendFileSync, writeFileSync } from 'node:fs'

// Schema - adjust metadata type for your domain
const PromptSchema = z.object({
  id: z.string(),
  input: z.union([z.string(), z.array(z.string())]),
  metadata: z.record(z.union([z.string(), z.boolean(), z.number()])).optional(),
})

type Prompt = z.infer<typeof PromptSchema>
type PromptWithHint = Prompt & { hint: string }

type Checkpoint = {
  completed: string[]
  failed: string[]
  startedAt: string
  lastUpdate: string
}

type Options = {
  dryRun: boolean
  resume: boolean
  skipFailures: boolean
}

// Constants
const RATE_LIMIT_MS = 65_000 // 60s deep-search + 5s buffer
const MAX_RETRIES = 3
const BACKOFF_MS = [5000, 10_000, 20_000]

const INPUT_FILE = join(import.meta.dir, '../data/prompts/full/prompts.jsonl')
const OUTPUT_FILE = join(import.meta.dir, '../data/prompts/full/prompts-with-hints.jsonl')
const CHECKPOINT_FILE = join(import.meta.dir, '../data/prompts/full/.hints-checkpoint.json')

// Generate hint using deep-search
const generateHint = async (prompt: Prompt): Promise<string> => {
  const inputText = Array.isArray(prompt.input) ? prompt.input.join('\n') : prompt.input

  const hintQuery = `Generate a concise grading hint (1-2 sentences) for evaluating responses to this query:

"${inputText}"

The hint should identify what key information, entities, facts, or concepts a correct answer MUST include. Be specific about critical details but avoid being overly strict. Focus on the essential elements that distinguish a good answer from a poor one.`

  const queryJson = JSON.stringify({
    query: hintQuery,
    search_effort: 'medium',
  })

  const result = await Bun.$`bunx @youdotcom-oss/api@latest deep-search --json ${queryJson} --client agent-eval-harness`.nothrow()

  if (result.exitCode !== 0) {
    throw new Error(`Deep-search failed: ${result.stderr.toString()}`)
  }

  const response = JSON.parse(result.stdout.toString())
  const answer = response.answer as string

  if (!answer) {
    throw new Error('No answer field in deep-search response')
  }

  // Extract first line as concise hint
  return answer.split('\n')[0].trim()
}

// Load checkpoint
const loadCheckpoint = async (): Promise<Checkpoint | null> => {
  const file = Bun.file(CHECKPOINT_FILE)
  if (!await file.exists()) return null

  try {
    return await file.json() as Checkpoint
  } catch {
    return null
  }
}

// Save checkpoint
const saveCheckpoint = async (checkpoint: Checkpoint): Promise<void> => {
  checkpoint.lastUpdate = new Date().toISOString()
  await Bun.write(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2))
}

// Process prompt with retry logic
const processPrompt = async (
  prompt: Prompt,
  checkpoint: Checkpoint,
  options: Options,
): Promise<boolean> => {
  if (options.dryRun) {
    console.log(`🔍 [DRY RUN] ${prompt.id}`)
    return true
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const hint = await generateHint(prompt)

      const promptWithHint: PromptWithHint = { ...prompt, hint }
      appendFileSync(OUTPUT_FILE, JSON.stringify(promptWithHint) + '\n', 'utf-8')

      checkpoint.completed.push(prompt.id)
      await saveCheckpoint(checkpoint)

      console.log(`✅ [${checkpoint.completed.length}] ${prompt.id} - "${hint.slice(0, 60)}..."`)
      return true

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`❌ Attempt ${attempt + 1}/${MAX_RETRIES} for ${prompt.id}: ${message}`)

      if (attempt === MAX_RETRIES - 1) {
        checkpoint.failed.push(prompt.id)
        const failed: PromptWithHint = { ...prompt, hint: '[FAILED - manual review needed]' }
        appendFileSync(OUTPUT_FILE, JSON.stringify(failed) + '\n', 'utf-8')
        await saveCheckpoint(checkpoint)
        return false
      }

      await Bun.sleep(BACKOFF_MS[attempt])
    }
  }

  return false
}

// Parse args
const parseArgs = (): Options => {
  const args = process.argv.slice(2)
  if (args.includes('-h') || args.includes('--help')) {
    console.log(`
Usage: bun scripts/generate-hints.ts [options]

Options:
  --dry-run          Preview without API calls
  --resume           Resume from checkpoint (default)
  --no-resume        Start fresh
  --skip-failures    Skip previously failed prompts
  -h, --help         Show help
`)
    process.exit(0)
  }

  return {
    dryRun: args.includes('--dry-run'),
    resume: !args.includes('--no-resume'),
    skipFailures: args.includes('--skip-failures'),
  }
}

// Main
const main = async (): Promise<void> => {
  const startTime = Date.now()
  const options = parseArgs()

  console.log('🔍 Generating golden hints (deep-search medium effort)')
  console.log('━'.repeat(80))

  // Load prompts
  const content = await Bun.file(INPUT_FILE).text()
  const result = parseJsonl(PromptSchema, content)

  if (result.data === null) {
    console.error('❌ Failed to parse prompts:')
    result.errors.forEach(err => console.error(`  ${err}`))
    process.exit(1)
  }

  const prompts = result.data

  // Load or create checkpoint
  let checkpoint: Checkpoint
  if (options.resume) {
    const loaded = await loadCheckpoint()
    checkpoint = loaded ?? {
      completed: [],
      failed: [],
      startedAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    }
  } else {
    checkpoint = {
      completed: [],
      failed: [],
      startedAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    }
    if (!options.dryRun) {
      writeFileSync(OUTPUT_FILE, '', 'utf-8')
    }
  }

  const remaining = prompts.filter(
    p => !checkpoint.completed.includes(p.id) &&
         !(options.skipFailures && checkpoint.failed.includes(p.id))
  )

  console.log(`\nInput:  ${INPUT_FILE} (${prompts.length} prompts)`)
  console.log(`Output: ${OUTPUT_FILE}`)
  console.log(`Resume: ${options.resume} (${checkpoint.completed.length} completed, ${remaining.length} remaining)\n`)

  // Process prompts
  let successCount = checkpoint.completed.length
  let failureCount = checkpoint.failed.length

  for (const prompt of prompts) {
    const index = prompts.indexOf(prompt) + 1

    if (checkpoint.completed.includes(prompt.id)) {
      console.log(`⏭️  [${String(index).padStart(3, '0')}/${prompts.length}] ${prompt.id} (completed)`)
      continue
    }

    if (options.skipFailures && checkpoint.failed.includes(prompt.id)) {
      console.log(`⏭️  [${String(index).padStart(3, '0')}/${prompts.length}] ${prompt.id} (skipped - failed)`)
      continue
    }

    console.log(`🔍 [${String(index).padStart(3, '0')}/${prompts.length}] ${prompt.id}`)

    const success = await processPrompt(prompt, checkpoint, options)
    if (success) {
      successCount++
    } else {
      failureCount++
    }

    // Rate limit between requests
    if (index < prompts.length && !options.dryRun) {
      await Bun.sleep(RATE_LIMIT_MS)
    }
  }

  // Summary
  const elapsedMin = ((Date.now() - startTime) / 60_000).toFixed(1)
  console.log('\n' + '━'.repeat(80))
  console.log(`\n🎉 Complete!`)
  console.log(`   ✅ Successful: ${successCount}/${prompts.length}`)
  console.log(`   ❌ Failed:     ${failureCount}/${prompts.length}`)
  console.log(`   ⏱️  Time:       ${elapsedMin} min\n`)

  if (failureCount > 0) {
    console.log('Failed prompts (manual review):')
    checkpoint.failed.forEach(id => console.log(`  - ${id}`))
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
```

## Hint Generation Strategies

### 1. Deep Research (Recommended)

Uses You.com deep-search for context-aware hints:

```bash
# Set API key
export YDC_API_KEY=ydc-sk-...

# Generate hints
bun scripts/generate-hints.ts prompts.jsonl -o prompts-with-hints.jsonl
```

**Timing:** ~60s per prompt (medium effort)
**Quality:** High - understands context, cites sources
**Cost:** API usage (check You.com pricing)

### 2. LLM Direct (Fast)

Use Claude/GPT directly for faster generation:

```typescript
const generateHint = async (prompt: Prompt): Promise<string> => {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Generate a 1-2 sentence grading hint for: "${prompt.input}". What key information must a correct answer include?`
    }]
  })

  return response.content[0].text.trim()
}
```

**Timing:** ~2s per prompt
**Quality:** Good - fast but less research depth
**Cost:** LLM API usage

### 3. Manual + AI Assist

Start with templates, AI-enhance later:

```typescript
// Template-based hints
const templates = {
  search: (query: string) => `Must identify relevant results for "${query}"`,
  code: (lang: string) => `Should produce valid ${lang} code that compiles`,
  factual: (entity: string) => `Must correctly describe ${entity}`,
}

// Enhance with AI
const enhanceHint = async (template: string): Promise<string> => {
  // Use LLM to add specifics
}
```

## Prompt Format

Hints are added to the standard PromptInput format:

```jsonl
{"id":"test-001","input":"Find CEO of Anthropic","hint":"Must identify Dario Amodei as CEO"}
{"id":"test-002","input":"Implement binary search","hint":"Should use O(log n) divide-and-conquer on sorted array"}
```

## Grader Patterns

### LLM-as-Judge (Recommended)

Most flexible and accurate for complex queries:

```typescript
import type { Grader } from '@plaited/agent-eval-harness/schemas'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export const grade: Grader = async ({ input, output, hint }) => {
  if (!hint) {
    return { pass: true, score: 1, reasoning: 'No grading criteria provided' }
  }

  const judgePrompt = `Evaluate this AI agent response:

**Query:** ${input}
**Response:** ${output}
**Criteria:** ${hint}

Does the response meet the criteria? It doesn't need exact wording, but must contain the key information.

Respond only with valid JSON:
{"pass": true/false, "score": 0.0-1.0, "reasoning": "brief explanation"}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 300,
    messages: [{ role: 'user', content: judgePrompt }]
  })

  const text = message.content[0].text
  // Extract JSON (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { pass: false, score: 0, reasoning: 'Judge failed to return valid JSON' }
  }

  const result = JSON.parse(jsonMatch[0])
  return {
    pass: result.pass,
    score: result.score,
    reasoning: result.reasoning
  }
}
```

### Keyword Extraction

For factual queries where specific entities/terms must appear:

```typescript
export const grade: Grader = async ({ output, hint }) => {
  if (!hint) return { pass: true, score: 1, reasoning: 'No hint' }

  // Extract keywords from hint (simple approach)
  const keywords = hint
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !['must', 'should', 'include'].includes(word))

  const outputLower = output.toLowerCase()
  const foundKeywords = keywords.filter(kw => outputLower.includes(kw))

  const score = foundKeywords.length / keywords.length
  const pass = score >= 0.7 // At least 70% of keywords present

  return {
    pass,
    score,
    reasoning: `Found ${foundKeywords.length}/${keywords.length} key terms: ${foundKeywords.join(', ')}`
  }
}
```

### Regex Pattern Match

For structured outputs (code, commands, specific formats):

```typescript
export const grade: Grader = async ({ output, hint }) => {
  // Extract expected patterns from hint
  const codeBlockMatch = hint.match(/`([^`]+)`/)
  if (!codeBlockMatch) {
    return { pass: true, score: 1, reasoning: 'No specific pattern in hint' }
  }

  const expectedPattern = codeBlockMatch[1]
  const hasPattern = output.includes(expectedPattern)

  return {
    pass: hasPattern,
    score: hasPattern ? 1 : 0,
    reasoning: hasPattern
      ? `Contains expected pattern: ${expectedPattern}`
      : `Missing pattern: ${expectedPattern}`
  }
}
```

### Multi-Criteria Grader

Combine multiple checks:

```typescript
export const grade: Grader = async ({ input, output, hint }) => {
  const checks = []

  // Check 1: Length (not too short)
  const lengthOk = output.length > 20
  checks.push({ name: 'length', pass: lengthOk, weight: 0.2 })

  // Check 2: Relevance (contains query terms)
  const queryTerms = input.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  const hasRelevantTerms = queryTerms.some(term => output.toLowerCase().includes(term))
  checks.push({ name: 'relevance', pass: hasRelevantTerms, weight: 0.3 })

  // Check 3: Hint criteria (LLM judge)
  if (hint) {
    const hintCheck = await llmJudge({ output, hint })
    checks.push({ name: 'criteria', pass: hintCheck.pass, weight: 0.5 })
  }

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0)
  const score = checks.reduce((sum, c) => sum + (c.pass ? c.weight : 0), 0) / totalWeight
  const pass = score >= 0.6

  const failed = checks.filter(c => !c.pass).map(c => c.name)

  return {
    pass,
    score,
    reasoning: pass
      ? `All checks passed (${(score * 100).toFixed(0)}%)`
      : `Failed: ${failed.join(', ')}`
  }
}
```

## Validation Workflow

### 1. Generate Hints

```bash
bun scripts/generate-hints.ts prompts.jsonl -o prompts-with-hints.jsonl
```

### 2. Validate Hints

Check that hints are useful (not too strict, not too vague):

```bash
# Run against reference solutions (if you have them)
bunx @plaited/agent-eval-harness validate-refs prompts-with-hints.jsonl --grader ./grader.ts -o validation.jsonl

# Check pass rate
cat validation.jsonl | jq '[.pass] | add / length'
```

**Target pass rate:** 90-95%
- Too low (<80%) → Hints too strict or grader too harsh
- Too high (>98%) → Hints too vague or grader too lenient

### 3. Sample Review

Manually review a sample of hints:

```bash
# Random sample of 10 hints
cat prompts-with-hints.jsonl | shuf -n 10 | jq '{id, input: .input[0:80], hint}'
```

Check for:
- ❌ **Too specific:** `"Must output exactly 'Hello, World!'"`
- ❌ **Too vague:** `"Should be relevant"`
- ✅ **Just right:** `"Must identify Python as an interpreted language"`

### 4. Calibrate Grader

Use calibration to find grader bugs:

```bash
bunx @plaited/agent-eval-harness calibrate results.jsonl --sample 20 -o calibration.md
```

See [agent-eval-harness calibration docs](../agent-eval-harness@plaited_agent-eval-harness/references/calibration.md).

## Best Practices

### Hint Quality

**Good hints:**
- Identify 2-3 key facts/concepts that MUST appear
- Specify critical details (names, numbers, relationships)
- Allow format flexibility (paraphrasing OK)
- Focus on "what" not "how"

**Example:**

```typescript
// ❌ Bad - too prescriptive
hint: "Output must be: The capital of France is Paris."

// ❌ Bad - too vague
hint: "Should mention France"

// ✅ Good - semantic constraint
hint: "Must identify Paris as the capital of France"
```

### Avoiding Overfitting

**Problem:** Hints become de facto golden answers

```jsonl
{"input":"What is 2+2?","hint":"4"}
```

**Solution:** Test with valid paraphrases

```jsonl
{"input":"What is 2+2?","hint":"Must state that 2+2 equals 4"}
```

### Handling Ambiguity

When a query has multiple valid answers:

```jsonl
{"input":"Name a web framework","hint":"Must name a valid web framework (e.g., React, Vue, Django, Rails)"}
```

### Domain-Specific Hints

For technical domains, be specific:

```jsonl
{"id":"algo-001","input":"Implement quicksort","hint":"Must use divide-and-conquer with pivot selection and recursive partitioning, average O(n log n)"}
{"id":"security-001","input":"Explain XSS","hint":"Must mention Cross-Site Scripting, injecting malicious scripts into web pages, and at least one mitigation (input sanitization, CSP, escaping)"}
```

## Checkpoint Support

The script supports resumable execution:

```bash
# Start generation
bun scripts/generate-hints.ts prompts.jsonl -o prompts-with-hints.jsonl

# If interrupted, resume where you left off
bun scripts/generate-hints.ts prompts.jsonl -o prompts-with-hints.jsonl --resume
```

**Checkpoint file:** `data/prompts/full/.hints-checkpoint.json`

```json
{
  "completed": ["test-001", "test-002"],
  "failed": ["test-099"],
  "startedAt": "2026-02-05T10:00:00.000Z",
  "lastUpdate": "2026-02-05T11:30:00.000Z"
}
```

**Add to `.gitignore`:**

```
# Hint generation checkpoints
.hints-checkpoint.json
```

## Environment Setup

```bash
# Install You.com API CLI
bunx @youdotcom-oss/api@latest --help

# Set API key
export YDC_API_KEY=ydc-sk-...

# Or use .env file
echo "YDC_API_KEY=ydc-sk-..." >> .env
```

## Troubleshooting

### Rate Limits

**Symptom:** `429 Too Many Requests`

**Solution:** Increase `RATE_LIMIT_MS`:

```typescript
const RATE_LIMIT_MS = 120_000 // 2 minutes between requests
```

### API Timeouts

**Symptom:** Deep-search takes >60s

**Solution:** Use `low` effort for faster (but lower quality) hints:

```typescript
const queryJson = JSON.stringify({
  query: hintQuery,
  search_effort: 'low', // <30s
})
```

### Hint Quality Issues

**Symptom:** Hints too vague or too specific

**Solution:** Adjust the generation prompt:

```typescript
// For more specific hints
const hintQuery = `Generate a detailed grading hint (2-3 sentences) listing specific facts, entities, and concepts that must appear in a correct response to: "${prompt.input}"`

// For more flexible hints
const hintQuery = `Generate a high-level grading hint identifying the essential concepts (not exact phrasing) that distinguish a correct answer from an incorrect one for: "${prompt.input}"`
```

## Integration with Agent-Eval-Harness

### 1. Generate Hints

```bash
bun scripts/generate-hints.ts data/prompts/full/prompts.jsonl -o data/prompts/full/prompts-with-hints.jsonl
```

### 2. Replace Original Prompts

```bash
mv data/prompts/full/prompts.jsonl data/prompts/full/prompts-without-hints.jsonl
mv data/prompts/full/prompts-with-hints.jsonl data/prompts/full/prompts.jsonl
```

### 3. Run Evaluations

```bash
# Capture trajectories with hints
bunx @plaited/agent-eval-harness capture data/prompts/full/prompts.jsonl \
  --schema ./claude.json \
  --grader ./grader.ts \
  -o results.jsonl

# Hints are automatically passed to grader
```

### 4. Validate Results

```bash
# Check hint effectiveness
bunx @plaited/agent-eval-harness summarize results.jsonl -o summary.jsonl
cat summary.jsonl | jq '{id, pass, score, hint: .hint[0:60]}'
```

## Related Skills

- **[agent-eval-harness](../agent-eval-harness@plaited_agent-eval-harness/SKILL.md)** - Trajectory capture and evaluation framework
- **[youdotcom-cli](../youdotcom-cli/SKILL.md)** - Deep-search API for hint generation

## Quick Reference

| Task | Command |
|------|---------|
| Generate hints | `bun scripts/generate-hints.ts prompts.jsonl -o out.jsonl` |
| Dry run | `bun scripts/generate-hints.ts --dry-run` |
| Resume | `bun scripts/generate-hints.ts --resume` |
| Validate hints | `bunx @plaited/agent-eval-harness validate-refs prompts.jsonl --grader ./grader.ts` |
| Calibrate grader | `bunx @plaited/agent-eval-harness calibrate results.jsonl --sample 20` |
| Sample review | `cat prompts.jsonl | shuf -n 10 | jq '{id, hint}'` |
