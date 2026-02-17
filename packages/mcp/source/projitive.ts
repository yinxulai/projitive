import fs from "node:fs/promises";
import path from "node:path";
import { catchIt } from "./helpers/catch/index.js";

export const PROJECT_MARKER = ".projitive";

const ignoreNames = new Set(["node_modules", ".git", ".next", "dist", "build"]);

export async function hasProjectMarker(dirPath: string): Promise<boolean> {
  const markerPath = path.join(dirPath, PROJECT_MARKER);
  const statResult = await catchIt(fs.stat(markerPath));
  if (statResult.isError()) {
    return false;
  }
  return statResult.value.isFile();
}

function parentDir(dirPath: string): string | null {
  const parent = path.dirname(dirPath);
  return parent === dirPath ? null : parent;
}

export async function resolveGovernanceDir(inputPath: string): Promise<string> {
  const absolutePath = path.resolve(inputPath);
  const statResult = await catchIt(fs.stat(absolutePath));
  if (statResult.isError()) {
    throw new Error(`Path not found: ${absolutePath}`);
  }

  const stat = statResult.value;
  let cursor: string | null = stat.isDirectory() ? absolutePath : path.dirname(absolutePath);

  while (cursor) {
    if (await hasProjectMarker(cursor)) {
      return cursor;
    }
    cursor = parentDir(cursor);
  }

  throw new Error(`No ${PROJECT_MARKER} marker found from path: ${absolutePath}`);
}

export async function discoverProjects(rootPath: string, maxDepth: number): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) {
      return;
    }

    if (await hasProjectMarker(currentPath)) {
      results.push(currentPath);
    }

    const entriesResult = await catchIt(fs.readdir(currentPath, { withFileTypes: true }));
    if (entriesResult.isError()) {
      return;
    }

    const entries = entriesResult.value;
    const folders = entries.filter((entry) => entry.isDirectory() && !ignoreNames.has(entry.name));
    for (const folder of folders) {
      await walk(path.join(currentPath, folder.name), depth + 1);
    }
  }

  await walk(rootPath, 0);
  return Array.from(new Set(results)).sort();
}
