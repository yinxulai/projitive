// Common type definitions (simplified)

export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE"

export interface TaskMetadata {
  id: string
  status: TaskStatus
  title: string
  owner?: string
  summary?: string
  updatedAt: string
  links: string[]
  roadmapRefs: string[]
  subState?: {
    phase?: "discovery" | "design" | "implementation" | "testing"
    confidence?: number
    estimatedCompletion?: string
  }
  blocker?: {
    type?: "internal_dependency" | "external_dependency" | "resource" | "approval"
    reason?: string
  }
}

export interface ProjectMetadata {
  name: string
  path: string
  governanceRoot: string
  artifacts: string[]
}

export interface DesignMetadata {
  task?: string
  roadmap?: string
  owner?: string
  status?: string
  lastUpdated?: string
}

export interface ResourceDefinition {
  name: string
  uri: string
  metadata: {
    title: string
    description: string
    mimeType: string
  }
  getter: () => Promise<{ contents: { uri: string; text: string }[] }>
}

export interface PromptDefinition {
  name: string
  metadata: {
    title: string
    description: string
    argsSchema?: any
  }
  handler: (args: any) => Promise<{ messages: any[] }>
}

export const VALID_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["TODO", "BLOCKED", "DONE"],
  BLOCKED: ["IN_PROGRESS"],
  DONE: [],
}
