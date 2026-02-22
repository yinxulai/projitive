import { describe, expect, it } from "vitest";
import {
  parseRequiredReading,
  type RequiredReadingItem,
} from "./readme.js";

describe("readme module", () => {
  describe("parseRequiredReading", () => {
    it("parses local and external required reading items", () => {
      const markdown = [
        "# Project README",
        "",
        "Some intro content",
        "",
        "## Required Reading for Agents",
        "",
        "- Local: ./design/README.md",
        "- Local: .projitive/tasks.md",
        "- External: https://example.com/docs",
        "",
        "## Other Section",
        "",
        "More content here",
      ].join("\n");

      const result = parseRequiredReading(markdown);
      expect(result.length).toBe(3);
      expect(result[0]).toEqual({
        source: "Local",
        value: "./design/README.md",
      });
      expect(result[1]).toEqual({
        source: "Local",
        value: ".projitive/tasks.md",
      });
      expect(result[2]).toEqual({
        source: "External",
        value: "https://example.com/docs",
      });
    });

    it("parses Chinese section header", () => {
      const markdown = [
        "# 项目 README",
        "",
        "## Agent 必读",
        "",
        "- Local: ./docs/guide.md",
        "",
        "## 其他部分",
      ].join("\n");

      const result = parseRequiredReading(markdown);
      expect(result.length).toBe(1);
      expect(result[0].source).toBe("Local");
      expect(result[0].value).toBe("./docs/guide.md");
    });

    it("returns empty array when no required reading section", () => {
      const markdown = [
        "# Simple README",
        "",
        "No required reading here",
        "",
        "## Other Section",
      ].join("\n");

      const result = parseRequiredReading(markdown);
      expect(result).toEqual([]);
    });

    it("returns empty array for empty string", () => {
      const result = parseRequiredReading("");
      expect(result).toEqual([]);
    });

    it("ignores non-list items in required reading section", () => {
      const markdown = [
        "## Required Reading for Agents",
        "",
        "Some paragraph text here",
        "- Local: valid-item.md",
        "Another paragraph",
        "- External: https://valid.com",
        "",
        "## Next Section",
      ].join("\n");

      const result = parseRequiredReading(markdown);
      expect(result.length).toBe(2);
      expect(result[0].value).toBe("valid-item.md");
      expect(result[1].value).toBe("https://valid.com");
    });

    it("handles items with whitespace variations", () => {
      const markdown = [
        "## Required Reading for Agents",
        "",
        "- Local:  ./path/with/spaces.md  ",
        "-  External:   https://example.com  ",
      ].join("\n");

      const result = parseRequiredReading(markdown);
      expect(result.length).toBe(2);
      expect(result[0].value).toBe("./path/with/spaces.md");
      expect(result[1].value).toBe("https://example.com");
    });

    it("ignores items without Local: or External: prefix", () => {
      const markdown = [
        "## Required Reading for Agents",
        "",
        "- Local: valid.md",
        "- Invalid: this is ignored",
        "- Just a plain list item",
        "- External: https://valid.com",
      ].join("\n");

      const result = parseRequiredReading(markdown);
      expect(result.length).toBe(2);
      expect(result.every((item) => 
        item.source === "Local" || item.source === "External"
      )).toBe(true);
    });

    it("stops at next section header", () => {
      const markdown = [
        "## Required Reading for Agents",
        "",
        "- Local: before.md",
        "",
        "## Another Section",
        "",
        "- Local: after.md",
      ].join("\n");

      const result = parseRequiredReading(markdown);
      expect(result.length).toBe(1);
      expect(result[0].value).toBe("before.md");
    });

    it("handles multiple required reading sections (takes first one)", () => {
      const markdown = [
        "## Required Reading for Agents",
        "",
        "- Local: first.md",
        "",
        "## Other Section",
        "",
        "## Required Reading for Agents",
        "",
        "- Local: second.md",
      ].join("\n");

      const result = parseRequiredReading(markdown);
      expect(result.length).toBe(1);
      expect(result[0].value).toBe("first.md");
    });
  });

  describe("edge cases", () => {
    it("handles markdown with just the section", () => {
      const markdown = "## Required Reading for Agents";
      const result = parseRequiredReading(markdown);
      expect(result).toEqual([]);
    });

    it("handles section with empty lines", () => {
      const markdown = [
        "## Required Reading for Agents",
        "",
        "",
        "- Local: item.md",
        "",
        "",
      ].join("\n");

      const result = parseRequiredReading(markdown);
      expect(result.length).toBe(1);
      expect(result[0].value).toBe("item.md");
    });

    it("handles mixed case section headers", () => {
      const markdown = [
        "## required reading for agents",
        "",
        "- Local: lowercase.md",
      ].join("\n");

      const result = parseRequiredReading(markdown);
      expect(result.length).toBe(1);
    });
  });
});
