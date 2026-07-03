import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./governance.js', () => ({
  registerGovernanceResources: vi.fn(),
}))

vi.mock('./designs.js', () => ({
  registerDesignFilesResources: vi.fn(),
}))

vi.mock('./catalog.js', () => ({
  registerMethodCatalogResource: vi.fn(),
}))

import { registerGovernanceResources } from './governance.js'
import { registerDesignFilesResources } from './designs.js'
import { registerMethodCatalogResource } from './catalog.js'
import { registerResources } from './index.js'

describe('resources index module', () => {
  it('registers governance, design, and method catalog resources', () => {
    const server = {} as McpServer

    registerResources(server, '/workspace/repo')

    expect(registerGovernanceResources).toHaveBeenCalledWith(server, '/workspace/repo')
    expect(registerDesignFilesResources).toHaveBeenCalledWith(server, '/workspace/repo')
    expect(registerMethodCatalogResource).toHaveBeenCalledWith(server)
  })
})
