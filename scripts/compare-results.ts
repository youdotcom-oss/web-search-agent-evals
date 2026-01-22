#!/usr/bin/env bun
/**
 * Compare results across different tools for same agent
 *
 * @remarks
 * Uses agent-eval-harness compare command with hybrid grader (deterministic + LLM).
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
 * Run agent-eval-harness compare with hybrid grader
 */
const compare = (fileA: string, fileB: string, toolA: string, toolB: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'bunx',
      [
        '@plaited/agent-eval-harness',
        'compare',
        '--run', `${toolA}:${fileA}`,
        '--run', `${toolB}:${fileB}`,
        '--grader', './scripts/comparison-grader.ts',
        '-o', outputPath,
        '--progress'
      ],
      {
        stdio: 'inherit',
        env: { ...process.env, GEMINI_API_KEY: process.env.GEMINI_API_KEY }
      }
    )

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`agent-eval-harness compare exited with code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(new Error(`Failed to run agent-eval-harness: ${error.message}`))
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
  const comparisonFile = join(resultsDir, `${toolA}-vs-${toolB}.jsonl`)

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

  // Check GEMINI_API_KEY for hybrid grader
  if (!process.env.GEMINI_API_KEY) {
    console.error('✗ GEMINI_API_KEY environment variable is required for hybrid grader')
    console.error('  Set it in .env file or export it in your shell')
    process.exit(1)
  }

  try {
    console.log(`Comparing ${toolA} vs ${toolB} with hybrid grader...`)
    await compare(fileA, fileB, toolA, toolB, comparisonFile)

    console.log(`\n✓ Comparison complete: ${comparisonFile}`)
    console.log(`\nView results:`)
    console.log(`  cat ${comparisonFile} | jq .`)
    console.log(`  cat ${comparisonFile} | jq -r '.rankings[] | "\\(.run): rank \\(.rank) (score: \\(.score))"'`)
  } catch (error) {
    console.error(`\n✗ Comparison failed: ${error.message}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
