import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { discoverGovernanceArtifacts } from "./helpers/files/index.js";
import { findTextReferences } from "./helpers/markdown/index.js";
import { resolveGovernanceDir } from "./projitive.js";
import { loadTasks } from "./tasks.js";

export const ROADMAP_ID_REGEX = /^ROADMAP-\d{4}$/;

function asText(markdown: string) {
  return {
    content: [{ type: "text" as const, text: markdown }],
  };
}

function renderErrorMarkdown(toolName: string, cause: string, nextSteps: string[], retryExample?: string): string {
  return [
    `# ${toolName}`,
    "",
    "## Error",
    `- cause: ${cause}`,
    "",
    "## Next Step",
    ...(nextSteps.length > 0 ? nextSteps : ["- (none)"]),
    "",
    "## Retry Example",
    `- ${retryExample ?? "(none)"}`,
  ].join("\n");
}

function candidateFilesFromArtifacts(artifacts: Awaited<ReturnType<typeof discoverGovernanceArtifacts>>): string[] {
  return artifacts
    .filter((item) => item.exists)
    .flatMap((item) => {
      if (item.kind === "file") {
        return [item.path];
      }
      return (item.markdownFiles ?? []).map((entry) => entry.path);
    });
}

export function isValidRoadmapId(id: string): boolean {
  return ROADMAP_ID_REGEX.test(id);
}

async function readRoadmapIds(governanceDir: string): Promise<string[]> {
  const roadmapPath = path.join(governanceDir, "roadmap.md");
  try {
    const markdown = await fs.readFile(roadmapPath, "utf-8");
    const matches = markdown.match(/ROADMAP-\d{4}/g) ?? [];
    return Array.from(new Set(matches));
  } catch {
    return [];
  }
}

export function registerRoadmapTools(server: McpServer): void {
  server.registerTool(
    "roadmapList",
    {
      title: "Roadmap List",
      description: "List roadmap IDs and related tasks for project planning",
      inputSchema: {
        projectPath: z.string(),
      },
    },
    async ({ projectPath }) => {
      const governanceDir = await resolveGovernanceDir(projectPath);
      const roadmapIds = await readRoadmapIds(governanceDir);
      const { tasks } = await loadTasks(governanceDir);

      const markdown = [
        "# roadmapList",
        "",
        "## Summary",
        `- governanceDir: ${governanceDir}`,
        `- roadmapCount: ${roadmapIds.length}`,
        "",
        "## Evidence",
        "- roadmaps:",
        ...(roadmapIds.length > 0
          ? roadmapIds.map((id) => {
              const linkedTasks = tasks.filter((task) => task.roadmapRefs.includes(id));
              return `- ${id} | linkedTasks=${linkedTasks.length}`;
            })
          : ["- (none)"]),
        "",
        "## Agent Guidance",
        "- Pick one roadmap ID and call `roadmapContext`.",
        "",
        "## Next Call",
        ...(roadmapIds.length > 0
          ? [`- roadmapContext(projectPath=\"${governanceDir}\", roadmapId=\"${roadmapIds[0]}\")`]
          : ["- (none)"]),
      ].join("\n");

      return asText(markdown);
    }
  );

  server.registerTool(
    "roadmapContext",
    {
      title: "Roadmap Context",
      description: "Get one roadmap with related tasks, references, and execution context",
      inputSchema: {
        projectPath: z.string(),
        roadmapId: z.string(),
      },
    },
    async ({ projectPath, roadmapId }) => {
      if (!isValidRoadmapId(roadmapId)) {
        return {
          ...asText(renderErrorMarkdown(
            "roadmapContext",
            `Invalid roadmap ID format: ${roadmapId}`,
            ["- expected format: ROADMAP-0001", "- retry with a valid roadmap ID"],
            `roadmapContext(projectPath=\"${projectPath}\", roadmapId=\"ROADMAP-0001\")`
          )),
          isError: true,
        };
      }

      const governanceDir = await resolveGovernanceDir(projectPath);
      const artifacts = await discoverGovernanceArtifacts(governanceDir);
      const fileCandidates = candidateFilesFromArtifacts(artifacts);
      const referenceLocations = (
        await Promise.all(fileCandidates.map((file) => findTextReferences(file, roadmapId)))
      ).flat();

      const { tasks } = await loadTasks(governanceDir);
      const relatedTasks = tasks.filter((task) => task.roadmapRefs.includes(roadmapId));

      const markdown = [
        "# roadmapContext",
        "",
        "## Summary",
        `- governanceDir: ${governanceDir}`,
        `- roadmapId: ${roadmapId}`,
        `- relatedTasks: ${relatedTasks.length}`,
        `- references: ${referenceLocations.length}`,
        "",
        "## Evidence",
        "### Related Tasks",
        ...(relatedTasks.length > 0
          ? relatedTasks.map((task) => `- ${task.id} | ${task.status} | ${task.title}`)
          : ["- (none)"]),
        "",
        "### Reference Locations",
        ...(referenceLocations.length > 0
          ? referenceLocations.map((item) => `- ${item.filePath}#L${item.line}: ${item.text}`)
          : ["- (none)"]),
        "",
        "## Agent Guidance",
        "- Read roadmap references first, then related tasks.",
        "- Keep ROADMAP/TASK IDs unchanged while updating markdown files.",
        "- Re-run `roadmapContext` after edits to confirm references remain consistent.",
        "",
        "## Next Call",
        `- roadmapContext(projectPath=\"${governanceDir}\", roadmapId=\"${roadmapId}\")`,
      ].join("\n");

      return asText(markdown);
    }
  );
}
