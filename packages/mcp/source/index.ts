import path from "node:path";
import process from "node:process";
import fs from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { discoverGovernanceArtifacts } from "./helpers/files/index.js";
import { findTextReferences } from "./helpers/markdown/index.js";
import { discoverProjects, resolveGovernanceDir } from "./projitive.js";
import { isValidRoadmapId } from "./roadmap.js";
import {
  isValidTaskId,
  loadTasks,
  parseTasksBlock,
  rankActionableTaskCandidates,
  taskPriority,
  toTaskUpdatedAtMs,
  type ActionableTaskCandidate,
  type Task,
} from "./tasks.js";

const PROJITIVE_SPEC_VERSION = "1.0.0";

const server = new McpServer({
  name: "projitive-mcp",
  version: PROJITIVE_SPEC_VERSION,
  description: "Semantic Projitive MCP for project/task discovery and agent guidance with markdown-first outputs",
});

function asText(markdown: string) {
  return {
    content: [{ type: "text" as const, text: markdown }],
  };
}

function renderErrorMarkdown(toolName: string, cause: string, nextSteps: string[]): string {
  return [
    `# ${toolName}`,
    "",
    "## Error",
    `- cause: ${cause}`,
    "",
    "## Next Step",
    ...(nextSteps.length > 0 ? nextSteps : ["- (none)"]),
  ].join("\n");
}

