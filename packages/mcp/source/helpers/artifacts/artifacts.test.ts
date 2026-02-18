import { describe, expect, it } from "vitest";
import { candidateFilesFromArtifacts } from "./artifacts.js";

describe("candidateFilesFromArtifacts", () => {
  it("collects existing file artifacts and markdown files from existing directories", () => {
    const candidates = candidateFilesFromArtifacts([
      { name: "README.md", kind: "file", path: "/a/README.md", exists: true, lineCount: 3 },
      { name: "tasks.md", kind: "file", path: "/a/tasks.md", exists: false },
      {
        name: "designs",
        kind: "directory",
        path: "/a/designs",
        exists: true,
        markdownFiles: [{ path: "/a/designs/d1.md", lineCount: 10 }],
      },
    ]);

    expect(candidates).toEqual(["/a/README.md", "/a/designs/d1.md"]);
  });
});
