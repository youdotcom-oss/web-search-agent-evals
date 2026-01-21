#!/usr/bin/env bun
/**
 * Run single agent×tool pairing via Docker Compose
 *
 * @remarks
 * Convenience wrapper for running specific playoff pairings.
 *
 * Usage:
 *   bun scripts/run-pairing.ts -a claude-code -t you
 *   bun scripts/run-pairing.ts --agent gemini --tool builtin --prompts data/prompts/test.jsonl
 */

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
      tool: { type: 'string', short: 't' },
      prompts: { type: 'string', short: 'p', default: 'data/prompts/search-test.jsonl' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help) {
    console.log(`
Run single agent×tool pairing via Docker Compose

Usage:
  bun scripts/run-pairing.ts -a <agent> -t <tool> [-p <prompts>]

Options:
  -a, --agent <name>     Agent name: ${AGENTS.join(', ')}
  -t, --tool <name>      Tool name: ${TOOLS.join(', ')}
  -p, --prompts <path>   Prompts file (default: data/prompts/search-test.jsonl)
  -h, --help             Show this help

Examples:
  bun scripts/run-pairing.ts -a claude-code -t you
  bun scripts/run-pairing.ts -a gemini -t builtin -p data/prompts/full.jsonl
`)
    process.exit(0)
  }

  if (!values.agent || !values.tool) {
    console.error('Error: --agent and --tool are required')
    console.error('Run with --help for usage information')
    process.exit(1)
  }

  const agent = values.agent as Agent
  const tool = values.tool as Tool

  if (!AGENTS.includes(agent)) {
    console.error(`Error: Invalid agent "${agent}". Must be one of: ${AGENTS.join(', ')}`)
    process.exit(1)
  }

  if (!TOOLS.includes(tool)) {
    console.error(`Error: Invalid tool "${tool}". Must be one of: ${TOOLS.join(', ')}`)
    process.exit(1)
  }

  return { agent, tool, prompts: values.prompts as string }
}

/**
 * Run Docker Compose service
 */
const runDockerService = (serviceName: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log(`Running Docker Compose service: ${serviceName}`)

    const child = spawn('docker', ['compose', 'run', '--rm', serviceName], {
      stdio: 'inherit',
      env: process.env,
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Docker Compose exited with code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(new Error(`Failed to spawn docker compose: ${error.message}`))
    })
  })
}

/**
 * Main execution
 */
const main = async () => {
  const { agent, tool, prompts } = parseCliArgs()

  // Service name follows pattern: <agent>-<tool>
  const serviceName = `${agent}-${tool}`

  console.log(`
Playoffs Pairing
================
Agent:   ${agent}
Tool:    ${tool}
Prompts: ${prompts}
Service: ${serviceName}
`)

  try {
    await runDockerService(serviceName)
    console.log(`\n✓ Pairing completed successfully`)
    console.log(`Results: data/results/${agent}/${tool}.jsonl`)
  } catch (error) {
    console.error(`\n✗ Pairing failed: ${error.message}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
