import { describe, expect, it } from "vitest";
import {
  asText,
  nextCallSection,
  renderErrorMarkdown,
  renderToolResponseMarkdown,
  summarySection,
} from "./response.js";

describe("response helpers", () => {
  it("wraps markdown text as MCP text content", () => {
    const result = asText("# hello");
    expect(result.content).toEqual([{ type: "text", text: "# hello" }]);
  });

  it("renders error markdown sections", () => {
    const markdown = renderErrorMarkdown("taskContext", "bad id", ["retry"], "taskContext(...)");
    expect(markdown).toContain("# taskContext");
    expect(markdown).toContain("## Error");
    expect(markdown).toContain("- cause: bad id");
    expect(markdown).toContain("- retry");
    expect(markdown).toContain("## Retry Example");
  });

  it("renders standard tool response sections with fallback", () => {
    const markdown = renderToolResponseMarkdown({
      toolName: "taskList",
      sections: [
        { title: "Summary", lines: ["- governanceDir: /tmp/.projitive"] },
        { title: "Evidence", lines: [] },
      ],
    });

    expect(markdown).toContain("# taskList");
    expect(markdown).toContain("## Summary");
    expect(markdown).toContain("## Evidence");
    expect(markdown).toContain("- (none)");
  });

  it("auto-prefixes plain lines in section helpers", () => {
    const markdown = renderToolResponseMarkdown({
      toolName: "taskList",
      sections: [
        summarySection(["governanceDir: /tmp/.projitive"]),
      ],
    });

    expect(markdown).toContain("- governanceDir: /tmp/.projitive");
  });

  it("nextCallSection accepts optional call and falls back when missing", () => {
    const withCall = renderToolResponseMarkdown({
      toolName: "taskList",
      sections: [nextCallSection("taskContext(projectPath=\"/tmp\", taskId=\"TASK-0001\")")],
    });
    expect(withCall).toContain("- taskContext(projectPath=\"/tmp\", taskId=\"TASK-0001\")");

    const withoutCall = renderToolResponseMarkdown({
      toolName: "taskList",
      sections: [nextCallSection(undefined)],
    });
    expect(withoutCall).toContain("- (none)");
  });
});
