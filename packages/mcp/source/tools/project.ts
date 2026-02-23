import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { discoverGovernanceArtifacts, catchIt, PROJECT_LINT_CODES, renderLintSuggestions } from "../common/index.js";
import {
  asText,
  evidenceSection,
  guidanceSection,
  lintSection,
  nextCallSection,
  renderToolResponseMarkdown,
  summarySection,
} from "../common/index.js";
import { collectTaskLintSuggestions, loadTasks, loadTasksDocument, type Task } from "./task.js";

export const PROJECT_MARKER = ".projitive";
const DEFAULT_GOVERNANCE_DIR = ".projitive";

const ignoreNames = new Set(["node_modules", ".git", ".next", "dist", "build"]);
const DEFAULT_SCAN_DEPTH = 3;
const MAX_SCAN_DEPTH = 8;

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

function requireEnvVar(name: "PROJITIVE_SCAN_ROOT_PATH" | "PROJITIVE_SCAN_MAX_DEPTH"): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function resolveScanRoot(inputPath?: string): string {
  const configuredRoot = requireEnvVar("PROJITIVE_SCAN_ROOT_PATH");
  return normalizePath(inputPath ?? configuredRoot);
}

export function resolveScanDepth(inputDepth?: number): number {
  const configuredDepthRaw = requireEnvVar("PROJITIVE_SCAN_MAX_DEPTH");
  const configuredDepth = parseDepthFromEnv(configuredDepthRaw);
  if (typeof configuredDepth !== "number") {
    throw new Error("Invalid PROJITIVE_SCAN_MAX_DEPTH: expected integer in range 0-8");
  }

  if (typeof inputDepth === "number") {
    return inputDepth;
  }
  return configuredDepth;
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
    return {
      tasksPath,
      exists: false,
      tasks: [],
      lintSuggestions: renderLintSuggestions([
        {
          code: PROJECT_LINT_CODES.TASKS_FILE_MISSING,
          message: "tasks.md is missing.",
          fixHint: "Initialize governance tasks structure first.",
        },
      ]),
    };
  }

  const { parseTasksBlock } = await import("./task.js");
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

export function toProjectPath(governanceDir: string): string {
  return path.dirname(governanceDir);
}

async function listChildGovernanceDirs(parentPath: string): Promise<string[]> {
  const entriesResult = await catchIt(fs.readdir(parentPath, { withFileTypes: true }));
  if (entriesResult.isError()) {
    return [];
  }

  const folders = entriesResult.value
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parentPath, entry.name));

  const markerChecks = await Promise.all(
    folders.map(async (folderPath) => ({
      folderPath,
      hasMarker: await hasProjectMarker(folderPath),
    }))
  );

  const candidates = markerChecks
    .filter((item) => item.hasMarker)
    .map((item) => item.folderPath)
    .sort((a, b) => a.localeCompare(b));

  return candidates;
}

