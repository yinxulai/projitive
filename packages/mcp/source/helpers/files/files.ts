import fs from "node:fs/promises";
import path from "node:path";
import { catchIt } from "../catch/index.js";

export type GovernanceFileEntry = {
  name: string;
  kind: "file" | "directory";
  path: string;
  exists: boolean;
  lineCount?: number;
  markdownFiles?: Array<{ path: string; lineCount: number }>;
};

const FILE_ARTIFACTS = ["README.md", "roadmap.md", "tasks.md"];
const DIRECTORY_ARTIFACTS = ["designs", "reports", "hooks"];

async function fileLineCount(filePath: string): Promise<number> {
  const content = await fs.readFile(filePath, "utf-8");
  if (!content) {
    return 0;
  }
  return content.split(/\r?\n/).length;
}

async function listMarkdownFiles(dirPath: string): Promise<Array<{ path: string; lineCount: number }>> {
  const entriesResult = await catchIt(fs.readdir(dirPath, { withFileTypes: true }));
  if (entriesResult.isError()) {
    return [];
  }

  const entries = entriesResult.value;
  const files = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"));
  const result: Array<{ path: string; lineCount: number }> = [];
  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);
    result.push({ path: fullPath, lineCount: await fileLineCount(fullPath) });
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

export async function discoverGovernanceArtifacts(governanceDir: string): Promise<GovernanceFileEntry[]> {
  const result: GovernanceFileEntry[] = [];

  for (const artifact of FILE_ARTIFACTS) {
    const artifactPath = path.join(governanceDir, artifact);
    const accessResult = await catchIt(fs.access(artifactPath));
    if (!accessResult.isError()) {
      result.push({
        name: artifact,
        kind: "file",
        path: artifactPath,
        exists: true,
        lineCount: await fileLineCount(artifactPath),
      });
    } else {
      result.push({ name: artifact, kind: "file", path: artifactPath, exists: false });
    }
  }

  for (const artifact of DIRECTORY_ARTIFACTS) {
    const artifactPath = path.join(governanceDir, artifact);
    const accessResult = await catchIt(fs.access(artifactPath));
    if (!accessResult.isError()) {
      result.push({
        name: artifact,
        kind: "directory",
        path: artifactPath,
        exists: true,
        markdownFiles: await listMarkdownFiles(artifactPath),
      });
    } else {
      result.push({ name: artifact, kind: "directory", path: artifactPath, exists: false, markdownFiles: [] });
    }
  }

  return result;
}
