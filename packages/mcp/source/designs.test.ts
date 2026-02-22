import { describe, expect, it } from "vitest";
import {
  parseDesignMetadata,
  validateDesignMetadata,
  type DesignMetadata,
} from "./designs.js";

describe("designs module", () => {
  describe("parseDesignMetadata", () => {
    it("parses design metadata from markdown", () => {
      const markdown = [
        "# Design Document",
        "",
        "**Task:** TASK-0001",
        "**Roadmap:** ROADMAP-0001",
        "**Owner:** ai-copilot",
        "**Status:** PROPOSED",
        "**Last Updated:** 2026-02-22",
        "",
        "Some design content here",
      ].join("\n");

      const metadata = parseDesignMetadata(markdown);
      expect(metadata.task).toBe("TASK-0001");
      expect(metadata.roadmap).toBe("ROADMAP-0001");
      expect(metadata.owner).toBe("ai-copilot");
      expect(metadata.status).toBe("PROPOSED");
      expect(metadata.lastUpdated).toBe("2026-02-22");
    });

    it("parses partial metadata", () => {
      const markdown = [
        "# Design Document",
        "",
        "**Task:** TASK-0001",
        "**Status:** DRAFT",
        "",
        "Content",
      ].join("\n");

      const metadata = parseDesignMetadata(markdown);
      expect(metadata.task).toBe("TASK-0001");
      expect(metadata.status).toBe("DRAFT");
      expect(metadata.owner).toBeUndefined();
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

    it("handles 'last updated' with spaces", () => {
      const markdown = [
        "Last Updated: 2026-02-22",
        "last updated: 2026-02-23",
      ].join("\n");

      const metadata = parseDesignMetadata(markdown);
      expect(metadata.lastUpdated).toBeDefined();
    });
  });

  describe("validateDesignMetadata", () => {
    it("validates correct design metadata", () => {
      const metadata: DesignMetadata = {
        task: "TASK-0001",
        roadmap: "ROADMAP-0001",
        owner: "ai-copilot",
        status: "PROPOSED",
        lastUpdated: "2026-02-22",
      };

      const result = validateDesignMetadata(metadata);
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects missing task metadata", () => {
      const metadata: DesignMetadata = {
        owner: "ai-copilot",
        status: "DRAFT",
      };

      const result = validateDesignMetadata(metadata);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Missing Task metadata");
    });

    it("rejects invalid task ID format", () => {
      const metadata: DesignMetadata = {
        task: "invalid-task-id",
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

    it("accepts various status values", () => {
      const statuses = ["DRAFT", "PROPOSED", "APPROVED", "IMPLEMENTED", "REJECTED"];
      
      for (const status of statuses) {
        const metadata: DesignMetadata = {
          task: "TASK-0001",
          status,
        };
        const result = validateDesignMetadata(metadata);
        expect(result.ok).toBe(true);
      }
    });
  });

  describe("integration", () => {
    it("parses and validates complete design metadata", () => {
      const markdown = [
        "# Spec v1.1 Design",
        "",
        "**Design ID:** DESIGN-0003",
        "**Task:** TASK-0003",
        "**Roadmap:** ROADMAP-0002",
        "**Owner:** ai-copilot",
        "**Status:** PROPOSED",
        "**Last Updated:** 2026-02-22",
        "",
        "## Executive Summary",
        "This document proposes governance changes...",
      ].join("\n");

      const metadata = parseDesignMetadata(markdown);
      const validation = validateDesignMetadata(metadata);

      expect(metadata.task).toBe("TASK-0003");
      expect(metadata.roadmap).toBe("ROADMAP-0002");
      expect(metadata.owner).toBe("ai-copilot");
      expect(metadata.status).toBe("PROPOSED");
      expect(metadata.lastUpdated).toBe("2026-02-22");
      expect(validation.ok).toBe(true);
    });
  });
});
