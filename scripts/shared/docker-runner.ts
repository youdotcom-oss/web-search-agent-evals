import { spawn } from "node:child_process";
import type { Agent, SearchProvider } from "./shared.types.ts";

export type DockerRunOptions = {
  agent: Agent;
  searchProvider: SearchProvider;
  envVars: string[];
  command?: string[];
  label: string;
  startBanner?: string;
  stdoutFilter?: (line: string) => boolean;
};

export type DockerRunResult = {
  exitCode: number;
  hasError: boolean;
  elapsed: number;
};

/**
 * Default stdout filter — shows progress lines, completions, errors, and status marks
 *
 * @internal
 */
const defaultStdoutFilter = (line: string): boolean =>
  (line.includes("[") && line.includes("/") && line.includes("]")) ||
  line.includes("Done!") ||
  line.includes("TIMEOUT") ||
  line.includes("ERROR") ||
  line.includes("Failed") ||
  line.match(/✓|✗|!/) !== null;

/**
 * Run a single Docker Compose scenario with streaming output
 *
 * @remarks
 * Spawns `docker compose run --rm` with the given environment variables and agent.
 * Streams stdout/stderr with selective logging and tracks errors.
 *
 * @param options - Docker run configuration
 * @returns Promise resolving to exit code, error flag, and elapsed seconds
 *
 * @public
 */
export const runDockerScenario = (options: DockerRunOptions): Promise<DockerRunResult> => {
  const { agent, envVars, command, label, startBanner, stdoutFilter } = options;
  const filter = stdoutFilter ?? defaultStdoutFilter;

  return new Promise((resolve) => {
    const startTime = Date.now();

    console.log(`\n${"=".repeat(80)}`);
    console.log(`${label} - STARTING${startBanner ? ` ${startBanner}` : ""}`);
    console.log(`${"=".repeat(80)}\n`);

    const dockerArgs = ["compose", "run", "--rm", ...envVars, agent, ...(command ?? [])];

    const proc = spawn("docker", dockerArgs, {
      stdio: "pipe",
    });

    let currentPrompt = "";
    let hasError = false;

    proc.stdout?.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        const promptMatch = line.match(/\[(\d+)\/(\d+)\]/);
        if (promptMatch) {
          currentPrompt = `${promptMatch[1]}/${promptMatch[2]}`;
        }

        if (filter(line)) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          const prefix = currentPrompt ? `[${currentPrompt}] ` : "";
          console.log(`  ${label} ${prefix}(${elapsed}s): ${line.trim()}`);

          if (line.includes("ERROR") || line.includes("Failed")) {
            hasError = true;
          }
        }
      }
    });

    proc.stderr?.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.includes("ERROR") && !line.includes("MCP ERROR")) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.error(`  ${label} (${elapsed}s): ⚠️  FATAL: ${line.trim()}`);
          hasError = true;
        } else if (line.includes("MCP ERROR")) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.warn(`  ${label} (${elapsed}s): ⚠️  WARNING: ${line.trim()}`);
        }
      }
    });

    proc.on("close", (code) => {
      const elapsed = (Date.now() - startTime) / 1000;
      const status = code === 0 ? "✓ COMPLETED" : "✗ FAILED";
      const errorNote = hasError && code === 0 ? " (had warnings)" : "";

      console.log(`\n${"=".repeat(80)}`);
      console.log(`${label} - ${status}${errorNote} (${elapsed.toFixed(1)}s, exit code: ${code})`);
      console.log(`${"=".repeat(80)}\n`);

      resolve({ exitCode: code ?? 1, hasError, elapsed });
    });

    proc.on("error", (err) => {
      const elapsed = (Date.now() - startTime) / 1000;
      console.error(`\n${"=".repeat(80)}`);
      console.error(`${label} - ✗ ERROR (${elapsed.toFixed(1)}s)`);
      console.error(`  ${err.message}`);
      console.error(`${"=".repeat(80)}\n`);
      resolve({ exitCode: 1, hasError: true, elapsed });
    });
  });
};
