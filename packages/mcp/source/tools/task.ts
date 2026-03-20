import fs from 'node:fs/promises'
import path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  candidateFilesFromArtifacts,
  discoverGovernanceArtifacts,
  findTextReferences,
  ensureStore,
  loadActionableTasksFromStore,
  loadRoadmapsFromStore,
  loadTaskStatusStatsFromStore,
  loadTasksFromStore,
  replaceTasksInStore,
  upsertTaskInStore,
  getStoreVersion,
  getMarkdownViewState,
  markMarkdownViewBuilt,
  createGovernedTool,
  ToolExecutionError,
  PROJECT_LINT_CODES,
  TASK_LINT_CODES,
  renderLintSuggestions,
  type LintSuggestion,
} from '../common/index.js'
import { resolveGovernanceDir, resolveScanDepth, resolveScanRoots, discoverProjectsAcrossRoots, toProjectPath } from './project.js'
import { isValidRoadmapId } from './roadmap.js'
import type {
  Task,
  TaskStatus,
  TaskDocument,
  ActionableTaskCandidate,
} from '../types.js'
import { SUB_STATE_PHASES, BLOCKER_TYPES } from '../types.js'

// Re-export types for backwards compatibility
export type { Task, TaskStatus, TaskDocument, ActionableTaskCandidate }

export const ALLOWED_STATUS = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const
export const TASK_ID_REGEX = /^TASK-(\d+)$/
export const TASKS_MARKDOWN_FILE = 'tasks.md'
export const TASK_RESEARCH_DIR = 'designs/research'
export const TASK_RESEARCH_FILE_SUFFIX = '.implementation-research.md'
export const CORE_DESIGN_DOCS_DIR = 'designs/core'
export const CORE_ARCHITECTURE_DOC_FILE = `${CORE_DESIGN_DOCS_DIR}/architecture.md`
export const CORE_STYLE_DOC_FILE = `${CORE_DESIGN_DOCS_DIR}/style-guide.md`

type TaskResearchBriefState = {
  relativePath: string;
  absolutePath: string;
  exists: boolean;
  ready: boolean;
};

export type TaskLintSuggestion = LintSuggestion;

function taskStatusGuidance(task: Task): string[] {
  if (task.status === 'TODO') {
    return [
      '- This task is TODO: confirm scope and set execution plan before edits.',
      '- Move to IN_PROGRESS only after owner and initial evidence are ready.',
    ]
  }

  if (task.status === 'IN_PROGRESS') {
    return [
      '- This task is IN_PROGRESS: prioritize finishing with report/design evidence updates.',
      '- Verify references stay consistent before marking DONE.',
    ]
  }

  if (task.status === 'BLOCKED') {
    return [
      '- This task is BLOCKED: identify blocker and required unblock condition first.',
      '- Reopen only after blocker evidence is documented.',
    ]
  }

  return [
    '- This task is DONE: only reopen when new requirement changes scope.',
    '- Keep report evidence immutable unless correction is required.',
  ]
}

const DEFAULT_NO_TASK_DISCOVERY_GUIDANCE = [
  '- Recheck project state first: run projectContext and confirm there is truly no TODO/IN_PROGRESS task to execute.',
  '- Create new tasks via `taskCreate(...)` (do not edit tasks.md directly).',
  '- If all remaining tasks are BLOCKED, create one unblock task with explicit unblock condition and dependency owner.',
  '- Start from active roadmap milestones and split into the smallest executable slices with a single done condition each.',
  '- Prefer slices that unlock multiple downstream tasks before isolated refactors or low-impact cleanups.',
  '- Create TODO tasks only when evidence is clear: each new task must produce at least one report/designs/readme artifact update.',
  '- Skip duplicate scope: do not create tasks that overlap existing TODO/IN_PROGRESS/BLOCKED task intent.',
  '- Use quality gates for discovery candidates: user value, delivery risk reduction, or measurable throughput improvement.',
  '- Keep each discovery round small (1-3 tasks), then rerun taskNext immediately for re-ranking and execution.',
]

const DEFAULT_TASK_CONTEXT_READING_GUIDANCE = [
  '- Read governance workspace overview first (README.md / projitive://governance/workspace).',
  '- Read roadmap and active milestones (roadmap.md / projitive://governance/roadmap).',
  '- Read task view and related task cards (tasks.md / projitive://governance/tasks).',
  '- Read design specs and technical decisions under designs/ (architecture, API contracts, constraints).',
  '- Read reports/ for latest execution evidence, regressions, and unresolved risks.',
  '- Read process guides under templates/docs/project guidelines to align with local governance rules.',
  '- If available, read docs/ architecture or migration guides before major structural changes.',
]

export async function resolveNoTaskDiscoveryGuidance(governanceDir?: string): Promise<string[]> {
  void governanceDir
  return DEFAULT_NO_TASK_DISCOVERY_GUIDANCE
}

export async function resolveTaskContextReadingGuidance(governanceDir?: string): Promise<string[]> {
  void governanceDir
  return DEFAULT_TASK_CONTEXT_READING_GUIDANCE
}

async function readRoadmapIds(governanceDir: string): Promise<string[]> {
  const dbPath = path.join(governanceDir, '.projitive')
  try {
    await ensureStore(dbPath)
    const milestones = await loadRoadmapsFromStore(dbPath)
    const ids = milestones.map((item) => item.id).filter((item) => isValidRoadmapId(item))
    return Array.from(new Set(ids))
  } catch {
    return []
  }
}

