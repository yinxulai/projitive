import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerDesignFilesResources } from './designs.js'

const tempPaths: string[] = []

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'projitive-design-resource-test-'))
  tempPaths.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  vi.restoreAllMocks()
})

describe('design resources registration', () => {
  it('registers discovered markdown design resources recursively', async () => {
    const root = await createTempDir()
    const designsDir = path.join(root, '.projitive', 'designs', 'mobile')
    await fs.mkdir(designsDir, { recursive: true })
    await fs.writeFile(path.join(root, '.projitive', 'designs', 'architecture.md'), '# Architecture\n', 'utf-8')
    await fs.writeFile(path.join(designsDir, 'screen.md'), '# Screen\n', 'utf-8')

    const server = { registerResource: vi.fn() } as unknown as McpServer
    await registerDesignFilesResources(server, root)

    const calls = (server.registerResource as ReturnType<typeof vi.fn>).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls.map((call) => call[0])).toEqual(expect.arrayContaining(['design-architecture', 'design-mobile-screen']))

    const mobileHandler = calls.find((call) => call[0] === 'design-mobile-screen')?.[3] as () => Promise<{ contents: Array<{ text: string; uri: string }> }>
    const result = await mobileHandler()
    expect(result.contents[0]).toEqual({
      uri: 'projitive://designs/mobile-screen',
      text: '# Screen\n',
    })
  })

  it('registers default fallback resource when designs directory is missing', async () => {
    const root = await createTempDir()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const server = { registerResource: vi.fn() } as unknown as McpServer

    await registerDesignFilesResources(server, root)

    const calls = (server.registerResource as ReturnType<typeof vi.fn>).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('designs')
    expect(warnSpy).toHaveBeenCalledOnce()

    const handler = calls[0][3] as () => Promise<{ contents: Array<{ text: string; uri: string }> }>
    await expect(handler()).resolves.toMatchObject({
      contents: [{
        uri: 'projitive://designs',
        text: '# Designs Directory\n\nDesign documents not found. Please create design files in .projitive/designs/ directory.',
      }],
    })
  })
})
