import { describe, expect, it } from 'vitest'
import {
  ConfidenceScoreError,
  FileNotFoundError,
  FileReadError,
  FileWriteError,
  GovernanceRootNotFoundError,
  InvalidTaskIdError,
  MCPError,
  ProjectError,
  ProjectNotFoundError,
  PromptNotFoundError,
  ProjitiveError,
  ResourceNotFoundError,
  TaskError,
  TaskNotFoundError,
  TaskValidationError,
  ValidationError,
} from './errors.js'

describe('errors module', () => {
  it('constructs base and project/task hierarchy errors with metadata', () => {
    const base = new ProjitiveError('base failure', 'BASE', { a: 1 })
    const project = new ProjectError('project failure', 'PROJECT', { projectPath: '/tmp/project' })
    const task = new TaskError('task failure', 'TASK', { taskId: 'TASK-0001' })

    expect(base.name).toBe('ProjitiveError')
    expect(base.code).toBe('BASE')
    expect(base.details).toEqual({ a: 1 })
    expect(project.name).toBe('ProjectError')
    expect(project.code).toBe('PROJECT')
    expect(task.name).toBe('TaskError')
    expect(task.code).toBe('TASK')
  })

  it('constructs specific project and task lookup errors', () => {
    const projectNotFound = new ProjectNotFoundError('/tmp/missing')
    const governanceNotFound = new GovernanceRootNotFoundError('/tmp/project')
    const taskNotFound = new TaskNotFoundError('TASK-0001')
    const invalidTaskId = new InvalidTaskIdError('BAD')
    const taskValidation = new TaskValidationError('TASK-0001', ['owner required', 'links required'])

    expect(projectNotFound.code).toBe('PROJECT_NOT_FOUND')
    expect(projectNotFound.message).toContain('/tmp/missing')
    expect(governanceNotFound.code).toBe('GOVERNANCE_ROOT_NOT_FOUND')
    expect(taskNotFound.code).toBe('TASK_NOT_FOUND')
    expect(invalidTaskId.code).toBe('INVALID_TASK_ID')
    expect(taskValidation.code).toBe('TASK_VALIDATION_FAILED')
    expect(taskValidation.errors).toEqual(['owner required', 'links required'])
    expect(taskValidation.message).toContain('owner required, links required')
  })

  it('constructs file and validation related errors', () => {
    const cause = new Error('disk offline')
    const notFound = new FileNotFoundError('/tmp/a.md')
    const readError = new FileReadError('/tmp/b.md', cause)
    const writeError = new FileWriteError('/tmp/c.md', cause)
    const validation = new ValidationError('invalid input', ['field missing'])
    const confidence = new ConfidenceScoreError('bad confidence', 1.5, ['must be <= 1'])

    expect(notFound.name).toBe('FileError')
    expect(notFound.code).toBe('FILE_NOT_FOUND')
    expect(readError.details).toMatchObject({ filePath: '/tmp/b.md', cause: 'disk offline' })
    expect(writeError.details).toMatchObject({ filePath: '/tmp/c.md', cause: 'disk offline' })
    expect(validation.name).toBe('ValidationError')
    expect(validation.code).toBe('VALIDATION_FAILED')
    expect(validation.errors).toEqual(['field missing'])
    expect(confidence.code).toBe('CONFIDENCE_SCORE_ERROR')
    expect(confidence.score).toBe(1.5)
  })

  it('constructs MCP related not-found errors', () => {
    const mcp = new MCPError('mcp failed', 'MCP_GENERIC', { retry: true })
    const resource = new ResourceNotFoundError('projitive://missing')
    const prompt = new PromptNotFoundError('taskExecution')

    expect(mcp.name).toBe('MCPError')
    expect(mcp.details).toEqual({ retry: true })
    expect(resource.code).toBe('RESOURCE_NOT_FOUND')
    expect(resource.message).toContain('projitive://missing')
    expect(prompt.code).toBe('PROMPT_NOT_FOUND')
    expect(prompt.message).toContain('taskExecution')
  })
})
