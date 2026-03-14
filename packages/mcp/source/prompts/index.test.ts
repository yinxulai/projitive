import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./quickStart.js', () => ({
  registerQuickStartPrompt: vi.fn(),
}))

vi.mock('./taskDiscovery.js', () => ({
  registerTaskDiscoveryPrompt: vi.fn(),
}))

vi.mock('./taskExecution.js', () => ({
  registerTaskExecutionPrompt: vi.fn(),
}))

import { registerQuickStartPrompt } from './quickStart.js'
import { registerTaskDiscoveryPrompt } from './taskDiscovery.js'
import { registerTaskExecutionPrompt } from './taskExecution.js'
import { registerPrompts } from './index.js'

describe('prompts index module', () => {
  it('registers all prompt categories', () => {
    const server = {} as McpServer

    registerPrompts(server)

    expect(registerQuickStartPrompt).toHaveBeenCalledWith(server)
    expect(registerTaskDiscoveryPrompt).toHaveBeenCalledWith(server)
    expect(registerTaskExecutionPrompt).toHaveBeenCalledWith(server)
  })
})
