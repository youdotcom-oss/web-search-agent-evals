#!/usr/bin/env bun
import { $ } from "bun";
import { z } from "zod";
import { readdirSync } from "node:fs";
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

/**
 * Read agent list from agent-schemas directory
 *
 * @remarks
 * Reads the name field from each schema JSON file to get the canonical agent name.
 * This ensures the manifest stays in sync with the actual agent schemas.
 */
const getAgents = async (): Promise<string[]> => {
  const schemaFiles = readdirSync("agent-schemas").filter((f) => f.endsWith(".json"));

  const agents = await Promise.all(
    schemaFiles.map(async (file) => {
      const schema = await Bun.file(`agent-schemas/${file}`).json();
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

const main = async () => {
  const runDate = (process.argv[2] ?? new Date().toISOString().split("T")[0]) as string;
  const runDir = `data/results/runs/${runDate}`;
  const agents = await getAgents();
  const searchProviders = getSearchProviders();

  if (agents.length === 0) {
    console.error("Error: No agent schemas found in agent-schemas/");
    process.exit(1);
  }

  const firstProvider = searchProviders.includes("builtin") ? "builtin" : searchProviders[0];
  if (!firstProvider) {
    console.error("Error: No search providers found");
    process.exit(1);
  }

  const samplePath = `${runDir}/${agents[0]}/${firstProvider}.jsonl`;
  if (!(await Bun.file(samplePath).exists())) {
    console.error(`Error: No full run found at ${runDir}`);
    console.error(`Expected: ${samplePath}`);
    process.exit(1);
  }

  const sampleFile = await Bun.file(samplePath).text();
  const promptCount = sampleFile.trim().split("\n").length;

  // Get git commit hash
  const commitOutput = await $`git rev-parse --short HEAD`.text();
  const commit = commitOutput.trim();

  if (!commit) {
    console.error("Error: Failed to get git commit hash");
    process.exit(1);
  }

  const entry: ManifestEntry = {
    date: runDate,
    mode: "full",
    agents,
    searchProviders,
    promptCount,
    commit: commit as string,
  };

  try {
    ManifestEntrySchema.parse(entry);
  } catch (error) {
    console.error("Error: Invalid manifest entry");
    console.error(error);
    process.exit(1);
  }

  // Check for existing entry with same date and update it instead of appending
  const manifestFile = Bun.file("data/results/MANIFEST.jsonl");
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
  await Bun.write(Bun.file("data/results/latest.json"), JSON.stringify(latestPointer, null, 2));

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
  console.log(`     git add data/results/runs/${runDate}/`);
  console.log(`     git commit -m "feat: add ${runDate} evaluation results"`);
  console.log(`\n  2. Then commit manifest (references commit from step 1):`);
  console.log(`     git add data/results/latest.json data/results/MANIFEST.jsonl`);
  console.log(`     git commit -m "chore: update manifest for ${runDate} run"`);
  console.log(`\n  For CI (single commit): Add [skip ci] to prevent infinite loops`);
};
main();