async function resolveChildGovernanceDir(parentPath: string): Promise<string | undefined> {
  const candidates = await listChildGovernanceDirs(parentPath);

  if (candidates.length === 0) {
    return undefined;
  }

  const defaultCandidate = path.join(parentPath, DEFAULT_GOVERNANCE_DIR);
  if (candidates.includes(defaultCandidate)) {
    return defaultCandidate;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  throw new Error(`Multiple governance roots found under path: ${parentPath}. Use projectPath/governanceDir explicitly.`);
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

    const childGovernanceDir = await resolveChildGovernanceDir(cursor);
    if (childGovernanceDir) {
      return childGovernanceDir;
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

    const childGovernanceDirs = await listChildGovernanceDirs(currentPath);
    results.push(...childGovernanceDirs);

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
  projectPath: string;
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
    "- roadmapRefs: ROADMAP-0001",
    "- links:",
    "  - (none)",
    "<!-- PROJITIVE:TASKS:END -->",
  ].join("\n");
}

function defaultNoTaskDiscoveryHookMarkdown(): string {
  return [
    "Objective:",
    "- When no actionable task exists, proactively discover meaningful work and convert it into TODO tasks.",
    "",
    "Checklist:",
    "- Check whether code violates project guides/specs; create tasks for each actionable gap.",
    "- Check test coverage improvement opportunities; create tasks for high-value missing tests.",
    "- Check development/testing workflow bottlenecks; create tasks for reliability and speed improvements.",
    "- Check TODO/FIXME/HACK comments; turn feasible items into governed tasks.",
    "- Check dependency/security hygiene and stale tooling; create tasks where upgrades are justified.",
    "",
    "Output Format:",
    "- Candidate findings (3-10)",
    "- Proposed tasks (TASK-xxxx style)",
    "- Priority rationale",
  ].join("\n");
}

export async function initializeProjectStructure(inputPath: string, governanceDir?: string, force = false): Promise<ProjectInitResult> {
  const projectPath = normalizePath(inputPath);
  const governanceDirName = normalizeGovernanceDirName(governanceDir);

  const rootStat = await catchIt(fs.stat(projectPath));
  if (rootStat.isError()) {
    throw new Error(`Path not found: ${projectPath}`);
  }
  if (!rootStat.value.isDirectory()) {
    throw new Error(`projectPath must be a directory: ${projectPath}`);
  }

  const governancePath = path.join(projectPath, governanceDirName);
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
    writeTextFile(path.join(governancePath, "hooks", "task_no_actionable.md"), defaultNoTaskDiscoveryHookMarkdown(), force),
  ]);

  return {
    projectPath,
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
      description: "Bootstrap governance files when a project has no .projitive yet (requires projectPath)",
      inputSchema: {
        projectPath: z.string(),
        governanceDir: z.string().optional(),
        force: z.boolean().optional(),
      },
    },
    async ({ projectPath, governanceDir, force }) => {
      const initialized = await initializeProjectStructure(projectPath, governanceDir, force ?? false);

      const filesByAction = {
        created: initialized.files.filter((item) => item.action === "created"),
        updated: initialized.files.filter((item) => item.action === "updated"),
        skipped: initialized.files.filter((item) => item.action === "skipped"),
      };

      const markdown = renderToolResponseMarkdown({
        toolName: "projectInit",
        sections: [
          summarySection([
            `- projectPath: ${initialized.projectPath}`,
            `- governanceDir: ${initialized.governanceDir}`,
            `- markerPath: ${initialized.markerPath}`,
            `- force: ${force === true ? "true" : "false"}`,
          ]),
          evidenceSection([
            `- createdFiles: ${filesByAction.created.length}`,
            `- updatedFiles: ${filesByAction.updated.length}`,
            `- skippedFiles: ${filesByAction.skipped.length}`,
            "- directories:",
            ...initialized.directories.map((item) => `  - ${item.action}: ${item.path}`),
            "- files:",
            ...initialized.files.map((item) => `  - ${item.action}: ${item.path}`),
          ]),
          guidanceSection([
            "- If files were skipped and you want to overwrite templates, rerun with force=true.",
            "- Continue with projectContext and taskList for execution.",
          ]),
          lintSection([
            "- After init, fill owner/roadmapRefs/links in tasks.md before marking DONE.",
            "- Keep task source-of-truth inside marker block only.",
          ]),
          nextCallSection(`projectContext(projectPath=\"${initialized.projectPath}\")`),
        ],
      });

      return asText(markdown);
    }
  );

  server.registerTool(
    "projectScan",
    {
      title: "Project Scan",
      description: "Start here when project path is unknown; discover all governance roots",
      inputSchema: {},
    },
    async () => {
      const root = resolveScanRoot();
      const depth = resolveScanDepth();
      const projects = await discoverProjects(root, depth);

      const markdown = renderToolResponseMarkdown({
        toolName: "projectScan",
        sections: [
          summarySection([
            `- rootPath: ${root}`,
            `- maxDepth: ${depth}`,
            `- discoveredCount: ${projects.length}`,
          ]),
          evidenceSection([
            "- projects:",
            ...projects.map((project, index) => `${index + 1}. ${project}`),
          ]),
          guidanceSection([
            "- Use one discovered project path and call `projectLocate` to lock governance root.",
            "- Then call `projectContext` to inspect current governance state.",
          ]),
          lintSection(projects.length === 0
            ? ["- No governance root discovered. Add `.projitive` marker and baseline artifacts before execution."]
            : ["- Run `projectContext` on a discovered project to receive module-level lint suggestions."]),
          nextCallSection(projects[0]
            ? `projectLocate(inputPath=\"${projects[0]}\")`
            : undefined),
        ],
      });

      return asText(markdown);
    }
  );

  server.registerTool(
    "projectNext",
    {
      title: "Project Next",
      description: "Rank actionable projects and return the best execution target",
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ limit }) => {
      const root = resolveScanRoot();
      const depth = resolveScanDepth();
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

      const markdown = renderToolResponseMarkdown({
        toolName: "projectNext",
        sections: [
          summarySection([
            `- rootPath: ${root}`,
            `- maxDepth: ${depth}`,
            `- matchedProjects: ${projects.length}`,
            `- actionableProjects: ${ranked.length}`,
            `- limit: ${limit ?? 10}`,
          ]),
          evidenceSection([
            "- rankedProjects:",
            ...ranked.map(
              (item, index) =>
                `${index + 1}. ${item.governanceDir} | actionable=${item.actionable} | in_progress=${item.inProgress} | todo=${item.todo} | blocked=${item.blocked} | done=${item.done} | latest=${item.latestUpdatedAt} | tasksPath=${item.tasksPath}${item.tasksExists ? "" : " (missing)"}`
            ),
          ]),
          guidanceSection([
            "- Pick top 1 project and call `projectContext` with its projectPath.",
            "- Then call `taskList` and `taskContext` to continue execution.",
            "- If `tasksPath` is missing, create tasks.md using project convention before task-level operations.",
          ]),
          lintSection(ranked[0]?.lintSuggestions ?? []),
          nextCallSection(ranked[0]
            ? `projectContext(projectPath=\"${toProjectPath(ranked[0].governanceDir)}\")`
            : undefined),
        ],
      });

      return asText(markdown);
    }
  );

  server.registerTool(
    "projectLocate",
    {
      title: "Project Locate",
      description: "Resolve the nearest governance root from any in-project path",
      inputSchema: {
        inputPath: z.string(),
      },
    },
    async ({ inputPath }) => {
      const resolvedFrom = normalizePath(inputPath);
      const governanceDir = await resolveGovernanceDir(resolvedFrom);
      const projectPath = toProjectPath(governanceDir);
      const markerPath = path.join(governanceDir, ".projitive");

      const markdown = renderToolResponseMarkdown({
        toolName: "projectLocate",
        sections: [
          summarySection([
            `- resolvedFrom: ${resolvedFrom}`,
            `- projectPath: ${projectPath}`,
            `- governanceDir: ${governanceDir}`,
            `- markerPath: ${markerPath}`,
          ]),
          guidanceSection(["- Call `projectContext` with this projectPath to get task and roadmap summaries."]),
          lintSection(["- Run `projectContext` to get governance/module lint suggestions for this project."]),
          nextCallSection(`projectContext(projectPath=\"${projectPath}\")`),
        ],
      });

      return asText(markdown);
    }
  );

  server.registerTool(
    "projectContext",
    {
      title: "Project Context",
      description: "Get project-level summary before selecting or executing a task",
      inputSchema: {
        projectPath: z.string(),
      },
    },
    async ({ projectPath }) => {
      const governanceDir = await resolveGovernanceDir(projectPath);
      const normalizedProjectPath = toProjectPath(governanceDir);
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

      const markdown = renderToolResponseMarkdown({
        toolName: "projectContext",
        sections: [
          summarySection([
            `- projectPath: ${normalizedProjectPath}`,
            `- governanceDir: ${governanceDir}`,
            `- tasksFile: ${tasksPath}`,
            `- roadmapIds: ${roadmapIds.length}`,
          ]),
          evidenceSection([
            "### Task Summary",
            `- total: ${taskSummary.total}`,
            `- TODO: ${taskSummary.TODO}`,
            `- IN_PROGRESS: ${taskSummary.IN_PROGRESS}`,
            `- BLOCKED: ${taskSummary.BLOCKED}`,
            `- DONE: ${taskSummary.DONE}`,
            "",
            "### Artifacts",
            renderArtifactsMarkdown(artifacts),
          ]),
          guidanceSection([
            "- Start from `taskList` to choose a target task.",
            "- Then call `taskContext` with a task ID to retrieve evidence locations and reading order.",
          ]),
          lintSection(lintSuggestions),
          nextCallSection(`taskList(projectPath=\"${normalizedProjectPath}\")`),
        ],
      });

      return asText(markdown);
    }
  );
}