function normalizePath(inputPath?: string): string {
  return inputPath ? path.resolve(inputPath) : process.cwd();
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

async function readOptionalMarkdown(filePath: string): Promise<string | undefined> {
  const content = await fs.readFile(filePath, "utf-8").catch(() => undefined);
  if (typeof content !== "string") {
    return undefined;
  }
  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function readTaskGetHooks(governanceDir: string): Promise<{ head?: string; footer?: string; headPath: string; footerPath: string }> {
  const headPath = path.join(governanceDir, "hooks", "task_get_head.md");
  const footerPath = path.join(governanceDir, "hooks", "task_get_footer.md");

  const [head, footer] = await Promise.all([readOptionalMarkdown(headPath), readOptionalMarkdown(footerPath)]);
  return { head, footer, headPath, footerPath };
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

function renderArtifactsMarkdown(artifacts: Awaited<ReturnType<typeof discoverGovernanceArtifacts>>): string {
  const rows = artifacts.map((item) => {
    if (item.kind === "file") {
      const lineText = item.lineCount == null ? "-" : String(item.lineCount);
      return `- ${item.exists ? "✅" : "❌"} ${item.name}  \n  path: ${item.path}  \n  lineCount: ${lineText}`;
    }

    const nested = (item.markdownFiles ?? [])
      .map((entry) => `    - ${entry.path} (lines: ${entry.lineCount})`)
      .join("\n");
    return `- ${item.exists ? "✅" : "❌"} ${item.name}/  \n  path: ${item.path}${nested ? `\n  markdownFiles:\n${nested}` : ""}`;
  });

  return rows.join("\n");
}

async function readTasksSnapshot(governanceDir: string): Promise<{ tasksPath: string; exists: boolean; tasks: Task[] }> {
  const tasksPath = path.join(governanceDir, "tasks.md");
  const markdown = await fs.readFile(tasksPath, "utf-8").catch(() => undefined);
  if (typeof markdown !== "string") {
    return { tasksPath, exists: false, tasks: [] };
  }

  const tasks = await parseTasksBlock(markdown);
  return { tasksPath, exists: true, tasks };
}

function latestTaskUpdatedAt(tasks: Task[]): string {
  const timestamps = tasks
    .map((task) => new Date(task.updatedAt).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return "(unknown)";
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function actionableScore(tasks: Task[]): number {
  return tasks.filter((task) => task.status === "IN_PROGRESS").length * 2
    + tasks.filter((task) => task.status === "TODO").length;
}

async function readActionableTaskCandidates(governanceDirs: string[]): Promise<ActionableTaskCandidate[]> {
  const snapshots = await Promise.all(
    governanceDirs.map(async (governanceDir) => {
      const snapshot = await readTasksSnapshot(governanceDir);
      return {
        governanceDir,
        tasksPath: snapshot.tasksPath,
        tasks: snapshot.tasks,
        projectScore: actionableScore(snapshot.tasks),
        projectLatestUpdatedAt: latestTaskUpdatedAt(snapshot.tasks),
      };
    })
  );

  return snapshots.flatMap((item) => item.tasks
    .filter((task) => task.status === "IN_PROGRESS" || task.status === "TODO")
    .map((task) => ({
      governanceDir: item.governanceDir,
      tasksPath: item.tasksPath,
      task,
      projectScore: item.projectScore,
      projectLatestUpdatedAt: item.projectLatestUpdatedAt,
      taskUpdatedAtMs: toTaskUpdatedAtMs(task.updatedAt),
      taskPriority: taskPriority(task.status),
    })));
}

server.registerTool(
  "project.scan",
  {
    title: "Project Scan",
    description: "Scan filesystem and discover project governance roots marked by .projitive",
    inputSchema: {
      rootPath: z.string().optional(),
      maxDepth: z.number().int().min(0).max(8).optional(),
    },
  },
  async ({ rootPath, maxDepth }) => {
    const root = normalizePath(rootPath);
    const projects = await discoverProjects(root, maxDepth ?? 3);

    const markdown = [
      "# project.scan",
      "",
      "## Summary",
      `- rootPath: ${root}`,
      `- maxDepth: ${maxDepth ?? 3}`,
      `- discoveredCount: ${projects.length}`,
      "",
      "## Evidence",
      "- projects:",
      ...(projects.length > 0 ? projects.map((project, index) => `${index + 1}. ${project}`) : ["- (none)"]),
      "",
      "## Agent Guidance",
      "- Next: call `project.locate` with one target path to lock the active governance root.",
      "- Then: call `project.overview` to view artifact and task status.",
    ].join("\n");

    return asText(markdown);
  }
);

server.registerTool(
  "project.next",
  {
    title: "Project Next",
    description: "Directly list recently actionable projects for immediate agent progression",
    inputSchema: {
      rootPath: z.string().optional(),
      maxDepth: z.number().int().min(0).max(8).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
  },
  async ({ rootPath, maxDepth, limit }) => {
    const root = normalizePath(rootPath);
    const projects = await discoverProjects(root, maxDepth ?? 3);
    const snapshots = await Promise.all(
      projects.map(async (governanceDir) => {
        const snapshot = await readTasksSnapshot(governanceDir);
        const inProgress = snapshot.tasks.filter((task) => task.status === "IN_PROGRESS").length;
        const todo = snapshot.tasks.filter((task) => task.status === "TODO").length;
        const blocked = snapshot.tasks.filter((task) => task.status === "BLOCKED").length;
        const done = snapshot.tasks.filter((task) => task.status === "DONE").length;
        const actionable = inProgress + todo;

        return {
          governanceDir,
          tasksPath: snapshot.tasksPath,
          tasksExists: snapshot.exists,
          total: snapshot.tasks.length,
          inProgress,
          todo,
          blocked,
          done,
          actionable,
          latestUpdatedAt: latestTaskUpdatedAt(snapshot.tasks),
          score: actionableScore(snapshot.tasks),
        };
      })
    );

    const ranked = snapshots
      .filter((item) => item.actionable > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return b.latestUpdatedAt.localeCompare(a.latestUpdatedAt);
      })
      .slice(0, limit ?? 10);

    const markdown = [
      "# project.next",
      "",
      "## Summary",
      `- rootPath: ${root}`,
      `- maxDepth: ${maxDepth ?? 3}`,
      `- matchedProjects: ${projects.length}`,
      `- actionableProjects: ${ranked.length}`,
      `- limit: ${limit ?? 10}`,
      "",
      "## Evidence",
      "- rankedProjects:",
      ...(ranked.length > 0
        ? ranked.map(
            (item, index) =>
              `${index + 1}. ${item.governanceDir} | actionable=${item.actionable} | in_progress=${item.inProgress} | todo=${item.todo} | blocked=${item.blocked} | done=${item.done} | latest=${item.latestUpdatedAt} | tasksPath=${item.tasksPath}${item.tasksExists ? "" : " (missing)"}`
          )
        : ["- (none)"]),
      "",
      "## Agent Guidance",
      "- Pick top 1 project and call `project.overview` with its governanceDir.",
      "- Then call `task.list` and `task.get` to continue execution.",
      "- If `tasksPath` is missing, create tasks.md using project convention before task-level operations.",
    ].join("\n");

    return asText(markdown);
  }
);

server.registerTool(
  "project.locate",
  {
    title: "Project Locate",
    description: "Resolve current project governance root from an in-project path by finding the nearest .projitive marker",
    inputSchema: {
      inputPath: z.string(),
    },
  },
  async ({ inputPath }) => {
    const resolvedFrom = normalizePath(inputPath);
    const governanceDir = await resolveGovernanceDir(resolvedFrom);
    const markerPath = path.join(governanceDir, ".projitive");

    const markdown = [
      "# project.locate",
      "",
      "## Summary",
      `- resolvedFrom: ${resolvedFrom}`,
      `- governanceDir: ${governanceDir}`,
      `- markerPath: ${markerPath}`,
      "",
      "## Agent Guidance",
      "- Next: call `project.overview` with this governanceDir to get task and roadmap summaries.",
    ].join("\n");

    return asText(markdown);
  }
);

server.registerTool(
  "project.overview",
  {
    title: "Project Overview",
    description: "Summarize governance artifacts and task/roadmap status for agent planning",
    inputSchema: {
      projectPath: z.string(),
    },
  },
  async ({ projectPath }) => {
    const governanceDir = await resolveGovernanceDir(projectPath);
    const artifacts = await discoverGovernanceArtifacts(governanceDir);
    const { tasksPath, tasks } = await loadTasks(governanceDir);
    const roadmapIds = await readRoadmapIds(governanceDir);

    const taskSummary = {
      total: tasks.length,
      TODO: tasks.filter((task) => task.status === "TODO").length,
      IN_PROGRESS: tasks.filter((task) => task.status === "IN_PROGRESS").length,
      BLOCKED: tasks.filter((task) => task.status === "BLOCKED").length,
      DONE: tasks.filter((task) => task.status === "DONE").length,
    };

    const markdown = [
      "# project.overview",
      "",
      "## Summary",
      `- governanceDir: ${governanceDir}`,
      `- tasksFile: ${tasksPath}`,
      `- roadmapIds: ${roadmapIds.length}`,
      "",
      "## Evidence",
      "### Task Summary",
      `- total: ${taskSummary.total}`,
      `- TODO: ${taskSummary.TODO}`,
      `- IN_PROGRESS: ${taskSummary.IN_PROGRESS}`,
      `- BLOCKED: ${taskSummary.BLOCKED}`,
      `- DONE: ${taskSummary.DONE}`,
      "",
      "### Artifacts",
      renderArtifactsMarkdown(artifacts),
      "",
      "## Agent Guidance",
      "- Next: call `task.list` to choose a target task.",
      "- Then: call `task.get` with a task ID to retrieve evidence locations and reading order.",
    ].join("\n");

    return asText(markdown);
  }
);

server.registerTool(
  "task.list",
  {
    title: "Task List",
    description: "List project tasks with optional status filter for agent planning",
    inputSchema: {
      projectPath: z.string(),
      status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
  },
  async ({ projectPath, status, limit }) => {
    const governanceDir = await resolveGovernanceDir(projectPath);
    const { tasksPath, tasks } = await loadTasks(governanceDir);
    const filtered = tasks
      .filter((task) => (status ? task.status === status : true))
      .slice(0, limit ?? 100);

    const markdown = [
      "# task.list",
      "",
      "## Summary",
      `- governanceDir: ${governanceDir}`,
      `- tasksPath: ${tasksPath}`,
      `- filter.status: ${status ?? "(none)"}`,
      `- returned: ${filtered.length}`,
      "",
      "## Evidence",
      "- tasks:",
      ...(filtered.length > 0
        ? filtered.map((task) => `- ${task.id} | ${task.status} | ${task.title} | owner=${task.owner || ""} | updatedAt=${task.updatedAt}`)
        : ["- (none)"]),
      "",
      "## Agent Guidance",
      "- Next: pick one task ID and call `task.get`.",
    ].join("\n");

    return asText(markdown);
  }
);

server.registerTool(
  "task.next",
  {
    title: "Task Next",
    description: "One-step discover and select the most actionable task with evidence and start guidance",
    inputSchema: {
      rootPath: z.string().optional(),
      maxDepth: z.number().int().min(0).max(8).optional(),
      topCandidates: z.number().int().min(1).max(20).optional(),
    },
  },
  async ({ rootPath, maxDepth, topCandidates }) => {
    const root = normalizePath(rootPath);
    const projects = await discoverProjects(root, maxDepth ?? 3);
    const rankedCandidates = rankActionableTaskCandidates(await readActionableTaskCandidates(projects));

    if (rankedCandidates.length === 0) {
      const markdown = [
        "# task.next",
        "",
        "## Summary",
        `- rootPath: ${root}`,
        `- maxDepth: ${maxDepth ?? 3}`,
        `- matchedProjects: ${projects.length}`,
        "- actionableTasks: 0",
        "",
        "## Evidence",
        "- candidates:",
        "- (none)",
        "",
        "## Agent Guidance",
        "- No TODO/IN_PROGRESS task is available.",
        "- Create or reopen tasks in tasks.md, then rerun `task.next`.",
      ].join("\n");
      return asText(markdown);
    }

    const selected = rankedCandidates[0];
    const artifacts = await discoverGovernanceArtifacts(selected.governanceDir);
    const fileCandidates = candidateFilesFromArtifacts(artifacts);
    const referenceLocations = (
      await Promise.all(fileCandidates.map((file) => findTextReferences(file, selected.task.id)))
    ).flat();
    const taskLocation = (await findTextReferences(selected.tasksPath, selected.task.id))[0];
    const relatedArtifacts = Array.from(new Set(referenceLocations.map((item) => item.filePath)));
    const suggestedReadOrder = [selected.tasksPath, ...relatedArtifacts.filter((item) => item !== selected.tasksPath)];
    const candidateLimit = topCandidates ?? 5;

    const markdown = [
      "# task.next",
      "",
      "## Summary",
      `- rootPath: ${root}`,
      `- maxDepth: ${maxDepth ?? 3}`,
      `- matchedProjects: ${projects.length}`,
      `- actionableTasks: ${rankedCandidates.length}`,
      `- selectedProject: ${selected.governanceDir}`,
      `- selectedTaskId: ${selected.task.id}`,
      `- selectedTaskStatus: ${selected.task.status}`,
      "",
      "## Evidence",
      "### Selected Task",
      `- id: ${selected.task.id}`,
      `- title: ${selected.task.title}`,
      `- owner: ${selected.task.owner || "(none)"}`,
      `- updatedAt: ${selected.task.updatedAt}`,
      `- roadmapRefs: ${selected.task.roadmapRefs.join(", ") || "(none)"}`,
      `- taskLocation: ${taskLocation ? `${taskLocation.filePath}#L${taskLocation.line}` : selected.tasksPath}`,
      "",
      "### Top Candidates",
      ...rankedCandidates
        .slice(0, candidateLimit)
        .map((item, index) => `${index + 1}. ${item.task.id} | ${item.task.status} | ${item.task.title} | project=${item.governanceDir} | projectScore=${item.projectScore} | latest=${item.projectLatestUpdatedAt}`),
      "",
      "### Related Artifacts",
      ...(relatedArtifacts.length > 0 ? relatedArtifacts.map((file) => `- ${file}`) : ["- (none)"]),
      "",
      "### Reference Locations",
      ...(referenceLocations.length > 0
        ? referenceLocations.map((item) => `- ${item.filePath}#L${item.line}: ${item.text}`)
        : ["- (none)"]),
      "",
      "### Suggested Read Order",
      ...suggestedReadOrder.map((item, index) => `${index + 1}. ${item}`),
      "",
      "## Agent Guidance",
      "- Start immediately with Suggested Read Order and execute the selected task.",
      "- Update markdown artifacts directly while keeping TASK/ROADMAP IDs unchanged.",
      "- Re-run `task.get` for the selectedTaskId after edits to verify evidence consistency.",
    ].join("\n");

    return asText(markdown);
  }
);

server.registerTool(
  "task.get",
  {
    title: "Task Get",
    description: "Get one task with related evidence locations and a guidance prompt for the agent",
    inputSchema: {
      projectPath: z.string(),
      taskId: z.string(),
    },
  },
  async ({ projectPath, taskId }) => {
    if (!isValidTaskId(taskId)) {
      return {
        ...asText(renderErrorMarkdown("task.get", `Invalid task ID format: ${taskId}`, ["- expected format: TASK-0001", "- retry with a valid task ID"])),
        isError: true,
      };
    }

    const governanceDir = await resolveGovernanceDir(projectPath);
    const { tasksPath, tasks } = await loadTasks(governanceDir);
    const taskGetHooks = await readTaskGetHooks(governanceDir);
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      return {
        ...asText(renderErrorMarkdown("task.get", `Task not found: ${taskId}`, ["- run `task.list` to discover available IDs", "- retry with an existing task ID"])),
        isError: true,
      };
    }

    const taskLocation = (await findTextReferences(tasksPath, taskId))[0];
    const artifacts = await discoverGovernanceArtifacts(governanceDir);
    const fileCandidates = candidateFilesFromArtifacts(artifacts);
    const referenceLocations = (
      await Promise.all(fileCandidates.map((file) => findTextReferences(file, taskId)))
    ).flat();

    const relatedArtifacts = Array.from(new Set(referenceLocations.map((item) => item.filePath)));
    const suggestedReadOrder = [tasksPath, ...relatedArtifacts.filter((item) => item !== tasksPath)];

    const hookPaths = Object.values(task.hooks)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => path.resolve(governanceDir, value));
    const hookStatus = `head=${taskGetHooks.head ? "loaded" : "missing"}, footer=${taskGetHooks.footer ? "loaded" : "missing"}`;

    const coreMarkdown = [
      "# task.get",
      "",
      "## Summary",
      `- governanceDir: ${governanceDir}`,
      `- taskId: ${task.id}`,
      `- title: ${task.title}`,
      `- status: ${task.status}`,
      `- owner: ${task.owner}`,
      `- updatedAt: ${task.updatedAt}`,
      `- roadmapRefs: ${task.roadmapRefs.join(", ") || "(none)"}`,
      `- taskLocation: ${taskLocation ? `${taskLocation.filePath}#L${taskLocation.line}` : tasksPath}`,
      `- hookStatus: ${hookStatus}`,
      "",
      "## Evidence",
      "### Related Artifacts",
      ...(relatedArtifacts.length > 0 ? relatedArtifacts.map((file) => `- ${file}`) : ["- (none)"]),
      "",
      "### Reference Locations",
      ...(referenceLocations.length > 0
        ? referenceLocations.map((item) => `- ${item.filePath}#L${item.line}: ${item.text}`)
        : ["- (none)"]),
      "",
      "### Hook Paths",
      ...(hookPaths.length > 0 ? hookPaths.map((item) => `- ${item}`) : ["- (none)"]),
      "",
      "### Suggested Read Order",
      ...suggestedReadOrder.map((item, index) => `${index + 1}. ${item}`),
      "",
      "## Agent Guidance",
      "- Read the files in Suggested Read Order.",
      "- Verify whether current status and evidence are consistent.",
      "- If updates are needed, edit tasks/designs/reports markdown directly and keep TASK IDs unchanged.",
      "- After editing, re-run `task.get` to verify references and context consistency.",
    ].join("\n");

    const markdownParts = [
      taskGetHooks.head,
      coreMarkdown,
      taskGetHooks.footer,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    const markdown = markdownParts.join("\n\n---\n\n");
    return asText(markdown);
  }
);

server.registerTool(
  "roadmap.list",
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
      "# roadmap.list",
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
      "- Next: call `roadmap.get` with a roadmap ID to inspect references and related tasks.",
    ].join("\n");

    return asText(markdown);
  }
);

server.registerTool(
  "roadmap.get",
  {
    title: "Roadmap Get",
    description: "Get one roadmap with related task and evidence locations for agent guidance",
    inputSchema: {
      projectPath: z.string(),
      roadmapId: z.string(),
    },
  },
  async ({ projectPath, roadmapId }) => {
    if (!isValidRoadmapId(roadmapId)) {
      return {
        ...asText(renderErrorMarkdown("roadmap.get", `Invalid roadmap ID format: ${roadmapId}`, ["- expected format: ROADMAP-0001", "- retry with a valid roadmap ID"])),
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
      "# roadmap.get",
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
      "- Re-run `roadmap.get` after edits to confirm references remain consistent.",
    ].join("\n");

    return asText(markdown);
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
