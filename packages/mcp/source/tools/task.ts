import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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
} from "../common/index.js";
import {
  asText,
  evidenceSection,
  guidanceSection,
  lintSection,
  nextCallSection,
  renderErrorMarkdown,
  renderToolResponseMarkdown,
  summarySection,
} from "../common/index.js";
import { catchIt, TASK_LINT_CODES, renderLintSuggestions, type LintSuggestion } from "../common/index.js";
import { resolveGovernanceDir, resolveScanDepth, resolveScanRoots, discoverProjectsAcrossRoots, toProjectPath } from "./project.js";
import { isValidRoadmapId } from "./roadmap.js";
import type {
  Task,
  TaskStatus,
  TaskDocument,
  ActionableTaskCandidate,
  SubStateMetadata,
  BlockerMetadata,
} from "../types.js";
import { SUB_STATE_PHASES, BLOCKER_TYPES } from "../types.js";

// Re-export types for backwards compatibility
export type { Task, TaskStatus, TaskDocument, ActionableTaskCandidate };

export const ALLOWED_STATUS = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
export const TASK_ID_REGEX = /^TASK-\d{4}$/;
export const TASKS_MARKDOWN_FILE = "tasks.md";

export type TaskLintSuggestion = LintSuggestion;

function appendLintSuggestions(target: string[], suggestions: LintSuggestion[]): void {
  target.push(...renderLintSuggestions(suggestions));
}

function taskStatusGuidance(task: Task): string[] {
  if (task.status === "TODO") {
    return [
      "- This task is TODO: confirm scope and set execution plan before edits.",
      "- Move to IN_PROGRESS only after owner and initial evidence are ready.",
    ];
  }

  if (task.status === "IN_PROGRESS") {
    return [
      "- This task is IN_PROGRESS: prioritize finishing with report/design evidence updates.",
      "- Verify references stay consistent before marking DONE.",
    ];
  }

  if (task.status === "BLOCKED") {
    return [
      "- This task is BLOCKED: identify blocker and required unblock condition first.",
      "- Reopen only after blocker evidence is documented.",
    ];
  }

  return [
    "- This task is DONE: only reopen when new requirement changes scope.",
    "- Keep report evidence immutable unless correction is required.",
  ];
}

const DEFAULT_NO_TASK_DISCOVERY_GUIDANCE = [
  "- Recheck project state first: run projectContext and confirm there is truly no TODO/IN_PROGRESS task to execute.",
  "- If all remaining tasks are BLOCKED, create one unblock task with explicit unblock condition and dependency owner.",
  "- Start from active roadmap milestones and split into the smallest executable slices with a single done condition each.",
  "- Prefer slices that unlock multiple downstream tasks before isolated refactors or low-impact cleanups.",
  "- Create TODO tasks only when evidence is clear: each new task must produce at least one report/design/readme artifact update.",
  "- Skip duplicate scope: do not create tasks that overlap existing TODO/IN_PROGRESS/BLOCKED task intent.",
  "- Use quality gates for discovery candidates: user value, delivery risk reduction, or measurable throughput improvement.",
  "- Keep each discovery round small (1-3 tasks), then rerun taskNext immediately for re-ranking and execution.",
];

const DEFAULT_TASK_CONTEXT_READING_GUIDANCE = [
  "- Read governance workspace overview first (README.md / projitive://governance/workspace).",
  "- Read roadmap and active milestones (roadmap.md / projitive://governance/roadmap).",
  "- Read task view and related task cards (tasks.md / projitive://governance/tasks).",
  "- Read design specs and technical decisions under designs/ (architecture, API contracts, constraints).",
  "- Read reports/ for latest execution evidence, regressions, and unresolved risks.",
  "- Read process guides under templates/docs/project guidelines to align with local governance rules.",
  "- If available, read docs/ architecture or migration guides before major structural changes.",
];

export async function resolveNoTaskDiscoveryGuidance(governanceDir?: string): Promise<string[]> {
  void governanceDir;
  return DEFAULT_NO_TASK_DISCOVERY_GUIDANCE;
}

export async function resolveTaskContextReadingGuidance(governanceDir?: string): Promise<string[]> {
  void governanceDir;
  return DEFAULT_TASK_CONTEXT_READING_GUIDANCE;
}

async function readRoadmapIds(governanceDir: string): Promise<string[]> {
  const dbPath = path.join(governanceDir, ".projitive");
  try {
    await ensureStore(dbPath);
    const milestones = await loadRoadmapsFromStore(dbPath);
    const ids = milestones.map((item) => item.id).filter((item) => isValidRoadmapId(item));
    return Array.from(new Set(ids));
  } catch {
    return [];
  }
}

export function renderTaskSeedTemplate(roadmapRef: string): string[] {
  return [
    "```markdown",
    "## TASK-0001 | TODO | Define initial executable objective",
    "- owner: ai-copilot",
    "- summary: Convert one roadmap milestone or report gap into an actionable task.",
    "- updatedAt: 2026-01-01T00:00:00.000Z",
    `- roadmapRefs: ${roadmapRef}`,
    "- links:",
    "  - ./README.md",
    "  - ./roadmap.md",
    "```",
  ];
}

