import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverProjects, hasProjectMarker, resolveGovernanceDir } from "./projitive.js";

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

describe("projitive module", () => {
  it("does not treat marker directory as a valid project marker", async () => {
    const root = await createTempDir();
    const dirMarkerPath = path.join(root, ".projitive");
    await fs.mkdir(dirMarkerPath, { recursive: true });

    const hasMarker = await hasProjectMarker(root);
    expect(hasMarker).toBe(false);
  });

  it("resolves governance dir by walking upwards for .projitive", async () => {
    const root = await createTempDir();
    const governanceDir = path.join(root, "repo", "governance");
    const deepDir = path.join(governanceDir, "nested", "module");
    await fs.mkdir(deepDir, { recursive: true });
    await fs.writeFile(path.join(governanceDir, ".projitive"), "", "utf-8");

    const resolved = await resolveGovernanceDir(deepDir);
    expect(resolved).toBe(governanceDir);
  });

  it("discovers projects by marker file", async () => {
    const root = await createTempDir();
    const p1 = path.join(root, "a");
    const p2 = path.join(root, "b", "c");
    await fs.mkdir(p1, { recursive: true });
    await fs.mkdir(p2, { recursive: true });
    await fs.writeFile(path.join(p1, ".projitive"), "", "utf-8");
    await fs.writeFile(path.join(p2, ".projitive"), "", "utf-8");

    const projects = await discoverProjects(root, 4);
    expect(projects).toContain(p1);
    expect(projects).toContain(p2);
  });
});
