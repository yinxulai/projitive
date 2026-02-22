import { describe, it, expect, beforeAll, afterAll } from "vitest"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { isValidRoadmapId, collectRoadmapLintSuggestions } from "./roadmap.js"

describe("roadmap module", () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "projitive-roadmap-test-"))
  })

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe("isValidRoadmapId", () => {
    it("should validate correct roadmap IDs", () => {
      expect(isValidRoadmapId("ROADMAP-0001")).toBe(true)
      expect(isValidRoadmapId("ROADMAP-1234")).toBe(true)
      expect(isValidRoadmapId("ROADMAP-9999")).toBe(true)
    })

    it("should reject invalid roadmap IDs", () => {
      expect(isValidRoadmapId("roadmap-0001")).toBe(false)
      expect(isValidRoadmapId("ROADMAP-001")).toBe(false)
      expect(isValidRoadmapId("ROADMAP-00001")).toBe(false)
      expect(isValidRoadmapId("TASK-0001")).toBe(false)
      expect(isValidRoadmapId("")).toBe(false)
      expect(isValidRoadmapId("invalid")).toBe(false)
    })
  })

  describe("collectRoadmapLintSuggestions", () => {
    it("should return lint suggestion for empty roadmap IDs", () => {
      const suggestions = collectRoadmapLintSuggestions([], [])
      expect(suggestions.some(s => s.includes("IDS_EMPTY"))).toBe(true)
    })

    it("should return lint suggestion for empty tasks", () => {
      const suggestions = collectRoadmapLintSuggestions(["ROADMAP-0001"], [])
      expect(suggestions.some(s => s.includes("TASKS_EMPTY"))).toBe(true)
    })

    it("should return lint suggestion for tasks without roadmap refs", () => {
      const tasks = [
        {
          id: "TASK-0001",
          title: "Test Task",
          status: "TODO" as const,
          owner: "ai-copilot",
          summary: "Test",
          updatedAt: "2026-01-01T00:00:00.000Z",
          links: [],
          roadmapRefs: [],
        },
      ]
      const suggestions = collectRoadmapLintSuggestions(["ROADMAP-0001"], tasks)
      expect(suggestions.some(s => s.includes("TASK_REFS_EMPTY"))).toBe(true)
    })

    it("should return lint suggestion for unknown roadmap refs", () => {
      const tasks = [
        {
          id: "TASK-0001",
          title: "Test Task",
          status: "TODO" as const,
          owner: "ai-copilot",
          summary: "Test",
          updatedAt: "2026-01-01T00:00:00.000Z",
          links: [],
          roadmapRefs: ["ROADMAP-9999"],
        },
      ]
      const suggestions = collectRoadmapLintSuggestions(["ROADMAP-0001"], tasks)
      expect(suggestions.some(s => s.includes("UNKNOWN_REFS"))).toBe(true)
    })

    it("should return lint suggestion for roadmaps with no linked tasks", () => {
      const tasks = [
        {
          id: "TASK-0001",
          title: "Test Task",
          status: "TODO" as const,
          owner: "ai-copilot",
          summary: "Test",
          updatedAt: "2026-01-01T00:00:00.000Z",
          links: [],
          roadmapRefs: ["ROADMAP-0001"],
        },
      ]
      const suggestions = collectRoadmapLintSuggestions(["ROADMAP-0001", "ROADMAP-0002"], tasks)
      expect(suggestions.some(s => s.includes("ZERO_LINKED_TASKS"))).toBe(true)
    })

    it("should return no lint suggestions for valid setup", () => {
      const tasks = [
        {
          id: "TASK-0001",
          title: "Test Task",
          status: "TODO" as const,
          owner: "ai-copilot",
          summary: "Test",
          updatedAt: "2026-01-01T00:00:00.000Z",
          links: [],
          roadmapRefs: ["ROADMAP-0001"],
        },
      ]
      const suggestions = collectRoadmapLintSuggestions(["ROADMAP-0001"], tasks)
      expect(suggestions.length).toBe(0)
    })
  })
})
