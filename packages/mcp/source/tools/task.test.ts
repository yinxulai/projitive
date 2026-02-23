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
  findTaskIdsOutsideMarkers,
  type ActionableTaskCandidate,
} from "./task.js";
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

  // Additional tests for improved coverage
  it("finds task IDs outside marker blocks", () => {
    const markdown = [
      "# Tasks",
      "Reference to TASK-0001 outside",
      "Another reference to TASK-0002",
      TASKS_START,
      "## TASK-0001 | TODO | A",
      "- owner: (none)",
      "- summary: (none)",
      "- updatedAt: 2026-02-18T00:00:00.000Z",
      "- roadmapRefs: ROADMAP-0001",
      "- links:",
      "  - (none)",
      TASKS_END,
      "Postscript with TASK-0003",
    ].join("\n");

    const ids = findTaskIdsOutsideMarkers(markdown);
    expect(ids).toContain("TASK-0001");
    expect(ids).toContain("TASK-0002");
    expect(ids).toContain("TASK-0003");
    expect(ids).toHaveLength(3);
  });

  it("normalizes task with optional fields", () => {
    const task = normalizeTask({
      id: "TASK-0001",
      title: "Test Task",
      status: "TODO",
      subState: {
        phase: "discovery",
        confidence: 0.75,
        estimatedCompletion: "2026-03-01T00:00:00Z"
      },
      blocker: {
        type: "internal_dependency",
        description: "Waiting for team review"
      }
    });

    expect(task.id).toBe("TASK-0001");
    expect(task.title).toBe("Test Task");
    expect(task.status).toBe("TODO");
    expect(task.subState).toBeDefined();
    expect(task.subState?.phase).toBe("discovery");
    expect(task.subState?.confidence).toBe(0.75);
    expect(task.blocker).toBeDefined();
    expect(task.blocker?.type).toBe("internal_dependency");
  });

  it("renders tasks with subState and blocker metadata", () => {
    const task1 = normalizeTask({
      id: "TASK-0001",
      title: "In Progress Task",
      status: "IN_PROGRESS",
      subState: {
        phase: "implementation",
        confidence: 0.85
      }
    });

    const task2 = normalizeTask({
      id: "TASK-0002",
      title: "Blocked Task",
      status: "BLOCKED",
      blocker: {
        type: "external_dependency",
        description: "Waiting for API"
      }
    });

    const markdown = renderTasksMarkdown([task1, task2]);
    
    expect(markdown).toContain("phase: implementation");
    expect(markdown).toContain("confidence: 0.85");
    expect(markdown).toContain("type: external_dependency");
    expect(markdown).toContain("description: Waiting for API");
  });

  it("parses empty task block correctly", async () => {
    const markdown = [
      "# Tasks",
      TASKS_START,
      "(no tasks)",
      TASKS_END,
    ].join("\n");

    const tasks = await parseTasksBlock(markdown);
    expect(tasks).toHaveLength(0);
  });

  it("parses task block without markers returns empty", async () => {
    const markdown = [
      "# Tasks",
      "## TASK-0001 | TODO | No Markers",
      "- owner: alice",
    ].join("\n");

    const tasks = await parseTasksBlock(markdown);
    expect(tasks).toHaveLength(0);
  });

  it("collects lint suggestions for duplicate IDs", () => {
    const tasks = [
      normalizeTask({ id: "TASK-0001", title: "A", status: "TODO", roadmapRefs: ["ROADMAP-0001"] }),
      normalizeTask({ id: "TASK-0001", title: "B", status: "TODO", roadmapRefs: ["ROADMAP-0001"] }),
    ];

    const lint = collectTaskLintSuggestions(tasks);
    expect(lint.some((line) => line.includes("Duplicate task IDs"))).toBe(true);
  });

  it("collects lint suggestions for DONE without links", () => {
    const tasks = [
      normalizeTask({ id: "TASK-0001", title: "Done Task", status: "DONE", roadmapRefs: ["ROADMAP-0001"], links: [] }),
    ];

    const lint = collectTaskLintSuggestions(tasks);
    expect(lint.some((line) => line.includes("DONE task(s) have no links evidence"))).toBe(true);
  });

  it("collects lint suggestions for BLOCKED without summary", () => {
    const tasks = [
      normalizeTask({ id: "TASK-0001", title: "Blocked", status: "BLOCKED", summary: "", roadmapRefs: ["ROADMAP-0001"] }),
    ];

    const lint = collectTaskLintSuggestions(tasks);
    expect(lint.some((line) => line.includes("BLOCKED task(s) have empty summary"))).toBe(true);
  });

  it("collects lint suggestions for invalid updatedAt", () => {
    const tasks = [
      normalizeTask({ id: "TASK-0001", title: "Invalid Date", status: "TODO", updatedAt: "not-a-date", roadmapRefs: ["ROADMAP-0001"] }),
    ];

    const lint = collectTaskLintSuggestions(tasks);
    expect(lint.some((line) => line.includes("invalid updatedAt format"))).toBe(true);
  });

  it("collects lint suggestions for Spec v1.1.0 blocker validation", () => {
    const tasks = [
      normalizeTask({ 
        id: "TASK-0001", 
        title: "Blocked Without Metadata", 
        status: "BLOCKED", 
        summary: "Blocked but no metadata",
        roadmapRefs: ["ROADMAP-0001"] 
      }),
    ];

    const lint = collectTaskLintSuggestions(tasks);
    expect(lint.some((line) => line.includes("BLOCKED task(s) have no blocker metadata"))).toBe(true);
  });

  it("collects lint suggestions for Spec v1.1.0 subState validation", () => {
    const tasks = [
      normalizeTask({ 
        id: "TASK-0001", 
        title: "In Progress Without SubState", 
        status: "IN_PROGRESS", 
        owner: "ai-copilot",
        roadmapRefs: ["ROADMAP-0001"] 
      }),
    ];

    const lint = collectTaskLintSuggestions(tasks);
    expect(lint.some((line) => line.includes("IN_PROGRESS task(s) have no subState metadata"))).toBe(true);
  });

  it("validates all status transitions correctly", () => {
    // TODO transitions
    expect(validateTransition("TODO", "TODO")).toBe(true);
    expect(validateTransition("TODO", "IN_PROGRESS")).toBe(true);
    expect(validateTransition("TODO", "BLOCKED")).toBe(true);
    expect(validateTransition("TODO", "DONE")).toBe(false);

    // IN_PROGRESS transitions
    expect(validateTransition("IN_PROGRESS", "IN_PROGRESS")).toBe(true);
    expect(validateTransition("IN_PROGRESS", "BLOCKED")).toBe(true);
    expect(validateTransition("IN_PROGRESS", "DONE")).toBe(true);
    expect(validateTransition("IN_PROGRESS", "TODO")).toBe(false);

    // BLOCKED transitions
    expect(validateTransition("BLOCKED", "BLOCKED")).toBe(true);
    expect(validateTransition("BLOCKED", "IN_PROGRESS")).toBe(true);
    expect(validateTransition("BLOCKED", "TODO")).toBe(true);
    expect(validateTransition("BLOCKED", "DONE")).toBe(false);

    // DONE transitions
    expect(validateTransition("DONE", "DONE")).toBe(true);
    expect(validateTransition("DONE", "TODO")).toBe(false);
    expect(validateTransition("DONE", "IN_PROGRESS")).toBe(false);
    expect(validateTransition("DONE", "BLOCKED")).toBe(false);
  });

  it("ranks candidates with same project score by task priority", () => {
    const candidates = [
      buildCandidate({ id: "TASK-0001", title: "TODO Task", status: "TODO", projectScore: 2 }),
      buildCandidate({ id: "TASK-0002", title: "IN_PROGRESS Task", status: "IN_PROGRESS", projectScore: 2 }),
    ];

    const ranked = rankActionableTaskCandidates(candidates);
    expect(ranked[0].task.id).toBe("TASK-0002");
    expect(ranked[1].task.id).toBe("TASK-0001");
  });

  it("ranks candidates with same project score and priority by recency", () => {
    const older = buildCandidate({ 
      id: "TASK-0001", 
      title: "Older Task", 
      status: "TODO", 
      projectScore: 2,
      taskUpdatedAtMs: toTaskUpdatedAtMs("2026-01-01T00:00:00.000Z")
    });
    
    const newer = buildCandidate({ 
      id: "TASK-0002", 
      title: "Newer Task", 
      status: "TODO", 
      projectScore: 2,
      taskUpdatedAtMs: toTaskUpdatedAtMs("2026-02-01T00:00:00.000Z")
    });

    const ranked = rankActionableTaskCandidates([older, newer]);
    expect(ranked[0].task.id).toBe("TASK-0002");
    expect(ranked[1].task.id).toBe("TASK-0001");
  });

  it("renders tasks without subState or blocker when not applicable", () => {
    const task = normalizeTask({
      id: "TASK-0001",
      title: "Simple TODO Task",
      status: "TODO"
    });

    const markdown = renderTasksMarkdown([task]);
    expect(markdown).not.toContain("subState:");
    expect(markdown).not.toContain("blocker:");
  });

  it("parses task with invalid subState phase gracefully", async () => {
    const markdown = [
      "# Tasks",
      TASKS_START,
      "## TASK-0001 | IN_PROGRESS | Invalid Phase",
      "- owner: test",
      "- summary: test",
      "- updatedAt: 2026-02-22T00:00:00.000Z",
      "- roadmapRefs: ROADMAP-0001",
      "- links:",
      "  - (none)",
      "- subState:",
      "  - phase: invalid_phase",
      TASKS_END,
    ].join("\n");

    const tasks = await parseTasksBlock(markdown);
    expect(tasks).toHaveLength(1);
    // Invalid phase should be ignored
    expect(tasks[0].subState?.phase).toBeUndefined();
  });

  it("parses task with invalid confidence score gracefully", async () => {
    const markdown = [
      "# Tasks",
      TASKS_START,
      "## TASK-0001 | IN_PROGRESS | Invalid Confidence",
      "- owner: test",
      "- summary: test",
      "- updatedAt: 2026-02-22T00:00:00.000Z",
      "- roadmapRefs: ROADMAP-0001",
      "- links:",
      "  - (none)",
      "- subState:",
      "  - confidence: 2.5",
      TASKS_END,
    ].join("\n");

    const tasks = await parseTasksBlock(markdown);
    expect(tasks).toHaveLength(1);
    // Invalid confidence should be ignored
    expect(tasks[0].subState?.confidence).toBeUndefined();
  });

  it("parses task with invalid blocker type gracefully", async () => {
    const markdown = [
      "# Tasks",
      TASKS_START,
      "## TASK-0001 | BLOCKED | Invalid Blocker Type",
      "- owner: test",
      "- summary: test",
      "- updatedAt: 2026-02-22T00:00:00.000Z",
      "- roadmapRefs: ROADMAP-0001",
      "- links:",
      "  - (none)",
      "- blocker:",
      "  - type: invalid_type",
      "  - description: test",
      TASKS_END,
    ].join("\n");

    const tasks = await parseTasksBlock(markdown);
    expect(tasks).toHaveLength(1);
    // Invalid blocker type should use default
    expect(tasks[0].blocker?.type).toBe("external_dependency");
  });
});
