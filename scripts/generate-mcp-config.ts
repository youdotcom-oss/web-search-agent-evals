#!/usr/bin/env bun
/**
 * Generate MCP configuration for specific agent+tool pairing
 *
 * @remarks
 * Reads tools/mcp-servers.json and generates agent-specific MCP config
 * using Zod schemas to ensure type safety.
 *
 * Usage:
 *   bun scripts/generate-mcp-config.ts -a claude-code -t you -c /workspace
 *   bun scripts/generate-mcp-config.ts --agent gemini --tool you --cwd /workspace
 */

import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import {
  CLAUDE_CONFIG_PATH,
  generateClaudeConfig,
} from '../tools/schemas/claude-mcp.ts'
import {
  GEMINI_CONFIG_PATH,
  generateGeminiConfig,
} from '../tools/schemas/gemini-mcp.ts'
import {
  DROID_CONFIG_PATH,
  generateDroidConfig,
} from '../tools/schemas/droid-mcp.ts'

type Agent = 'claude-code' | 'gemini' | 'droid'
type Tool = 'builtin' | 'you'

const AGENTS: Agent[] = ['claude-code', 'gemini', 'droid']
const TOOLS: Tool[] = ['builtin', 'you']

/**
 * Parse and validate CLI arguments
 */
const parseCliArgs = () => {
  const { values } = parseArgs({
    options: {
      agent: { type: 'string', short: 'a' },
      tool: { type: 'string', short: 't' },
      cwd: { type: 'string', short: 'c' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help) {
    console.log(`
Generate MCP configuration for agent+tool pairing

Usage:
  bun scripts/generate-mcp-config.ts -a <agent> -t <tool> -c <cwd>

Options:
  -a, --agent <name>   Agent name: ${AGENTS.join(', ')}
  -t, --tool <name>    Tool name: ${TOOLS.join(', ')}
  -c, --cwd <path>     Working directory for config output
  -h, --help           Show this help

Examples:
  bun scripts/generate-mcp-config.ts -a claude-code -t you -c /workspace
  bun scripts/generate-mcp-config.ts -a gemini -t builtin -c /tmp/test
`)
    process.exit(0)
  }

  if (!values.agent || !values.tool || !values.cwd) {
    console.error('Error: --agent, --tool, and --cwd are required')
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

  return { agent, tool, cwd: values.cwd }
}

/**
 * Main execution
 */
const main = async () => {
  const { agent, tool, cwd } = parseCliArgs()

  // Builtin means no MCP config needed
  if (tool === 'builtin') {
    console.log(`Agent "${agent}" using builtin tools - no MCP config needed`)
    return
  }

  // Read unified MCP server definitions
  const mcpServersPath = join(import.meta.dir, '../tools/mcp-servers.json')
  const mcpServersFile = Bun.file(mcpServersPath)

  if (!(await mcpServersFile.exists())) {
    console.error(`Error: MCP servers file not found at ${mcpServersPath}`)
    process.exit(1)
  }

  const mcpServersData = await mcpServersFile.json()
  const servers = mcpServersData.servers

  // Filter to requested tool
  const filteredServers: Record<string, any> = {}
  if (servers[tool]) {
    filteredServers[tool] = servers[tool]
  } else {
    console.error(`Error: Tool "${tool}" not found in mcp-servers.json`)
    process.exit(1)
  }

  // Generate agent-specific config
  const env = process.env as Record<string, string | undefined>
  let config: any
  let configPath: string
  let configDir: string | undefined

  switch (agent) {
    case 'claude-code':
      config = generateClaudeConfig(filteredServers, env)
      configPath = join(cwd, CLAUDE_CONFIG_PATH)
      break
    case 'gemini':
      config = generateGeminiConfig(filteredServers, env)
      configPath = join(cwd, GEMINI_CONFIG_PATH)
      configDir = join(cwd, '.gemini')
      break
    case 'droid':
      config = generateDroidConfig(filteredServers, env)
      configPath = join(cwd, DROID_CONFIG_PATH)
      configDir = join(cwd, '.factory')
      break
  }

  // Ensure config directory exists
  if (configDir) {
    await mkdir(configDir, { recursive: true })
  }

  // Write config
  await Bun.write(configPath, JSON.stringify(config, null, 2))
  console.log(`✓ Generated ${agent} MCP config at ${configPath}`)
}

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
