import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectHookEvent, resolveHookForEvent } from "./hooks.js";
import { normalizeTask } from "./tasks.js";

const tempPaths: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "projitive-mcp-test-"));
  tempPaths.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempPaths.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    })
  );
});

describe("hooks module", () => {
  it("maps transitions to hook events", () => {
    expect(detectHookEvent("TODO", "IN_PROGRESS")).toBe("onAssigned");
    expect(detectHookEvent("IN_PROGRESS", "DONE")).toBe("onCompleted");
    expect(detectHookEvent("IN_PROGRESS", "BLOCKED")).toBe("onBlocked");
    expect(detectHookEvent("BLOCKED", "TODO")).toBe(null);
  });

  it("prefers task-level hook over global hook", async () => {
    const root = await createTempDir();
    const governanceDir = path.join(root, "gov");
    await fs.mkdir(path.join(governanceDir, "hooks"), { recursive: true });
    await fs.writeFile(path.join(governanceDir, "hooks", "on_task_assigned.md"), "global assigned", "utf-8");
    await fs.writeFile(path.join(governanceDir, "hooks", "custom-assigned.md"), "task assigned", "utf-8");

    const task = normalizeTask({
      id: "TASK-0001",
      title: "Task",
      status: "TODO",
      hooks: { onAssigned: "./hooks/custom-assigned.md" },
    });

    const hook = await resolveHookForEvent(governanceDir, task, "onAssigned");
    expect(hook.source).toBe("task");
    expect(hook.content).toContain("task assigned");
  });

  it("falls back to global hook when task-level hook is missing", async () => {
    const root = await createTempDir();
    const governanceDir = path.join(root, "gov");
    await fs.mkdir(path.join(governanceDir, "hooks"), { recursive: true });
    await fs.writeFile(path.join(governanceDir, "hooks", "on_task_completed.md"), "global completed", "utf-8");

    const task = normalizeTask({ id: "TASK-0001", title: "Task", status: "IN_PROGRESS" });
    const hook = await resolveHookForEvent(governanceDir, task, "onCompleted");

    expect(hook.source).toBe("global");
    expect(hook.content).toContain("global completed");
  });
});
