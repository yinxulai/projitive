import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./project.js', () => ({
  registerProjectTools: vi.fn(),
}))

vi.mock('./task.js', () => ({
  registerTaskTools: vi.fn(),
}))

vi.mock('./roadmap.js', () => ({
  registerRoadmapTools: vi.fn(),
}))

import { registerProjectTools } from './project.js'
import { registerTaskTools } from './task.js'
import { registerRoadmapTools } from './roadmap.js'
import { registerTools } from './index.js'

describe('tools index module', () => {
  it('registers all tool groups', () => {
    const server = {} as McpServer

    registerTools(server)

    expect(registerProjectTools).toHaveBeenCalledWith(server)
    expect(registerTaskTools).toHaveBeenCalledWith(server)
    expect(registerRoadmapTools).toHaveBeenCalledWith(server)
  })
})
