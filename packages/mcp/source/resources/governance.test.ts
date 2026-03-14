import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerGovernanceResources } from './governance.js'

const tempPaths: string[] = []

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'projitive-governance-resource-test-'))
  tempPaths.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  vi.restoreAllMocks()
})

describe('governance resources', () => {
  it('registers workspace, tasks, and roadmap resources from markdown files', async () => {
    const root = await createTempDir()
    const governanceDir = path.join(root, '.projitive')
    await fs.mkdir(governanceDir, { recursive: true })
    await fs.writeFile(path.join(governanceDir, 'README.md'), '# Workspace\n', 'utf-8')
    await fs.writeFile(path.join(governanceDir, 'tasks.md'), '# Tasks\n', 'utf-8')
    await fs.writeFile(path.join(governanceDir, 'roadmap.md'), '# Roadmap\n', 'utf-8')

    const server = { registerResource: vi.fn() } as unknown as McpServer
    registerGovernanceResources(server, root)

    const calls = (server.registerResource as ReturnType<typeof vi.fn>).mock.calls
    expect(calls).toHaveLength(3)

    const workspaceHandler = calls[0][3] as () => Promise<{ contents: Array<{ text: string; uri: string }> }>
    const tasksHandler = calls[1][3] as () => Promise<{ contents: Array<{ text: string; uri: string }> }>
    const roadmapHandler = calls[2][3] as () => Promise<{ contents: Array<{ text: string; uri: string }> }>

    await expect(workspaceHandler()).resolves.toMatchObject({ contents: [{ uri: 'projitive://governance/workspace', text: '# Workspace\n' }] })
    await expect(tasksHandler()).resolves.toMatchObject({ contents: [{ uri: 'projitive://governance/tasks', text: '# Tasks\n' }] })
    await expect(roadmapHandler()).resolves.toMatchObject({ contents: [{ uri: 'projitive://governance/roadmap', text: '# Roadmap\n' }] })
  })
})
