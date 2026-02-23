import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverGovernanceArtifacts } from '../../common/files.js';

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

describe("files module", () => {
  it("discovers governance artifacts with paths and line counts", async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, "README.md"), "# Readme\n", "utf-8");
    await fs.writeFile(path.join(root, "tasks.md"), "# Tasks\n## TODO\n", "utf-8");
    await fs.mkdir(path.join(root, "designs"), { recursive: true });
    await fs.writeFile(path.join(root, "designs", "feature-design.md"), "# Design\n", "utf-8");

    const artifacts = await discoverGovernanceArtifacts(root);
    const readme = artifacts.find((item) => item.name === "README.md");
    const designs = artifacts.find((item) => item.name === "designs");

    expect(readme?.exists).toBe(true);
    expect(readme?.lineCount).toBe(2);
    expect(designs?.exists).toBe(true);
    expect(designs?.markdownFiles?.[0].path.endsWith("feature-design.md")).toBe(true);
  });
});