export function renderTaskSeedTemplate(roadmapRef: string): string[] {
  return [
    '```markdown',
    '## TASK-0001 | TODO | Define initial executable objective',
    '- owner: ai-copilot',
    '- summary: Convert one roadmap milestone or report gap into an actionable task.',
    '- updatedAt: 2026-01-01T00:00:00.000Z',
    `- roadmapRefs: ${roadmapRef}`,
    '- links:',
    '  - README.md',
    '  - .projitive/roadmap.md',
    '```',
  ]
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function isProjectRootRelativePath(value: string): boolean {
  return value.length > 0
    && !value.startsWith('/')
    && !value.startsWith('./')
    && !value.startsWith('../')
    && !/^[A-Za-z]:\//.test(value)
}

function normalizeTaskLink(link: string): string {
  const trimmed = link.trim()
  if (trimmed.length === 0 || isHttpUrl(trimmed)) {
    return trimmed
  }

  const slashNormalized = trimmed.replace(/\\/g, '/')
  const withoutDotPrefix = slashNormalized.replace(/^\.\//, '')
  return withoutDotPrefix.replace(/^\/+/, '')
}

function resolveTaskLinkPath(projectPath: string, link: string): string {
  return path.join(projectPath, link)
}

function taskResearchBriefRelativePath(taskId: string): string {
  return `${TASK_RESEARCH_DIR}/${taskId}${TASK_RESEARCH_FILE_SUFFIX}`
}

function renderTaskResearchBriefTemplate(task: Task): string[] {
  return [
    `# ${task.id} Implementation Research Brief`,
    '',
    `Task: ${task.title}`,
    `Summary: ${task.summary || '(fill this with a short objective summary)'}`,
    '',
    '## Design Guidelines and Specs',
    '- [ ] List relevant design/governance/spec files with line location',
    '- Example: designs/ARCHITECTURE.md#L42-L76 - API boundary and constraints',
    '- Example: roadmap.md#L18 - milestone acceptance criteria',
    '',
    '## Code Architecture and Implementation Findings',
    '- [ ] Document current architecture and extension points with line location',
    '- Example: packages/mcp/source/tools/task.ts#L1020-L1130 - taskContext response assembly',
    '- Example: packages/mcp/source/prompts/taskExecution.ts#L25-L130 - execution workflow prompt',
    '',
    '## Implementation Plan',
    '- [ ] Proposed change list with impacted modules',
    '- [ ] Validation and regression test plan',
    '',
    '## Risks and Open Questions',
    '- [ ] Known risks, assumptions, and unresolved questions',
  ]
}

async function inspectTaskResearchBrief(governanceDir: string, task: Task): Promise<TaskResearchBriefState> {
  const projectPath = toProjectPath(governanceDir)
  const relativePath = taskResearchBriefRelativePath(task.id)
  const absolutePath = resolveTaskLinkPath(projectPath, relativePath)
  const exists = await fs.access(absolutePath).then(() => true).catch(() => false)
  return { relativePath, absolutePath, exists, ready: exists }
}

function collectTaskResearchBriefLintSuggestions(state: TaskResearchBriefState): TaskLintSuggestion[] {
  if (!state.exists) {
    return [{
      code: TASK_LINT_CODES.RESEARCH_BRIEF_MISSING,
      message: `Pre-execution research brief missing: ${state.relativePath}.`,
      fixHint: 'Create the file and fill required sections before implementation.',
    }]
  }
  return []
}

function inspectProjectContextDocsFromArtifacts(files: string[]) {
  const markdownFiles = files
    .map((item) => item.replace(/\\/g, '/'))
    .filter((item) => item.toLowerCase().endsWith('.md'))
  const architectureDocSuffix = `/${CORE_ARCHITECTURE_DOC_FILE}`.toLowerCase()
  const styleDocSuffix = `/${CORE_STYLE_DOC_FILE}`.toLowerCase()

  const architectureDocs = markdownFiles.filter((item) => item.toLowerCase().endsWith(architectureDocSuffix))
  const styleDocs = markdownFiles.filter((item) => item.toLowerCase().endsWith(styleDocSuffix))

  const missingArchitectureDocs = architectureDocs.length === 0
  const missingStyleDocs = styleDocs.length === 0

  return {
    architectureDocs,
    styleDocs,
    missingArchitectureDocs,
    missingStyleDocs,
    ready: !missingArchitectureDocs && !missingStyleDocs,
  }
}

function collectProjectContextDocsLintSuggestions(state: ReturnType<typeof inspectProjectContextDocsFromArtifacts>): TaskLintSuggestion[] {
  const suggestions: TaskLintSuggestion[] = []

  if (state.missingArchitectureDocs) {
    suggestions.push({
      code: PROJECT_LINT_CODES.ARCHITECTURE_DOC_MISSING,
      message: 'Project context is missing architecture design documentation.',
      fixHint: `Add required file: ${CORE_ARCHITECTURE_DOC_FILE}.`,
    })
  }

  if (state.missingStyleDocs) {
    suggestions.push({
      code: PROJECT_LINT_CODES.STYLE_DOC_MISSING,
      message: 'Project context is missing design style documentation.',
      fixHint: `Add required file: ${CORE_STYLE_DOC_FILE}.`,
    })
  }

  return suggestions
}

async function readActionableTaskCandidates(governanceDirs: string[]): Promise<ActionableTaskCandidate[]> {
  const snapshots = await Promise.all(
    governanceDirs.map(async (governanceDir) => {
      const tasksPath = path.join(governanceDir, '.projitive')
      await ensureStore(tasksPath)
      const [stats, actionableTasks] = await Promise.all([
        loadTaskStatusStatsFromStore(tasksPath),
        loadActionableTasksFromStore(tasksPath),
      ])
      return {
        governanceDir,
        tasks: actionableTasks,
        projectScore: stats.inProgress * 2 + stats.todo,
        projectLatestUpdatedAt: stats.latestUpdatedAt || '(unknown)',
      }
    })
  )

  return snapshots.flatMap((item) => item.tasks
    .filter((task) => task.status === 'IN_PROGRESS' || task.status === 'TODO')
    .map((task) => ({
      governanceDir: item.governanceDir,
      task,
      projectScore: item.projectScore,
      projectLatestUpdatedAt: item.projectLatestUpdatedAt,
      taskUpdatedAtMs: toTaskUpdatedAtMs(task.updatedAt),
      taskPriority: taskPriority(task.status),
    })))
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function isValidTaskId(id: string): boolean {
  return toTaskIdNumericSuffix(id) > 0
}

export function taskPriority(status: Task['status']): number {
  if (status === 'IN_PROGRESS') {
    return 2
  }
  if (status === 'TODO') {
    return 1
  }
  return 0
}

export function toTaskUpdatedAtMs(updatedAt: string): number {
  const timestamp = new Date(updatedAt).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function toTaskIdNumericSuffix(taskId: string): number {
  const match = taskId.match(TASK_ID_REGEX)
  if (!match) {
    return -1
  }

  const suffix = Number.parseInt(match[1], 10)
  return Number.isFinite(suffix) ? suffix : -1
}

function nextTaskId(tasks: Task[]): string {
  const maxSuffix = tasks
    .map((item) => toTaskIdNumericSuffix(item.id))
    .filter((value) => value > 0)
    .reduce((max, value) => Math.max(max, value), 0)

  const next = maxSuffix + 1
  const minWidth = Math.max(4, String(next).length)
  return `TASK-${String(next).padStart(minWidth, '0')}`
}

export function sortTasksNewestFirst(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const updatedAtDelta = toTaskUpdatedAtMs(b.updatedAt) - toTaskUpdatedAtMs(a.updatedAt)
    if (updatedAtDelta !== 0) {
      return updatedAtDelta
    }

    const idDelta = toTaskIdNumericSuffix(b.id) - toTaskIdNumericSuffix(a.id)
    if (idDelta !== 0) {
      return idDelta
    }

    return b.id.localeCompare(a.id)
  })
}

function normalizeAndSortTasks(tasks: Task[]): Task[] {
  return sortTasksNewestFirst(tasks.map((task) => normalizeTask(task)))
}

function resolveTaskArtifactPaths(governanceDir: string): { tasksPath: string; markdownPath: string } {
  return {
    tasksPath: path.join(governanceDir, '.projitive'),
    markdownPath: path.join(governanceDir, TASKS_MARKDOWN_FILE),
  }
}

async function syncTasksMarkdownView(tasksPath: string, markdownPath: string, markdown: string, force = false): Promise<void> {
  const sourceVersion = await getStoreVersion(tasksPath, 'tasks')
  const viewState = await getMarkdownViewState(tasksPath, 'tasks_markdown')
  const markdownExists = await fs.access(markdownPath).then(() => true).catch(() => false)

  const shouldWrite = force
    || !markdownExists
    || viewState.dirty
    || viewState.lastSourceVersion !== sourceVersion

  if (!shouldWrite) {
    return
  }

  await fs.writeFile(markdownPath, markdown, 'utf-8')
  await markMarkdownViewBuilt(tasksPath, 'tasks_markdown', sourceVersion)
}

export function rankActionableTaskCandidates(candidates: ActionableTaskCandidate[]): ActionableTaskCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.projectScore !== a.projectScore) {
      return b.projectScore - a.projectScore
    }
    if (b.taskPriority !== a.taskPriority) {
      return b.taskPriority - a.taskPriority
    }
    if (b.taskUpdatedAtMs !== a.taskUpdatedAtMs) {
      return b.taskUpdatedAtMs - a.taskUpdatedAtMs
    }
    if (a.governanceDir !== b.governanceDir) {
      return a.governanceDir.localeCompare(b.governanceDir)
    }
    return a.task.id.localeCompare(b.task.id)
  })
}

export function normalizeTask(task: Partial<Task> & { id: string; title: string }): Task {
  const normalizedRoadmapRefs = Array.isArray(task.roadmapRefs)
    ? task.roadmapRefs.map(String).filter((value) => isValidRoadmapId(value))
    : []

  const normalized: Task = {
    id: String(task.id),
    title: String(task.title),
    status: ALLOWED_STATUS.includes(task.status as TaskStatus) ? (task.status as TaskStatus) : 'TODO',
    owner: task.owner ? String(task.owner) : '',
    summary: task.summary ? String(task.summary) : '',
    updatedAt: task.updatedAt ? String(task.updatedAt) : nowIso(),
    links: Array.isArray(task.links)
      ? Array.from(
          new Set(
            task.links
              .map(String)
              .map((value) => normalizeTaskLink(value))
              .filter((value) => value.length > 0)
          )
        )
      : [],
    roadmapRefs: Array.from(new Set(normalizedRoadmapRefs)),
  }

  // Include optional v1.1.0 fields if present
  if (task.subState) {
    normalized.subState = task.subState
  }
  if (task.blocker) {
    normalized.blocker = task.blocker
  }

  return normalized
}

