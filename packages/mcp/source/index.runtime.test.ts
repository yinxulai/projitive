import { afterEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const connectMock = vi.fn().mockResolvedValue(undefined)
  const serverInstance = { connect: connectMock }

  return {
    connectMock,
    serverInstance,
    registerToolsMock: vi.fn(),
    registerPromptsMock: vi.fn(),
    registerResourcesMock: vi.fn(),
    mcpServerMock: vi.fn().mockImplementation(() => serverInstance),
    stdioTransportMock: vi.fn().mockImplementation(() => ({ kind: 'stdio' })),
  }
})

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: hoisted.mcpServerMock,
}))

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: hoisted.stdioTransportMock,
}))

vi.mock('./tools/index.js', () => ({
  registerTools: hoisted.registerToolsMock,
}))

vi.mock('./prompts/index.js', () => ({
  registerPrompts: hoisted.registerPromptsMock,
}))

vi.mock('./resources/index.js', () => ({
  registerResources: hoisted.registerResourcesMock,
}))

describe('index runtime module', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    hoisted.connectMock.mockClear()
    hoisted.registerToolsMock.mockClear()
    hoisted.registerPromptsMock.mockClear()
    hoisted.registerResourcesMock.mockClear()
    hoisted.mcpServerMock.mockClear()
    hoisted.stdioTransportMock.mockClear()
  })

  it('boots the MCP server, registers modules, and connects stdio transport', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await import('./index.js')
    await Promise.resolve()

    expect(hoisted.mcpServerMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'projitive',
      description: expect.stringContaining('governance-store-first outputs'),
    }))
    expect(hoisted.registerToolsMock).toHaveBeenCalledWith(hoisted.serverInstance)
    expect(hoisted.registerPromptsMock).toHaveBeenCalledWith(hoisted.serverInstance)
    expect(hoisted.registerResourcesMock).toHaveBeenCalledWith(hoisted.serverInstance, expect.any(String))
    expect(hoisted.stdioTransportMock).toHaveBeenCalledOnce()
    expect(hoisted.connectMock).toHaveBeenCalledOnce()
    expect(errorSpy).toHaveBeenCalledWith('[projitive-mcp] starting server')
    expect(errorSpy.mock.calls.some((call) => String(call[0]).includes('transport=stdio'))).toBe(true)
  })
})
