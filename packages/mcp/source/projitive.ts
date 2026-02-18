import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { discoverGovernanceArtifacts } from "./helpers/files/index.js";
import { catchIt } from "./helpers/catch/index.js";
import { collectTaskLintSuggestions, loadTasks, loadTasksDocument, type Task } from "./tasks.js";

export const PROJECT_MARKER = ".projitive";
const DEFAULT_GOVERNANCE_DIR = ".projitive";

const ignoreNames = new Set(["node_modules", ".git", ".next", "dist", "build"]);
const DEFAULT_SCAN_DEPTH = 3;
const MAX_SCAN_DEPTH = 8;

function asText(markdown: string) {
  return {
    content: [{ type: "text" as const, text: markdown }],
  };
}

function normalizePath(inputPath?: string): string {
  return inputPath ? path.resolve(inputPath) : process.cwd();
}

function normalizeGovernanceDirName(input?: string): string {
  const name = input?.trim() || DEFAULT_GOVERNANCE_DIR;
  if (!name) {
    throw new Error("governanceDir cannot be empty");
  }
  if (path.isAbsolute(name)) {
    throw new Error("governanceDir must be a relative directory name");
  }
  if (name.includes("/") || name.includes("\\")) {
    throw new Error("governanceDir must not contain path separators");
  }
  if (name === "." || name === "..") {
    throw new Error("governanceDir must be a normal directory name");
  }
  return name;
}

