import { describe, expect, it } from "vitest";
import { parseDesignMetadata, validateDesignMetadata, type DesignMetadata } from "./designs.js";

describe("designs module", () => {
  describe("parseDesignMetadata", () => {
    it("parses task metadata from markdown", () => {
      const markdown = [
        "# Design Document",
        "",
        "**Task:** TASK-0001",
        "**Owner:** ai-copilot",
        "**Status:** Draft",
        "**Last Updated:** 2026-02-22",
        "",
        "Some content here",
      ].join("\n");

      const metadata = parseDesignMetadata(markdown);
      expect(metadata.task).toBe("TASK-0001");
      expect(metadata.owner).toBe("ai-copilot");
      expect(metadata.status).toBe("Draft");
      expect(metadata.lastUpdated).toBe("2026-02-22");
    });

    it("parses roadmap metadata from markdown", () => {
      const markdown = [
        "# Design Document",
        "",
        "**Roadmap:** ROADMAP-0001",
        "",
        "Some content here",
      ].join("\n");

      const metadata = parseDesignMetadata(markdown);
      expect(metadata.roadmap).toBe("ROADMAP-0001");
    });

    it("returns empty object for markdown without metadata", () => {
      const markdown = [
        "# Simple Design",
        "",
        "No metadata here",
      ].join("\n");

      const metadata = parseDesignMetadata(markdown);
      expect(metadata).toEqual({});
    });

    it("handles empty string", () => {
      const metadata = parseDesignMetadata("");
      expect(metadata).toEqual({});
    });

    it("handles malformed metadata lines", () => {
      const markdown = [
        "# Report",
        "",
        "Task without colon",
        "Not a metadata line",
        ":",
        "Task:",
      ].join("\n");

      const metadata = parseDesignMetadata(markdown);
      expect(metadata).toBeDefined();
    });

    it("parses metadata in different formats", () => {
      const markdown = [
        "Task: TASK-0001",
        "task: TASK-0002",
        "TASK: TASK-0003",
        "  task  :  TASK-0004  ",
      ].join("\n");

      const metadata = parseDesignMetadata(markdown);
      expect(metadata.task).toBeDefined();
    });
  });

  describe("validateDesignMetadata", () => {
    it("validates correct task metadata", () => {
      const metadata: DesignMetadata = {
        task: "TASK-0001",
        owner: "ai-copilot",
        status: "Draft",
        lastUpdated: "2026-02-22",
      };

      const result = validateDesignMetadata(metadata);
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects missing task metadata", () => {
      const metadata: DesignMetadata = {
        owner: "ai-copilot",
      };

      const result = validateDesignMetadata(metadata);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Missing Task metadata");
    });

    it("rejects invalid task ID format", () => {
      const metadata: DesignMetadata = {
        task: "invalid-format",
      };

      const result = validateDesignMetadata(metadata);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes("Invalid Task"))).toBe(true);
    });

    it("validates optional roadmap metadata", () => {
      const metadata: DesignMetadata = {
        task: "TASK-0001",
        roadmap: "ROADMAP-0001",
      };

      const result = validateDesignMetadata(metadata);
      expect(result.ok).toBe(true);
    });

    it("rejects invalid roadmap ID format", () => {
      const metadata: DesignMetadata = {
        task: "TASK-0001",
        roadmap: "invalid-roadmap",
      };

      const result = validateDesignMetadata(metadata);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes("Invalid Roadmap"))).toBe(true);
    });

    it("handles empty metadata object", () => {
      const metadata: DesignMetadata = {};
      const result = validateDesignMetadata(metadata);
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("collects multiple validation errors", () => {
      const metadata: DesignMetadata = {
        task: "invalid-task",
        roadmap: "invalid-roadmap",
      };

      const result = validateDesignMetadata(metadata);
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("integration", () => {
    it("parses and validates complete design metadata", () => {
      const markdown = [
        "# Design Completion Report",
        "",
        "**Task:** TASK-0001",
        "**Roadmap:** ROADMAP-0002",
        "**Owner:** ai-copilot",
        "**Status:** Completed",
        "**Last Updated:** 2026-02-22",
        "",
        "## Summary",
        "Design completed successfully",
      ].join("\n");

      const metadata = parseDesignMetadata(markdown);
      const validation = validateDesignMetadata(metadata);

      expect(metadata.task).toBe("TASK-0001");
      expect(metadata.roadmap).toBe("ROADMAP-0002");
      expect(metadata.owner).toBe("ai-copilot");
      expect(metadata.status).toBe("Completed");
      expect(metadata.lastUpdated).toBe("2026-02-22");
      expect(validation.ok).toBe(true);
    });
  });
});
