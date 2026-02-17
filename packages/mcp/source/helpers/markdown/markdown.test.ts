import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findTextReferences, readMarkdownSections } from "./markdown.js";

const tempPaths: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "projitive-mcp-test-"));
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

describe("markdown module", () => {
  it("locates markdown sections with line ranges", async () => {
    const root = await createTempDir();
    const file = path.join(root, "tasks.md");
    await fs.writeFile(file, ["# Tasks", "", "## TODO", "- TASK-0001", "## DONE", "- TASK-0002"].join("\n"), "utf-8");

    const located = await readMarkdownSections(file);
    expect(located.lineCount).toBe(6);
    expect(located.sections[0].heading).toBe("Tasks");
    expect(located.sections[1].heading).toBe("TODO");
    expect(located.sections[1].startLine).toBe(3);
  });

  it("finds ID references with exact line number", async () => {
    const root = await createTempDir();
    const file = path.join(root, "reports.md");
    await fs.writeFile(file, ["Task: TASK-0001", "Roadmap: ROADMAP-0001"].join("\n"), "utf-8");

    const refs = await findTextReferences(file, "TASK-0001");
    expect(refs).toHaveLength(1);
    expect(refs[0].line).toBe(1);
  });
});
