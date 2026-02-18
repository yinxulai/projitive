import { describe, expect, it } from "vitest";
import { collectRoadmapLintSuggestions } from "./roadmap.js";
import { normalizeTask } from "./tasks.js";

describe("roadmap lint rendering alignment", () => {
  it("renders roadmap lint in code-prefixed markdown lines", () => {
    const lint = collectRoadmapLintSuggestions(["ROADMAP-0001"], [
      normalizeTask({ id: "TASK-0001", title: "x", status: "TODO", roadmapRefs: [] }),
    ]);

    expect(lint.some((line) => line.startsWith("- [ROADMAP_TASK_REFS_EMPTY]"))).toBe(true);
  });
});