function collectTaskLintSuggestionItems(tasks: Task[]): TaskLintSuggestion[] {
  const suggestions: TaskLintSuggestion[] = []

  const duplicateIds = Array.from(
    tasks.reduce((counter, task) => {
      counter.set(task.id, (counter.get(task.id) ?? 0) + 1)
      return counter
    }, new Map<string, number>())
      .entries()
  )
    .filter(([, count]) => count > 1)
    .map(([id]) => id)

  if (duplicateIds.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.DUPLICATE_ID,
      message: `Duplicate task IDs detected: ${duplicateIds.join(', ')}.`,
      fixHint: 'Keep task IDs unique in marker block.',
    })
  }

  const inProgressWithoutOwner = tasks.filter((task) => task.status === 'IN_PROGRESS' && task.owner.trim().length === 0)
  if (inProgressWithoutOwner.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.IN_PROGRESS_OWNER_EMPTY,
      message: `${inProgressWithoutOwner.length} IN_PROGRESS task(s) have empty owner.`,
      fixHint: 'Set owner before continuing execution.',
    })
  }

  const doneWithoutLinks = tasks.filter((task) => task.status === 'DONE' && task.links.length === 0)
  if (doneWithoutLinks.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.DONE_LINKS_MISSING,
      message: `${doneWithoutLinks.length} DONE task(s) have no links evidence.`,
      fixHint: 'Add at least one evidence link before keeping DONE.',
    })
  }

  const blockedWithoutReason = tasks.filter((task) => task.status === 'BLOCKED' && task.summary.trim().length === 0)
  if (blockedWithoutReason.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKED_SUMMARY_EMPTY,
      message: `${blockedWithoutReason.length} BLOCKED task(s) have empty summary.`,
      fixHint: 'Add blocker reason and unblock condition.',
    })
  }

  const invalidUpdatedAt = tasks.filter((task) => !Number.isFinite(new Date(task.updatedAt).getTime()))
  if (invalidUpdatedAt.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.UPDATED_AT_INVALID,
      message: `${invalidUpdatedAt.length} task(s) have invalid updatedAt format.`,
      fixHint: 'Use ISO8601 UTC timestamp.',
    })
  }

  const missingRoadmapRefs = tasks.filter((task) => task.roadmapRefs.length === 0)
  if (missingRoadmapRefs.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.ROADMAP_REFS_EMPTY,
      message: `${missingRoadmapRefs.length} task(s) have empty roadmapRefs.`,
      fixHint: 'Bind at least one ROADMAP-xxxx when applicable.',
    })
  }

  const invalidLinkPathFormat = tasks.filter((task) => task.links.some((link) => {
    const normalized = link.trim()
    return normalized.length > 0 && !isHttpUrl(normalized) && !isProjectRootRelativePath(normalized)
  }))
  if (invalidLinkPathFormat.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.LINK_PATH_FORMAT_INVALID,
      message: `${invalidLinkPathFormat.length} task(s) contain invalid links path format.`,
      fixHint: 'Use project-root-relative paths without leading slash (for example reports/task-0001.md) or http(s) URL.',
    })
  }

  // ============================================================================
  // Spec v1.1.0 - Blocker Categorization Validation
  // ============================================================================

  const blockedWithoutBlocker = tasks.filter((task) => task.status === 'BLOCKED' && !task.blocker)
  if (blockedWithoutBlocker.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKED_WITHOUT_BLOCKER,
      message: `${blockedWithoutBlocker.length} BLOCKED task(s) have no blocker metadata.`,
      fixHint: 'Add structured blocker metadata with type and description.',
    })
  }

  const blockerTypeInvalid = tasks.filter((task) => task.blocker && !BLOCKER_TYPES.includes(task.blocker.type))
  if (blockerTypeInvalid.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKER_TYPE_INVALID,
      message: `${blockerTypeInvalid.length} task(s) have invalid blocker type.`,
      fixHint: `Use one of: ${BLOCKER_TYPES.join(', ')}.`,
    })
  }

  const blockerDescriptionEmpty = tasks.filter((task) => task.blocker && !task.blocker.description?.trim())
  if (blockerDescriptionEmpty.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKER_DESCRIPTION_EMPTY,
      message: `${blockerDescriptionEmpty.length} task(s) have empty blocker description.`,
      fixHint: 'Provide a clear description of why the task is blocked.',
    })
  }

  // ============================================================================
  // Spec v1.1.0 - Sub-state Metadata Validation (Optional but Recommended)
  // ============================================================================

  const inProgressWithoutSubState = tasks.filter((task) => task.status === 'IN_PROGRESS' && !task.subState)
  if (inProgressWithoutSubState.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.IN_PROGRESS_WITHOUT_SUBSTATE,
      message: `${inProgressWithoutSubState.length} IN_PROGRESS task(s) have no subState metadata.`,
      fixHint: 'Add optional subState metadata for better progress tracking.',
    })
  }

  const subStatePhaseInvalid = tasks.filter(
    (task) => task.subState?.phase && !SUB_STATE_PHASES.includes(task.subState.phase)
  )
  if (subStatePhaseInvalid.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.SUBSTATE_PHASE_INVALID,
      message: `${subStatePhaseInvalid.length} task(s) have invalid subState phase.`,
      fixHint: `Use one of: ${SUB_STATE_PHASES.join(', ')}.`,
    })
  }

  const subStateConfidenceInvalid = tasks.filter(
    (task) => typeof task.subState?.confidence === 'number' && (task.subState.confidence < 0 || task.subState.confidence > 1)
  )
  if (subStateConfidenceInvalid.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.SUBSTATE_CONFIDENCE_INVALID,
      message: `${subStateConfidenceInvalid.length} task(s) have invalid confidence score.`,
      fixHint: 'Confidence must be between 0.0 and 1.0.',
    })
  }

  return suggestions
}

export function collectTaskLintSuggestions(tasks: Task[]): string[] {
  return renderLintSuggestions(collectTaskLintSuggestionItems(tasks))
}

