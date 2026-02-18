import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { discoverGovernanceArtifacts } from "./helpers/files/index.js";
import { findTextReferences } from "./helpers/markdown/index.js";
import { catchIt } from "./helpers/catch/index.js";
import { resolveGovernanceDir, resolveScanDepth, resolveScanRoot, discoverProjects } from "./projitive.js";
import { isValidRoadmapId } from "./roadmap.js";

export const TASKS_START = "<!-- PROJITIVE:TASKS:START -->";
export const TASKS_END = "<!-- PROJITIVE:TASKS:END -->";
export const ALLOWED_STATUS = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
export const TASK_ID_REGEX = /^TASK-\d{4}$/;

export type TaskStatus = (typeof ALLOWED_STATUS)[number];
export type HookKey = "onAssigned" | "onCompleted" | "onBlocked" | "onReopened";
export type TaskHooks = Partial<Record<HookKey, string>>;

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  owner: string;
  summary: string;
  updatedAt: string;
  links: string[];
  roadmapRefs: string[];
  hooks: TaskHooks;
};

export type TaskDocument = {
  tasksPath: string;
  tasks: Task[];
  markdown: string;
};

export type ActionableTaskCandidate = {
  governanceDir: string;
  tasksPath: string;
  task: Task;
  projectScore: number;
  projectLatestUpdatedAt: string;
  taskUpdatedAtMs: number;
  taskPriority: number;
};

function asText(markdown: string) {
  return {
    content: [{ type: "text" as const, text: markdown }],
  };
}

