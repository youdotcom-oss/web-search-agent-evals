#!/usr/bin/env bun
/**
 * Compare results across different tools for same agent
 *
 * @remarks
 * Uses acp-harness summarize to generate comparison markdown.
 *
 * Usage:
 *   bun scripts/compare-results.ts -a claude-code --toolA builtin --toolB you
 *   bun scripts/compare-results.ts --agent gemini --toolA you --toolB builtin
 */

import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { spawn } from 'node:child_process'

type Agent = 'claude-code' | 'gemini' | 'droid' | 'codex'
type Tool = 'builtin' | 'you'

const AGENTS: Agent[] = ['claude-code', 'gemini', 'droid', 'codex']
const TOOLS: Tool[] = ['builtin', 'you']

/**
 * Parse and validate CLI arguments
 */
const parseCliArgs = () => {
  const { values } = parseArgs({
    options: {
      agent: { type: 'string', short: 'a' },
      toolA: { type: 'string' },
      toolB: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help) {
    console.log(`
Compare results across different tools for same agent

Usage:
  bun scripts/compare-results.ts -a <agent> --toolA <tool> --toolB <tool>

Options:
  -a, --agent <name>   Agent name: ${AGENTS.join(', ')}
  --toolA <name>       First tool to compare: ${TOOLS.join(', ')}
  --toolB <name>       Second tool to compare: ${TOOLS.join(', ')}
  -h, --help           Show this help

Examples:
  bun scripts/compare-results.ts -a claude-code --toolA builtin --toolB you
  bun scripts/compare-results.ts -a gemini --toolA you --toolB builtin
`)
    process.exit(0)
  }

  if (!values.agent || !values.toolA || !values.toolB) {
    console.error('Error: --agent, --toolA, and --toolB are required')
    console.error('Run with --help for usage information')
    process.exit(1)
  }

  const agent = values.agent as Agent
  const toolA = values.toolA as Tool
  const toolB = values.toolB as Tool

  if (!AGENTS.includes(agent)) {
    console.error(`Error: Invalid agent "${agent}". Must be one of: ${AGENTS.join(', ')}`)
    process.exit(1)
  }

  if (!TOOLS.includes(toolA)) {
    console.error(`Error: Invalid toolA "${toolA}". Must be one of: ${TOOLS.join(', ')}`)
    process.exit(1)
  }

  if (!TOOLS.includes(toolB)) {
    console.error(`Error: Invalid toolB "${toolB}". Must be one of: ${TOOLS.join(', ')}`)
    process.exit(1)
  }

  if (toolA === toolB) {
    console.error('Error: toolA and toolB must be different')
    process.exit(1)
  }

  return { agent, toolA, toolB }
}

/**
 * Run acp-harness summarize
 */
const summarize = (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'bunx',
      ['@plaited/acp-harness', 'summarize', inputPath, '--markdown', '-o', outputPath],
      {
        stdio: 'inherit',
      },
    )

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`acp-harness summarize exited with code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(new Error(`Failed to run acp-harness: ${error.message}`))
    })
  })
}

/**
 * Main execution
 */
const main = async () => {
  const { agent, toolA, toolB } = parseCliArgs()

  const resultsDir = join('data', 'results', agent)
  const fileA = join(resultsDir, `${toolA}.jsonl`)
  const fileB = join(resultsDir, `${toolB}.jsonl`)
  const summaryA = join(resultsDir, `${toolA}-summary.md`)
  const summaryB = join(resultsDir, `${toolB}-summary.md`)

  console.log(`
Comparison
==========
Agent:  ${agent}
Tool A: ${toolA}
Tool B: ${toolB}
`)

  // Check if files exist
  const fileAExists = await Bun.file(fileA).exists()
  const fileBExists = await Bun.file(fileB).exists()

  if (!fileAExists) {
    console.error(`✗ Results not found: ${fileA}`)
    console.error(`  Run: bun run run-pairing -- -a ${agent} -t ${toolA}`)
    process.exit(1)
  }

  if (!fileBExists) {
    console.error(`✗ Results not found: ${fileB}`)
    console.error(`  Run: bun run run-pairing -- -a ${agent} -t ${toolB}`)
    process.exit(1)
  }

  try {
    console.log(`Generating summary for ${toolA}...`)
    await summarize(fileA, summaryA)

    console.log(`Generating summary for ${toolB}...`)
    await summarize(fileB, summaryB)

    console.log(`\n✓ Summaries generated:`)
    console.log(`  ${summaryA}`)
    console.log(`  ${summaryB}`)
    console.log(`\nTo compare, use:`)
    console.log(`  diff ${summaryA} ${summaryB}`)
    console.log(`  or`)
    console.log(`  code --diff ${summaryA} ${summaryB}`)
  } catch (error) {
    console.error(`\n✗ Comparison failed: ${error.message}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
