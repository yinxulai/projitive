import fs from "node:fs/promises";
import path from "node:path";
import { catchIt } from "./helpers/catch/index.js";
import { resolveGovernanceDir } from "./projitive.js";
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

export type ActionableTaskCandidate = {
  governanceDir: string;
  tasksPath: string;
  task: Task;
  projectScore: number;
  projectLatestUpdatedAt: string;
  taskUpdatedAtMs: number;
  taskPriority: number;
};

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
  const tasksPath = await ensureTasksFile(inputPath);
  const markdown = await fs.readFile(tasksPath, "utf-8");
  return { tasksPath, tasks: await parseTasksBlock(markdown) };
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
