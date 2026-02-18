import { describe, expect, it } from "vitest";
import {
  TASKS_END,
  TASKS_START,
  collectTaskLintSuggestions,
  isValidTaskId,
  normalizeTask,
  parseTasksBlock,
  rankActionableTaskCandidates,
  renderTasksMarkdown,
  taskPriority,
  toTaskUpdatedAtMs,
  validateTransition,
  type ActionableTaskCandidate,
} from "./tasks.js";

function buildCandidate(partial: Partial<ActionableTaskCandidate> & { id: string; title: string; status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" }): ActionableTaskCandidate {
  const task = normalizeTask({
    id: partial.id,
    title: partial.title,
    status: partial.status,
    updatedAt: partial.task?.updatedAt ?? "2026-01-01T00:00:00.000Z",
  });

  return {
    governanceDir: partial.governanceDir ?? "/workspace/a",
    tasksPath: partial.tasksPath ?? "/workspace/a/tasks.md",
    task,
    projectScore: partial.projectScore ?? 1,
    projectLatestUpdatedAt: partial.projectLatestUpdatedAt ?? "2026-01-01T00:00:00.000Z",
    taskUpdatedAtMs: partial.taskUpdatedAtMs ?? toTaskUpdatedAtMs(task.updatedAt),
    taskPriority: partial.taskPriority ?? taskPriority(task.status),
  };
}

describe("tasks module", () => {
  it("parses markdown task block and normalizes task fields", async () => {
    const markdown = [
      "# Tasks",
      TASKS_START,
      "## TASK-0001 | TODO | hello",
      "- owner: alice",
      "- summary: first task",
      "- updatedAt: 2026-02-17T00:00:00.000Z",
      "- roadmapRefs: ROADMAP-0001",
      "- links:",
      "  - ./designs/example.md",
      "- hooks:",
      "  - onAssigned: ./hooks/on_task_assigned.md",
      TASKS_END,
    ].join("\n");

    const tasks = await parseTasksBlock(markdown);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("TASK-0001");
    expect(tasks[0].status).toBe("TODO");
    expect(tasks[0].roadmapRefs).toEqual(["ROADMAP-0001"]);
    expect(tasks[0].hooks).toEqual({ onAssigned: "./hooks/on_task_assigned.md" });
  });

  it("renders markdown containing markers", () => {
    const task = normalizeTask({ id: "TASK-0002", title: "render", status: "IN_PROGRESS" });
    const markdown = renderTasksMarkdown([task]);
    expect(markdown.includes(TASKS_START)).toBe(true);
    expect(markdown.includes(TASKS_END)).toBe(true);
    expect(markdown.includes("## TASK-0002 | IN_PROGRESS | render")).toBe(true);
  });

  it("validates task IDs", () => {
    expect(isValidTaskId("TASK-0001")).toBe(true);
    expect(isValidTaskId("TASK-001")).toBe(false);
  });

  it("allows and rejects expected transitions", () => {
    expect(validateTransition("TODO", "IN_PROGRESS")).toBe(true);
    expect(validateTransition("IN_PROGRESS", "DONE")).toBe(true);
    expect(validateTransition("DONE", "IN_PROGRESS")).toBe(false);
  });

  it("assigns priority for actionable statuses", () => {
    expect(taskPriority("IN_PROGRESS")).toBe(2);
    expect(taskPriority("TODO")).toBe(1);
    expect(taskPriority("BLOCKED")).toBe(0);
  });

  it("returns zero timestamp for invalid date", () => {
    expect(toTaskUpdatedAtMs("invalid")).toBe(0);
  });

  it("ranks by project score, then task priority, then recency", () => {
    const candidates = [
      buildCandidate({ id: "TASK-0001", title: "A", status: "TODO", projectScore: 2 }),
      buildCandidate({ id: "TASK-0002", title: "B", status: "IN_PROGRESS", projectScore: 2 }),
      buildCandidate({ id: "TASK-0003", title: "C", status: "IN_PROGRESS", projectScore: 3 }),
    ];

    const ranked = rankActionableTaskCandidates(candidates);
    expect(ranked[0].task.id).toBe("TASK-0003");
    expect(ranked[1].task.id).toBe("TASK-0002");
    expect(ranked[2].task.id).toBe("TASK-0001");
  });

  it("renders lint lines with stable code prefix", () => {
    const task = normalizeTask({
      id: "TASK-0001",
      title: "lint",
      status: "IN_PROGRESS",
      owner: "",
      roadmapRefs: [],
    });

    const lint = collectTaskLintSuggestions([task]);
    expect(lint.some((line) => line.startsWith("- [TASK_IN_PROGRESS_OWNER_EMPTY]"))).toBe(true);
    expect(lint.some((line) => line.startsWith("- [TASK_ROADMAP_REFS_EMPTY]"))).toBe(true);
  });

  it("scopes outside-marker lint to provided task IDs", () => {
    const tasks = [
      normalizeTask({ id: "TASK-0001", title: "A", status: "TODO", roadmapRefs: ["ROADMAP-0001"] }),
      normalizeTask({ id: "TASK-0002", title: "B", status: "TODO", roadmapRefs: ["ROADMAP-0001"] }),
    ];

    const markdown = [
      "# Tasks",
      "TASK-0002 outside",
      "TASK-0003 outside",
      TASKS_START,
      "## TASK-0001 | TODO | A",
      "- owner: (none)",
      "- summary: (none)",
      "- updatedAt: 2026-02-18T00:00:00.000Z",
      "- roadmapRefs: ROADMAP-0001",
      "- links:",
      "  - (none)",
      "- hooks:",
      "  - (none)",
      "## TASK-0002 | TODO | B",
      "- owner: (none)",
      "- summary: (none)",
      "- updatedAt: 2026-02-18T00:00:00.000Z",
      "- roadmapRefs: ROADMAP-0001",
      "- links:",
      "  - (none)",
      "- hooks:",
      "  - (none)",
      TASKS_END,
    ].join("\n");

    const scoped = collectTaskLintSuggestions(tasks, markdown, new Set(["TASK-0001"]));
    const scopedOutside = scoped.find((line) => line.includes("TASK IDs found outside marker block"));
    expect(scopedOutside).toBeUndefined();

    const all = collectTaskLintSuggestions(tasks, markdown);
    const allOutside = all.find((line) => line.includes("TASK IDs found outside marker block"));
    expect(allOutside).toContain("TASK-0002");
    expect(allOutside).toContain("TASK-0003");
  });
});
