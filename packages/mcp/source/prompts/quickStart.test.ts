import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'
import { registerQuickStartPrompt } from './quickStart.js'

describe('quickStart prompt', () => {
  it('registers the prompt and renders known project guidance', async () => {
    const server = { registerPrompt: vi.fn() } as unknown as McpServer

    registerQuickStartPrompt(server)

    const handler = (server.registerPrompt as ReturnType<typeof vi.fn>).mock.calls[0][2] as ({ projectPath }: { projectPath?: string }) => Promise<{ messages: Array<{ content: { text: string } }> }>
    const result = await handler({ projectPath: '/workspace/app' })
    const text = result.messages[0].content.text

    expect((server.registerPrompt as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('quickStart')
    expect(text).toContain('Known project path: "/workspace/app"')
    expect(text).toContain('taskCreate')
    expect(text).toContain('.projitive governance store is source of truth')
  })

  it('renders discovery workflow when project path is unknown', async () => {
    const server = { registerPrompt: vi.fn() } as unknown as McpServer

    registerQuickStartPrompt(server)

    const handler = (server.registerPrompt as ReturnType<typeof vi.fn>).mock.calls[0][2] as ({ projectPath }: { projectPath?: string }) => Promise<{ messages: Array<{ content: { text: string } }> }>
    const result = await handler({})
    const text = result.messages[0].content.text

    expect(text).toContain('Call `projectScan()` to discover all governance roots')
    expect(text).toContain('Call `projectLocate(inputPath="<selected-path>")` to lock governance root')
  })
})
