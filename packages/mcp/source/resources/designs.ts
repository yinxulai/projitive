import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";
import { isValidRoadmapId } from "../tools/roadmap.js";
import { isValidTaskId } from "../tools/task.js";

export type DesignMetadata = {
  task?: string;
  roadmap?: string;
  owner?: string;
  status?: string;
  lastUpdated?: string;
};

export function parseDesignMetadata(markdown: string): DesignMetadata {
  const lines = markdown.split(/\r?\n/);
  const metadata: DesignMetadata = {};

  for (const line of lines) {
    // Remove markdown bold markers (**)
    const cleanLine = line.replace(/\*\*/g, "");
    const [rawKey, ...rawValue] = cleanLine.split(":");
    if (!rawKey || rawValue.length === 0) {
      continue;
    }
    const key = rawKey.trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (key === "task") metadata.task = value;
    if (key === "roadmap") metadata.roadmap = value;
    if (key === "owner") metadata.owner = value;
    if (key === "status") metadata.status = value;
    if (key === "last updated") metadata.lastUpdated = value;
  }

  return metadata;
}

export function validateDesignMetadata(metadata: DesignMetadata): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!metadata.task) {
    errors.push("Missing Task metadata");
  } else if (!isValidTaskId(metadata.task)) {
    errors.push(`Invalid Task metadata format: ${metadata.task}`);
  }

  if (metadata.roadmap && !isValidRoadmapId(metadata.roadmap)) {
    errors.push(`Invalid Roadmap metadata format: ${metadata.roadmap}`);
  }

  return { ok: errors.length === 0, errors };
}

async function findAllMarkdownFiles(dir: string): Promise<{ filePath: string; relativePath: string }[]> {
  const result: { filePath: string; relativePath: string }[] = [];

  async function walk(currentDir: string, relativeBase: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, path.join(relativeBase, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        result.push({
          filePath: fullPath,
          relativePath: path.join(relativeBase, entry.name),
        });
      }
    }
  }

  await walk(dir, "");
  return result;
}

export async function registerDesignFilesResources(server: McpServer, repoRoot: string): Promise<void> {
  const designsDir = path.join(repoRoot, ".projitive", "designs");

  try {
    // Check if design documents directory exists
    await fs.access(designsDir);

    // Recursively read all .md files (including subdirectories)
    const markdownFiles = await findAllMarkdownFiles(designsDir);

    // Register each design file as a resource
    for (const { filePath, relativePath } of markdownFiles) {
      // Generate designId from relative path, replace path separators with '-'
      const designId = relativePath
        .slice(0, -3) // Remove .md suffix
        .replace(/[\\/]/g, "-"); // Replace path separators with '-'
      const content = await fs.readFile(filePath, "utf-8");

      // Register resource
      server.registerResource(
        `design-${designId}`,
        `projitive://designs/${designId}`,
        {
          title: designId,
          description: `Design document: ${relativePath}`,
          mimeType: "text/markdown",
        },
        async () => ({
          contents: [
            {
              uri: `projitive://designs/${designId}`,
              text: content,
            },
          ],
        })
      );
    }
  } catch (error) {
    // If design documents directory doesn't exist, register a default resource
    console.warn(`Designs directory not found at ${designsDir}, registering default design resource`);
    server.registerResource(
      "designs",
      "projitive://designs",
      {
        title: "Designs",
        description: "Design documents directory",
        mimeType: "text/markdown",
      },
      async () => ({
        contents: [
          {
            uri: "projitive://designs",
            text: `# Designs Directory\n\nDesign documents not found. Please create design files in .projitive/designs/ directory.`,
          },
        ],
      })
    );
  }
}
