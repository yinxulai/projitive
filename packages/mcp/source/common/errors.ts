// Projitive unified error type definitions

export class ProjitiveError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, any>
  ) {
    super(message)
    this.name = "ProjitiveError"
  }
}

// Project related errors
export class ProjectError extends ProjitiveError {
  constructor(
    message: string,
    code?: string,
    details?: Record<string, any>
  ) {
    super(message, code, details)
    this.name = "ProjectError"
  }
}

export class ProjectNotFoundError extends ProjectError {
  constructor(inputPath: string) {
    super(`Project not found at path: ${inputPath}`, "PROJECT_NOT_FOUND", {
      inputPath,
    })
  }
}

export class GovernanceRootNotFoundError extends ProjectError {
  constructor(projectPath: string) {
    super(
      `Governance root not found for project: ${projectPath}`,
      "GOVERNANCE_ROOT_NOT_FOUND",
      { projectPath }
    )
  }
}

// Task related errors
export class TaskError extends ProjitiveError {
  constructor(
    message: string,
    code?: string,
    details?: Record<string, any>
  ) {
    super(message, code, details)
    this.name = "TaskError"
  }
}

export class TaskNotFoundError extends TaskError {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`, "TASK_NOT_FOUND", { taskId })
  }
}

export class InvalidTaskIdError extends TaskError {
  constructor(taskId: string) {
    super(`Invalid task ID: ${taskId}`, "INVALID_TASK_ID", { taskId })
  }
}

export class TaskValidationError extends TaskError {
  constructor(
    taskId: string,
    public readonly errors: string[]
  ) {
    super(
      `Task validation failed for ${taskId}: ${errors.join(", ")}`,
      "TASK_VALIDATION_FAILED",
      { taskId, errors }
    )
  }
}

// File operation errors
export class FileError extends ProjitiveError {
  constructor(
    message: string,
    public readonly filePath: string,
    code?: string,
    details?: Record<string, any>
  ) {
    super(message, code || "FILE_ERROR", { filePath, ...details })
    this.name = "FileError"
  }
}

export class FileNotFoundError extends FileError {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`, filePath, "FILE_NOT_FOUND")
  }
}

export class FileReadError extends FileError {
  constructor(filePath: string, cause?: Error) {
    super(`Failed to read file: ${filePath}`, filePath, "FILE_READ_ERROR", {
      cause: cause?.message,
    })
  }
}

export class FileWriteError extends FileError {
  constructor(filePath: string, cause?: Error) {
    super(`Failed to write file: ${filePath}`, filePath, "FILE_WRITE_ERROR", {
      cause: cause?.message,
    })
  }
}

// Validation errors
export class ValidationError extends ProjitiveError {
  constructor(
    message: string,
    public readonly errors: string[] = [],
    code?: string
  ) {
    super(message, code || "VALIDATION_FAILED", { errors })
    this.name = "ValidationError"
  }
}

export class ConfidenceScoreError extends ValidationError {
  constructor(
    message: string,
    public readonly score: number,
    errors: string[] = []
  ) {
    super(message, errors, "CONFIDENCE_SCORE_ERROR")
    this.score = score
  }
}

// MCP related errors
export class MCPError extends ProjitiveError {
  constructor(
    message: string,
    code?: string,
    details?: Record<string, any>
  ) {
    super(message, code, details)
    this.name = "MCPError"
  }
}

export class ResourceNotFoundError extends MCPError {
  constructor(resourceUri: string) {
    super(`Resource not found: ${resourceUri}`, "RESOURCE_NOT_FOUND", {
      resourceUri,
    })
  }
}

export class PromptNotFoundError extends MCPError {
  constructor(promptName: string) {
    super(`Prompt not found: ${promptName}`, "PROMPT_NOT_FOUND", {
      promptName,
    })
  }
}
