import { test, expect } from 'bun:test'

/**
 * Tests for prompt conversion utility
 *
 * @remarks
 * Tests keyword to XML conversion, time marker addition, and metadata preservation
 */

type Prompt = {
  id: string
  input: string
  metadata?: Record<string, unknown>
}

/**
 * Extract convertPrompt function for testing
 * (Duplicated from script to avoid import issues with script execution)
 */
const convertPrompt = (prompt: Prompt): Prompt => {
  let { input } = prompt

  if (input.includes('<web-search>')) {
    return prompt
  }

  let question = input
  const year = new Date().getFullYear()

  if (!input.includes('2024') && !input.includes('2025') && !input.includes('2026')) {
    question = `${question} ${year}`
  }

  if (!question.endsWith('?')) {
    if (input.toLowerCase().includes('how') || input.toLowerCase().includes('tutorial')) {
      question = `How do I find information about: ${question}?`
    } else {
      question = `Find current information about: ${question}`
    }
  }

  const xmlInput = `<web-search>${question}</web-search>`

  return {
    ...prompt,
    input: xmlInput
  }
}

test('converts keyword query to XML format', () => {
  const prompt: Prompt = {
    id: 'test-1',
    input: 'landing page design patterns'
  }

  const result = convertPrompt(prompt)

  expect(result.input).toStartWith('<web-search>')
  expect(result.input).toEndWith('</web-search>')
  expect(result.input).toContain('landing page design patterns')
})

test('adds time marker to query without year', () => {
  const prompt: Prompt = {
    id: 'test-2',
    input: 'React best practices'
  }

  const result = convertPrompt(prompt)
  const currentYear = new Date().getFullYear()

  expect(result.input).toContain(currentYear.toString())
})

test('does not add time marker if year already present', () => {
  const prompt: Prompt = {
    id: 'test-3',
    input: 'TypeScript features 2024'
  }

  const result = convertPrompt(prompt)
  const currentYear = new Date().getFullYear()

  // Should not add current year if 2024 is already present
  const yearCount = (result.input.match(/202[456]/g) || []).length
  expect(yearCount).toBe(1)
  expect(result.input).toContain('2024')
})

test('converts how/tutorial queries with appropriate prefix', () => {
  const prompt: Prompt = {
    id: 'test-4',
    input: 'how to implement authentication'
  }

  const result = convertPrompt(prompt)

  expect(result.input).toContain('How do I find information about:')
  expect(result.input).toContain('authentication')
  expect(result.input).toEndWith('?</web-search>')
})

test('uses default prefix for non-how queries', () => {
  const prompt: Prompt = {
    id: 'test-5',
    input: 'authentication patterns'
  }

  const result = convertPrompt(prompt)

  expect(result.input).toContain('Find current information about:')
  expect(result.input).toContain('authentication patterns')
})

test('preserves metadata', () => {
  const prompt: Prompt = {
    id: 'test-6',
    input: 'database optimization',
    metadata: {
      category: 'Learning',
      subcategory: 'Database',
      lang: 'SQL'
    }
  }

  const result = convertPrompt(prompt)

  expect(result.id).toBe('test-6')
  expect(result.metadata).toEqual({
    category: 'Learning',
    subcategory: 'Database',
    lang: 'SQL'
  })
})

test('skips already converted prompts', () => {
  const prompt: Prompt = {
    id: 'test-7',
    input: '<web-search>Find info about: Docker</web-search>'
  }

  const result = convertPrompt(prompt)

  expect(result.input).toBe(prompt.input)
  // Should not double-wrap
  expect(result.input.match(/<web-search>/g)?.length).toBe(1)
})

test('handles non-English characters', () => {
  const prompt: Prompt = {
    id: 'test-8',
    input: '한국 정부사이트 PDF 다운로드'
  }

  const result = convertPrompt(prompt)

  expect(result.input).toContain('한국 정부사이트 PDF 다운로드')
  expect(result.input).toStartWith('<web-search>')
  expect(result.input).toEndWith('</web-search>')
})

test('handles empty metadata', () => {
  const prompt: Prompt = {
    id: 'test-9',
    input: 'test query'
  }

  const result = convertPrompt(prompt)

  expect(result.metadata).toBeUndefined()
})

test('handles queries with question marks', () => {
  const prompt: Prompt = {
    id: 'test-10',
    input: 'What are REST APIs?'
  }

  const result = convertPrompt(prompt)

  // Should not add another question mark
  expect(result.input).toContain('What are REST APIs?')
  expect(result.input).not.toContain('??')
})

test('batch conversion maintains order', () => {
  const prompts: Prompt[] = [
    { id: 'a', input: 'query 1' },
    { id: 'b', input: 'query 2' },
    { id: 'c', input: 'query 3' }
  ]

  const results = prompts.map(convertPrompt)

  expect(results[0].id).toBe('a')
  expect(results[1].id).toBe('b')
  expect(results[2].id).toBe('c')
})

test('handles special characters in query', () => {
  const prompt: Prompt = {
    id: 'test-11',
    input: 'C++ templates & STL containers'
  }

  const result = convertPrompt(prompt)

  expect(result.input).toContain('C++ templates & STL containers')
  expect(result.input).toStartWith('<web-search>')
  expect(result.input).toEndWith('</web-search>')
})