async function readActionableTaskCandidates(governanceDirs: string[]): Promise<ActionableTaskCandidate[]> {
  const snapshots = await Promise.all(
    governanceDirs.map(async (governanceDir) => {
      const tasksPath = path.join(governanceDir, ".projitive");
      await ensureStore(tasksPath);
      const [stats, actionableTasks] = await Promise.all([
        loadTaskStatusStatsFromStore(tasksPath),
        loadActionableTasksFromStore(tasksPath),
      ]);
      return {
        governanceDir,
        tasks: actionableTasks,
        projectScore: stats.inProgress * 2 + stats.todo,
        projectLatestUpdatedAt: stats.latestUpdatedAt || "(unknown)",
      };
    })
  );

  return snapshots.flatMap((item) => item.tasks
    .filter((task) => task.status === "IN_PROGRESS" || task.status === "TODO")
    .map((task) => ({
      governanceDir: item.governanceDir,
      task,
      projectScore: item.projectScore,
      projectLatestUpdatedAt: item.projectLatestUpdatedAt,
      taskUpdatedAtMs: toTaskUpdatedAtMs(task.updatedAt),
      taskPriority: taskPriority(task.status),
    })));
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isValidTaskId(id: string): boolean {
  return TASK_ID_REGEX.test(id);
}

export function taskPriority(status: Task["status"]): number {
  if (status === "IN_PROGRESS") {
    return 2;
  }
  if (status === "TODO") {
    return 1;
  }
  return 0;
}

export function toTaskUpdatedAtMs(updatedAt: string): number {
  const timestamp = new Date(updatedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function toTaskIdNumericSuffix(taskId: string): number {
  const match = taskId.match(/^(?:TASK-)(\d{4})$/);
  if (!match) {
    return -1;
  }
  return Number.parseInt(match[1], 10);
}

export function sortTasksNewestFirst(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const updatedAtDelta = toTaskUpdatedAtMs(b.updatedAt) - toTaskUpdatedAtMs(a.updatedAt);
    if (updatedAtDelta !== 0) {
      return updatedAtDelta;
    }

    const idDelta = toTaskIdNumericSuffix(b.id) - toTaskIdNumericSuffix(a.id);
    if (idDelta !== 0) {
      return idDelta;
    }

    return b.id.localeCompare(a.id);
  });
}

function normalizeAndSortTasks(tasks: Task[]): Task[] {
  return sortTasksNewestFirst(tasks.map((task) => normalizeTask(task)));
}

function resolveTaskArtifactPaths(governanceDir: string): { tasksPath: string; markdownPath: string } {
  return {
    tasksPath: path.join(governanceDir, ".projitive"),
    markdownPath: path.join(governanceDir, TASKS_MARKDOWN_FILE),
  };
}

async function syncTasksMarkdownView(tasksPath: string, markdownPath: string, markdown: string, force = false): Promise<void> {
  const sourceVersion = await getStoreVersion(tasksPath, "tasks");
  const viewState = await getMarkdownViewState(tasksPath, "tasks_markdown");
  const markdownExists = await fs.access(markdownPath).then(() => true).catch(() => false);

  const shouldWrite = force
    || !markdownExists
    || viewState.dirty
    || viewState.lastSourceVersion !== sourceVersion;

  if (!shouldWrite) {
    return;
  }

  await fs.writeFile(markdownPath, markdown, "utf-8");
  await markMarkdownViewBuilt(tasksPath, "tasks_markdown", sourceVersion);
}

export function rankActionableTaskCandidates(candidates: ActionableTaskCandidate[]): ActionableTaskCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.projectScore !== a.projectScore) {
      return b.projectScore - a.projectScore;
    }
    if (b.taskPriority !== a.taskPriority) {
      return b.taskPriority - a.taskPriority;
    }
    if (b.taskUpdatedAtMs !== a.taskUpdatedAtMs) {
      return b.taskUpdatedAtMs - a.taskUpdatedAtMs;
    }
    if (a.governanceDir !== b.governanceDir) {
      return a.governanceDir.localeCompare(b.governanceDir);
    }
    return a.task.id.localeCompare(b.task.id);
  });
}

export function normalizeTask(task: Partial<Task> & { id: string; title: string }): Task {
  const normalizedRoadmapRefs = Array.isArray(task.roadmapRefs)
    ? task.roadmapRefs.map(String).filter((value) => isValidRoadmapId(value))
    : [];

  const normalized: Task = {
    id: String(task.id),
    title: String(task.title),
    status: ALLOWED_STATUS.includes(task.status as TaskStatus) ? (task.status as TaskStatus) : "TODO",
    owner: task.owner ? String(task.owner) : "",
    summary: task.summary ? String(task.summary) : "",
    updatedAt: task.updatedAt ? String(task.updatedAt) : nowIso(),
    links: Array.isArray(task.links) ? task.links.map(String) : [],
    roadmapRefs: Array.from(new Set(normalizedRoadmapRefs)),
  };

  // Include optional v1.1.0 fields if present
  if (task.subState) {
    normalized.subState = task.subState;
  }
  if (task.blocker) {
    normalized.blocker = task.blocker;
  }

  return normalized;
}

