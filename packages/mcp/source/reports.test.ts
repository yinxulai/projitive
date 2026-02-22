import { describe, expect, it } from "vitest";
import {
  parseReportMetadata,
  validateReportMetadata,
  type ReportMetadata,
} from "./resources/reports.js";

describe("reports module", () => {
  describe("parseReportMetadata", () => {
    it("parses task metadata from markdown", () => {
      const markdown = [
        "# Task Report",
        "",
        "**Task:** TASK-0001",
        "**Owner:** ai-copilot",
        "**Date:** 2026-02-22",
        "",
        "Some content here",
      ].join("\n");

      const metadata = parseReportMetadata(markdown);
      expect(metadata.task).toBe("TASK-0001");
      expect(metadata.owner).toBe("ai-copilot");
      expect(metadata.date).toBe("2026-02-22");
    });

    it("parses roadmap metadata from markdown", () => {
      const markdown = [
        "# Roadmap Report",
        "",
        "**Roadmap:** ROADMAP-0001",
        "",
        "Some content here",
      ].join("\n");

      const metadata = parseReportMetadata(markdown);
      expect(metadata.roadmap).toBe("ROADMAP-0001");
    });

    it("returns empty object for markdown without metadata", () => {
      const markdown = [
        "# Simple Report",
        "",
        "No metadata here",
      ].join("\n");

      const metadata = parseReportMetadata(markdown);
      expect(metadata).toEqual({});
    });

    it("handles empty string", () => {
      const metadata = parseReportMetadata("");
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

      const metadata = parseReportMetadata(markdown);
      expect(metadata).toBeDefined();
    });

    it("parses metadata in different formats", () => {
      const markdown = [
        "Task: TASK-0001",
        "task: TASK-0002",
        "TASK: TASK-0003",
        "  task  :  TASK-0004  ",
      ].join("\n");

      const metadata = parseReportMetadata(markdown);
      expect(metadata.task).toBeDefined();
    });
  });

  describe("validateReportMetadata", () => {
    it("validates correct task metadata", () => {
      const metadata: ReportMetadata = {
        task: "TASK-0001",
        owner: "ai-copilot",
        date: "2026-02-22",
      };

      const result = validateReportMetadata(metadata);
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects missing task metadata", () => {
      const metadata: ReportMetadata = {
        owner: "ai-copilot",
      };

      const result = validateReportMetadata(metadata);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Missing Task metadata");
    });

    it("rejects invalid task ID format", () => {
      const metadata: ReportMetadata = {
        task: "invalid-format",
      };

      const result = validateReportMetadata(metadata);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes("Invalid Task"))).toBe(true);
    });

    it("validates optional roadmap metadata", () => {
      const metadata: ReportMetadata = {
        task: "TASK-0001",
        roadmap: "ROADMAP-0001",
      };

      const result = validateReportMetadata(metadata);
      expect(result.ok).toBe(true);
    });

    it("rejects invalid roadmap ID format", () => {
      const metadata: ReportMetadata = {
        task: "TASK-0001",
        roadmap: "invalid-roadmap",
      };

      const result = validateReportMetadata(metadata);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes("Invalid Roadmap"))).toBe(true);
    });

    it("handles empty metadata object", () => {
      const metadata: ReportMetadata = {};
      const result = validateReportMetadata(metadata);
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("collects multiple validation errors", () => {
      const metadata: ReportMetadata = {
        task: "invalid-task",
        roadmap: "invalid-roadmap",
      };

      const result = validateReportMetadata(metadata);
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("integration", () => {
    it("parses and validates complete report metadata", () => {
      const markdown = [
        "# Task Completion Report",
        "",
        "**Task:** TASK-0001",
        "**Roadmap:** ROADMAP-0002",
        "**Owner:** ai-copilot",
        "**Date:** 2026-02-22",
        "",
        "## Summary",
        "Task completed successfully",
      ].join("\n");

      const metadata = parseReportMetadata(markdown);
      const validation = validateReportMetadata(metadata);

      expect(metadata.task).toBe("TASK-0001");
      expect(metadata.roadmap).toBe("ROADMAP-0002");
      expect(metadata.owner).toBe("ai-copilot");
      expect(metadata.date).toBe("2026-02-22");
      expect(validation.ok).toBe(true);
    });
  });
});
