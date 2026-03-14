import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { capitalizeFirstLetter, formatTitle, readMarkdownOrFallback } from './utils.js'

const tempPaths: string[] = []

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'projitive-utils-test-'))
  tempPaths.push(dir)
  return dir
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempPaths.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('utils module', () => {
  it('reads markdown content when file exists and is non-empty', async () => {
    const root = await createTempDir()
    const filePath = path.join(root, 'README.md')
    await fs.writeFile(filePath, '# Hello\n', 'utf-8')

    const content = await readMarkdownOrFallback('README.md', 'Fallback', root)
    expect(content).toBe('# Hello\n')
  })

  it('returns fallback markdown for missing or empty files', async () => {
    const root = await createTempDir()
    await fs.writeFile(path.join(root, 'empty.md'), '   ', 'utf-8')

    const missing = await readMarkdownOrFallback('missing.md', 'Missing Title', root)
    const empty = await readMarkdownOrFallback('empty.md', 'Empty Title', root)

    expect(missing).toContain('# Missing Title')
    expect(missing).toContain('- status: missing-or-empty')
    expect(empty).toContain('# Empty Title')
    expect(empty).toContain('- file: empty.md')
  })

  it('logs non-ENOENT read errors before falling back', async () => {
    const root = await createTempDir()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(fs, 'readFile').mockRejectedValueOnce({ code: 'EACCES' })

    const result = await readMarkdownOrFallback('secret.md', 'Secret', root)

    expect(result).toContain('# Secret')
    expect(errorSpy).toHaveBeenCalledOnce()
  })

  it('formats title helpers consistently', () => {
    expect(capitalizeFirstLetter('task_execution')).toBe('TaskExecution')
    expect(capitalizeFirstLetter('roadmap-next')).toBe('RoadmapNext')
    expect(formatTitle('task_execution')).toBe('Task Execution')
    expect(formatTitle('roadmap-next')).toBe('Roadmap Next')
  })
})