function collectTaskLintSuggestionItems(tasks: Task[]): TaskLintSuggestion[] {
  const suggestions: TaskLintSuggestion[] = [];

  const duplicateIds = Array.from(
    tasks.reduce((counter, task) => {
      counter.set(task.id, (counter.get(task.id) ?? 0) + 1);
      return counter;
    }, new Map<string, number>())
      .entries()
  )
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  if (duplicateIds.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.DUPLICATE_ID,
      message: `Duplicate task IDs detected: ${duplicateIds.join(", ")}.`,
      fixHint: "Keep task IDs unique in marker block.",
    });
  }

  const inProgressWithoutOwner = tasks.filter((task) => task.status === "IN_PROGRESS" && task.owner.trim().length === 0);
  if (inProgressWithoutOwner.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.IN_PROGRESS_OWNER_EMPTY,
      message: `${inProgressWithoutOwner.length} IN_PROGRESS task(s) have empty owner.`,
      fixHint: "Set owner before continuing execution.",
    });
  }

  const doneWithoutLinks = tasks.filter((task) => task.status === "DONE" && task.links.length === 0);
  if (doneWithoutLinks.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.DONE_LINKS_MISSING,
      message: `${doneWithoutLinks.length} DONE task(s) have no links evidence.`,
      fixHint: "Add at least one evidence link before keeping DONE.",
    });
  }

  const blockedWithoutReason = tasks.filter((task) => task.status === "BLOCKED" && task.summary.trim().length === 0);
  if (blockedWithoutReason.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKED_SUMMARY_EMPTY,
      message: `${blockedWithoutReason.length} BLOCKED task(s) have empty summary.`,
      fixHint: "Add blocker reason and unblock condition.",
    });
  }

  const invalidUpdatedAt = tasks.filter((task) => !Number.isFinite(new Date(task.updatedAt).getTime()));
  if (invalidUpdatedAt.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.UPDATED_AT_INVALID,
      message: `${invalidUpdatedAt.length} task(s) have invalid updatedAt format.`,
      fixHint: "Use ISO8601 UTC timestamp.",
    });
  }

  const missingRoadmapRefs = tasks.filter((task) => task.roadmapRefs.length === 0);
  if (missingRoadmapRefs.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.ROADMAP_REFS_EMPTY,
      message: `${missingRoadmapRefs.length} task(s) have empty roadmapRefs.`,
      fixHint: "Bind at least one ROADMAP-xxxx when applicable.",
    });
  }

  // ============================================================================
  // Spec v1.1.0 - Blocker Categorization Validation
  // ============================================================================

  const blockedWithoutBlocker = tasks.filter((task) => task.status === "BLOCKED" && !task.blocker);
  if (blockedWithoutBlocker.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKED_WITHOUT_BLOCKER,
      message: `${blockedWithoutBlocker.length} BLOCKED task(s) have no blocker metadata.`,
      fixHint: "Add structured blocker metadata with type and description.",
    });
  }

  const blockerTypeInvalid = tasks.filter((task) => task.blocker && !BLOCKER_TYPES.includes(task.blocker.type));
  if (blockerTypeInvalid.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKER_TYPE_INVALID,
      message: `${blockerTypeInvalid.length} task(s) have invalid blocker type.`,
      fixHint: `Use one of: ${BLOCKER_TYPES.join(", ")}.`,
    });
  }

  const blockerDescriptionEmpty = tasks.filter((task) => task.blocker && !task.blocker.description?.trim());
  if (blockerDescriptionEmpty.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKER_DESCRIPTION_EMPTY,
      message: `${blockerDescriptionEmpty.length} task(s) have empty blocker description.`,
      fixHint: "Provide a clear description of why the task is blocked.",
    });
  }

  // ============================================================================
  // Spec v1.1.0 - Sub-state Metadata Validation (Optional but Recommended)
  // ============================================================================

  const inProgressWithoutSubState = tasks.filter((task) => task.status === "IN_PROGRESS" && !task.subState);
  if (inProgressWithoutSubState.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.IN_PROGRESS_WITHOUT_SUBSTATE,
      message: `${inProgressWithoutSubState.length} IN_PROGRESS task(s) have no subState metadata.`,
      fixHint: "Add optional subState metadata for better progress tracking.",
    });
  }

  const subStatePhaseInvalid = tasks.filter(
    (task) => task.subState?.phase && !SUB_STATE_PHASES.includes(task.subState.phase)
  );
  if (subStatePhaseInvalid.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.SUBSTATE_PHASE_INVALID,
      message: `${subStatePhaseInvalid.length} task(s) have invalid subState phase.`,
      fixHint: `Use one of: ${SUB_STATE_PHASES.join(", ")}.`,
    });
  }

  const subStateConfidenceInvalid = tasks.filter(
    (task) => typeof task.subState?.confidence === "number" && (task.subState.confidence < 0 || task.subState.confidence > 1)
  );
  if (subStateConfidenceInvalid.length > 0) {
    suggestions.push({
      code: TASK_LINT_CODES.SUBSTATE_CONFIDENCE_INVALID,
      message: `${subStateConfidenceInvalid.length} task(s) have invalid confidence score.`,
      fixHint: "Confidence must be between 0.0 and 1.0.",
    });
  }

  return suggestions;
}

export function collectTaskLintSuggestions(tasks: Task[]): string[] {
  return renderLintSuggestions(collectTaskLintSuggestionItems(tasks));
}