function renderErrorMarkdown(toolName: string, cause: string, nextSteps: string[], retryExample?: string): string {
  return [
    `# ${toolName}`,
    "",
    "## Error",
    `- cause: ${cause}`,
    "",
    "## Next Step",
    ...(nextSteps.length > 0 ? nextSteps : ["- (none)"]),
    "",
    "## Retry Example",
    `- ${retryExample ?? "(none)"}`,
  ].join("\n");
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

function candidateFilesFromArtifacts(artifacts: Awaited<ReturnType<typeof discoverGovernanceArtifacts>>): string[] {
  return artifacts
    .filter((item) => item.exists)
    .flatMap((item) => {
      if (item.kind === "file") {
        return [item.path];
      }
      return (item.markdownFiles ?? []).map((entry) => entry.path);
    });
}

async function readOptionalMarkdown(filePath: string): Promise<string | undefined> {
  const content = await fs.readFile(filePath, "utf-8").catch(() => undefined);
  if (typeof content !== "string") {
    return undefined;
  }
  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function readTaskContextHooks(governanceDir: string): Promise<{ head?: string; footer?: string; headPath: string; footerPath: string }> {
  const headPath = path.join(governanceDir, "hooks", "task_get_head.md");
  const footerPath = path.join(governanceDir, "hooks", "task_get_footer.md");

  const [head, footer] = await Promise.all([readOptionalMarkdown(headPath), readOptionalMarkdown(footerPath)]);
  return { head, footer, headPath, footerPath };
}

function latestTaskUpdatedAt(tasks: Task[]): string {
  const timestamps = tasks
    .map((task) => new Date(task.updatedAt).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return "(unknown)";
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function actionableScore(tasks: Task[]): number {
  return tasks.filter((task) => task.status === "IN_PROGRESS").length * 2
    + tasks.filter((task) => task.status === "TODO").length;
}

async function readActionableTaskCandidates(governanceDirs: string[]): Promise<ActionableTaskCandidate[]> {
  const snapshots = await Promise.all(
    governanceDirs.map(async (governanceDir) => {
      const snapshot = await loadTasks(governanceDir);
      return {
        governanceDir,
        tasksPath: snapshot.tasksPath,
        tasks: snapshot.tasks,
        projectScore: actionableScore(snapshot.tasks),
        projectLatestUpdatedAt: latestTaskUpdatedAt(snapshot.tasks),
      };
    })
  );

  return snapshots.flatMap((item) => item.tasks
    .filter((task) => task.status === "IN_PROGRESS" || task.status === "TODO")
    .map((task) => ({
      governanceDir: item.governanceDir,
      tasksPath: item.tasksPath,
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

  const inputHooks = task.hooks ?? {};
  const normalizedHooks: TaskHooks = {};
  for (const key of ["onAssigned", "onCompleted", "onBlocked", "onReopened"] as const) {
    const value = inputHooks[key];
    if (typeof value === "string" && value.trim().length > 0) {
      normalizedHooks[key] = value;
    }
  }

  return {
    id: String(task.id),
    title: String(task.title),
    status: ALLOWED_STATUS.includes(task.status as TaskStatus) ? (task.status as TaskStatus) : "TODO",
    owner: task.owner ? String(task.owner) : "",
    summary: task.summary ? String(task.summary) : "",
    updatedAt: task.updatedAt ? String(task.updatedAt) : nowIso(),
    links: Array.isArray(task.links) ? task.links.map(String) : [],
    roadmapRefs: Array.from(new Set(normalizedRoadmapRefs)),
    hooks: normalizedHooks,
  };
}

export async function parseTasksBlock(markdown: string): Promise<Task[]> {
  const start = markdown.indexOf(TASKS_START);
  const end = markdown.indexOf(TASKS_END);

  if (start === -1 || end === -1 || end <= start) {
    return [];
  }

  const body = markdown.slice(start + TASKS_START.length, end).trim();
  if (!body || body === "(no tasks)") {
    return [];
  }

  const sections = body
    .split(/\n(?=##\s+TASK-\d{4}\s+\|\s+(?:TODO|IN_PROGRESS|BLOCKED|DONE)\s+\|)/g)
    .map((section) => section.trim())
    .filter((section) => section.startsWith("## TASK-"));

  const tasks: Task[] = [];

  for (const section of sections) {
    const lines = section.split(/\r?\n/);
    const header = lines[0]?.match(/^##\s+(TASK-\d{4})\s+\|\s+(TODO|IN_PROGRESS|BLOCKED|DONE)\s+\|\s+(.+)$/);
    if (!header) {
      continue;
    }

    const [, id, statusRaw, title] = header;
    const status = statusRaw as TaskStatus;

    const taskDraft: Partial<Task> & { id: string; title: string } = {
      id,
      title: title.trim(),
      status,
      owner: "",
      summary: "",
      updatedAt: nowIso(),
      links: [],
      roadmapRefs: [],
      hooks: {},
    };

    let inLinks = false;
    let inHooks = false;

    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      if (trimmed.startsWith("- owner:")) {
        taskDraft.owner = trimmed.replace("- owner:", "").trim();
        inLinks = false;
        inHooks = false;
        continue;
      }

      if (trimmed.startsWith("- summary:")) {
        taskDraft.summary = trimmed.replace("- summary:", "").trim();
        inLinks = false;
        inHooks = false;
        continue;
      }

      if (trimmed.startsWith("- updatedAt:")) {
        taskDraft.updatedAt = trimmed.replace("- updatedAt:", "").trim();
        inLinks = false;
        inHooks = false;
        continue;
      }

      if (trimmed.startsWith("- roadmapRefs:")) {
        const payload = trimmed.replace("- roadmapRefs:", "").trim();
        const refs = payload === "(none)"
          ? []
          : payload
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0);
        taskDraft.roadmapRefs = refs;
        inLinks = false;
        inHooks = false;
        continue;
      }

      if (trimmed === "- links:") {
        inLinks = true;
        inHooks = false;
        continue;
      }

      if (trimmed === "- hooks:") {
        inLinks = false;
        inHooks = true;
        continue;
      }

      const nestedItem = trimmed.match(/^-\s+(.+)$/);
      if (!nestedItem) {
        continue;
      }

      const nestedValue = nestedItem[1].trim();
      if (nestedValue === "(none)") {
        continue;
      }

      if (inLinks) {
        taskDraft.links = [...(taskDraft.links ?? []), nestedValue];
        continue;
      }

      if (inHooks) {
        const hookMatch = nestedValue.match(/^(onAssigned|onCompleted|onBlocked|onReopened):\s+(.+)$/);
        if (hookMatch) {
          const [, hookKey, hookPath] = hookMatch;
          taskDraft.hooks = {
            ...(taskDraft.hooks ?? {}),
            [hookKey]: hookPath.trim(),
          };
        }
      }
    }

    tasks.push(normalizeTask(taskDraft));
  }

  return tasks;
}

export function findTaskIdsOutsideMarkers(markdown: string): string[] {
  const start = markdown.indexOf(TASKS_START);
  const end = markdown.indexOf(TASKS_END);

  const outsideText = (start !== -1 && end !== -1 && end > start)
    ? `${markdown.slice(0, start)}\n${markdown.slice(end + TASKS_END.length)}`
    : markdown;

  const ids = outsideText.match(/TASK-\d{4}/g) ?? [];
  return Array.from(new Set(ids));
}

export function collectTaskLintSuggestions(tasks: Task[], markdown?: string): string[] {
  const suggestions: string[] = [];

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
    suggestions.push(`- Duplicate task IDs detected: ${duplicateIds.join(", ")}. Keep task IDs unique in marker block.`);
  }

  const inProgressWithoutOwner = tasks.filter((task) => task.status === "IN_PROGRESS" && task.owner.trim().length === 0);
  if (inProgressWithoutOwner.length > 0) {
    suggestions.push(`- ${inProgressWithoutOwner.length} IN_PROGRESS task(s) have empty owner. Set owner before continuing execution.`);
  }

  const doneWithoutLinks = tasks.filter((task) => task.status === "DONE" && task.links.length === 0);
  if (doneWithoutLinks.length > 0) {
    suggestions.push(`- ${doneWithoutLinks.length} DONE task(s) have no links evidence. Add at least one evidence link before keeping DONE.`);
  }

  const blockedWithoutReason = tasks.filter((task) => task.status === "BLOCKED" && task.summary.trim().length === 0);
  if (blockedWithoutReason.length > 0) {
    suggestions.push(`- ${blockedWithoutReason.length} BLOCKED task(s) have empty summary. Add blocker reason and unblock condition.`);
  }

  const invalidUpdatedAt = tasks.filter((task) => !Number.isFinite(new Date(task.updatedAt).getTime()));
  if (invalidUpdatedAt.length > 0) {
    suggestions.push(`- ${invalidUpdatedAt.length} task(s) have invalid updatedAt format. Use ISO8601 UTC timestamp.`);
  }

  const missingRoadmapRefs = tasks.filter((task) => task.roadmapRefs.length === 0);
  if (missingRoadmapRefs.length > 0) {
    suggestions.push(`- ${missingRoadmapRefs.length} task(s) have empty roadmapRefs. Bind at least one ROADMAP-xxxx when applicable.`);
  }

  if (typeof markdown === "string") {
    const outsideMarkerTaskIds = findTaskIdsOutsideMarkers(markdown);
    if (outsideMarkerTaskIds.length > 0) {
      suggestions.push(`- TASK IDs found outside marker block: ${outsideMarkerTaskIds.join(", ")}. Keep task source of truth inside marker region only.`);
    }
  }

  return suggestions;
}

function collectSingleTaskLintSuggestions(task: Task): string[] {
  const suggestions: string[] = [];

  if (task.status === "IN_PROGRESS" && task.owner.trim().length === 0) {
    suggestions.push("- Current task is IN_PROGRESS but owner is empty. Set owner before continuing execution.");
  }

  if (task.status === "DONE" && task.links.length === 0) {
    suggestions.push("- Current task is DONE but has no links evidence. Add at least one evidence link.");
  }

  if (task.status === "BLOCKED" && task.summary.trim().length === 0) {
    suggestions.push("- Current task is BLOCKED but summary is empty. Add blocker reason and unblock condition.");
  }

  if (!Number.isFinite(new Date(task.updatedAt).getTime())) {
    suggestions.push("- Current task updatedAt is invalid. Use ISO8601 UTC timestamp.");
  }

  if (task.roadmapRefs.length === 0) {
    suggestions.push("- Current task has empty roadmapRefs. Bind ROADMAP-xxxx where applicable.");
  }

  return suggestions;
}

async function collectTaskFileLintSuggestions(governanceDir: string, task: Task): Promise<string[]> {
  const suggestions: string[] = [];

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
      suggestions.push(`- Link target not found: ${normalized} (resolved: ${resolvedPath}).`);
    }
  }

  const hookEntries = Object.entries(task.hooks)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0) as Array<[string, string]>;

  for (const [hookKey, hookPath] of hookEntries) {
    const resolvedPath = path.resolve(governanceDir, hookPath);
    const exists = await fs.access(resolvedPath).then(() => true).catch(() => false);
    if (!exists) {
      suggestions.push(`- Hook file not found for ${hookKey}: ${hookPath} (resolved: ${resolvedPath}).`);
    }
  }

  return suggestions;
}

export function renderTasksMarkdown(tasks: Task[]): string {
  const sections = tasks.map((task) => {
    const roadmapRefs = task.roadmapRefs.length > 0 ? task.roadmapRefs.join(", ") : "(none)";
    const links = task.links.length > 0
      ? ["- links:", ...task.links.map((link) => `  - ${link}`)]
      : ["- links:", "  - (none)"];

    const hookEntries = Object.entries(task.hooks)
      .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
      .map(([key, value]) => `  - ${key}: ${value}`);

    const hooks = hookEntries.length > 0
      ? ["- hooks:", ...hookEntries]
      : ["- hooks:", "  - (none)"];

    return [
      `## ${task.id} | ${task.status} | ${task.title}`,
      `- owner: ${task.owner || "(none)"}`,
      `- summary: ${task.summary || "(none)"}`,
      `- updatedAt: ${task.updatedAt}`,
      `- roadmapRefs: ${roadmapRefs}`,
      ...links,
      ...hooks,
    ].join("\n");
  });

  return [
    "# Tasks",
    "",
    "本文件由 Projitive MCP 维护，手动编辑请保持 Markdown 结构合法。",
    "",
    TASKS_START,
    ...(sections.length > 0 ? sections : ["(no tasks)"]),
    TASKS_END,
    "",
  ].join("\n");
}

export async function ensureTasksFile(inputPath: string): Promise<string> {
  const governanceDir = await resolveGovernanceDir(inputPath);
  const tasksPath = path.join(governanceDir, "tasks.md");

  await fs.mkdir(governanceDir, { recursive: true });

  const accessResult = await catchIt(fs.access(tasksPath));
  if (accessResult.isError()) {
    await fs.writeFile(tasksPath, renderTasksMarkdown([]), "utf-8");
  }

  return tasksPath;
}

export async function loadTasks(inputPath: string): Promise<{ tasksPath: string; tasks: Task[] }> {
  const { tasksPath, tasks } = await loadTasksDocument(inputPath);
  return { tasksPath, tasks };
}

export async function loadTasksDocument(inputPath: string): Promise<TaskDocument> {
  const tasksPath = await ensureTasksFile(inputPath);
  const markdown = await fs.readFile(tasksPath, "utf-8");
  return { tasksPath, markdown, tasks: await parseTasksBlock(markdown) };
}

export async function saveTasks(tasksPath: string, tasks: Task[]): Promise<void> {
  const normalized = tasks.map((task) => normalizeTask(task));
  await fs.writeFile(tasksPath, renderTasksMarkdown(normalized), "utf-8");
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
      description: "List project tasks with optional status filter for agent planning",
      inputSchema: {
        projectPath: z.string(),
        status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async ({ projectPath, status, limit }) => {
      const governanceDir = await resolveGovernanceDir(projectPath);
      const { tasksPath, tasks, markdown: tasksMarkdown } = await loadTasksDocument(governanceDir);
      const filtered = tasks
        .filter((task) => (status ? task.status === status : true))
        .slice(0, limit ?? 100);
      const lintSuggestions = collectTaskLintSuggestions(filtered, tasksMarkdown);
      if (status && filtered.length === 0) {
        lintSuggestions.push(`- No tasks matched status=${status}. Confirm status values or update task states.`);
      }
      const nextTaskId = filtered[0]?.id;

      const markdown = [
        "# taskList",
        "",
        "## Summary",
        `- governanceDir: ${governanceDir}`,
        `- tasksPath: ${tasksPath}`,
        `- filter.status: ${status ?? "(none)"}`,
        `- returned: ${filtered.length}`,
        "",
        "## Evidence",
        "- tasks:",
        ...(filtered.length > 0
          ? filtered.map((task) => `- ${task.id} | ${task.status} | ${task.title} | owner=${task.owner || ""} | updatedAt=${task.updatedAt}`)
          : ["- (none)"]),
        "",
        "## Agent Guidance",
        "- Pick one task ID and call `taskContext`.",
        "",
        "## Lint Suggestions",
        ...(lintSuggestions.length > 0 ? lintSuggestions : ["- (none)"]),
        "",
        "## Next Call",
        ...(nextTaskId
          ? [`- taskContext(projectPath=\"${governanceDir}\", taskId=\"${nextTaskId}\")`]
          : ["- (none)"]),
      ].join("\n");

      return asText(markdown);
    }
  );

  server.registerTool(
    "taskNext",
    {
      title: "Task Next",
      description: "One-step discover and select the most actionable task with evidence and start guidance",
      inputSchema: {
        rootPath: z.string().optional(),
        maxDepth: z.number().int().min(0).max(8).optional(),
        topCandidates: z.number().int().min(1).max(20).optional(),
      },
    },
    async ({ rootPath, maxDepth, topCandidates }) => {
      const root = resolveScanRoot(rootPath);
      const depth = resolveScanDepth(maxDepth);
      const projects = await discoverProjects(root, depth);
      const rankedCandidates = rankActionableTaskCandidates(await readActionableTaskCandidates(projects));

      if (rankedCandidates.length === 0) {
        const markdown = [
          "# taskNext",
          "",
          "## Summary",
          `- rootPath: ${root}`,
          `- maxDepth: ${depth}`,
          `- matchedProjects: ${projects.length}`,
          "- actionableTasks: 0",
          "",
          "## Evidence",
          "- candidates:",
          "- (none)",
          "",
          "## Agent Guidance",
          "- No TODO/IN_PROGRESS task is available.",
          "- Create or reopen tasks in tasks.md, then rerun `taskNext`.",
          "",
          "## Lint Suggestions",
          "- No actionable tasks found. Verify task statuses and required fields in marker block.",
          "",
          "## Next Call",
          `- projectNext(rootPath=\"${root}\", maxDepth=${depth})`,
        ].join("\n");
        return asText(markdown);
      }

      const selected = rankedCandidates[0];
      const selectedTaskDocument = await loadTasksDocument(selected.governanceDir);
      const lintSuggestions = collectTaskLintSuggestions(selectedTaskDocument.tasks, selectedTaskDocument.markdown);
      const artifacts = await discoverGovernanceArtifacts(selected.governanceDir);
      const fileCandidates = candidateFilesFromArtifacts(artifacts);
      const referenceLocations = (
        await Promise.all(fileCandidates.map((file) => findTextReferences(file, selected.task.id)))
      ).flat();
      const taskLocation = (await findTextReferences(selected.tasksPath, selected.task.id))[0];
      const relatedArtifacts = Array.from(new Set(referenceLocations.map((item) => item.filePath)));
      const suggestedReadOrder = [selected.tasksPath, ...relatedArtifacts.filter((item) => item !== selected.tasksPath)];
      const candidateLimit = topCandidates ?? 5;

      const markdown = [
        "# taskNext",
        "",
        "## Summary",
        `- rootPath: ${root}`,
        `- maxDepth: ${depth}`,
        `- matchedProjects: ${projects.length}`,
        `- actionableTasks: ${rankedCandidates.length}`,
        `- selectedProject: ${selected.governanceDir}`,
        `- selectedTaskId: ${selected.task.id}`,
        `- selectedTaskStatus: ${selected.task.status}`,
        "",
        "## Evidence",
        "### Selected Task",
        `- id: ${selected.task.id}`,
        `- title: ${selected.task.title}`,
        `- owner: ${selected.task.owner || "(none)"}`,
        `- updatedAt: ${selected.task.updatedAt}`,
        `- roadmapRefs: ${selected.task.roadmapRefs.join(", ") || "(none)"}`,
        `- taskLocation: ${taskLocation ? `${taskLocation.filePath}#L${taskLocation.line}` : selected.tasksPath}`,
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
        "",
        "## Agent Guidance",
        "- Start immediately with Suggested Read Order and execute the selected task.",
        "- Update markdown artifacts directly while keeping TASK/ROADMAP IDs unchanged.",
        "- Re-run `taskContext` for the selectedTaskId after edits to verify evidence consistency.",
        "",
        "## Lint Suggestions",
        ...(lintSuggestions.length > 0 ? lintSuggestions : ["- (none)"]),
        "",
        "## Next Call",
        `- taskContext(projectPath=\"${selected.governanceDir}\", taskId=\"${selected.task.id}\")`,
      ].join("\n");

      return asText(markdown);
    }
  );

  server.registerTool(
    "taskContext",
    {
      title: "Task Context",
      description: "Get one task with detail, evidence locations, and execution guidance",
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
            ["- expected format: TASK-0001", "- retry with a valid task ID"],
            `taskContext(projectPath=\"${projectPath}\", taskId=\"TASK-0001\")`
          )),
          isError: true,
        };
      }

      const governanceDir = await resolveGovernanceDir(projectPath);
      const { tasksPath, tasks, markdown: tasksMarkdown } = await loadTasksDocument(governanceDir);
      const taskContextHooks = await readTaskContextHooks(governanceDir);
      const task = tasks.find((item) => item.id === taskId);
      if (!task) {
        return {
          ...asText(renderErrorMarkdown(
            "taskContext",
            `Task not found: ${taskId}`,
            ["- run `taskList` to discover available IDs", "- retry with an existing task ID"],
            `taskList(projectPath=\"${governanceDir}\")`
          )),
          isError: true,
        };
      }

      const lintSuggestions = [
        ...collectSingleTaskLintSuggestions(task),
        ...(await collectTaskFileLintSuggestions(governanceDir, task)),
      ];

      const outsideMarkerTaskIds = findTaskIdsOutsideMarkers(tasksMarkdown);
      if (outsideMarkerTaskIds.includes(task.id)) {
        lintSuggestions.push(`- Current task ID appears outside marker block (${task.id}). Keep task source of truth inside marker region.`);
      }

      const taskLocation = (await findTextReferences(tasksPath, taskId))[0];
      const artifacts = await discoverGovernanceArtifacts(governanceDir);
      const fileCandidates = candidateFilesFromArtifacts(artifacts);
      const referenceLocations = (
        await Promise.all(fileCandidates.map((file) => findTextReferences(file, taskId)))
      ).flat();

      const relatedArtifacts = Array.from(new Set(referenceLocations.map((item) => item.filePath)));
      const suggestedReadOrder = [tasksPath, ...relatedArtifacts.filter((item) => item !== tasksPath)];

      const hookPaths = Object.values(task.hooks)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => path.resolve(governanceDir, value));
      const hookStatus = `head=${taskContextHooks.head ? "loaded" : "missing"}, footer=${taskContextHooks.footer ? "loaded" : "missing"}`;

      if (!taskContextHooks.head) {
        lintSuggestions.push(`- Missing ${taskContextHooks.headPath}. Add a task context head hook template if you need standardized preface.`);
      }
      if (!taskContextHooks.footer) {
        lintSuggestions.push(`- Missing ${taskContextHooks.footerPath}. Add a task context footer hook template for standardized close-out checks.`);
      }

      const coreMarkdown = [
        "# taskContext",
        "",
        "## Summary",
        `- governanceDir: ${governanceDir}`,
        `- taskId: ${task.id}`,
        `- title: ${task.title}`,
        `- status: ${task.status}`,
        `- owner: ${task.owner}`,
        `- updatedAt: ${task.updatedAt}`,
        `- roadmapRefs: ${task.roadmapRefs.join(", ") || "(none)"}`,
        `- taskLocation: ${taskLocation ? `${taskLocation.filePath}#L${taskLocation.line}` : tasksPath}`,
        `- hookStatus: ${hookStatus}`,
        "",
        "## Evidence",
        "### Related Artifacts",
        ...(relatedArtifacts.length > 0 ? relatedArtifacts.map((file) => `- ${file}`) : ["- (none)"]),
        "",
        "### Reference Locations",
        ...(referenceLocations.length > 0
          ? referenceLocations.map((item) => `- ${item.filePath}#L${item.line}: ${item.text}`)
          : ["- (none)"]),
        "",
        "### Hook Paths",
        ...(hookPaths.length > 0 ? hookPaths.map((item) => `- ${item}`) : ["- (none)"]),
        "",
        "### Suggested Read Order",
        ...suggestedReadOrder.map((item, index) => `${index + 1}. ${item}`),
        "",
        "## Agent Guidance",
        "- Read the files in Suggested Read Order.",
        "- Verify whether current status and evidence are consistent.",
        ...taskStatusGuidance(task),
        "- If updates are needed, edit tasks/designs/reports markdown directly and keep TASK IDs unchanged.",
        "- After editing, re-run `taskContext` to verify references and context consistency.",
        "",
        "## Lint Suggestions",
        ...(lintSuggestions.length > 0 ? lintSuggestions : ["- (none)"]),
        "",
        "## Next Call",
        `- taskContext(projectPath=\"${governanceDir}\", taskId=\"${task.id}\")`,
      ].join("\n");

      const markdownParts = [
        taskContextHooks.head,
        coreMarkdown,
        taskContextHooks.footer,
      ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

      const markdown = markdownParts.join("\n\n---\n\n");
      return asText(markdown);
    }
  );
}
