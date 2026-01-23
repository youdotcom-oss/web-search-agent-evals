/**
 * Shared testing utilities for CLI script tests
 *
 * @remarks
 * Provides common helpers for testing CLI scripts via Bun.spawn,
 * capturing output, and verifying behavior without side effects.
 */

type ScriptResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

/**
 * Execute a CLI script and capture output
 *
 * @remarks
 * Spawns the script using Bun, captures stdout/stderr, and returns
 * the exit code. Useful for testing CLI behavior without mocking.
 *
 * @param scriptPath - Absolute path to the script file
 * @param args - Array of command-line arguments
 * @returns Promise resolving to stdout, stderr, and exit code
 */
export const runScript = async (scriptPath: string, args: string[]): Promise<ScriptResult> => {
  const proc = Bun.spawn(["bun", scriptPath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);

  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
};
