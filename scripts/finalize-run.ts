#!/usr/bin/env bun
import { $ } from "bun";
import { z } from "zod";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { MCP_SERVERS } from "../mcp-servers.ts";

const ManifestEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.literal("full"),
  agents: z.array(z.string()),
  searchProviders: z.array(z.string()),
  promptCount: z.number(),
  durationHours: z.number().optional(),
  commit: z.string(),
});

type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

type FinalizeOptions = {
  runDate: string;
  dataDir?: string;
  agentSchemasDir?: string;
};

/**
 * Read agent list from agent-schemas directory
 *
 * @remarks
 * Reads the name field from each schema JSON file to get the canonical agent name.
 * This ensures the manifest stays in sync with the actual agent schemas.
 */
const getAgents = async (schemasDir = "agent-schemas"): Promise<string[]> => {
  const schemaFiles = readdirSync(schemasDir).filter((f) => f.endsWith(".json"));

  const agents = await Promise.all(
    schemaFiles.map(async (file) => {
      const schema = await Bun.file(join(schemasDir, file)).json();
      return schema.name;
    }),
  );

  return agents.sort();
};

/**
 * Read search provider list from mcp-servers.ts
 *
 * @remarks
 * Returns 'builtin' plus all MCP server keys from MCP_SERVERS constant.
 * This ensures the manifest stays in sync with available search providers.
 */
const getSearchProviders = (): string[] => {
  const mcpProviders = Object.keys(MCP_SERVERS);
  return ["builtin", ...mcpProviders].sort();
};

/**
 * Finalize a full evaluation run by creating/updating manifest and latest pointer
 *
 * @param options - Configuration for the finalization
 * @returns The manifest entry created
 *
 * @public
 */
export const finalizeRun = async (options: FinalizeOptions): Promise<ManifestEntry> => {
  const { runDate, dataDir = "data/results", agentSchemasDir = "agent-schemas" } = options;
  const runDir = join(dataDir, "runs", runDate);
  const agents = await getAgents(agentSchemasDir);
  const searchProviders = getSearchProviders();

  if (agents.length === 0) {
    throw new Error(`No agent schemas found in ${agentSchemasDir}/`);
  }

  const firstProvider = searchProviders.includes("builtin") ? "builtin" : searchProviders[0];
  if (!firstProvider) {
    throw new Error("No search providers found");
  }

  const samplePath = join(runDir, agents[0]!, `${firstProvider}.jsonl`);
  if (!(await Bun.file(samplePath).exists())) {
    throw new Error(`No full run found at ${runDir}`);
  }

  const sampleFile = await Bun.file(samplePath).text();
  const promptCount = sampleFile.trim().split("\n").length;

  // Get git commit hash
  const commitOutput = await $`git rev-parse --short HEAD`.text();
  const commit = commitOutput.trim();

  if (!commit) {
    throw new Error("Failed to get git commit hash");
  }

  const entry: ManifestEntry = {
    date: runDate,
    mode: "full",
    agents,
    searchProviders,
    promptCount,
    commit: commit as string,
  };

  // Validate entry
  ManifestEntrySchema.parse(entry);

  // Check for existing entry with same date and update it instead of appending
  const manifestPath = join(dataDir, "MANIFEST.jsonl");
  const manifestFile = Bun.file(manifestPath);
  let existingEntries: ManifestEntry[] = [];

  if (await manifestFile.exists()) {
    const content = await manifestFile.text();
    if (content.trim()) {
      existingEntries = content
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as ManifestEntry);
    }
  }

  // Check if entry already exists for this date
  const existingEntry = existingEntries.find((e) => e.date === runDate);
  const isUpdate = existingEntry !== undefined;

  // Remove existing entry for this date if present
  const filteredEntries = existingEntries.filter((e) => e.date !== runDate);

  // Add new entry
  filteredEntries.push(entry);

  // Write all entries back
  await Bun.write(manifestFile, `${filteredEntries.map((e) => JSON.stringify(e)).join("\n")}\n`);

  const latestPointer = {
    date: runDate,
    path: `runs/${runDate}`,
    mode: "full",
    promptCount,
    commit: commit as string,
  };
  const latestPath = join(dataDir, "latest.json");
  await Bun.write(Bun.file(latestPath), JSON.stringify(latestPointer, null, 2));

  console.log(`✓ Manifest ${isUpdate ? "updated" : "entry created"} for ${runDate}`);
  if (isUpdate) {
    console.log("  (Replaced existing entry for this date)");
  }
  console.log(`  Agents: ${agents.join(", ")}`);
  console.log(`  Search Providers: ${searchProviders.join(", ")}`);
  console.log(`  Prompts: ${promptCount}`);
  console.log(`  Commit: ${commit}`);

  console.log(`\nRecommended workflow:`);
  console.log(`  1. Commit results first:`);
  console.log(`     git add ${dataDir}/runs/${runDate}/`);
  console.log(`     git commit -m "feat: add ${runDate} evaluation results"`);
  console.log(`\n  2. Then commit manifest (references commit from step 1):`);
  console.log(`     git add ${dataDir}/latest.json ${dataDir}/MANIFEST.jsonl`);
  console.log(`     git commit -m "chore: update manifest for ${runDate} run"`);
  console.log(`\n  For CI (single commit): Add [skip ci] to prevent infinite loops`);

  return entry;
};

const main = async () => {
  const runDate = (process.argv[2] ?? new Date().toISOString().split("T")[0]) as string;
  const dataDir = process.argv.includes("--data-dir")
    ? process.argv[process.argv.indexOf("--data-dir") + 1]
    : undefined;
  const agentSchemasDir = process.argv.includes("--schemas-dir")
    ? process.argv[process.argv.indexOf("--schemas-dir") + 1]
    : undefined;

  try {
    await finalizeRun({ runDate, dataDir, agentSchemasDir });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("Error:", error);
    }
    process.exit(1);
  }
};

if (import.meta.main) {
  main();
}
