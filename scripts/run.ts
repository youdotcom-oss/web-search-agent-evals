#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type Agent = "claude-code" | "gemini" | "droid" | "codex";
type Mode = "test" | "full";

interface RunOptions {
  agents: Agent[];
  mode?: Mode;
  dryRun?: boolean;
}

const ALL_AGENTS: Agent[] = ["claude-code", "gemini", "droid", "codex"];

const parseArgs = (args: string[]): RunOptions => {
  const agents: Agent[] = [];
  let mode: Mode | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agent" && i + 1 < args.length) {
      const agent = args[i + 1];
      if (!ALL_AGENTS.includes(agent as Agent)) {
        throw new Error(`Invalid agent: ${agent}. Must be one of: ${ALL_AGENTS.join(", ")}`);
      }
      agents.push(agent as Agent);
      i++;
    } else if (args[i] === "--mode" && i + 1 < args.length) {
      const m = args[i + 1];
      if (m !== "test" && m !== "full") {
        throw new Error(`Invalid mode: ${m}. Must be "test" or "full"`);
      }
      mode = m;
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return {
    agents: agents.length > 0 ? agents : ALL_AGENTS,
    mode,
    dryRun,
  };
};

const detectCurrentMode = async (): Promise<Mode> => {
  const composeFile = join(process.cwd(), "docker-compose.yml");
  const content = await readFile(composeFile, "utf-8");

  if (content.includes("/eval/data/prompts/test.jsonl")) {
    return "test";
  }
  if (content.includes("/eval/data/prompts/full.jsonl")) {
    return "full";
  }
  throw new Error("Could not detect current mode from docker-compose.yml");
};

const toggleMode = async (mode: Mode): Promise<void> => {
  console.log(`Toggling to ${mode} mode first...\n`);

  return new Promise((resolve, reject) => {
    const toggleProcess = spawn("bun", ["scripts/toggle-prompts.ts", "--mode", mode], {
      stdio: "inherit",
    });

    toggleProcess.on("close", (code) => {
      if (code === 0) {
        console.log("");
        resolve();
      } else {
        reject(new Error(`Toggle failed with exit code ${code}`));
      }
    });
  });
};

const runService = (service: string): Promise<number> => {
  return new Promise((resolve) => {
    console.log(`Starting: ${service}`);

    const proc = spawn("docker", ["compose", "run", "--rm", service], {
      stdio: "inherit",
    });

    proc.on("close", (code) => {
      resolve(code ?? 1);
    });

    proc.on("error", (err) => {
      console.error(`Failed to start ${service}:`, err.message);
      resolve(1);
    });
  });
};

const main = async () => {
  const args = process.argv.slice(2);

  try {
    const options = parseArgs(args);

    if (options.dryRun) {
      console.log("[DRY RUN] Validation mode - no docker commands will run\n");
    }

    // Check if mode override is requested
    if (options.mode) {
      if (options.dryRun) {
        console.log(`[DRY RUN] Would toggle to ${options.mode} mode\n`);
      } else {
        await toggleMode(options.mode);
      }
    }

    // Detect current mode
    const currentMode = await detectCurrentMode();

    console.log(`${options.dryRun ? "[DRY RUN] " : ""}Running in ${currentMode} mode`);
    console.log(`Agents: ${options.agents.join(", ")}`);
    console.log("");

    // Build service list (agent-builtin and agent-you)
    const services: string[] = [];
    for (const agent of options.agents) {
      services.push(`${agent}-builtin`, `${agent}-you`);
    }

    console.log(
      `${options.dryRun ? "[DRY RUN] Would run" : "Running"} ${services.length} services in parallel: ${services.join(", ")}\n`,
    );

    if (options.dryRun) {
      console.log("[DRY RUN] Service execution plan:");
      for (const service of services) {
        console.log(`  - docker compose run --rm ${service}`);
      }
      console.log("\n[DRY RUN] No services were executed.");
      process.exit(0);
    }

    // Run all services in parallel
    const results = await Promise.all(services.map((service) => runService(service)));

    // Report results
    console.log(`\n${"=".repeat(80)}`);
    console.log("Results:");
    console.log("=".repeat(80));

    const failures: string[] = [];
    for (let i = 0; i < services.length; i++) {
      const service = services[i];
      const exitCode = results[i];
      if (service === undefined || exitCode === undefined) {
        continue;
      }
      const status = exitCode === 0 ? "✓" : "✗";
      console.log(`${status} ${service}: exit code ${exitCode}`);

      if (exitCode !== 0) {
        failures.push(service);
      }
    }

    console.log("");

    if (failures.length > 0) {
      console.error(`Failed services (${failures.length}):`);
      failures.forEach((service) => console.error(`  - ${service}`));
      process.exit(1);
    } else {
      console.log("All services completed successfully!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
};

main();
