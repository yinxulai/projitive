import fs from "node:fs/promises";
import path from "node:path";
import { catchIt } from "./helpers/catch/index.js";
import type { HookKey, Task, TaskStatus } from "./tasks.js";

export type HookResolution = {
  event: HookKey;
  source: "task" | "global" | "none";
  path?: string;
  content?: string;
  warning?: string;
};

const GLOBAL_EVENT_FILES: Record<HookKey, string> = {
  onAssigned: "on_task_assigned.md",
  onCompleted: "on_task_completed.md",
  onBlocked: "on_task_blocked.md",
  onReopened: "on_task_reopened.md",
};

export function detectHookEvent(from: TaskStatus, to: TaskStatus): HookKey | null {
  if (to === "IN_PROGRESS") {
    return from === "DONE" ? "onReopened" : "onAssigned";
  }

  if (to === "DONE") {
    return "onCompleted";
  }

  if (to === "BLOCKED") {
    return "onBlocked";
  }

  return null;
}

async function readHookFile(filePath: string): Promise<{ ok: boolean; content?: string; warning?: string }> {
  const contentResult = await catchIt(fs.readFile(filePath, "utf-8"));
  if (contentResult.isError()) {
    return { ok: false, warning: `Hook file not found or unreadable: ${filePath}` };
  }

  const content = contentResult.value;
  if (content.trim().length === 0) {
    return { ok: true, content: "" };
  }
  return { ok: true, content };
}

export async function resolveHookForEvent(governanceDir: string, task: Task, event: HookKey): Promise<HookResolution> {
  const taskHookPath = task.hooks[event];
  if (taskHookPath) {
    const resolvedTaskPath = path.resolve(governanceDir, taskHookPath);
    const taskFile = await readHookFile(resolvedTaskPath);
    if (taskFile.ok) {
      return {
        event,
        source: "task",
        path: resolvedTaskPath,
        content: taskFile.content,
      };
    }
  }

  const globalPath = path.join(governanceDir, "hooks", GLOBAL_EVENT_FILES[event]);
  const globalFile = await readHookFile(globalPath);
  if (globalFile.ok) {
    return {
      event,
      source: "global",
      path: globalPath,
      content: globalFile.content,
    };
  }

  return {
    event,
    source: "none",
    warning: globalFile.warning,
  };
}