function collectSingleTaskLintSuggestions(task: Task): string[] {
  const suggestions: TaskLintSuggestion[] = [];

  if (task.status === "IN_PROGRESS" && task.owner.trim().length === 0) {
    suggestions.push({
      code: TASK_LINT_CODES.IN_PROGRESS_OWNER_EMPTY,
      message: "Current task is IN_PROGRESS but owner is empty.",
      fixHint: "Set owner before continuing execution.",
    });
  }

  if (task.status === "DONE" && task.links.length === 0) {
    suggestions.push({
      code: TASK_LINT_CODES.DONE_LINKS_MISSING,
      message: "Current task is DONE but has no links evidence.",
      fixHint: "Add at least one evidence link.",
    });
  }

  if (task.status === "BLOCKED" && task.summary.trim().length === 0) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKED_SUMMARY_EMPTY,
      message: "Current task is BLOCKED but summary is empty.",
      fixHint: "Add blocker reason and unblock condition.",
    });
  }

  if (!Number.isFinite(new Date(task.updatedAt).getTime())) {
    suggestions.push({
      code: TASK_LINT_CODES.UPDATED_AT_INVALID,
      message: "Current task updatedAt is invalid.",
      fixHint: "Use ISO8601 UTC timestamp.",
    });
  }

  if (task.roadmapRefs.length === 0) {
    suggestions.push({
      code: TASK_LINT_CODES.ROADMAP_REFS_EMPTY,
      message: "Current task has empty roadmapRefs.",
      fixHint: "Bind ROADMAP-xxxx where applicable.",
    });
  }

  // ============================================================================
  // Spec v1.1.0 - Blocker Categorization Validation (Single Task)
  // ============================================================================

  if (task.status === "BLOCKED" && !task.blocker) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKED_WITHOUT_BLOCKER,
      message: "Current task is BLOCKED but has no blocker metadata.",
      fixHint: "Add structured blocker metadata with type and description.",
    });
  }

  if (task.blocker && !BLOCKER_TYPES.includes(task.blocker.type)) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKER_TYPE_INVALID,
      message: `Current task has invalid blocker type: ${task.blocker.type}.`,
      fixHint: `Use one of: ${BLOCKER_TYPES.join(", ")}.`,
    });
  }

  if (task.blocker && !task.blocker.description?.trim()) {
    suggestions.push({
      code: TASK_LINT_CODES.BLOCKER_DESCRIPTION_EMPTY,
      message: "Current task has empty blocker description.",
      fixHint: "Provide a clear description of why the task is blocked.",
    });
  }

  // ============================================================================
  // Spec v1.1.0 - Sub-state Metadata Validation (Single Task, Optional)
  // ============================================================================

  if (task.status === "IN_PROGRESS" && !task.subState) {
    suggestions.push({
      code: TASK_LINT_CODES.IN_PROGRESS_WITHOUT_SUBSTATE,
      message: "Current task is IN_PROGRESS but has no subState metadata.",
      fixHint: "Add optional subState metadata for better progress tracking.",
    });
  }

  if (task.subState?.phase && !SUB_STATE_PHASES.includes(task.subState.phase)) {
    suggestions.push({
      code: TASK_LINT_CODES.SUBSTATE_PHASE_INVALID,
      message: `Current task has invalid subState phase: ${task.subState.phase}.`,
      fixHint: `Use one of: ${SUB_STATE_PHASES.join(", ")}.`,
    });
  }

  if (typeof task.subState?.confidence === "number" && (task.subState.confidence < 0 || task.subState.confidence > 1)) {
    suggestions.push({
      code: TASK_LINT_CODES.SUBSTATE_CONFIDENCE_INVALID,
      message: `Current task has invalid confidence score: ${task.subState.confidence}.`,
      fixHint: "Confidence must be between 0.0 and 1.0.",
    });
  }

  return renderLintSuggestions(suggestions);
}

async function collectTaskFileLintSuggestions(governanceDir: string, task: Task): Promise<string[]> {
  const suggestions: TaskLintSuggestion[] = [];

  for (const link of task.links) {
    const normalized = link.trim();
    if (normalized.length === 0) {
      continue;
    }

    if (/^https?:\/\//i.test(normalized)) {
      continue;
    }

    const resolvedPath = path.resolve(governanceDir, normalized);
    const exists = await fs.access(resolvedPath).then(() => true).catch(() => false);
    if (!exists) {
      suggestions.push({
        code: TASK_LINT_CODES.LINK_TARGET_MISSING,
        message: `Link target not found: ${normalized} (resolved: ${resolvedPath}).`,
      });
    }
  }

  return renderLintSuggestions(suggestions);
}

export function renderTasksMarkdown(tasks: Task[]): string {
  const sections = sortTasksNewestFirst(tasks).map((task) => {
    const roadmapRefs = task.roadmapRefs.length > 0 ? task.roadmapRefs.join(", ") : "(none)";
    const links = task.links.length > 0
      ? ["- links:", ...task.links.map((link) => `  - ${link}`)]
      : ["- links:", "  - (none)"];

    const lines = [
      `## ${task.id} | ${task.status} | ${task.title}`,
      `- owner: ${task.owner || "(none)"}`,
      `- summary: ${task.summary || "(none)"}`,
      `- updatedAt: ${task.updatedAt}`,
      `- roadmapRefs: ${roadmapRefs}`,
      ...links,
    ];

    // Add subState for IN_PROGRESS tasks (Spec v1.1.0)
    if (task.subState && task.status === "IN_PROGRESS") {
      lines.push(`- subState:`);
      if (task.subState.phase) {
        lines.push(`  - phase: ${task.subState.phase}`);
      }
      if (typeof task.subState.confidence === "number") {
        lines.push(`  - confidence: ${task.subState.confidence}`);
      }
      if (task.subState.estimatedCompletion) {
        lines.push(`  - estimatedCompletion: ${task.subState.estimatedCompletion}`);
      }
    }

    // Add blocker for BLOCKED tasks (Spec v1.1.0)
    if (task.blocker && task.status === "BLOCKED") {
      lines.push(`- blocker:`);
      lines.push(`  - type: ${task.blocker.type}`);
      lines.push(`  - description: ${task.blocker.description}`);
      if (task.blocker.blockingEntity) {
        lines.push(`  - blockingEntity: ${task.blocker.blockingEntity}`);
      }
      if (task.blocker.unblockCondition) {
        lines.push(`  - unblockCondition: ${task.blocker.unblockCondition}`);
      }
      if (task.blocker.escalationPath) {
        lines.push(`  - escalationPath: ${task.blocker.escalationPath}`);
      }
    }

    return lines.join("\n");
  });

  return [
    "# Tasks",
    "",
    "This file is generated from .projitive sqlite tables by Projitive MCP. Manual edits will be overwritten.",
    "",
    ...(sections.length > 0 ? sections : ["(no tasks)"]),
    "",
  ].join("\n");
}

export async function ensureTasksFile(inputPath: string): Promise<string> {
  const governanceDir = await resolveGovernanceDir(inputPath);
  const { tasksPath, markdownPath } = resolveTaskArtifactPaths(governanceDir);

  await fs.mkdir(governanceDir, { recursive: true });
  await ensureStore(tasksPath);

  const tasks = normalizeAndSortTasks(await loadTasksFromStore(tasksPath));

  await syncTasksMarkdownView(tasksPath, markdownPath, renderTasksMarkdown(tasks));

  return tasksPath;
}

