import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  initializeProjectStructure,
  resolveGovernanceDir,
} from "./projitive.js";
import {
  renderTasksMarkdown,
  type Task,
} from "./tasks.js";

const tempPaths: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "projitive-workflow-test-"));
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

describe("MCP Workflow Integration", () => {
  describe("Full workflow: initialization", () => {
    it("executes project initialization", async () => {
      // Step 1: Initialize project structure
      const projectRoot = await createTempDir();
      const initResult = await initializeProjectStructure(projectRoot);
      expect(initResult.governanceDir).toBeDefined();

      const governanceDir = await resolveGovernanceDir(projectRoot);
      expect(governanceDir).toBeDefined();
    });

    it("handles project initialization and verifies files", async () => {
      const projectRoot = await createTempDir();
      
      // Initialize project
      const initResult = await initializeProjectStructure(projectRoot);
      expect(initResult.governanceDir).toBeDefined();
      
      const governanceDir = initResult.governanceDir;

      // Verify required files exist
      const requiredFiles = [
        "README.md",
        "roadmap.md",
        "tasks.md",
      ];
      
      for (const file of requiredFiles) {
        const filePath = path.join(governanceDir, file);
        await expect(fs.access(filePath)).resolves.toBeUndefined();
      }

      // Verify directories exist
      const requiredDirs = [
        "designs",
        "reports",
        "hooks",
      ];
      
      for (const dir of requiredDirs) {
        const dirPath = path.join(governanceDir, dir);
        const stats = await fs.stat(dirPath);
        expect(stats.isDirectory()).toBe(true);
      }
    });
  });

  describe("Tasks markdown rendering", () => {
    it("renders tasks markdown correctly", async () => {
      const sampleTasks: Task[] = [
        {
          id: "TASK-0001",
          title: "Test Task",
          status: "TODO",
          owner: "ai-copilot",
          summary: "A test task",
          updatedAt: new Date().toISOString(),
          links: [],
          roadmapRefs: ["ROADMAP-0001"],
        },
      ];

      const rendered = renderTasksMarkdown(sampleTasks);
      expect(rendered).toContain("PROJITIVE:TASKS:START");
      expect(rendered).toContain("PROJITIVE:TASKS:END");
      expect(rendered).toContain("TASK-0001");
    });
  });

  describe("Spec v1.1 features", () => {
    it("supports sub-state metadata in tasks", async () => {
      const tasksWithSubState: Task[] = [
        {
          id: "TASK-0001",
          title: "Test Task with Sub-state",
          status: "IN_PROGRESS",
          owner: "ai-copilot",
          summary: "A test task",
          updatedAt: new Date().toISOString(),
          links: [],
          roadmapRefs: ["ROADMAP-0001"],
          subState: {
            phase: "implementation",
            confidence: 0.85,
            estimatedCompletion: "2026-02-25T15:00:00Z",
          },
        },
      ];

      // Render with sub-state
      const rendered = renderTasksMarkdown(tasksWithSubState);
      expect(rendered).toBeDefined();
      expect(typeof rendered).toBe("string");
      expect(rendered).toContain("subState");
      expect(rendered).toContain("phase: implementation");
      expect(rendered).toContain("confidence: 0.85");
    });

    it("supports blocker categorization", async () => {
      const tasksWithBlocker: Task[] = [
        {
          id: "TASK-0001",
          title: "Test Task with Blocker",
          status: "BLOCKED",
          owner: "ai-copilot",
          summary: "A test task",
          updatedAt: new Date().toISOString(),
          links: [],
          roadmapRefs: ["ROADMAP-0001"],
          blocker: {
            type: "external_dependency",
            description: "Waiting for API release",
            blockingEntity: "third-party/provider",
            unblockCondition: "API v2.0 GA",
            escalationPath: "contact-pm",
          },
        },
      ];

      // Render with blocker
      const rendered = renderTasksMarkdown(tasksWithBlocker);
      expect(rendered).toBeDefined();
      expect(typeof rendered).toBe("string");
      expect(rendered).toContain("blocker");
      expect(rendered).toContain("type: external_dependency");
      expect(rendered).toContain("description: Waiting for API release");
    });
  });
});
