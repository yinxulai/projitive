import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { candidateFilesFromArtifacts } from "../helpers/artifacts/index.js";
import { discoverGovernanceArtifacts } from "../helpers/files/index.js";
import { ROADMAP_LINT_CODES, renderLintSuggestions, type LintSuggestion } from "../helpers/linter/index.js";
import { findTextReferences } from "../helpers/markdown/index.js";
import {
  asText,
  evidenceSection,
  guidanceSection,
  lintSection,
  nextCallSection,
  renderErrorMarkdown,
  renderToolResponseMarkdown,
  summarySection,
} from "../helpers/response/index.js";
import { resolveGovernanceDir, toProjectPath } from "./project.js";
import { loadTasks } from "./task.js";

export const ROADMAP_ID_REGEX = /^ROADMAP-\d{4}$/;

function collectRoadmapLintSuggestionItems(roadmapIds: string[], tasks: Awaited<ReturnType<typeof loadTasks>>["tasks"]): LintSuggestion[] {
  const suggestions: LintSuggestion[] = [];

  if (roadmapIds.length === 0) {
    suggestions.push({
      code: ROADMAP_LINT_CODES.IDS_EMPTY,
      message: "No roadmap IDs found in roadmap.md.",
      fixHint: "Add at least one ROADMAP-xxxx milestone.",
    });
  }

  if (tasks.length === 0) {
    suggestions.push({
      code: ROADMAP_LINT_CODES.TASKS_EMPTY,
      message: "No tasks found in tasks.md.",
      fixHint: "Add task cards and bind roadmapRefs for traceability.",
    });
    return suggestions;
  }

  const roadmapSet = new Set(roadmapIds);
  const unboundTasks = tasks.filter((task) => task.roadmapRefs.length === 0);
  if (unboundTasks.length > 0) {
    suggestions.push({
      code: ROADMAP_LINT_CODES.TASK_REFS_EMPTY,
      message: `${unboundTasks.length} task(s) have empty roadmapRefs.`,
      fixHint: "Bind ROADMAP-xxxx where applicable.",
    });
  }

  const unknownRefs = Array.from(new Set(
    tasks.flatMap((task) => task.roadmapRefs).filter((id) => !roadmapSet.has(id))
  ));
  if (unknownRefs.length > 0) {
    suggestions.push({
      code: ROADMAP_LINT_CODES.UNKNOWN_REFS,
      message: `Unknown roadmapRefs detected: ${unknownRefs.join(", ")}.`,
      fixHint: "Add missing roadmap IDs or fix task references.",
    });
  }

  const noLinkedRoadmaps = roadmapIds.filter((id) => !tasks.some((task) => task.roadmapRefs.includes(id)));
  if (noLinkedRoadmaps.length > 0) {
    suggestions.push({
      code: ROADMAP_LINT_CODES.ZERO_LINKED_TASKS,
      message: `${noLinkedRoadmaps.length} roadmap ID(s) have zero linked tasks.`,
      fixHint: `Consider binding tasks to: ${noLinkedRoadmaps.slice(0, 3).join(", ")}${noLinkedRoadmaps.length > 3 ? ", ..." : ""}.`,
    });
  }

  return suggestions;
}

export function collectRoadmapLintSuggestions(roadmapIds: string[], tasks: Awaited<ReturnType<typeof loadTasks>>["tasks"]): string[] {
  return renderLintSuggestions(collectRoadmapLintSuggestionItems(roadmapIds, tasks));
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
      description: "List roadmap IDs and task linkage for planning or traceability",
      inputSchema: {
        projectPath: z.string(),
      },
    },
    async ({ projectPath }) => {
      const governanceDir = await resolveGovernanceDir(projectPath);
      const roadmapIds = await readRoadmapIds(governanceDir);
      const { tasks } = await loadTasks(governanceDir);
      const lintSuggestions = collectRoadmapLintSuggestions(roadmapIds, tasks);

      const markdown = renderToolResponseMarkdown({
        toolName: "roadmapList",
        sections: [
          summarySection([
            `- governanceDir: ${governanceDir}`,
            `- roadmapCount: ${roadmapIds.length}`,
          ]),
          evidenceSection([
            "- roadmaps:",
            ...roadmapIds.map((id) => {
              const linkedTasks = tasks.filter((task) => task.roadmapRefs.includes(id));
              return `- ${id} | linkedTasks=${linkedTasks.length}`;
            }),
          ]),
          guidanceSection(["- Pick one roadmap ID and call `roadmapContext`."]),
          lintSection(lintSuggestions),
          nextCallSection(roadmapIds[0]
            ? `roadmapContext(projectPath=\"${toProjectPath(governanceDir)}\", roadmapId=\"${roadmapIds[0]}\")`
            : undefined),
        ],
      });

      return asText(markdown);
    }
  );

  server.registerTool(
    "roadmapContext",
    {
      title: "Roadmap Context",
      description: "Inspect one roadmap with linked tasks and reference locations",
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
            ["expected format: ROADMAP-0001", "retry with a valid roadmap ID"],
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
      const roadmapIds = await readRoadmapIds(governanceDir);
      const lintSuggestionItems = collectRoadmapLintSuggestionItems(roadmapIds, tasks);
      if (relatedTasks.length === 0) {
        lintSuggestionItems.push({
          code: ROADMAP_LINT_CODES.CONTEXT_RELATED_TASKS_EMPTY,
          message: `relatedTasks=0 for ${roadmapId}.`,
          fixHint: "Batch bind task roadmapRefs to improve execution traceability.",
        });
      }
      const lintSuggestions = renderLintSuggestions(lintSuggestionItems);

      const markdown = renderToolResponseMarkdown({
        toolName: "roadmapContext",
        sections: [
          summarySection([
            `- governanceDir: ${governanceDir}`,
            `- roadmapId: ${roadmapId}`,
            `- relatedTasks: ${relatedTasks.length}`,
            `- references: ${referenceLocations.length}`,
          ]),
          evidenceSection([
            "### Related Tasks",
            ...relatedTasks.map((task) => `- ${task.id} | ${task.status} | ${task.title}`),
            "",
            "### Reference Locations",
            ...referenceLocations.map((item) => `- ${item.filePath}#L${item.line}: ${item.text}`),
          ]),
          guidanceSection([
            "- Read roadmap references first, then related tasks.",
            "- Keep ROADMAP/TASK IDs unchanged while updating markdown files.",
            "- Re-run `roadmapContext` after edits to confirm references remain consistent.",
          ]),
          lintSection(lintSuggestions),
          nextCallSection(`roadmapContext(projectPath=\"${toProjectPath(governanceDir)}\", roadmapId=\"${roadmapId}\")`),
        ],
      });

      return asText(markdown);
    }
  );
}
