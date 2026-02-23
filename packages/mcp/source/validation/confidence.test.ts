import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  calculateConfidenceScore,
  calculateContextCompleteness,
  calculateSimilarTaskHistory,
  calculateSpecificationClarity,
  hasTaskAutoCreateValidationHook,
  getOrCreateTaskAutoCreateValidationHook,
  runPreCreationValidation,
  generateConfidenceReport,
} from "../common/confidence.js";
import type { Task } from "../types.js";

const tempPaths: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "projitive-confidence-test-"));
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

describe("confidence module", () => {
  describe("calculateConfidenceScore", () => {
    it("calculates confidence score with valid inputs", () => {
      const result = calculateConfidenceScore({
        contextCompleteness: 0.8,
        similarTaskHistory: 0.7,
        specificationClarity: 0.9,
      });

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.recommendation).toBeDefined();
    });

    it("recommends auto_create for high confidence scores", () => {
      const result = calculateConfidenceScore({
        contextCompleteness: 1.0,
        similarTaskHistory: 1.0,
        specificationClarity: 1.0,
      });

      expect(result.recommendation).toBe("auto_create");
    });

    it("recommends review_required for medium confidence scores", () => {
      const result = calculateConfidenceScore({
        contextCompleteness: 0.7,
        similarTaskHistory: 0.7,
        specificationClarity: 0.7,
      });

      expect(result.recommendation).toBe("review_required");
    });

    it("recommends do_not_create for low confidence scores", () => {
      const result = calculateConfidenceScore({
        contextCompleteness: 0.0,
        similarTaskHistory: 0.0,
        specificationClarity: 0.0,
      });

      expect(result.recommendation).toBe("do_not_create");
    });

    it("clamps values outside [0, 1] range", () => {
      const result = calculateConfidenceScore({
        contextCompleteness: 1.5,
        similarTaskHistory: -0.5,
        specificationClarity: 2.0,
      });

      expect(result.factors.contextCompleteness).toBe(1);
      expect(result.factors.similarTaskHistory).toBe(0);
      expect(result.factors.specificationClarity).toBe(1);
    });
  });

  describe("calculateContextCompleteness", () => {
    it("returns 0 for empty directory", async () => {
      const root = await createTempDir();
      const completeness = await calculateContextCompleteness(root);
      expect(completeness).toBe(0);
    });

    it("returns higher score for more complete context", async () => {
      const root = await createTempDir();
      await fs.writeFile(path.join(root, "tasks.md"), "", "utf-8");
      await fs.writeFile(path.join(root, "roadmap.md"), "", "utf-8");
      await fs.writeFile(path.join(root, "README.md"), "", "utf-8");

      const completeness = await calculateContextCompleteness(root);
      expect(completeness).toBeGreaterThan(0.5);
    });
  });

  describe("calculateSimilarTaskHistory", () => {
    const sampleTasks: Task[] = [
      {
        id: "TASK-0001",
        title: "Implement feature X",
        status: "DONE",
        summary: "Build core functionality for feature X",
        owner: "ai-copilot",
        updatedAt: "2026-02-22T00:00:00.000Z",
        links: [],
        roadmapRefs: [],
      },
      {
        id: "TASK-0002",
        title: "Test feature Y",
        status: "TODO",
        summary: "Write tests for feature Y",
        owner: "ai-copilot",
        updatedAt: "2026-02-22T00:00:00.000Z",
        links: [],
        roadmapRefs: [],
      },
      {
        id: "TASK-0003",
        title: "Implement feature Z",
        status: "DONE",
        summary: "Build core functionality for feature Z",
        owner: "ai-copilot",
        updatedAt: "2026-02-22T00:00:00.000Z",
        links: [],
        roadmapRefs: [],
      },
    ];

    it("returns 0.5 when no similar tasks", () => {
      const result = calculateSimilarTaskHistory([], "Build something new");
      expect(result).toBe(0.5);
    });

    it("calculates success rate for similar tasks", () => {
      const result = calculateSimilarTaskHistory(
        sampleTasks,
        "Implement feature A with core functionality"
      );
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("handles tasks with no matching keywords", () => {
      const result = calculateSimilarTaskHistory(
        sampleTasks,
        "Something completely different unrelated"
      );
      expect(result).toBe(0.5);
    });
  });

  describe("calculateSpecificationClarity", () => {
    it("returns base clarity with no context", () => {
      const result = calculateSpecificationClarity({});
      expect(result).toBe(0.3);
    });

    it("increases clarity with roadmap", () => {
      const result = calculateSpecificationClarity({ hasRoadmap: true });
      expect(result).toBeGreaterThan(0.3);
    });

    it("increases clarity with design docs", () => {
      const result = calculateSpecificationClarity({ hasDesignDocs: true });
      expect(result).toBeGreaterThan(0.3);
    });

    it("reaches maximum clarity with all factors", () => {
      const result = calculateSpecificationClarity({
        hasRoadmap: true,
        hasDesignDocs: true,
        hasClearAcceptanceCriteria: true,
      });
      expect(result).toBe(1);
    });
  });

  describe("validation hooks", () => {
    it("detects missing validation hook", async () => {
      const root = await createTempDir();
      const hasHook = await hasTaskAutoCreateValidationHook(root);
      expect(hasHook).toBe(false);
    });

    it("creates default validation hook", async () => {
      const root = await createTempDir();
      const hookContent = await getOrCreateTaskAutoCreateValidationHook(root);
      expect(hookContent).toContain("Task Auto-Create Validation Hook");
    });

    it("reads existing validation hook", async () => {
      const root = await createTempDir();
      const hooksDir = path.join(root, "hooks");
      await fs.mkdir(hooksDir, { recursive: true });
      const hookPath = path.join(hooksDir, "task_auto_create_validation.md");
      await fs.writeFile(hookPath, "custom hook content", "utf-8");

      const hookContent = await getOrCreateTaskAutoCreateValidationHook(root);
      expect(hookContent).toBe("custom hook content");
    });
  });

  describe("runPreCreationValidation", () => {
    it("validates confidence score", async () => {
      const root = await createTempDir();
      const confidenceScore = calculateConfidenceScore({
        contextCompleteness: 0.9,
        similarTaskHistory: 0.9,
        specificationClarity: 0.9,
      });

      const result = await runPreCreationValidation(root, confidenceScore);
      expect(result.passed).toBeDefined();
      expect(result.issues).toBeInstanceOf(Array);
    });
  });

  describe("generateConfidenceReport", () => {
    it("generates human-readable report", () => {
      const confidenceScore = calculateConfidenceScore({
        contextCompleteness: 0.8,
        similarTaskHistory: 0.7,
        specificationClarity: 0.9,
      });

      const report = generateConfidenceReport(confidenceScore);
      expect(report).toContain("Confidence Score Report");
      expect(report).toContain("Final Score");
      expect(report).toContain("Factor Breakdown");
      expect(report).toContain("Thresholds");
    });

    it("includes recommendation in report", () => {
      const confidenceScore = calculateConfidenceScore({
        contextCompleteness: 1.0,
        similarTaskHistory: 1.0,
        specificationClarity: 1.0,
      });

      const report = generateConfidenceReport(confidenceScore);
      expect(report).toContain("auto create");
    });
  });
});