export async function loadTasks(inputPath: string): Promise<{ tasksPath: string; tasks: Task[] }> {
  const { tasksPath, tasks } = await loadTasksDocument(inputPath);
  return { tasksPath, tasks };
}

export async function loadTasksDocument(inputPath: string): Promise<TaskDocument> {
  return loadTasksDocumentWithOptions(inputPath, false);
}

export async function loadTasksDocumentWithOptions(inputPath: string, forceViewSync: boolean): Promise<TaskDocument> {
  const tasksPath = await ensureTasksFile(inputPath);
  const tasks = normalizeAndSortTasks(await loadTasksFromStore(tasksPath));
  const markdown = renderTasksMarkdown(tasks);
  const markdownPath = path.join(path.dirname(tasksPath), TASKS_MARKDOWN_FILE);
  await syncTasksMarkdownView(tasksPath, markdownPath, markdown, forceViewSync);
  return { tasksPath, markdownPath, markdown, tasks };
}

export async function saveTasks(tasksPath: string, tasks: Task[]): Promise<void> {
  const normalized = normalizeAndSortTasks(tasks);
  const markdownPath = path.join(path.dirname(tasksPath), TASKS_MARKDOWN_FILE);
  await replaceTasksInStore(tasksPath, normalized);
  await syncTasksMarkdownView(tasksPath, markdownPath, renderTasksMarkdown(normalized));
}

export function validateTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) {
    return true;
  }

  const allowed: Record<TaskStatus, Set<TaskStatus>> = {
    TODO: new Set(["IN_PROGRESS", "BLOCKED"]),
    IN_PROGRESS: new Set(["BLOCKED", "DONE"]),
    BLOCKED: new Set(["IN_PROGRESS", "TODO"]),
    DONE: new Set(),
  };

  return allowed[from].has(to);
}