function collectSingleTaskLintSuggestionItems(task: Task): TaskLintSuggestion[] {
  const suggestions: TaskLintSuggestion[] = []

  if (task.status === 'IN_PROGRESS' && task.owner.trim().length === 0) {
    suggestions.push({
      code: TASK_LINT_CODES.IN_PROGRESS_OWNER_EMPTY,
      message: 'Current task is IN_PROGRESS but owner is empty.',
      fixHint: 'Set owner before continuing execution.',
    })
  }

  if (task.status === 'DONE' && task.links.length === 0) {
    suggestions.push({
      code: TASK_LINT_CODES.DONE_LINKS_MISSING,
      message: 'Current task is DONE but has no links evidence.',
      fixHint: 'Add at least one evidence link.',
    })
  }

  const invalidLinkPathFormat = task.links.some((link) => {
    const normalized = link.trim()
    return normalized.length > 0 && !isHttpUrl(normalized) && !isProjectRootRelativePath(normalized)
  })
  if (invalidLinkPathFormat) {
    suggestions.push({
      code: TASK_LINT_CODES.LINK_PATH_FORMAT_INVALID,
      message: 'Current task has invalid links path format.',
      fixHint: 'Use project-root-relative paths without leading slash (for example reports/task-0001.md) or http(s) URL.',
    })
  }

  if (task.status === 'BLOCKED' && task.summary.trim().length === 0) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKED_SUMMARY_EMPTY,
      message: 'Current task is BLOCKED but summary is empty.',
      fixHint: 'Add blocker reason and unblock condition.',
    })
  }

  if (!Number.isFinite(new Date(task.updatedAt).getTime())) {
    suggestions.push({
      code: TASK_LINT_CODES.UPDATED_AT_INVALID,
      message: 'Current task updatedAt is invalid.',
      fixHint: 'Use ISO8601 UTC timestamp.',
    })
  }

  if (task.roadmapRefs.length === 0) {
    suggestions.push({
      code: TASK_LINT_CODES.ROADMAP_REFS_EMPTY,
      message: 'Current task has empty roadmapRefs.',
      fixHint: 'Bind ROADMAP-xxxx where applicable.',
    })
  }

  // ============================================================================
  // Spec v1.1.0 - Blocker Categorization Validation (Single Task)
  // ============================================================================

  if (task.status === 'BLOCKED' && !task.blocker) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKED_WITHOUT_BLOCKER,
      message: 'Current task is BLOCKED but has no blocker metadata.',
      fixHint: 'Add structured blocker metadata with type and description.',
    })
  }

  if (task.blocker && !BLOCKER_TYPES.includes(task.blocker.type)) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKER_TYPE_INVALID,
      message: `Current task has invalid blocker type: ${task.blocker.type}.`,
      fixHint: `Use one of: ${BLOCKER_TYPES.join(', ')}.`,
    })
  }

  if (task.blocker && !task.blocker.description?.trim()) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKER_DESCRIPTION_EMPTY,
      message: 'Current task has empty blocker description.',
      fixHint: 'Provide a clear description of why the task is blocked.',
    })
  }

  // ============================================================================
  // Spec v1.1.0 - Sub-state Metadata Validation (Single Task, Optional)
  // ============================================================================

  if (task.status === 'IN_PROGRESS' && !task.subState) {
    suggestions.push({
      code: TASK_LINT_CODES.IN_PROGRESS_WITHOUT_SUBSTATE,
      message: 'Current task is IN_PROGRESS but has no subState metadata.',
      fixHint: 'Add optional subState metadata for better progress tracking.',
    })
  }

  if (task.subState?.phase && !SUB_STATE_PHASES.includes(task.subState.phase)) {
    suggestions.push({
      code: TASK_LINT_CODES.SUBSTATE_PHASE_INVALID,
      message: `Current task has invalid subState phase: ${task.subState.phase}.`,
      fixHint: `Use one of: ${SUB_STATE_PHASES.join(', ')}.`,
    })
  }

  if (typeof task.subState?.confidence === 'number' && (task.subState.confidence < 0 || task.subState.confidence > 1)) {
    suggestions.push({
      code: TASK_LINT_CODES.SUBSTATE_CONFIDENCE_INVALID,
      message: `Current task has invalid confidence score: ${task.subState.confidence}.`,
      fixHint: 'Confidence must be between 0.0 and 1.0.',
    })
  }

  return suggestions
}

function collectSingleTaskLintSuggestions(task: Task): string[] {
  return renderLintSuggestions(collectSingleTaskLintSuggestionItems(task))
}

async function collectDoneConformanceSuggestions(governanceDir: string, task: Task): Promise<TaskLintSuggestion[]> {
  const researchBriefState = await inspectTaskResearchBrief(governanceDir, task)
  const artifacts = await discoverGovernanceArtifacts(governanceDir)
  const fileCandidates = candidateFilesFromArtifacts(artifacts)
  const projectContextDocsState = inspectProjectContextDocsFromArtifacts(fileCandidates)
  return [
    ...collectSingleTaskLintSuggestionItems(task),
    ...collectTaskResearchBriefLintSuggestions(researchBriefState),
    ...collectProjectContextDocsLintSuggestions(projectContextDocsState),
  ]
}

export function renderTasksMarkdown(tasks: Task[]): string {
  const sections = sortTasksNewestFirst(tasks).map((task) => {
    const roadmapRefs = task.roadmapRefs.length > 0 ? task.roadmapRefs.join(', ') : '(none)'
    const links = task.links.length > 0
      ? ['- links:', ...task.links.map((link) => `  - ${link}`)]
      : ['- links:', '  - (none)']

    const lines = [
      `## ${task.id} | ${task.status} | ${task.title}`,
      `- owner: ${task.owner || '(none)'}`,
      `- summary: ${task.summary || '(none)'}`,
      `- updatedAt: ${task.updatedAt}`,
      `- roadmapRefs: ${roadmapRefs}`,
      ...links,
    ]

    // Add subState for IN_PROGRESS tasks (Spec v1.1.0)
    if (task.subState && task.status === 'IN_PROGRESS') {
      lines.push('- subState:')
      if (task.subState.phase) {
        lines.push(`  - phase: ${task.subState.phase}`)
      }
      if (typeof task.subState.confidence === 'number') {
        lines.push(`  - confidence: ${task.subState.confidence}`)
      }
      if (task.subState.estimatedCompletion) {
        lines.push(`  - estimatedCompletion: ${task.subState.estimatedCompletion}`)
      }
    }

    // Add blocker for BLOCKED tasks (Spec v1.1.0)
    if (task.blocker && task.status === 'BLOCKED') {
      lines.push('- blocker:')
      lines.push(`  - type: ${task.blocker.type}`)
      lines.push(`  - description: ${task.blocker.description}`)
      if (task.blocker.blockingEntity) {
        lines.push(`  - blockingEntity: ${task.blocker.blockingEntity}`)
      }
      if (task.blocker.unblockCondition) {
        lines.push(`  - unblockCondition: ${task.blocker.unblockCondition}`)
      }
      if (task.blocker.escalationPath) {
        lines.push(`  - escalationPath: ${task.blocker.escalationPath}`)
      }
    }

    return lines.join('\n')
  })

  return [
    '# Tasks',
    '',
    'Projitive is an AI-first project governance framework for tasks, roadmaps, reports, and designs.',
    'Author: yinxulai',
    'Repository: https://github.com/yinxulai/projitive',
    'Do not edit this file manually. This file is automatically generated by Projitive.',
    'This file is generated from .projitive governance store by Projitive MCP. Manual edits will be overwritten.',
    '',
    ...(sections.length > 0 ? sections : ['(no tasks)']),
    '',
  ].join('\n')
}

export async function ensureTasksFile(inputPath: string): Promise<string> {
  const governanceDir = await resolveGovernanceDir(inputPath)
  const { tasksPath, markdownPath } = resolveTaskArtifactPaths(governanceDir)

  await fs.mkdir(governanceDir, { recursive: true })
  await ensureStore(tasksPath)

  const tasks = normalizeAndSortTasks(await loadTasksFromStore(tasksPath))

  await syncTasksMarkdownView(tasksPath, markdownPath, renderTasksMarkdown(tasks))

  return tasksPath
}

export async function loadTasks(inputPath: string): Promise<{ tasksPath: string; tasks: Task[] }> {
  const { tasksPath, tasks } = await loadTasksDocument(inputPath)
  return { tasksPath, tasks }
}

export async function loadTasksDocument(inputPath: string): Promise<TaskDocument> {
  return loadTasksDocumentWithOptions(inputPath, false)
}

export async function loadTasksDocumentWithOptions(inputPath: string, forceViewSync: boolean): Promise<TaskDocument> {
  const tasksPath = await ensureTasksFile(inputPath)
  const tasks = normalizeAndSortTasks(await loadTasksFromStore(tasksPath))
  const markdown = renderTasksMarkdown(tasks)
  const markdownPath = path.join(path.dirname(tasksPath), TASKS_MARKDOWN_FILE)
  await syncTasksMarkdownView(tasksPath, markdownPath, markdown, forceViewSync)
  return { tasksPath, markdownPath, markdown, tasks }
}

export async function saveTasks(tasksPath: string, tasks: Task[]): Promise<void> {
  const normalized = normalizeAndSortTasks(tasks)
  const markdownPath = path.join(path.dirname(tasksPath), TASKS_MARKDOWN_FILE)
  await replaceTasksInStore(tasksPath, normalized)
  await syncTasksMarkdownView(tasksPath, markdownPath, renderTasksMarkdown(normalized))
}