function parseDepthFromEnv(rawDepth: string | undefined): number | undefined {
  if (typeof rawDepth !== "string" || rawDepth.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(rawDepth, 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.min(MAX_SCAN_DEPTH, Math.max(0, parsed));
}

export function resolveScanRoot(inputPath?: string): string {
  const fallback = process.env.PROJITIVE_SCAN_ROOT_PATH;
  return normalizePath(inputPath ?? fallback);
}

export function resolveScanDepth(inputDepth?: number): number {
  if (typeof inputDepth === "number") {
    return inputDepth;
  }
  return parseDepthFromEnv(process.env.PROJITIVE_SCAN_MAX_DEPTH) ?? DEFAULT_SCAN_DEPTH;
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

async function readTasksSnapshot(governanceDir: string): Promise<{ tasksPath: string; exists: boolean; tasks: Task[]; lintSuggestions: string[] }> {
  const tasksPath = path.join(governanceDir, "tasks.md");
  const markdown = await fs.readFile(tasksPath, "utf-8").catch(() => undefined);
  if (typeof markdown !== "string") {
    return { tasksPath, exists: false, tasks: [], lintSuggestions: ["- tasks.md is missing. Initialize governance tasks structure first."] };
  }

  const { parseTasksBlock } = await import("./tasks.js");
  const tasks = await parseTasksBlock(markdown);
  return { tasksPath, exists: true, tasks, lintSuggestions: collectTaskLintSuggestions(tasks, markdown) };
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

type InitArtifactResult = {
  path: string;
  action: "created" | "updated" | "skipped";
};

type ProjectInitResult = {
  rootPath: string;
  governanceDir: string;
  markerPath: string;
  directories: InitArtifactResult[];
  files: InitArtifactResult[];
};

async function pathExists(targetPath: string): Promise<boolean> {
  const accessResult = await catchIt(fs.access(targetPath));
  return !accessResult.isError();
}

async function writeTextFile(targetPath: string, content: string, force: boolean): Promise<InitArtifactResult> {
  const exists = await pathExists(targetPath);
  if (exists && !force) {
    return { path: targetPath, action: "skipped" };
  }

  await fs.writeFile(targetPath, content, "utf-8");
  return { path: targetPath, action: exists ? "updated" : "created" };
}

function defaultReadmeMarkdown(governanceDirName: string): string {
  return [
    "# Projitive Governance Workspace",
    "",
    `This directory (\`${governanceDirName}/\`) is the governance root for this project.`,
    "",
    "## Conventions",
    "- Keep roadmap/task/design/report files in markdown.",
    "- Keep IDs stable (TASK-xxxx / ROADMAP-xxxx).",
    "- Update report evidence before status transitions.",
  ].join("\n");
}

function defaultRoadmapMarkdown(): string {
  return [
    "# Roadmap",
    "",
    "## Active Milestones",
    "- [ ] ROADMAP-0001: Bootstrap governance baseline (time: 2026-Q1)",
  ].join("\n");
}

function defaultTasksMarkdown(): string {
  const updatedAt = new Date().toISOString();
  return [
    "# Tasks",
    "",
    "<!-- PROJITIVE:TASKS:START -->",
    "## TASK-0001 | TODO | Bootstrap governance workspace",
    "- owner: unassigned",
    "- summary: Create initial governance artifacts and confirm task execution loop.",
    `- updatedAt: ${updatedAt}`,
    "- links:",
    "- roadmapRefs: ROADMAP-0001",
    "- hooks:",
    "<!-- PROJITIVE:TASKS:END -->",
  ].join("\n");
}

export async function initializeProjectStructure(inputPath?: string, governanceDir?: string, force = false): Promise<ProjectInitResult> {
  const rootPath = normalizePath(inputPath);
  const governanceDirName = normalizeGovernanceDirName(governanceDir);

  const rootStat = await catchIt(fs.stat(rootPath));
  if (rootStat.isError()) {
    throw new Error(`Path not found: ${rootPath}`);
  }
  if (!rootStat.value.isDirectory()) {
    throw new Error(`rootPath must be a directory: ${rootPath}`);
  }

  const governancePath = path.join(rootPath, governanceDirName);
  const directories: InitArtifactResult[] = [];

  const requiredDirectories = [governancePath, path.join(governancePath, "designs"), path.join(governancePath, "reports"), path.join(governancePath, "hooks")];
  for (const dirPath of requiredDirectories) {
    const exists = await pathExists(dirPath);
    await fs.mkdir(dirPath, { recursive: true });
    directories.push({ path: dirPath, action: exists ? "skipped" : "created" });
  }

  const markerPath = path.join(governancePath, PROJECT_MARKER);
  const files = await Promise.all([
    writeTextFile(markerPath, "", force),
    writeTextFile(path.join(governancePath, "README.md"), defaultReadmeMarkdown(governanceDirName), force),
    writeTextFile(path.join(governancePath, "roadmap.md"), defaultRoadmapMarkdown(), force),
    writeTextFile(path.join(governancePath, "tasks.md"), defaultTasksMarkdown(), force),
  ]);

  return {
    rootPath,
    governanceDir: governancePath,
    markerPath,
    directories,
    files,
  };
}

export function registerProjectTools(server: McpServer): void {
  server.registerTool(
    "projectInit",
    {
      title: "Project Init",
      description: "Initialize Projitive governance directory structure manually (default .projitive)",
      inputSchema: {
        rootPath: z.string().optional(),
        governanceDir: z.string().optional(),
        force: z.boolean().optional(),
      },
    },
    async ({ rootPath, governanceDir, force }) => {
      const initialized = await initializeProjectStructure(rootPath, governanceDir, force ?? false);

      const filesByAction = {
        created: initialized.files.filter((item) => item.action === "created"),
        updated: initialized.files.filter((item) => item.action === "updated"),
        skipped: initialized.files.filter((item) => item.action === "skipped"),
      };

      const markdown = [
        "# projectInit",
        "",
        "## Summary",
        `- rootPath: ${initialized.rootPath}`,
        `- governanceDir: ${initialized.governanceDir}`,
        `- markerPath: ${initialized.markerPath}`,
        `- force: ${force === true ? "true" : "false"}`,
        "",
        "## Evidence",
        `- createdFiles: ${filesByAction.created.length}`,
        `- updatedFiles: ${filesByAction.updated.length}`,
        `- skippedFiles: ${filesByAction.skipped.length}`,
        "- directories:",
        ...initialized.directories.map((item) => `  - ${item.action}: ${item.path}`),
        "- files:",
        ...initialized.files.map((item) => `  - ${item.action}: ${item.path}`),
        "",
        "## Agent Guidance",
        "- If files were skipped and you want to overwrite templates, rerun with force=true.",
        "- Continue with projectContext and taskList for execution.",
        "",
        "## Lint Suggestions",
        "- After init, fill owner/roadmapRefs/links in tasks.md before marking DONE.",
        "- Keep task source-of-truth inside marker block only.",
        "",
        "## Next Call",
        `- projectContext(projectPath=\"${initialized.governanceDir}\")`,
      ].join("\n");

      return asText(markdown);
    }
  );

  server.registerTool(
    "projectScan",
    {
      title: "Project Scan",
      description: "Scan filesystem and discover project governance roots marked by .projitive",
      inputSchema: {
        rootPath: z.string().optional(),
        maxDepth: z.number().int().min(0).max(8).optional(),
      },
    },
    async ({ rootPath, maxDepth }) => {
      const root = resolveScanRoot(rootPath);
      const depth = resolveScanDepth(maxDepth);
      const projects = await discoverProjects(root, depth);

      const markdown = [
        "# projectScan",
        "",
        "## Summary",
        `- rootPath: ${root}`,
        `- maxDepth: ${depth}`,
        `- discoveredCount: ${projects.length}`,
        "",
        "## Evidence",
        "- projects:",
        ...(projects.length > 0 ? projects.map((project, index) => `${index + 1}. ${project}`) : ["- (none)"]),
        "",
        "## Agent Guidance",
        "- Use one discovered project path and call `projectLocate` to lock governance root.",
        "- Then call `projectContext` to inspect current governance state.",
        "",
        "## Lint Suggestions",
        ...(projects.length === 0
          ? ["- No governance root discovered. Add `.projitive` marker and baseline artifacts before execution."]
          : ["- Run `projectContext` on a discovered project to receive module-level lint suggestions."]),
        "",
        "## Next Call",
        ...(projects.length > 0
          ? [`- projectLocate(inputPath=\"${projects[0]}\")`]
          : ["- (none)"]),
      ].join("\n");

      return asText(markdown);
    }
  );

  server.registerTool(
    "projectNext",
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
      const root = resolveScanRoot(rootPath);
      const depth = resolveScanDepth(maxDepth);
      const projects = await discoverProjects(root, depth);
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
            lintSuggestions: snapshot.lintSuggestions,
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
        "# projectNext",
        "",
        "## Summary",
        `- rootPath: ${root}`,
        `- maxDepth: ${depth}`,
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
        "- Pick top 1 project and call `projectContext` with its governanceDir.",
        "- Then call `taskList` and `taskContext` to continue execution.",
        "- If `tasksPath` is missing, create tasks.md using project convention before task-level operations.",
        "",
        "## Lint Suggestions",
        ...(ranked.length > 0
          ? ranked[0].lintSuggestions.length > 0
            ? ranked[0].lintSuggestions
            : ["- (none)"]
          : ["- (none)"]),
        "",
        "## Next Call",
        ...(ranked.length > 0
          ? [`- projectContext(projectPath=\"${ranked[0].governanceDir}\")`]
          : ["- (none)"]),
      ].join("\n");

      return asText(markdown);
    }
  );

  server.registerTool(
    "projectLocate",
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
        "# projectLocate",
        "",
        "## Summary",
        `- resolvedFrom: ${resolvedFrom}`,
        `- governanceDir: ${governanceDir}`,
        `- markerPath: ${markerPath}`,
        "",
        "## Agent Guidance",
        "- Call `projectContext` with this governanceDir to get task and roadmap summaries.",
        "",
        "## Lint Suggestions",
        "- Run `projectContext` to get governance/module lint suggestions for this project.",
        "",
        "## Next Call",
        `- projectContext(projectPath=\"${governanceDir}\")`,
      ].join("\n");

      return asText(markdown);
    }
  );

  server.registerTool(
    "projectContext",
    {
      title: "Project Context",
      description: "Summarize project governance context for task execution planning",
      inputSchema: {
        projectPath: z.string(),
      },
    },
    async ({ projectPath }) => {
      const governanceDir = await resolveGovernanceDir(projectPath);
      const artifacts = await discoverGovernanceArtifacts(governanceDir);
      const { tasksPath, tasks, markdown: tasksMarkdown } = await loadTasksDocument(governanceDir);
      const roadmapIds = await readRoadmapIds(governanceDir);
      const lintSuggestions = collectTaskLintSuggestions(tasks, tasksMarkdown);

      const taskSummary = {
        total: tasks.length,
        TODO: tasks.filter((task) => task.status === "TODO").length,
        IN_PROGRESS: tasks.filter((task) => task.status === "IN_PROGRESS").length,
        BLOCKED: tasks.filter((task) => task.status === "BLOCKED").length,
        DONE: tasks.filter((task) => task.status === "DONE").length,
      };

      const markdown = [
        "# projectContext",
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
        "- Start from `taskList` to choose a target task.",
        "- Then call `taskContext` with a task ID to retrieve evidence locations and reading order.",
        "",
        "## Lint Suggestions",
        ...(lintSuggestions.length > 0 ? lintSuggestions : ["- (none)"]),
        "",
        "## Next Call",
        `- taskList(projectPath=\"${governanceDir}\")`,
      ].join("\n");

      return asText(markdown);
    }
  );
}
