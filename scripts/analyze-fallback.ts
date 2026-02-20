/**
 * Analyze how often a fallback phrase appears in droid/you.jsonl trajectories.
 *
 * Reports occurrence counts at three levels:
 *   - trajectory steps  (raw string matches)
 *   - trials            (how many individual trial runs contained ≥1 match)
 *   - prompts           (how many prompts had ≥1 matching trial)
 *
 * Usage:
 *   bun scripts/analyze-fallback.ts [path-to-results.jsonl] [--phrase "..."]
 *
 * Defaults:
 *   path   data/results/2026-02-18/droid/you.jsonl
 *   phrase "Let me try with the WebSearch tool instead:"
 *
 * @internal
 */

const DEFAULT_PATH = "data/results/2026-02-18/droid/you.jsonl";
const DEFAULT_PHRASE = "Let me try with the WebSearch tool instead:";

const args = process.argv.slice(2);
const phraseFlagIdx = args.indexOf("--phrase");
const phrase = phraseFlagIdx !== -1 ? (args[phraseFlagIdx + 1] ?? DEFAULT_PHRASE) : DEFAULT_PHRASE;
const phraseValue = phraseFlagIdx !== -1 ? args[phraseFlagIdx + 1] : undefined;
const filePath = args.find((a) => !a.startsWith("--") && a !== phraseValue) ?? DEFAULT_PATH;

// ─── Types (mirrors TrialResult schema) ─────────────────────────────────────

type TrajectoryStep = {
  type: string;
  content?: string;
  name?: string;
  status?: string;
  timestamp: number;
};

type Trial = {
  trialNum: number;
  output: string;
  trajectory?: TrajectoryStep[];
  duration?: number;
  pass?: boolean;
  score?: number;
};

type TrialResult = {
  id: string;
  input: string | string[];
  k: number;
  trials: Trial[];
};

// ─── Analysis ────────────────────────────────────────────────────────────────

type PromptHit = {
  promptId: string;
  trialsWithHit: number;
  totalTrials: number;
  stepHits: number;
  /** trial numbers (1-based) that contained the phrase */
  hitTrialNums: number[];
};

const promptHits: PromptHit[] = [];
let totalStepHits = 0;
let totalTrialHits = 0;

const text = await Bun.file(filePath).text();
const lines = text.split("\n").filter((l) => l.trim().length > 0);

for (const line of lines) {
  const record = JSON.parse(line) as TrialResult;
  let promptStepHits = 0;
  let promptTrialHits = 0;
  const hitTrialNums: number[] = [];

  for (const trial of record.trials) {
    let trialHit = false;
    for (const step of trial.trajectory ?? []) {
      if (step.content?.includes(phrase)) {
        promptStepHits++;
        totalStepHits++;
        trialHit = true;
      }
    }
    if (trialHit) {
      promptTrialHits++;
      totalTrialHits++;
      hitTrialNums.push(trial.trialNum);
    }
  }

  if (promptStepHits > 0) {
    promptHits.push({
      promptId: record.id,
      trialsWithHit: promptTrialHits,
      totalTrials: record.trials.length,
      stepHits: promptStepHits,
      hitTrialNums,
    });
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

const totalPrompts = lines.length;
const totalTrials = lines.reduce((sum, l) => {
  const r = JSON.parse(l) as TrialResult;
  return sum + r.trials.length;
}, 0);

console.log(`\nPhrase: "${phrase}"`);
console.log(`File  : ${filePath}\n`);

console.log("══ Summary ═══════════════════════════════════════════");
console.log(`Prompts  : ${promptHits.length} / ${totalPrompts} had ≥1 hit  (${pct(promptHits.length, totalPrompts)})`);
console.log(`Trials   : ${totalTrialHits} / ${totalTrials} contained phrase (${pct(totalTrialHits, totalTrials)})`);
console.log(`Steps    : ${totalStepHits} total step-level occurrences`);
console.log("══════════════════════════════════════════════════════\n");

if (promptHits.length > 0) {
  console.log("── Per-Prompt Breakdown ───────────────────────────────");
  for (const hit of promptHits.sort((a, b) => b.stepHits - a.stepHits)) {
    const trialFraction = `${hit.trialsWithHit}/${hit.totalTrials}`;
    const trialPct = pct(hit.trialsWithHit, hit.totalTrials);
    console.log(
      `  ${hit.promptId.padEnd(20)} | ${trialFraction.padStart(5)} trials (${trialPct}) | ${String(hit.stepHits).padStart(2)} steps | trials: [${hit.hitTrialNums.join(",")}]`,
    );
  }
  console.log("──────────────────────────────────────────────────────");
}

function pct(n: number, total: number): string {
  if (total === 0) return "0.0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}
