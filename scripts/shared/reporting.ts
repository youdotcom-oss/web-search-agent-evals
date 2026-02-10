import type { RunConfig } from "./shared.types.ts";
import { playCompletionSound } from "./sounds.ts";

/**
 * Format milliseconds as human-readable elapsed time
 *
 * @param ms - Elapsed time in milliseconds
 * @returns Formatted string like "3m 45s" or "45s"
 *
 * @public
 */
export const formatElapsed = (ms: number): string => {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(0);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

/**
 * Create a periodic status heartbeat that logs progress
 *
 * @param options - Heartbeat configuration
 * @returns Interval handle (pass to clearInterval when done)
 *
 * @public
 */
export const createStatusHeartbeat = (options: {
  runs: RunConfig[];
  completed: Set<number>;
  concurrency: number;
  intervalMs: number;
  startTime: number;
}): ReturnType<typeof setInterval> => {
  const { runs, completed, concurrency, intervalMs, startTime } = options;

  return setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = runs.length - completed.size;

    if (remaining > 0) {
      console.log(`\n⏱️  Status update (${elapsed}s elapsed):`);
      console.log(`   Completed: ${completed.size}/${runs.length}`);

      const activeLimit = concurrency === Infinity ? remaining : Math.min(concurrency, remaining);
      const queued = Math.max(0, remaining - activeLimit);
      console.log(`   Active containers: ${activeLimit}, Queued: ${queued}`);

      const stillRunning = runs
        .map((run, index) =>
          completed.has(index + 1) ? null : `[${index + 1}/${runs.length}] ${run.agent}-${run.searchProvider}`,
        )
        .filter((x) => x !== null);

      if (stillRunning.length > 0) {
        console.log(`   Running/Queued: ${stillRunning.join(", ")}`);
      }
      console.log("");
    }
  }, intervalMs);
};

/**
 * Print a final results summary and return success/failure counts
 *
 * @param options - Summary configuration
 * @returns Object with failure and success counts
 *
 * @public
 */
export const printResultsSummary = (options: {
  runs: RunConfig[];
  results: number[];
  startTime: number;
  extraLines?: string[];
}): { failures: number; successes: number } => {
  const { runs, results, startTime, extraLines } = options;

  console.log(`\n${"=".repeat(80)}`);
  console.log("FINAL RESULTS SUMMARY");
  console.log("=".repeat(80));

  const failures: Array<{ label: string; exitCode: number }> = [];
  const successes: string[] = [];

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const exitCode = results[i];

    if (!run || exitCode === undefined) {
      continue;
    }

    const label = `[${i + 1}/${runs.length}] ${run.agent}-${run.searchProvider}`;

    if (exitCode === 0) {
      successes.push(label);
      console.log(`✓ ${label}`);
    } else {
      failures.push({ label, exitCode });
      console.log(`✗ ${label} (exit code: ${exitCode})`);
    }
  }

  const totalElapsed = (Date.now() - startTime) / 1000;
  const timeDisplay = formatElapsed(totalElapsed * 1000);

  console.log(`\n${"=".repeat(80)}`);
  console.log(`Success: ${successes.length}/${runs.length}`);
  console.log(`Failed: ${failures.length}/${runs.length}`);
  console.log(`Total time: ${timeDisplay} (${totalElapsed.toFixed(1)}s)`);

  if (extraLines) {
    for (const line of extraLines) {
      console.log(line);
    }
  }

  console.log("=".repeat(80));

  if (failures.length > 0) {
    console.error(`\n⚠️  Failed scenarios (${failures.length}):`);
    for (const { label, exitCode } of failures) {
      const errorType = exitCode === 143 || exitCode === 124 ? "TIMEOUT" : "ERROR";
      console.error(`  - ${label}: ${errorType} (exit code ${exitCode})`);
    }
    console.error("\n💡 Tip: Check output above for specific error details (tool errors, MCP issues, etc.)");
  }

  return { failures: failures.length, successes: successes.length };
};

/**
 * Play completion sound and exit with appropriate code
 *
 * @param failures - Number of failed scenarios
 * @param successMessage - Custom success message (default: "All scenarios completed successfully!")
 *
 * @public
 */
export const handleExit = async (failures: number, successMessage?: string): Promise<never> => {
  if (failures > 0) {
    await playCompletionSound(false);
    process.exit(1);
  } else {
    console.log(`\n✅ ${successMessage ?? "All scenarios completed successfully!"}`);
    await playCompletionSound(true);
    process.exit(0);
  }
};
