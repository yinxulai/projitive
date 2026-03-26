import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'
import { registerTaskDiscoveryPrompt } from './taskDiscovery.js'

describe('taskDiscovery prompt', () => {
  it('registers the prompt and renders project-specific discovery guidance', async () => {
    const server = { registerPrompt: vi.fn() } as unknown as McpServer

    registerTaskDiscoveryPrompt(server)

    const handler = (server.registerPrompt as ReturnType<typeof vi.fn>).mock.calls[0][2] as ({ projectPath }: { projectPath?: string }) => Promise<{ messages: Array<{ content: { text: string } }> }>
    const result = await handler({ projectPath: '/workspace/app' })
    const text = result.messages[0].content.text

    expect((server.registerPrompt as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('taskDiscovery')
    expect(text).toContain('Known project path: "/workspace/app"')
    expect(text).toContain('Method A: Auto-select with taskNext()')
    expect(text).toContain('roadmapCreate')
    expect(text).toContain('Core docs review checklist (required before DONE):')
    expect(text).toContain('- [ ] architecture.md reviewed (`designs/core/architecture.md`)')
    expect(text).toContain('- [ ] code-style.md reviewed (`designs/core/code-style.md`)')
    expect(text).toContain('- [ ] ui-style.md reviewed (`designs/core/ui-style.md`)')
  })

  it('renders unknown-project discovery steps', async () => {
    const server = { registerPrompt: vi.fn() } as unknown as McpServer

    registerTaskDiscoveryPrompt(server)

    const handler = (server.registerPrompt as ReturnType<typeof vi.fn>).mock.calls[0][2] as ({ projectPath }: { projectPath?: string }) => Promise<{ messages: Array<{ content: { text: string } }> }>
    const result = await handler({})
    const text = result.messages[0].content.text

    expect(text).toContain('Call `projectScan()` to discover all governance roots')
    expect(text).toContain('Call `projectContext(projectPath="<project-path>")` to load project context')
  })
})