export function registerTaskTools(server: McpServer): void {
  server.registerTool(
    "taskList",
    {
      title: "Task List",
      description: "List tasks for a known project and optionally filter by status",
      inputSchema: {
        projectPath: z.string(),
        status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async ({ projectPath, status, limit }) => {
      const governanceDir = await resolveGovernanceDir(projectPath);
      const { tasks } = await loadTasksDocument(governanceDir);
      const filtered = tasks
        .filter((task) => (status ? task.status === status : true))
        .slice(0, limit ?? 100);
      const lintSuggestions = collectTaskLintSuggestions(filtered);
      if (status && filtered.length === 0) {
        appendLintSuggestions(lintSuggestions, [
          {
            code: TASK_LINT_CODES.FILTER_EMPTY,
            message: `No tasks matched status=${status}.`,
            fixHint: "Confirm status values or update task states.",
          },
        ]);
      }
      const nextTaskId = filtered[0]?.id;

      const markdown = renderToolResponseMarkdown({
        toolName: "taskList",
        sections: [
          summarySection([
            `- governanceDir: ${governanceDir}`,
            `- filter.status: ${status ?? "(none)"}`,
            `- returned: ${filtered.length}`,
          ]),
          evidenceSection([
            "- tasks:",
            ...filtered.map((task) => `- ${task.id} | ${task.status} | ${task.title} | owner=${task.owner || ""} | updatedAt=${task.updatedAt}`),
          ]),
          guidanceSection(["- Pick one task ID and call `taskContext`." ]),
          lintSection(lintSuggestions),
          nextCallSection(nextTaskId
            ? `taskContext(projectPath=\"${toProjectPath(governanceDir)}\", taskId=\"${nextTaskId}\")`
            : undefined),
        ],
      });

      return asText(markdown);
    }
  );

  server.registerTool(
    "taskNext",
    {
      title: "Task Next",
      description: "Start here to auto-select the highest-priority actionable task",
      inputSchema: {
        limit: z.number().int().min(1).max(20).optional(),
      },
    },
    async ({ limit }) => {
      const roots = resolveScanRoots();
      const depth = resolveScanDepth();
      const projects = await discoverProjectsAcrossRoots(roots, depth);
      const rankedCandidates = rankActionableTaskCandidates(await readActionableTaskCandidates(projects));

      if (rankedCandidates.length === 0) {
        const projectSnapshots = await Promise.all(
          projects.map(async (governanceDir) => {
            const tasksPath = path.join(governanceDir, ".projitive");
            await ensureStore(tasksPath);
            const stats = await loadTaskStatusStatsFromStore(tasksPath);
            const roadmapIds = await readRoadmapIds(governanceDir);
            return {
              governanceDir,
              roadmapIds,
              total: stats.total,
              todo: stats.todo,
              inProgress: stats.inProgress,
              blocked: stats.blocked,
              done: stats.done,
            };
          })
        );

        const preferredProject = projectSnapshots[0];
        const preferredRoadmapRef = preferredProject?.roadmapIds[0] ?? "ROADMAP-0001";
        const noTaskDiscoveryGuidance = await resolveNoTaskDiscoveryGuidance(preferredProject?.governanceDir);
        const markdown = renderToolResponseMarkdown({
          toolName: "taskNext",
          sections: [
            summarySection([
              `- rootPaths: ${roots.join(", ")}`,
              `- rootCount: ${roots.length}`,
              `- maxDepth: ${depth}`,
              `- matchedProjects: ${projects.length}`,
              "- actionableTasks: 0",
            ]),
            evidenceSection([
              "### Project Snapshots",
              ...(projectSnapshots.length > 0
                ? projectSnapshots.map(
                    (item, index) => `${index + 1}. ${item.governanceDir} | total=${item.total} | todo=${item.todo} | in_progress=${item.inProgress} | blocked=${item.blocked} | done=${item.done} | roadmapIds=${item.roadmapIds.join(", ") || "(none)"}`
                  )
                : ["- (none)"]),
              "",
              "### Seed Task Template",
              ...renderTaskSeedTemplate(preferredRoadmapRef),
            ]),
            guidanceSection([
              "- No TODO/IN_PROGRESS task is available.",
              "- Use no-task discovery checklist below to proactively find and create meaningful TODO tasks.",
              "- If roadmap has active milestones, analyze milestone intent and split into 1-3 executable TODO tasks.",
              "",
              "### No-Task Discovery Checklist",
              ...noTaskDiscoveryGuidance,
              "",
              "- If no tasks exist, derive 1-3 TODO tasks from roadmap milestones, README scope, or unresolved report gaps.",
              "- If only BLOCKED/DONE tasks exist, reopen one blocked item or create a follow-up TODO task.",
              "- After creating tasks, rerun `taskNext` to re-rank actionable work.",
            ]),
            lintSection([
              "- No actionable tasks found. Verify task statuses and required fields in .projitive task table.",
              "- Ensure each new task has stable TASK-xxxx ID and at least one roadmapRefs item.",
            ]),
            nextCallSection(preferredProject
              ? `projectContext(projectPath=\"${toProjectPath(preferredProject.governanceDir)}\")`
              : "projectScan()"),
          ],
        });
        return asText(markdown);
      }

      const selected = rankedCandidates[0];
      const selectedTaskDocument = await loadTasksDocument(selected.governanceDir);
      const lintSuggestions = collectTaskLintSuggestions(selectedTaskDocument.tasks);
      const artifacts = await discoverGovernanceArtifacts(selected.governanceDir);
      const fileCandidates = candidateFilesFromArtifacts(artifacts);
      const referenceLocations = (
        await Promise.all(fileCandidates.map((file) => findTextReferences(file, selected.task.id)))
      ).flat();
      const taskLocation = (await findTextReferences(selectedTaskDocument.markdownPath, selected.task.id))[0];
      const relatedArtifacts = Array.from(new Set(referenceLocations.map((item) => item.filePath)));
      const suggestedReadOrder = [selectedTaskDocument.markdownPath, ...relatedArtifacts.filter((item) => item !== selectedTaskDocument.markdownPath)];
      const candidateLimit = limit ?? 5;

      const markdown = renderToolResponseMarkdown({
        toolName: "taskNext",
        sections: [
          summarySection([
            `- rootPaths: ${roots.join(", ")}`,
            `- rootCount: ${roots.length}`,
            `- maxDepth: ${depth}`,
            `- matchedProjects: ${projects.length}`,
            `- actionableTasks: ${rankedCandidates.length}`,
            `- selectedProject: ${selected.governanceDir}`,
            `- selectedTaskId: ${selected.task.id}`,
            `- selectedTaskStatus: ${selected.task.status}`,
          ]),
          evidenceSection([
            "### Selected Task",
            `- id: ${selected.task.id}`,
            `- title: ${selected.task.title}`,
            `- owner: ${selected.task.owner || "(none)"}`,
            `- updatedAt: ${selected.task.updatedAt}`,
            `- roadmapRefs: ${selected.task.roadmapRefs.join(", ") || "(none)"}`,
            `- taskLocation: ${taskLocation ? `${taskLocation.filePath}#L${taskLocation.line}` : selectedTaskDocument.markdownPath}`,
            "",
            "### Top Candidates",
            ...rankedCandidates
              .slice(0, candidateLimit)
              .map((item, index) => `${index + 1}. ${item.task.id} | ${item.task.status} | ${item.task.title} | project=${item.governanceDir} | projectScore=${item.projectScore} | latest=${item.projectLatestUpdatedAt}`),
            "",
            "### Selection Reason",
            "- Rank rule: projectScore DESC -> taskPriority DESC -> taskUpdatedAt DESC.",
            `- Selected candidate scores: projectScore=${selected.projectScore}, taskPriority=${selected.taskPriority}, taskUpdatedAtMs=${selected.taskUpdatedAtMs}.`,
            "",
            "### Related Artifacts",
            ...(relatedArtifacts.length > 0 ? relatedArtifacts.map((file) => `- ${file}`) : ["- (none)"]),
            "",
            "### Reference Locations",
            ...(referenceLocations.length > 0
              ? referenceLocations.map((item) => `- ${item.filePath}#L${item.line}: ${item.text}`)
              : ["- (none)"]),
            "",
            "### Suggested Read Order",
            ...suggestedReadOrder.map((item, index) => `${index + 1}. ${item}`),
          ]),
          guidanceSection([
            "- Start immediately with Suggested Read Order and execute the selected task.",
            "- Update markdown artifacts directly while keeping TASK/ROADMAP IDs unchanged.",
            "- Re-run `taskContext` for the selectedTaskId after edits to verify evidence consistency.",
          ]),
          lintSection(lintSuggestions),
          nextCallSection(`taskContext(projectPath=\"${toProjectPath(selected.governanceDir)}\", taskId=\"${selected.task.id}\")`),
        ],
      });

      return asText(markdown);
    }
  );

  server.registerTool(
    "taskContext",
    {
      title: "Task Context",
      description: "Get deep context, evidence links, and read order for one task",
      inputSchema: {
        projectPath: z.string(),
        taskId: z.string(),
      },
    },
    async ({ projectPath, taskId }) => {
      if (!isValidTaskId(taskId)) {
        return {
          ...asText(renderErrorMarkdown(
            "taskContext",
            `Invalid task ID format: ${taskId}`,
            ["expected format: TASK-0001", "retry with a valid task ID"],
            `taskContext(projectPath=\"${projectPath}\", taskId=\"TASK-0001\")`
          )),
          isError: true,
        };
      }

      const governanceDir = await resolveGovernanceDir(projectPath);
      const { markdownPath, tasks, markdown: tasksMarkdown } = await loadTasksDocument(governanceDir);
      const task = tasks.find((item) => item.id === taskId);
      if (!task) {
        return {
          ...asText(renderErrorMarkdown(
            "taskContext",
            `Task not found: ${taskId}`,
            ["run `taskList` to discover available IDs", "retry with an existing task ID"],
            `taskList(projectPath=\"${toProjectPath(governanceDir)}\")`
          )),
          isError: true,
        };
      }

      const lintSuggestions = [
        ...collectSingleTaskLintSuggestions(task),
        ...(await collectTaskFileLintSuggestions(governanceDir, task)),
      ];
      const contextReadingGuidance = await resolveTaskContextReadingGuidance(governanceDir);

      const taskLocation = (await findTextReferences(markdownPath, taskId))[0];
      const artifacts = await discoverGovernanceArtifacts(governanceDir);
      const fileCandidates = candidateFilesFromArtifacts(artifacts);
      const referenceLocations = (
        await Promise.all(fileCandidates.map((file) => findTextReferences(file, taskId)))
      ).flat();

      const relatedArtifacts = Array.from(new Set(referenceLocations.map((item) => item.filePath)));
      const suggestedReadOrder = [markdownPath, ...relatedArtifacts.filter((item) => item !== markdownPath)];

      // Build summary with subState and blocker info (v1.1.0)
      const summaryLines = [
        `- governanceDir: ${governanceDir}`,
        `- taskId: ${task.id}`,
        `- title: ${task.title}`,
        `- status: ${task.status}`,
        `- owner: ${task.owner}`,
        `- updatedAt: ${task.updatedAt}`,
        `- roadmapRefs: ${task.roadmapRefs.join(", ") || "(none)"}`,
        `- taskLocation: ${taskLocation ? `${taskLocation.filePath}#L${taskLocation.line}` : markdownPath}`,
      ];

      // Add subState info for IN_PROGRESS tasks (v1.1.0)
      if (task.subState && task.status === "IN_PROGRESS") {
        summaryLines.push(`- subState:`);
        if (task.subState.phase) {
          summaryLines.push(`  - phase: ${task.subState.phase}`);
        }
        if (typeof task.subState.confidence === "number") {
          summaryLines.push(`  - confidence: ${task.subState.confidence}`);
        }
        if (task.subState.estimatedCompletion) {
          summaryLines.push(`  - estimatedCompletion: ${task.subState.estimatedCompletion}`);
        }
      }

      // Add blocker info for BLOCKED tasks (v1.1.0)
      if (task.blocker && task.status === "BLOCKED") {
        summaryLines.push(`- blocker:`);
        summaryLines.push(`  - type: ${task.blocker.type}`);
        summaryLines.push(`  - description: ${task.blocker.description}`);
        if (task.blocker.blockingEntity) {
          summaryLines.push(`  - blockingEntity: ${task.blocker.blockingEntity}`);
        }
        if (task.blocker.unblockCondition) {
          summaryLines.push(`  - unblockCondition: ${task.blocker.unblockCondition}`);
        }
        if (task.blocker.escalationPath) {
          summaryLines.push(`  - escalationPath: ${task.blocker.escalationPath}`);
        }
      }

      const coreMarkdown = renderToolResponseMarkdown({
        toolName: "taskContext",
        sections: [
          summarySection(summaryLines),
          evidenceSection([
            "### Related Artifacts",
            ...(relatedArtifacts.length > 0 ? relatedArtifacts.map((file) => `- ${file}`) : ["- (none)"]),
            "",
            "### Reference Locations",
            ...(referenceLocations.length > 0
              ? referenceLocations.map((item) => `- ${item.filePath}#L${item.line}: ${item.text}`)
              : ["- (none)"]),
            "",
            "### Suggested Read Order",
            ...suggestedReadOrder.map((item, index) => `${index + 1}. ${item}`),
          ]),
          guidanceSection([
            "- Read the files in Suggested Read Order.",
            "",
            "### Recommended Context Reading",
            ...contextReadingGuidance,
            "",
            "- Verify whether current status and evidence are consistent.",
            ...taskStatusGuidance(task),
            "- If updates are needed, use tool writes for sqlite source (`taskUpdate` / `roadmapUpdate`) and keep TASK IDs unchanged.",
            "- After editing, re-run `taskContext` to verify references and context consistency.",
          ]),
          lintSection(lintSuggestions),
          nextCallSection(`taskContext(projectPath=\"${toProjectPath(governanceDir)}\", taskId=\"${task.id}\")`),
        ],
      });

      return asText(coreMarkdown);
    }
  );

  // taskUpdate tool - Update task fields including subState and blocker (Spec v1.1.0)
  server.registerTool(
    "taskUpdate",
    {
      title: "Task Update",
      description: "Update task fields including status, owner, summary, subState, and blocker metadata",
      inputSchema: {
        projectPath: z.string(),
        taskId: z.string(),
        updates: z.object({
          status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(),
          owner: z.string().optional(),
          summary: z.string().optional(),
          roadmapRefs: z.array(z.string()).optional(),
          links: z.array(z.string()).optional(),
          subState: z.object({
            phase: z.enum(["discovery", "design", "implementation", "testing"]).optional(),
            confidence: z.number().min(0).max(1).optional(),
            estimatedCompletion: z.string().optional(),
          }).optional(),
          blocker: z.object({
            type: z.enum(["internal_dependency", "external_dependency", "resource", "approval"]),
            description: z.string(),
            blockingEntity: z.string().optional(),
            unblockCondition: z.string().optional(),
            escalationPath: z.string().optional(),
          }).optional(),
        }),
      },
    },
    async ({ projectPath, taskId, updates }) => {
      if (!isValidTaskId(taskId)) {
        return {
          ...asText(renderErrorMarkdown(
            "taskUpdate",
            `Invalid task ID format: ${taskId}`,
            ["expected format: TASK-0001", "retry with a valid task ID"],
            `taskUpdate(projectPath=\"${projectPath}\", taskId=\"TASK-0001\", updates={...})`
          )),
          isError: true,
        };
      }

      const governanceDir = await resolveGovernanceDir(projectPath);
      const { tasksPath, tasks } = await loadTasksDocument(governanceDir);
      const taskIndex = tasks.findIndex((item) => item.id === taskId);

      if (taskIndex === -1) {
        return {
          ...asText(renderErrorMarkdown(
            "taskUpdate",
            `Task not found: ${taskId}`,
            ["run `taskList` to discover available IDs", "retry with an existing task ID"],
            `taskList(projectPath=\"${toProjectPath(governanceDir)}\")`
          )),
          isError: true,
        };
      }

      const task = tasks[taskIndex];
      const originalStatus = task.status;

      // Validate status transition
      if (updates.status && !validateTransition(originalStatus, updates.status)) {
        return {
          ...asText(renderErrorMarkdown(
            "taskUpdate",
            `Invalid status transition: ${originalStatus} -> ${updates.status}`,
            ["use `validateTransition` to check allowed transitions", "provide evidence when transitioning to DONE"],
            `taskContext(projectPath=\"${toProjectPath(governanceDir)}\", taskId=\"${taskId}\")`
          )),
          isError: true,
        };
      }

      // Apply updates
      if (updates.status) task.status = updates.status;
      if (updates.owner !== undefined) task.owner = updates.owner;
      if (updates.summary !== undefined) task.summary = updates.summary;
      if (updates.roadmapRefs) task.roadmapRefs = updates.roadmapRefs;
      if (updates.links) task.links = updates.links;

      // Handle subState (Spec v1.1.0)
      if (updates.subState !== undefined) {
        if (updates.subState === null) {
          delete task.subState;
        } else {
          task.subState = {
            ...(task.subState || {}),
            ...updates.subState,
          };
        }
      }

      // Handle blocker (Spec v1.1.0)
      if (updates.blocker !== undefined) {
        if (updates.blocker === null) {
          delete task.blocker;
        } else {
          task.blocker = updates.blocker;
        }
      }

      // Update updatedAt
      task.updatedAt = nowIso();

      const normalizedTask = normalizeTask(task);

      // Save task incrementally
      await upsertTaskInStore(tasksPath, normalizedTask);

      task.status = normalizedTask.status;
      task.owner = normalizedTask.owner;
      task.summary = normalizedTask.summary;
      task.roadmapRefs = normalizedTask.roadmapRefs;
      task.links = normalizedTask.links;
      task.updatedAt = normalizedTask.updatedAt;
      task.subState = normalizedTask.subState;
      task.blocker = normalizedTask.blocker;

      // Build response
      const updateSummary = [
        `- taskId: ${taskId}`,
        `- originalStatus: ${originalStatus}`,
        `- newStatus: ${task.status}`,
        `- updatedAt: ${task.updatedAt}`,
      ];

      if (task.subState) {
        updateSummary.push(`- subState:`);
        if (task.subState.phase) updateSummary.push(`  - phase: ${task.subState.phase}`);
        if (typeof task.subState.confidence === "number") updateSummary.push(`  - confidence: ${task.subState.confidence}`);
        if (task.subState.estimatedCompletion) updateSummary.push(`  - estimatedCompletion: ${task.subState.estimatedCompletion}`);
      }

      if (task.blocker) {
        updateSummary.push(`- blocker:`);
        updateSummary.push(`  - type: ${task.blocker.type}`);
        updateSummary.push(`  - description: ${task.blocker.description}`);
        if (task.blocker.blockingEntity) updateSummary.push(`  - blockingEntity: ${task.blocker.blockingEntity}`);
        if (task.blocker.unblockCondition) updateSummary.push(`  - unblockCondition: ${task.blocker.unblockCondition}`);
        if (task.blocker.escalationPath) updateSummary.push(`  - escalationPath: ${task.blocker.escalationPath}`);
      }

      const markdown = renderToolResponseMarkdown({
        toolName: "taskUpdate",
        sections: [
          summarySection(updateSummary),
          evidenceSection([
            "### Updated Task",
            `- ${task.id} | ${task.status} | ${task.title}`,
            `- owner: ${task.owner || "(none)"}`,
            `- summary: ${task.summary || "(none)"}`,
            "",
            "### Update Details",
            ...(updates.status ? [`- status: ${originalStatus} → ${updates.status}`] : []),
            ...(updates.owner !== undefined ? [`- owner: ${updates.owner}`] : []),
            ...(updates.summary !== undefined ? [`- summary: ${updates.summary}`] : []),
            ...(updates.roadmapRefs ? [`- roadmapRefs: ${updates.roadmapRefs.join(", ")}`] : []),
            ...(updates.links ? [`- links: ${updates.links.join(", ")}`] : []),
            ...(updates.subState ? [`- subState: ${JSON.stringify(updates.subState)}`] : []),
            ...(updates.blocker ? [`- blocker: ${JSON.stringify(updates.blocker)}`] : []),
          ]),
          guidanceSection([
            "Task updated successfully. Run `taskContext` to verify the changes.",
            "If status changed to DONE, ensure evidence links are added.",
            "If subState or blocker were updated, verify the metadata is correct.",
            "SQLite is source of truth; tasks.md is a generated view and may be overwritten.",
            "Call `syncViews(projectPath=..., views=[\"tasks\"], force=true)` when immediate markdown materialization is required.",
          ]),
          lintSection([]),
          nextCallSection(`taskContext(projectPath=\"${toProjectPath(governanceDir)}\", taskId=\"${taskId}\")`),
        ],
      });

      return asText(markdown);
    }
  );
}