export function validateTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) {
    return true
  }

  const allowed: Record<TaskStatus, Set<TaskStatus>> = {
    TODO: new Set(['IN_PROGRESS', 'BLOCKED']),
    IN_PROGRESS: new Set(['BLOCKED', 'DONE']),
    BLOCKED: new Set(['IN_PROGRESS', 'TODO']),
    DONE: new Set(),
  }

  return allowed[from].has(to)
}

export function registerTaskTools(server: McpServer): void {
  server.registerTool(
    ...createGovernedTool({
      name: 'taskList',
      title: 'Task List',
      description: 'List tasks for a known project and optionally filter by status',
      inputSchema: {
        projectPath: z.string(),
        status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
      async execute({ projectPath, status, limit }) {
        const governanceDir = await resolveGovernanceDir(projectPath)
        const normalizedProjectPath = toProjectPath(governanceDir)
        const { tasks, markdownPath: tasksViewPath } = await loadTasksDocument(governanceDir)
        const roadmapViewPath = path.join(governanceDir, 'roadmap.md')
        const filtered = tasks
          .filter((task) => (status ? task.status === status : true))
          .slice(0, limit ?? 100)
        return { normalizedProjectPath, governanceDir, tasksViewPath, roadmapViewPath, filtered, status }
      },
      primary: ({ normalizedProjectPath, governanceDir, tasksViewPath, roadmapViewPath, filtered, status }) => [
        `- projectPath: ${normalizedProjectPath}`,
        `- governanceDir: ${governanceDir}`,
        `- tasksView: ${tasksViewPath}`,
        `- roadmapView: ${roadmapViewPath}`,
        `- filter.status: ${status ?? '(none)'}`,
        `- returned: ${filtered.length}`,
      ],
      evidence: ({ filtered }) => [
        '- tasks:',
        ...filtered.map((task) => `- ${task.id} | ${task.status} | ${task.title} | owner=${task.owner || ''} | updatedAt=${task.updatedAt}`),
      ],
      guidance: () => ['- Pick one task ID and call `taskContext`.'],
      lint: ({ filtered, status }) => {
        const suggestions = collectTaskLintSuggestions(filtered)
        if (status && filtered.length === 0) {
          suggestions.push(...renderLintSuggestions([
            {
              code: TASK_LINT_CODES.FILTER_EMPTY,
              message: `No tasks matched status=${status}.`,
              fixHint: 'Confirm status values or update task states.',
            },
          ]))
        }
        return suggestions
      },
      nextCall: ({ filtered, normalizedProjectPath }) =>
        filtered[0]
          ? `taskContext(projectPath="${normalizedProjectPath}", taskId="${filtered[0].id}")`
          : undefined,
    })
  )

  server.registerTool(
    ...createGovernedTool({
      name: 'taskCreate',
      title: 'Task Create',
      description: 'Create a new task in governance store with stable TASK-<number> ID',
      inputSchema: {
        projectPath: z.string(),
        taskId: z.string().optional(),
        title: z.string(),
        status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
        owner: z.string().optional(),
        summary: z.string().optional(),
        roadmapRefs: z.array(z.string()).optional(),
        links: z.array(z.string()).optional(),
        subState: z.object({
          phase: z.enum(['discovery', 'design', 'implementation', 'testing']).optional(),
          confidence: z.number().min(0).max(1).optional(),
          estimatedCompletion: z.string().optional(),
        }).optional(),
        blocker: z.object({
          type: z.enum(['internal_dependency', 'external_dependency', 'resource', 'approval']),
          description: z.string(),
          blockingEntity: z.string().optional(),
          unblockCondition: z.string().optional(),
          escalationPath: z.string().optional(),
        }).optional(),
      },
      async execute({ projectPath, taskId, title, status, owner, summary, roadmapRefs, links, subState, blocker }) {
        if (taskId && !isValidTaskId(taskId)) {
          throw new ToolExecutionError(
            `Invalid task ID format: ${taskId}`,
            ['expected format: TASK-1 or TASK-0001', 'omit taskId to auto-generate next ID'],
            `taskCreate(projectPath="${projectPath}", title="Define executable objective")`,
          )
        }
        const governanceDir = await resolveGovernanceDir(projectPath)
        const normalizedProjectPath = toProjectPath(governanceDir)
        const { tasksPath, tasks, markdownPath: tasksViewPath } = await loadTasksDocument(governanceDir)
        const roadmapViewPath = path.join(governanceDir, 'roadmap.md')
        const finalTaskId = taskId ?? nextTaskId(tasks)
        const duplicated = tasks.some((item) => item.id === finalTaskId)
        if (duplicated) {
          throw new ToolExecutionError(
            `Task already exists: ${finalTaskId}`,
            ['task IDs must be unique', 'use taskUpdate for existing tasks'],
            `taskUpdate(projectPath="${normalizedProjectPath}", taskId="${finalTaskId}", updates={...})`,
          )
        }
        const createdTask = normalizeTask({
          id: finalTaskId,
          title,
          status: status ?? 'TODO',
          owner,
          summary,
          roadmapRefs,
          links,
          subState,
          blocker,
          updatedAt: nowIso(),
        })
        await upsertTaskInStore(tasksPath, createdTask)
        await loadTasksDocumentWithOptions(governanceDir, true)
        return { normalizedProjectPath, governanceDir, tasksViewPath, roadmapViewPath, createdTask }
      },
      primary: ({ normalizedProjectPath, governanceDir, tasksViewPath, roadmapViewPath, createdTask }) => [
        `- projectPath: ${normalizedProjectPath}`,
        `- governanceDir: ${governanceDir}`,
        `- tasksView: ${tasksViewPath}`,
        `- roadmapView: ${roadmapViewPath}`,
        `- taskId: ${createdTask.id}`,
        `- status: ${createdTask.status}`,
        `- owner: ${createdTask.owner || '(none)'}`,
        `- updatedAt: ${createdTask.updatedAt}`,
      ],
      evidence: ({ createdTask }) => [
        '### Created Task',
        `- ${createdTask.id} | ${createdTask.status} | ${createdTask.title}`,
        `- summary: ${createdTask.summary || '(none)'}`,
        `- roadmapRefs: ${createdTask.roadmapRefs.join(', ') || '(none)'}`,
        `- links: ${createdTask.links.join(', ') || '(none)'}`,
      ],
      guidance: () => [
        'Task created in governance store successfully and tasks.md has been synced.',
        'Run taskContext to verify references and lint guidance.',
      ],
      lint: ({ createdTask }) => collectSingleTaskLintSuggestions(createdTask),
      nextCall: ({ normalizedProjectPath, createdTask }) =>
        `taskContext(projectPath="${normalizedProjectPath}", taskId="${createdTask.id}")`,
    })
  )

  server.registerTool(
    ...createGovernedTool({
      name: 'taskNext',
      title: 'Task Next',
      description: 'Start here to auto-select the highest-priority actionable task',
      inputSchema: {
        limit: z.number().int().min(1).max(20).optional(),
      },
      async execute({ limit }) {
        const roots = resolveScanRoots()
        const depth = resolveScanDepth()
        const projects = await discoverProjectsAcrossRoots(roots, depth)
        const rankedCandidates = rankActionableTaskCandidates(await readActionableTaskCandidates(projects))

        if (rankedCandidates.length === 0) {
          const projectSnapshots = await Promise.all(
            projects.map(async (governanceDir) => {
              const tasksPath = path.join(governanceDir, '.projitive')
              await ensureStore(tasksPath)
              const stats = await loadTaskStatusStatsFromStore(tasksPath)
              const roadmapIds = await readRoadmapIds(governanceDir)
              return { governanceDir, roadmapIds, total: stats.total, todo: stats.todo, inProgress: stats.inProgress, blocked: stats.blocked, done: stats.done }
            })
          )
          const preferredProject = projectSnapshots[0]
          const preferredRoadmapRef = preferredProject?.roadmapIds[0] ?? 'ROADMAP-0001'
          const noTaskDiscoveryGuidance = await resolveNoTaskDiscoveryGuidance(preferredProject?.governanceDir)
          return { isEmpty: true as const, roots, depth, projects, projectSnapshots, preferredProject, preferredRoadmapRef, noTaskDiscoveryGuidance }
        }

        const selected = rankedCandidates[0]
        const selectedTaskDocument = await loadTasksDocument(selected.governanceDir)
        const artifacts = await discoverGovernanceArtifacts(selected.governanceDir)
        const fileCandidates = candidateFilesFromArtifacts(artifacts)
        const projectContextDocsState = inspectProjectContextDocsFromArtifacts(fileCandidates)
        const referenceLocations = (
          await Promise.all(fileCandidates.map((file) => findTextReferences(file, selected.task.id)))
        ).flat()
        const taskLocation = (await findTextReferences(selectedTaskDocument.markdownPath, selected.task.id))[0]
        const relatedArtifacts = Array.from(new Set(referenceLocations.map((item) => item.filePath)))
        const suggestedReadOrder = [selectedTaskDocument.markdownPath, ...relatedArtifacts.filter((item) => item !== selectedTaskDocument.markdownPath)]
        const candidateLimit = limit ?? 5
        return {
          isEmpty: false as const,
          roots, depth, projects,
          rankedCandidates, selected, selectedTaskDocument,
          relatedArtifacts, referenceLocations,
          suggestedReadOrder, projectContextDocsState, taskLocation, candidateLimit,
        }
      },
      primary: (data) => {
        if (data.isEmpty) {
          return [
            `- rootPaths: ${data.roots.join(', ')}`,
            `- rootCount: ${data.roots.length}`,
            `- maxDepth: ${data.depth}`,
            `- matchedProjects: ${data.projects.length}`,
            '- actionableTasks: 0',
          ]
        }
        return [
          `- rootPaths: ${data.roots.join(', ')}`,
          `- rootCount: ${data.roots.length}`,
          `- maxDepth: ${data.depth}`,
          `- matchedProjects: ${data.projects.length}`,
          `- actionableTasks: ${data.rankedCandidates.length}`,
          `- selectedProject: ${toProjectPath(data.selected.governanceDir)}`,
          `- selectedTaskId: ${data.selected.task.id}`,
          `- selectedTaskStatus: ${data.selected.task.status}`,
        ]
      },
      evidence: (data) => {
        if (data.isEmpty) {
          return [
            '### Project Snapshots',
            ...(data.projectSnapshots.length > 0
              ? data.projectSnapshots.map(
                  (item, index) => `${index + 1}. ${toProjectPath(item.governanceDir)} | total=${item.total} | todo=${item.todo} | in_progress=${item.inProgress} | blocked=${item.blocked} | done=${item.done} | roadmapIds=${item.roadmapIds.join(', ') || '(none)'}`,
                )
              : ['- (none)']),
            '',
            '### Seed Task Template',
            ...renderTaskSeedTemplate(data.preferredRoadmapRef),
          ]
        }
        const { taskLocation, selectedTaskDocument, rankedCandidates, candidateLimit, relatedArtifacts, referenceLocations, suggestedReadOrder } = data
        const taskLocationStr = taskLocation
          ? `${taskLocation.filePath}#L${taskLocation.line}`
          : selectedTaskDocument.markdownPath
        return [
          '### Selected Task',
          `- id: ${data.selected.task.id}`,
          `- title: ${data.selected.task.title}`,
          `- owner: ${data.selected.task.owner || '(none)'}`,
          `- updatedAt: ${data.selected.task.updatedAt}`,
          `- roadmapRefs: ${data.selected.task.roadmapRefs.join(', ') || '(none)'}`,
          `- taskLocation: ${taskLocationStr}`,
          '',
          '### Top Candidates',
          ...rankedCandidates
            .slice(0, candidateLimit)
            .map((item, index) => `${index + 1}. ${item.task.id} | ${item.task.status} | ${item.task.title} | projectPath=${toProjectPath(item.governanceDir)} | projectScore=${item.projectScore} | latest=${item.projectLatestUpdatedAt}`),
          '',
          '### Selection Reason',
          '- Rank rule: projectScore DESC -> taskPriority DESC -> taskUpdatedAt DESC.',
          `- Selected candidate scores: projectScore=${data.selected.projectScore}, taskPriority=${data.selected.taskPriority}, taskUpdatedAtMs=${data.selected.taskUpdatedAtMs}.`,
          '',
          '### Related Artifacts',
          ...(relatedArtifacts.length > 0 ? relatedArtifacts.map((file) => `- ${file}`) : ['- (none)']),
          '',
          '### Reference Locations',
          ...(referenceLocations.length > 0
            ? referenceLocations.map((item) => `- ${item.filePath}#L${item.line}: ${item.text}`)
            : ['- (none)']),
          '',
          '### Suggested Read Order',
          ...suggestedReadOrder.map((item, index) => `${index + 1}. ${item}`),
        ]
      },
      guidance: (data) => {
        if (data.isEmpty) {
          return [
            '- No TODO/IN_PROGRESS task is available.',
            '- Create 1-3 new TODO tasks using `taskCreate(...)` from active roadmap slices.',
            '- Use no-task discovery checklist below to proactively find and create meaningful TODO tasks.',
            '- If roadmap has active milestones, analyze milestone intent and split into 1-3 executable TODO tasks.',
            '',
            '### No-Task Discovery Checklist',
            ...data.noTaskDiscoveryGuidance,
            '',
            '- If no tasks exist, derive 1-3 TODO tasks from roadmap milestones, README scope, or unresolved report gaps.',
            '- If only BLOCKED/DONE tasks exist, reopen one blocked item or create a follow-up TODO task.',
            '- After creating tasks, rerun `taskNext` to re-rank actionable work.',
          ]
        }
        return [
          ...(!data.projectContextDocsState.ready
            ? [
                '- Project context docs are incomplete. Complete missing project architecture/style docs before deep implementation.',
                ...(data.projectContextDocsState.missingArchitectureDocs
                  ? [`- Missing architecture design doc: create required file ${CORE_ARCHITECTURE_DOC_FILE}.`]
                  : []),
                ...(data.projectContextDocsState.missingStyleDocs
                  ? [`- Missing design style doc: create required file ${CORE_STYLE_DOC_FILE}.`]
                  : []),
              ]
            : []),
          '- Start immediately with Suggested Read Order and execute the selected task.',
          '- Update markdown artifacts directly while keeping TASK/ROADMAP IDs unchanged.',
          '- Re-run `taskContext` for the selectedTaskId after edits to verify evidence consistency.',
        ]
      },
      lint: (data) => {
        if (data.isEmpty) {
          return [
            '- No actionable tasks found. Verify task statuses and required fields in .projitive task table.',
            '- Ensure each new task has stable TASK-<number> ID and at least one roadmapRefs item.',
          ]
        }
        return [
          ...collectTaskLintSuggestions(data.selectedTaskDocument.tasks),
          ...renderLintSuggestions(collectProjectContextDocsLintSuggestions(data.projectContextDocsState)),
        ]
      },
      nextCall: (data) => {
        if (data.isEmpty) {
          return data.preferredProject
            ? `taskCreate(projectPath="${toProjectPath(data.preferredProject.governanceDir)}", title="Create first executable slice", roadmapRefs=["${data.preferredRoadmapRef}"], summary="Derived from active roadmap milestone")`
            : 'projectScan()'
        }
        return `taskContext(projectPath="${toProjectPath(data.selected.governanceDir)}", taskId="${data.selected.task.id}")`
      },
    })
  )

  server.registerTool(
    ...createGovernedTool({
      name: 'taskContext',
      title: 'Task Context',
      description: 'Get deep context, evidence links, and read order for one task',
      inputSchema: {
        projectPath: z.string(),
        taskId: z.string(),
      },
      async execute({ projectPath, taskId }) {
        if (!isValidTaskId(taskId)) {
          throw new ToolExecutionError(
            `Invalid task ID format: ${taskId}`,
            ['expected format: TASK-1 or TASK-0001', 'retry with a valid task ID'],
            `taskContext(projectPath="${projectPath}", taskId="TASK-0001")`,
          )
        }
        const governanceDir = await resolveGovernanceDir(projectPath)
        const normalizedProjectPath = toProjectPath(governanceDir)
        const { markdownPath, tasks } = await loadTasksDocument(governanceDir)
        const roadmapViewPath = path.join(governanceDir, 'roadmap.md')
        const task = tasks.find((item) => item.id === taskId)
        if (!task) {
          throw new ToolExecutionError(
            `Task not found: ${taskId}`,
            ['run `taskList` to discover available IDs', 'retry with an existing task ID'],
            `taskList(projectPath="${toProjectPath(governanceDir)}")`,
          )
        }
        const researchBriefState = await inspectTaskResearchBrief(governanceDir, task)
        const contextReadingGuidance = await resolveTaskContextReadingGuidance(governanceDir)
        const taskLocation = (await findTextReferences(markdownPath, taskId))[0]
        const artifacts = await discoverGovernanceArtifacts(governanceDir)
        const fileCandidates = candidateFilesFromArtifacts(artifacts)
        const projectContextDocsState = inspectProjectContextDocsFromArtifacts(fileCandidates)
        const referenceLocations = (
          await Promise.all(fileCandidates.map((file) => findTextReferences(file, taskId)))
        ).flat()
        const relatedArtifacts = Array.from(new Set(referenceLocations.map((item) => item.filePath)))
        const suggestedReadOrder = [markdownPath, ...relatedArtifacts.filter((item) => item !== markdownPath)]
        return {
          normalizedProjectPath, governanceDir, markdownPath, roadmapViewPath,
          task, researchBriefState, contextReadingGuidance,
          taskLocation, referenceLocations, relatedArtifacts, suggestedReadOrder,
          projectContextDocsState,
        }
      },
      primary: ({ normalizedProjectPath, governanceDir, markdownPath, roadmapViewPath, task, researchBriefState, projectContextDocsState, taskLocation }) => {
        const lines = [
          `- projectPath: ${normalizedProjectPath}`,
          `- governanceDir: ${governanceDir}`,
          `- tasksView: ${markdownPath}`,
          `- roadmapView: ${roadmapViewPath}`,
          `- taskId: ${task.id}`,
          `- title: ${task.title}`,
          `- status: ${task.status}`,
          `- owner: ${task.owner}`,
          `- updatedAt: ${task.updatedAt}`,
          `- roadmapRefs: ${task.roadmapRefs.join(', ') || '(none)'}`,
          `- researchBriefPath: ${researchBriefState.relativePath}`,
          `- researchBriefStatus: ${researchBriefState.ready ? 'READY' : 'MISSING'}`,
          `- architectureDocsStatus: ${projectContextDocsState.missingArchitectureDocs ? 'MISSING' : 'READY'}`,
          `- styleDocsStatus: ${projectContextDocsState.missingStyleDocs ? 'MISSING' : 'READY'}`,
          `- taskLocation: ${taskLocation ? `${taskLocation.filePath}#L${taskLocation.line}` : markdownPath}`,
        ]
        if (task.subState && task.status === 'IN_PROGRESS') {
          lines.push('- subState:')
          if (task.subState.phase) lines.push(`  - phase: ${task.subState.phase}`)
          if (typeof task.subState.confidence === 'number') lines.push(`  - confidence: ${task.subState.confidence}`)
          if (task.subState.estimatedCompletion) lines.push(`  - estimatedCompletion: ${task.subState.estimatedCompletion}`)
        }
        if (task.blocker && task.status === 'BLOCKED') {
          lines.push('- blocker:')
          lines.push(`  - type: ${task.blocker.type}`)
          lines.push(`  - description: ${task.blocker.description}`)
          if (task.blocker.blockingEntity) lines.push(`  - blockingEntity: ${task.blocker.blockingEntity}`)
          if (task.blocker.unblockCondition) lines.push(`  - unblockCondition: ${task.blocker.unblockCondition}`)
          if (task.blocker.escalationPath) lines.push(`  - escalationPath: ${task.blocker.escalationPath}`)
        }
        return lines
      },
      evidence: ({ task, researchBriefState, projectContextDocsState, relatedArtifacts, referenceLocations, suggestedReadOrder }) => [
        '### Pre-Execution Research Brief',
        `- path: ${researchBriefState.relativePath}`,
        `- absolutePath: ${researchBriefState.absolutePath}`,
        `- status: ${researchBriefState.ready ? 'READY' : 'MISSING'}`,
        ...(!researchBriefState.ready
          ? [
              '',
              '### Required Research Brief Template',
              ...renderTaskResearchBriefTemplate(task).map((line) => `- ${line}`),
            ]
          : []),
        '',
        '### Project Context Docs Check',
        `- architecture docs: ${projectContextDocsState.architectureDocs.length > 0 ? 'found' : 'missing'}`,
        ...(projectContextDocsState.architectureDocs.length > 0
          ? projectContextDocsState.architectureDocs.map((item) => `- architecture: ${item}`)
          : [`- architecture: add required file ${CORE_ARCHITECTURE_DOC_FILE}.`]),
        `- design style docs: ${projectContextDocsState.styleDocs.length > 0 ? 'found' : 'missing'}`,
        ...(projectContextDocsState.styleDocs.length > 0
          ? projectContextDocsState.styleDocs.map((item) => `- style: ${item}`)
          : [`- style: add required file ${CORE_STYLE_DOC_FILE}.`]),
        '',
        '### Related Artifacts',
        ...(relatedArtifacts.length > 0 ? relatedArtifacts.map((file) => `- ${file}`) : ['- (none)']),
        '',
        '### Reference Locations',
        ...(referenceLocations.length > 0
          ? referenceLocations.map((item) => `- ${item.filePath}#L${item.line}: ${item.text}`)
          : ['- (none)']),
        '',
        '### Suggested Read Order',
        ...suggestedReadOrder.map((item, index) => `${index + 1}. ${item}`),
      ],
      guidance: ({ researchBriefState, projectContextDocsState, contextReadingGuidance, task }) => [
        ...(!researchBriefState.ready
          ? [
              '- Pre-execution gate is NOT satisfied. Complete research brief first, then proceed with implementation.',
              `- Create or update ${researchBriefState.relativePath} with design guidelines + code architecture findings before code changes.`,
              '- Include exact file/line locations in the brief (for example path/to/file.ts#L120).',
              '- Re-run taskContext after writing the brief and confirm researchBriefStatus becomes READY.',
            ]
          : [
              '- Pre-execution gate satisfied. Read the research brief first, then continue implementation.',
              `- Must read ${researchBriefState.relativePath} before any task execution changes.`,
            ]),
        ...(!projectContextDocsState.ready
          ? [
              '- Project context docs gate is NOT satisfied. Complete missing project architecture/style docs first.',
              ...(projectContextDocsState.missingArchitectureDocs
                ? [`- Missing architecture design doc. Add required file ${CORE_ARCHITECTURE_DOC_FILE} and include architecture boundaries and module responsibilities.`]
                : []),
              ...(projectContextDocsState.missingStyleDocs
                ? [`- Missing design style doc. Add required file ${CORE_STYLE_DOC_FILE} and include style language, tokens/themes, and UI consistency rules.`]
                : []),
              '- Re-run taskContext and confirm both architectureDocsStatus/styleDocsStatus are READY.',
            ]
          : [
              '- Project context docs gate satisfied. Architecture/style docs are available for execution alignment.',
            ]),
        '- Read the files in Suggested Read Order.',
        '',
        '### Context Reading',
        ...contextReadingGuidance,
        '',
        '- Verify whether current status and evidence are consistent.',
        ...taskStatusGuidance(task),
        '- If updates are needed, use tool writes for governance store (`taskUpdate` / `roadmapUpdate`) and keep TASK IDs unchanged.',
        '- After editing, re-run `taskContext` to verify references and context consistency.',
      ],
      lint: ({ task, researchBriefState, projectContextDocsState }) => [
        ...collectSingleTaskLintSuggestions(task),
        ...renderLintSuggestions(collectTaskResearchBriefLintSuggestions(researchBriefState)),
        ...renderLintSuggestions(collectProjectContextDocsLintSuggestions(projectContextDocsState)),
      ],
      nextCall: ({ normalizedProjectPath, task }) =>
        `taskContext(projectPath="${normalizedProjectPath}", taskId="${task.id}")`,
    })
  )

  // taskUpdate tool - Update task fields including subState and blocker (Spec v1.1.0)
  server.registerTool(
    ...createGovernedTool({
      name: 'taskUpdate',
      title: 'Task Update',
      description: 'Update task fields including status, owner, summary, subState, and blocker metadata',
      inputSchema: {
        projectPath: z.string(),
        taskId: z.string(),
        updates: z.object({
          status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
          owner: z.string().optional(),
          summary: z.string().optional(),
          roadmapRefs: z.array(z.string()).optional(),
          links: z.array(z.string()).optional(),
          subState: z.object({
            phase: z.enum(['discovery', 'design', 'implementation', 'testing']).optional(),
            confidence: z.number().min(0).max(1).optional(),
            estimatedCompletion: z.string().optional(),
          }).optional(),
          blocker: z.object({
            type: z.enum(['internal_dependency', 'external_dependency', 'resource', 'approval']),
            description: z.string(),
            blockingEntity: z.string().optional(),
            unblockCondition: z.string().optional(),
            escalationPath: z.string().optional(),
          }).optional(),
        }),
      },
      async execute({ projectPath, taskId, updates }) {
        if (!isValidTaskId(taskId)) {
          throw new ToolExecutionError(
            `Invalid task ID format: ${taskId}`,
            ['expected format: TASK-1 or TASK-0001', 'retry with a valid task ID'],
            `taskUpdate(projectPath="${projectPath}", taskId="TASK-0001", updates={...})`,
          )
        }
        const governanceDir = await resolveGovernanceDir(projectPath)
        const normalizedProjectPath = toProjectPath(governanceDir)
        const { tasksPath, tasks } = await loadTasksDocument(governanceDir)
        const tasksViewPath = path.join(governanceDir, TASKS_MARKDOWN_FILE)
        const roadmapViewPath = path.join(governanceDir, 'roadmap.md')
        const taskIndex = tasks.findIndex((item) => item.id === taskId)
        if (taskIndex === -1) {
          throw new ToolExecutionError(
            `Task not found: ${taskId}`,
            ['run `taskList` to discover available IDs', 'retry with an existing task ID'],
            `taskList(projectPath="${toProjectPath(governanceDir)}")`,
          )
        }
        const task = tasks[taskIndex]
        const originalStatus = task.status
        const previewTask: Task = normalizeTask({ ...task, ...updates, updatedAt: nowIso() })
        if (updates.status && !validateTransition(originalStatus, updates.status)) {
          throw new ToolExecutionError(
            `Invalid status transition: ${originalStatus} -> ${updates.status}`,
            ['use `validateTransition` to check allowed transitions', 'provide evidence when transitioning to DONE'],
            `taskContext(projectPath="${toProjectPath(governanceDir)}", taskId="${taskId}")`,
          )
        }
        const updatedSubState = updates.subState === null ? undefined
          : updates.subState !== undefined ? { ...(task.subState ?? {}), ...updates.subState }
          : task.subState
        const updatedBlocker = updates.blocker === null ? undefined
          : updates.blocker !== undefined ? updates.blocker
          : task.blocker
        const normalizedTask = normalizeTask({
          ...task,
          ...(updates.status ? { status: updates.status } : {}),
          ...(updates.owner !== undefined ? { owner: updates.owner } : {}),
          ...(updates.summary !== undefined ? { summary: updates.summary } : {}),
          ...(updates.roadmapRefs ? { roadmapRefs: updates.roadmapRefs } : {}),
          ...(updates.links ? { links: updates.links } : {}),
          subState: updatedSubState,
          blocker: updatedBlocker,
          updatedAt: nowIso(),
        })
        await upsertTaskInStore(tasksPath, normalizedTask)
        await loadTasksDocumentWithOptions(governanceDir, true)
        return { normalizedProjectPath, governanceDir, tasksViewPath, roadmapViewPath, taskId, originalStatus, task: normalizedTask, previewTask, updates }
      },
      primary: ({ normalizedProjectPath, governanceDir, tasksViewPath, roadmapViewPath, taskId, originalStatus, task }) => {
        const lines = [
          `- projectPath: ${normalizedProjectPath}`,
          `- governanceDir: ${governanceDir}`,
          `- tasksView: ${tasksViewPath}`,
          `- roadmapView: ${roadmapViewPath}`,
          `- taskId: ${taskId}`,
          `- originalStatus: ${originalStatus}`,
          `- newStatus: ${task.status}`,
          `- updatedAt: ${task.updatedAt}`,
        ]
        if (task.subState) {
          lines.push('- subState:')
          if (task.subState.phase) lines.push(`  - phase: ${task.subState.phase}`)
          if (typeof task.subState.confidence === 'number') lines.push(`  - confidence: ${task.subState.confidence}`)
          if (task.subState.estimatedCompletion) lines.push(`  - estimatedCompletion: ${task.subState.estimatedCompletion}`)
        }
        if (task.blocker) {
          lines.push('- blocker:')
          lines.push(`  - type: ${task.blocker.type}`)
          lines.push(`  - description: ${task.blocker.description}`)
          if (task.blocker.blockingEntity) lines.push(`  - blockingEntity: ${task.blocker.blockingEntity}`)
          if (task.blocker.unblockCondition) lines.push(`  - unblockCondition: ${task.blocker.unblockCondition}`)
          if (task.blocker.escalationPath) lines.push(`  - escalationPath: ${task.blocker.escalationPath}`)
        }
        return lines
      },
      evidence: ({ task, originalStatus, updates }) => [
        '### Updated Task',
        `- ${task.id} | ${task.status} | ${task.title}`,
        `- owner: ${task.owner || '(none)'}`,
        `- summary: ${task.summary || '(none)'}`,
        '',
        '### Update Details',
        ...(updates.status ? [`- status: ${originalStatus} → ${updates.status}`] : []),
        ...(updates.owner !== undefined ? [`- owner: ${updates.owner}`] : []),
        ...(updates.summary !== undefined ? [`- summary: ${updates.summary}`] : []),
        ...(updates.roadmapRefs ? [`- roadmapRefs: ${updates.roadmapRefs.join(', ')}`] : []),
        ...(updates.links ? [`- links: ${updates.links.join(', ')}`] : []),
        ...(updates.subState ? [`- subState: ${JSON.stringify(updates.subState)}`] : []),
        ...(updates.blocker ? [`- blocker: ${JSON.stringify(updates.blocker)}`] : []),
      ],
      guidance: ({ updates, originalStatus }) => [
        'Task updated successfully and tasks.md has been synced. Run `taskContext` to verify the changes.',
        ...(updates.status === 'IN_PROGRESS' && originalStatus === 'TODO'
          ? ['- Ensure pre-execution research brief exists before deep implementation.']
          : []),
        ...(updates.status === 'DONE'
          ? ['- Verify evidence links are attached and reflect completed work.']
          : []),
        '.projitive governance store is source of truth; tasks.md is a generated view and may be overwritten.',
      ],
      lint: async ({ previewTask, governanceDir }) => [
        ...collectSingleTaskLintSuggestions(previewTask),
        ...renderLintSuggestions(await collectDoneConformanceSuggestions(governanceDir, previewTask)),
      ],
      nextCall: ({ normalizedProjectPath, taskId }) =>
        `taskContext(projectPath="${normalizedProjectPath}", taskId="${taskId}")`,
    })
  )
}
