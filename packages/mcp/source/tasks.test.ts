import { describe, expect, it } from "vitest";
import {
  TASKS_END,
  TASKS_START,
  collectTaskLintSuggestions,
  isValidTaskId,
  normalizeTask,
  parseTasksBlock,
  rankActionableTaskCandidates,
  resolveNoTaskDiscoveryGuidance,
  renderTaskSeedTemplate,
  renderTasksMarkdown,
  taskPriority,
  toTaskUpdatedAtMs,
  validateTransition,
  type ActionableTaskCandidate,
} from "./tasks.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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
      TASKS_END,
    ].join("\n");

    const tasks = await parseTasksBlock(markdown);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("TASK-0001");
    expect(tasks[0].status).toBe("TODO");
    expect(tasks[0].roadmapRefs).toEqual(["ROADMAP-0001"]);
    expect(tasks[0].links).toEqual(["./designs/example.md"]);
  });

  it("renders markdown containing markers", () => {
    const task = normalizeTask({ id: "TASK-0002", title: "render", status: "IN_PROGRESS" });
    const markdown = renderTasksMarkdown([task]);
    expect(markdown.includes(TASKS_START)).toBe(true);
    expect(markdown.includes(TASKS_END)).toBe(true);
    expect(markdown.includes("## TASK-0002 | IN_PROGRESS | render")).toBe(true);
  });

  it("parses task with subState metadata (Spec v1.1.0)", async () => {
    const markdown = [
      "# Tasks",
      TASKS_START,
      "## TASK-0003 | IN_PROGRESS | feature with substate",
      "- owner: bob",
      "- summary: implementing feature",
      "- updatedAt: 2026-02-20T00:00:00.000Z",
      "- roadmapRefs: ROADMAP-0001",
      "- links:",
      "  - ./designs/feature.md",
      "- subState:",
      "  - phase: implementation",
      "  - confidence: 0.85",
      "  - estimatedCompletion: 2026-02-25T15:00:00Z",
      TASKS_END,
    ].join("\n");

    const tasks = await parseTasksBlock(markdown);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("TASK-0003");
    expect(tasks[0].subState).toBeDefined();
    expect(tasks[0].subState?.phase).toBe("implementation");
    expect(tasks[0].subState?.confidence).toBe(0.85);
    expect(tasks[0].subState?.estimatedCompletion).toBe("2026-02-25T15:00:00Z");
  });

  it("parses task with blocker metadata (Spec v1.1.0)", async () => {
    const markdown = [
      "# Tasks",
      TASKS_START,
      "## TASK-0004 | BLOCKED | waiting for api",
      "- owner: charlie",
      "- summary: Waiting for payment API v2.0",
      "- updatedAt: 2026-02-20T00:00:00.000Z",
      "- roadmapRefs: ROADMAP-0001",
      "- links:",
      "  - ./docs/api-waiting.md",
      "- blocker:",
      "  - type: external_dependency",
      "  - description: Waiting for payment API v2.0",
      "  - blockingEntity: third-party/payment-provider",
      "  - unblockCondition: API v2.0 GA announced",
      "  - escalationPath: contact-pm-for-workaround",
      TASKS_END,
    ].join("\n");

    const tasks = await parseTasksBlock(markdown);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("TASK-0004");
    expect(tasks[0].blocker).toBeDefined();
    expect(tasks[0].blocker?.type).toBe("external_dependency");
    expect(tasks[0].blocker?.description).toBe("Waiting for payment API v2.0");
    expect(tasks[0].blocker?.blockingEntity).toBe("third-party/payment-provider");
    expect(tasks[0].blocker?.unblockCondition).toBe("API v2.0 GA announced");
    expect(tasks[0].blocker?.escalationPath).toBe("contact-pm-for-workaround");
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
      "## TASK-0002 | TODO | B",
      "- owner: (none)",
      "- summary: (none)",
      "- updatedAt: 2026-02-18T00:00:00.000Z",
      "- roadmapRefs: ROADMAP-0001",
      "- links:",
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

  it("renders seed task template with provided roadmap ref", () => {
    const lines = renderTaskSeedTemplate("ROADMAP-0099");
    const markdown = lines.join("\n");

    expect(markdown).toContain("## TASK-0001 | TODO | Define initial executable objective");
    expect(markdown).toContain("- roadmapRefs: ROADMAP-0099");
    expect(markdown).toContain("- links:");
    expect(markdown).not.toContain("- hooks:");
  });

  it("uses default no-task guidance when hook file is absent", async () => {
    const guidance = await resolveNoTaskDiscoveryGuidance("/path/that/does/not/exist");
    expect(guidance.length).toBeGreaterThan(3);
    expect(guidance.some((line) => line.includes("TODO/FIXME/HACK"))).toBe(true);
  });

  it("uses hook checklist when task_no_actionable hook exists", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "projitive-mcp-test-"));
    const hooksDir = path.join(dir, "hooks");
    await fs.mkdir(hooksDir, { recursive: true });
    await fs.writeFile(
      path.join(hooksDir, "task_no_actionable.md"),
      [
        "Objective:",
        "- custom-item-1",
        "- custom-item-2",
      ].join("\n"),
      "utf-8"
    );

    const guidance = await resolveNoTaskDiscoveryGuidance(dir);
    expect(guidance).toContain("- custom-item-1");
    expect(guidance).toContain("- custom-item-2");

    await fs.rm(dir, { recursive: true, force: true });
  });
});
