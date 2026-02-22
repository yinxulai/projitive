import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  initializeProjectStructure,
  resolveGovernanceDir,
  discoverProjects,
  hasProjectMarker,
  toProjectPath,
} from "./projitive.js";
import {
  renderTasksMarkdown,
  parseTasksBlock,
  loadTasks,
  saveTasks,
  type Task,
} from "./tasks.js";

const tempPaths: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "projitive-e2e-test-"));
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

describe("E2E Integration Tests", () => {
  describe("Complete Project Lifecycle", () => {
    it("executes full workflow: initialize → discover → manage tasks", async () => {
      // Step 1: Create and initialize a test project
      const workspaceRoot = await createTempDir();
      const project1 = path.join(workspaceRoot, "test-project-1");
      await fs.mkdir(project1, { recursive: true });

      // Initialize governance structure
      const initResult = await initializeProjectStructure(project1);
      expect(initResult.governanceDir).toBeDefined();
      expect(await hasProjectMarker(initResult.governanceDir)).toBe(true);

      // Add a second project for discovery testing
      const project2 = path.join(workspaceRoot, "test-project-2");
      await fs.mkdir(project2, { recursive: true });
      await initializeProjectStructure(project2);

      // Step 2: Discover projects
      const projects = await discoverProjects(workspaceRoot, 2);
      expect(projects.length).toBeGreaterThanOrEqual(2);
      expect(projects.some((p) => p.includes("test-project-1"))).toBe(true);
      expect(projects.some((p) => p.includes("test-project-2"))).toBe(true);

      // Step 3: Resolve governance directory from subdirectory
      const subDir = path.join(project1, "src", "components");
      await fs.mkdir(subDir, { recursive: true });
      
      const governanceDir = await resolveGovernanceDir(subDir);
      expect(governanceDir).toBeDefined();
      expect(governanceDir).toContain("test-project-1");

      // Step 4: Convert to project path
      const projectPath = toProjectPath(governanceDir);
      expect(projectPath).toBeDefined();

      // Step 5: Load existing tasks
      const { tasksPath, tasks } = await loadTasks(project1);
      expect(tasksPath).toBeDefined();
      expect(Array.isArray(tasks)).toBe(true);

      // Step 6: Create and add test tasks
      const testTasks: Task[] = [
        {
          id: "TASK-0001",
          title: "High Priority Task",
          status: "TODO",
          owner: "ai-copilot",
          summary: "A high priority task for testing",
          updatedAt: new Date().toISOString(),
          roadmapRefs: ["ROADMAP-0001"],
          links: [],
        },
        {
          id: "TASK-0002",
          title: "In Progress Task",
          status: "IN_PROGRESS",
          owner: "ai-copilot",
          summary: "A task already in progress",
          updatedAt: new Date().toISOString(),
          roadmapRefs: ["ROADMAP-0001"],
          links: [],
        },
      ];

      await saveTasks(tasksPath, testTasks);

      // Step 7: Verify tasks were saved correctly
      const { tasks: reloadedTasks } = await loadTasks(project1);
      expect(reloadedTasks.length).toBe(2);
      expect(reloadedTasks[0].id).toBe("TASK-0001");
      expect(reloadedTasks[1].id).toBe("TASK-0002");

      // Step 8: Update a task status
      const updatedTasks = reloadedTasks.map((t) =>
        t.id === "TASK-0001" ? { ...t, status: "IN_PROGRESS" as const } : t
      );
      await saveTasks(tasksPath, updatedTasks);

      // Verify update
      const { tasks: finalTasks } = await loadTasks(project1);
      const task1 = finalTasks.find((t) => t.id === "TASK-0001");
      expect(task1?.status).toBe("IN_PROGRESS");
    });

    it("tests markdown rendering and parsing roundtrip", async () => {
      const projectRoot = await createTempDir();
      await initializeProjectStructure(projectRoot);

      const testTasks: Task[] = [
        {
          id: "TASK-0001",
          title: "Test Task 1",
          status: "TODO",
          owner: "ai-copilot",
          summary: "First test task",
          updatedAt: new Date().toISOString(),
          roadmapRefs: ["ROADMAP-0001"],
          links: [],
        },
        {
          id: "TASK-0002",
          title: "Test Task 2",
          status: "DONE",
          owner: "ai-copilot",
          summary: "Second test task",
          updatedAt: new Date().toISOString(),
          roadmapRefs: ["ROADMAP-0001"],
          links: [],
        },
      ];

      // Render to markdown
      const markdown = renderTasksMarkdown(testTasks);
      expect(markdown).toContain("PROJITIVE:TASKS:START");
      expect(markdown).toContain("PROJITIVE:TASKS:END");
      expect(markdown).toContain("TASK-0001");
      expect(markdown).toContain("TASK-0002");

      // Parse back from markdown
      const parsedTasks = await parseTasksBlock(markdown);
      expect(parsedTasks.length).toBe(2);
      expect(parsedTasks[0].id).toBe("TASK-0001");
      expect(parsedTasks[1].id).toBe("TASK-0002");
      expect(parsedTasks[0].status).toBe("TODO");
      expect(parsedTasks[1].status).toBe("DONE");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("handles non-existent project path gracefully", async () => {
      const nonExistentPath = path.join(os.tmpdir(), "non-existent-project-12345");

      await expect(resolveGovernanceDir(nonExistentPath)).rejects.toThrow();
    });

    it("handles project without governance structure", async () => {
      const rawProject = await createTempDir();

      await expect(resolveGovernanceDir(rawProject)).rejects.toThrow();

      const projects = await discoverProjects(rawProject, 1);
      expect(projects.length).toBe(0);
    });

    it("handles hasProjectMarker correctly", async () => {
      const projectRoot = await createTempDir();
      
      // No marker yet
      expect(await hasProjectMarker(projectRoot)).toBe(false);
      
      // Initialize with marker
      const initResult = await initializeProjectStructure(projectRoot);
      expect(await hasProjectMarker(initResult.governanceDir)).toBe(true);
    });
  });

  describe("Spec v1.1 Features Integration", () => {
    it("supports subState and blocker in markdown roundtrip", async () => {
      const projectRoot = await createTempDir();
      await initializeProjectStructure(projectRoot);

      const specV11Task: Task = {
        id: "TASK-0001",
        title: "Spec v1.1 Test Task",
        status: "IN_PROGRESS",
        owner: "ai-copilot",
        summary: "Testing sub-state and blocker",
        updatedAt: new Date().toISOString(),
        roadmapRefs: ["ROADMAP-0001"],
        links: [],
        subState: {
          phase: "implementation",
          confidence: 0.85,
          estimatedCompletion: "2026-02-25T15:00:00Z",
        },
      };

      // Render with sub-state
      const markdown = renderTasksMarkdown([specV11Task]);
      expect(markdown).toContain("subState");
      expect(markdown).toContain("phase: implementation");
      expect(markdown).toContain("confidence: 0.85");

      // Parse back
      const parsed = await parseTasksBlock(markdown);
      expect(parsed.length).toBe(1);
      expect(parsed[0].subState).toBeDefined();
      expect(parsed[0].subState?.phase).toBe("implementation");
      expect(parsed[0].subState?.confidence).toBe(0.85);
    });

    it("supports blocker categorization", async () => {
      const blockedTask: Task = {
        id: "TASK-0001",
        title: "Blocked Task",
        status: "BLOCKED",
        owner: "ai-copilot",
        summary: "A blocked task",
        updatedAt: new Date().toISOString(),
        roadmapRefs: ["ROADMAP-0001"],
        links: [],
        blocker: {
          type: "external_dependency",
          description: "Waiting for API",
          blockingEntity: "third-party",
          unblockCondition: "API v2.0",
          escalationPath: "contact-pm",
        },
      };

      const markdown = renderTasksMarkdown([blockedTask]);
      expect(markdown).toContain("blocker");
      expect(markdown).toContain("type: external_dependency");
      expect(markdown).toContain("description: Waiting for API");

      const parsed = await parseTasksBlock(markdown);
      expect(parsed.length).toBe(1);
      expect(parsed[0].blocker).toBeDefined();
      expect(parsed[0].blocker?.type).toBe("external_dependency");
    });
  });
});
