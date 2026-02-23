import { describe, expect, it } from "vitest";
import { renderLintSuggestions } from "./linter.js";

describe("renderLintSuggestions", () => {
  it("renders lint lines with code and message", () => {
    const lines = renderLintSuggestions([
      { code: "TASK_001", message: "Example lint" },
    ]);

    expect(lines).toEqual(["- [TASK_001] Example lint"]);
  });

  it("appends fixHint when provided", () => {
    const lines = renderLintSuggestions([
      { code: "TASK_002", message: "Missing field.", fixHint: "Set owner." },
    ]);

    expect(lines).toEqual(["- [TASK_002] Missing field. Set owner."]);
  });
});
