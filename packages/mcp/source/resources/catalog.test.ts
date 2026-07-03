import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'
import { registerMethodCatalogResource } from './catalog.js'

describe('method catalog resource', () => {
  it('registers a discoverable usage catalog resource', async () => {
    const server = { registerResource: vi.fn() } as unknown as McpServer

    registerMethodCatalogResource(server)

    const calls = (server.registerResource as ReturnType<typeof vi.fn>).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('methodCatalog')
    expect(calls[0][1]).toBe('projitive://mcp/method-catalog')

    const handler = calls[0][3] as () => Promise<{ contents: Array<{ uri: string; text: string }> }>
    const result = await handler()

    expect(result.contents[0]).toMatchObject({
      uri: 'projitive://mcp/method-catalog',
      text: expect.stringContaining('projectScan()'),
    })
    expect(result.contents[0].text).toContain('.projitive/tasks.md')
  })
})
