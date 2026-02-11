#!/usr/bin/env bun

/**
 * Find prompts with 0% or low pass@k rates
 */

type TrialResult = {
  id: string;
  passRate: number;
  passAtK: number;
  passExpK: number;
  trials: Array<{
    passed: boolean;
    score: number;
  }>;
};

const analyzeFailures = async (filePath: string) => {
  const file = Bun.file(filePath);
  const text = await file.text();
  const lines = text.trim().split("\n");

  const failures: Array<{ id: string; passAtK: number; passRate: number; passExpK: number }> = [];
  const lowPerformers: Array<{ id: string; passAtK: number; passRate: number; passExpK: number }> = [];

  for (const line of lines) {
    const result: TrialResult = JSON.parse(line);

    if (result.passAtK === 0) {
      failures.push({
        id: result.id,
        passAtK: result.passAtK,
        passRate: result.passRate,
        passExpK: result.passExpK,
      });
    } else if (result.passAtK < 0.5) {
      lowPerformers.push({
        id: result.id,
        passAtK: result.passAtK,
        passRate: result.passRate,
        passExpK: result.passExpK,
      });
    }
  }

  // Sort by passAtK ascending
  failures.sort((a, b) => a.passAtK - b.passAtK);
  lowPerformers.sort((a, b) => a.passAtK - b.passAtK);

  console.log(`## Droid-Builtin Failing Prompts\n`);
  console.log(`Total prompts analyzed: ${lines.length}`);
  console.log(`Complete failures (pass@k = 0%): ${failures.length}`);
  console.log(`Low performers (pass@k < 50%): ${lowPerformers.length}\n`);

  if (failures.length > 0) {
    console.log(`### Complete Failures (pass@k = 0%)\n`);
    console.log(`| Prompt ID | Pass Rate | Pass@k | Pass^k |`);
    console.log(`|-----------|-----------|--------|--------|`);
    for (const f of failures) {
      console.log(
        `| ${f.id} | ${(f.passRate * 100).toFixed(0)}% | ${(f.passAtK * 100).toFixed(1)}% | ${(f.passExpK * 100).toFixed(1)}% |`,
      );
    }
    console.log();
  }

  if (lowPerformers.length > 0) {
    console.log(`### Low Performers (0% < pass@k < 50%)\n`);
    console.log(`| Prompt ID | Pass Rate | Pass@k | Pass^k |`);
    console.log(`|-----------|-----------|--------|--------|`);
    for (const lp of lowPerformers.slice(0, 20)) {
      // Top 20
      console.log(
        `| ${lp.id} | ${(lp.passRate * 100).toFixed(0)}% | ${(lp.passAtK * 100).toFixed(1)}% | ${(lp.passExpK * 100).toFixed(1)}% |`,
      );
    }
    console.log();
  }

  return { failures, lowPerformers };
};

const main = async () => {
  const trialFile = "data/results/trials/2026-02-10/droid/builtin.jsonl";
  const { failures, lowPerformers } = await analyzeFailures(trialFile);

  // Now read prompt file to get actual queries
  const promptFile = "data/prompts/full/prompts.jsonl";
  const promptData = Bun.file(promptFile);
  const promptText = await promptData.text();
  const promptLines = promptText.trim().split("\n");

  const promptMap = new Map<string, string>();
  for (const line of promptLines) {
    const prompt = JSON.parse(line);
    promptMap.set(prompt.id, prompt.input);
  }

  // Print failing prompt queries
  if (failures.length > 0) {
    console.log(`### Failing Prompt Queries\n`);
    for (const f of failures) {
      const query = promptMap.get(f.id) ?? "Unknown";
      console.log(`**${f.id}** (pass@k=${(f.passAtK * 100).toFixed(1)}%)`);
      console.log(`> ${query}\n`);
    }
  }

  if (lowPerformers.length > 0) {
    console.log(`### Low Performer Queries (Top 10)\n`);
    for (const lp of lowPerformers.slice(0, 10)) {
      const query = promptMap.get(lp.id) ?? "Unknown";
      console.log(`**${lp.id}** (pass@k=${(lp.passAtK * 100).toFixed(1)}%)`);
      console.log(`> ${query}\n`);
    }
  }
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
