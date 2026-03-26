import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'
import { registerTaskExecutionPrompt } from './taskExecution.js'

describe('taskExecution prompt', () => {
  it('registers the prompt and renders direct taskContext entry when task is known', async () => {
    const server = { registerPrompt: vi.fn() } as unknown as McpServer

    registerTaskExecutionPrompt(server)

    const handler = (server.registerPrompt as ReturnType<typeof vi.fn>).mock.calls[0][2] as ({ projectPath, taskId }: { projectPath?: string; taskId?: string }) => Promise<{ messages: Array<{ content: { text: string } }> }>
    const result = await handler({ projectPath: '/workspace/app', taskId: 'TASK-0007' })
    const text = result.messages[0].content.text

    expect((server.registerPrompt as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('taskExecution')
    expect(text).toContain('1) Run taskContext(projectPath="/workspace/app", taskId="TASK-0007").')
    expect(text).toContain('Every status transition must have report evidence')
    expect(text).toContain('Pre-Execution Research Brief (Mandatory Gate)')
    expect(text).toContain('Fixed file name (relative to governanceDir): `designs/research/<TASK-ID>.implementation-research.md`')
    expect(text).toContain('Always read `<governanceDir>/designs/research/<TASK-ID>.implementation-research.md` before implementation')
    expect(text).toContain('Core docs review checklist (required):')
    expect(text).toContain('- [ ] architecture.md reviewed (`designs/core/architecture.md`)')
    expect(text).toContain('- [ ] code-style.md reviewed (`designs/core/code-style.md`)')
    expect(text).toContain('- [ ] ui-style.md reviewed (`designs/core/ui-style.md`)')
  })

  it('falls back to taskNext when task is not provided', async () => {
    const server = { registerPrompt: vi.fn() } as unknown as McpServer

    registerTaskExecutionPrompt(server)

    const handler = (server.registerPrompt as ReturnType<typeof vi.fn>).mock.calls[0][2] as ({ projectPath, taskId }: { projectPath?: string; taskId?: string }) => Promise<{ messages: Array<{ content: { text: string } }> }>
    const result = await handler({})
    const text = result.messages[0].content.text

    expect(text).toContain('1) Run taskNext().')
    expect(text).toContain('Governance-store-first writes only')
    expect(text).toContain('TODO -> IN_PROGRESS')
    expect(text).toContain('research brief is READY')
  })
})
