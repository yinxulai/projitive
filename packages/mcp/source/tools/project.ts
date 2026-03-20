import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  discoverGovernanceArtifacts,
  catchIt,
  PROJECT_LINT_CODES,
  renderLintSuggestions,
  ensureStore,
  replaceRoadmapsInStore,
  replaceTasksInStore,
  markMarkdownViewDirty,
  loadTaskStatusStatsFromStore,
} from '../common/index.js'
import {
  createGovernedTool,
  ToolExecutionError,
  getDefaultToolTemplateMarkdown,
} from '../common/index.js'
import { collectTaskLintSuggestions, loadTasksDocument, loadTasksDocumentWithOptions, renderTasksMarkdown } from './task.js'
import { loadRoadmapDocumentWithOptions, renderRoadmapMarkdown } from './roadmap.js'
import type { RoadmapMilestone } from '../types.js'

export const PROJECT_MARKER = '.projitive'
const DEFAULT_GOVERNANCE_DIR = '.projitive'

const ignoreNames = new Set(['node_modules', '.git', '.next', 'dist', 'build'])
const MAX_SCAN_DEPTH = 8

function normalizePath(inputPath?: string): string {
  return inputPath ? path.resolve(inputPath) : process.cwd()
}

function normalizeGovernanceDirName(input?: string): string {
  const name = input?.trim() || DEFAULT_GOVERNANCE_DIR
  if (!name) {
    throw new Error('governanceDir cannot be empty')
  }
  if (path.isAbsolute(name)) {
    throw new Error('governanceDir must be a relative directory name')
  }
  if (name.includes('/') || name.includes('\\')) {
    throw new Error('governanceDir must not contain path separators')
  }
  if (name === '.' || name === '..') {
    throw new Error('governanceDir must be a normal directory name')
  }
  return name
}

function parseDepthFromEnv(rawDepth: string | undefined): number | undefined {
  if (typeof rawDepth !== 'string' || rawDepth.trim().length === 0) {
    return undefined
  }

  const parsed = Number.parseInt(rawDepth, 10)
  if (!Number.isFinite(parsed)) {
    return undefined
  }

  return Math.min(MAX_SCAN_DEPTH, Math.max(0, parsed))
}

function requireEnvVar(name: 'PROJITIVE_SCAN_ROOT_PATH' | 'PROJITIVE_SCAN_ROOT_PATHS' | 'PROJITIVE_SCAN_MAX_DEPTH'): string {
  const value = process.env[name]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value.trim()
}

function normalizeScanRoots(rootPaths: string[]): string[] {
  const normalized = rootPaths
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => normalizePath(entry))

  return Array.from(new Set(normalized))
}

function parseScanRoots(rawValue: string): string[] {
  const trimmed = rawValue.trim()
  if (trimmed.length === 0) {
    return []
  }
  return trimmed.split(path.delimiter)
}

export function resolveScanRoots(inputPaths?: string[]): string[] {
  const normalizedInputPaths = normalizeScanRoots(inputPaths ?? [])
  if (normalizedInputPaths.length > 0) {
    return normalizedInputPaths
  }

  const configuredRoots = process.env.PROJITIVE_SCAN_ROOT_PATHS
  const rootsFromMultiEnv = typeof configuredRoots === 'string'
    ? normalizeScanRoots(parseScanRoots(configuredRoots))
    : []
  if (rootsFromMultiEnv.length > 0) {
    return rootsFromMultiEnv
  }

  const legacyRoot = process.env.PROJITIVE_SCAN_ROOT_PATH
  const rootsFromLegacyEnv = typeof legacyRoot === 'string'
    ? normalizeScanRoots([legacyRoot])
    : []
  if (rootsFromLegacyEnv.length > 0) {
    return rootsFromLegacyEnv
  }

  throw new Error('Missing required environment variable: PROJITIVE_SCAN_ROOT_PATHS (or legacy PROJITIVE_SCAN_ROOT_PATH)')
}

export function resolveScanRoot(inputPath?: string): string {
  return resolveScanRoots(inputPath ? [inputPath] : undefined)[0]
}

export function resolveScanDepth(inputDepth?: number): number {
  const configuredDepthRaw = requireEnvVar('PROJITIVE_SCAN_MAX_DEPTH')
  const configuredDepth = parseDepthFromEnv(configuredDepthRaw)
  if (typeof configuredDepth !== 'number') {
    throw new Error('Invalid PROJITIVE_SCAN_MAX_DEPTH: expected integer in range 0-8')
  }

  if (typeof inputDepth === 'number') {
    return inputDepth
  }
  return configuredDepth
}

function renderArtifactsMarkdown(artifacts: Awaited<ReturnType<typeof discoverGovernanceArtifacts>>): string {
  const rows = artifacts.map((item) => {
    if (item.kind === 'file') {
      const lineText = item.lineCount == null ? '-' : String(item.lineCount)
      return `- ${item.exists ? '✅' : '❌'} ${item.name}  \n  path: ${item.path}  \n  lineCount: ${lineText}`
    }

    const nested = (item.markdownFiles ?? [])
      .map((entry) => `    - ${entry.path} (lines: ${entry.lineCount})`)
      .join('\n')
    return `- ${item.exists ? '✅' : '❌'} ${item.name}/  \n  path: ${item.path}${nested ? `\n  markdownFiles:\n${nested}` : ''}`
  })

  return rows.join('\n')
}

type TaskSnapshot = {
  exists: boolean;
  lintSuggestions: string[];
  todo: number;
  inProgress: number;
  blocked: number;
  done: number;
  total: number;
  latestUpdatedAt: string;
  score: number;
};

async function readTasksSnapshot(governanceDir: string): Promise<TaskSnapshot> {
  const tasksPath = path.join(governanceDir, PROJECT_MARKER)
  const exists = await fs.access(tasksPath).then(() => true).catch(() => false)
  if (!exists) {
    return {
      exists: false,
      lintSuggestions: renderLintSuggestions([
        {
          code: PROJECT_LINT_CODES.TASKS_FILE_MISSING,
          message: 'governance store is missing.',
          fixHint: 'Initialize governance tasks structure first.',
        },
      ]),
      todo: 0,
      inProgress: 0,
      blocked: 0,
      done: 0,
      total: 0,
      latestUpdatedAt: '(unknown)',
      score: 0,
    }
  }

  await ensureStore(tasksPath)
  const stats = await loadTaskStatusStatsFromStore(tasksPath)
  return {
    exists: true,
    lintSuggestions: [],
    todo: stats.todo,
    inProgress: stats.inProgress,
    blocked: stats.blocked,
    done: stats.done,
    total: stats.total,
    latestUpdatedAt: stats.latestUpdatedAt || '(unknown)',
    score: stats.inProgress * 2 + stats.todo,
  }
}

export async function hasProjectMarker(dirPath: string): Promise<boolean> {
  const markerPath = path.join(dirPath, PROJECT_MARKER)
  const statResult = await catchIt(fs.stat(markerPath))
  if (statResult.isError()) {
    return false
  }
  return statResult.value.isFile()
}

function parentDir(dirPath: string): string | null {
  const parent = path.dirname(dirPath)
  return parent === dirPath ? null : parent
}

export function toProjectPath(governanceDir: string): string {
  return path.dirname(governanceDir)
}

async function listChildGovernanceDirs(parentPath: string): Promise<string[]> {
  const entriesResult = await catchIt(fs.readdir(parentPath, { withFileTypes: true }))
  if (entriesResult.isError()) {
    return []
  }

  const folders = entriesResult.value
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parentPath, entry.name))

  const markerChecks = await Promise.all(
    folders.map(async (folderPath) => ({
      folderPath,
      hasMarker: await hasProjectMarker(folderPath),
    }))
  )

  const candidates = markerChecks
    .filter((item) => item.hasMarker)
    .map((item) => item.folderPath)
    .sort((a, b) => a.localeCompare(b))

  return candidates
}

async function resolveChildGovernanceDir(parentPath: string): Promise<string | undefined> {
  const candidates = await listChildGovernanceDirs(parentPath)

  if (candidates.length === 0) {
    return undefined
  }

  const defaultCandidate = path.join(parentPath, DEFAULT_GOVERNANCE_DIR)
  if (candidates.includes(defaultCandidate)) {
    return defaultCandidate
  }

  if (candidates.length === 1) {
    return candidates[0]
  }

  throw new Error(`Multiple governance roots found under path: ${parentPath}. Use projectPath/governanceDir explicitly.`)
}

export async function resolveGovernanceDir(inputPath: string): Promise<string> {
  const absolutePath = path.resolve(inputPath)
  const statResult = await catchIt(fs.stat(absolutePath))
  if (statResult.isError()) {
    throw new Error(`Path not found: ${absolutePath}`)
  }

  const stat = statResult.value
  let cursor: string | null = stat.isDirectory() ? absolutePath : path.dirname(absolutePath)

  while (cursor) {
    if (await hasProjectMarker(cursor)) {
      return cursor
    }

    const childGovernanceDir = await resolveChildGovernanceDir(cursor)
    if (childGovernanceDir) {
      return childGovernanceDir
    }

    cursor = parentDir(cursor)
  }

  throw new Error(`No ${PROJECT_MARKER} marker found from path: ${absolutePath}`)
}

export async function discoverProjects(rootPath: string, maxDepth: number): Promise<string[]> {
  const results: string[] = []

  async function walk(currentPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) {
      return
    }

    if (await hasProjectMarker(currentPath)) {
      results.push(currentPath)
    }

    const childGovernanceDirs = await listChildGovernanceDirs(currentPath)
    results.push(...childGovernanceDirs)

    const entriesResult = await catchIt(fs.readdir(currentPath, { withFileTypes: true }))
    if (entriesResult.isError()) {
      return
    }

    const entries = entriesResult.value
    const folders = entries.filter((entry) => entry.isDirectory() && !ignoreNames.has(entry.name))
    for (const folder of folders) {
      await walk(path.join(currentPath, folder.name), depth + 1)
    }
  }

  await walk(rootPath, 0)
  return Array.from(new Set(results)).sort()
}

export async function discoverProjectsAcrossRoots(rootPaths: string[], maxDepth: number): Promise<string[]> {
  const perRootResults = await Promise.all(
    rootPaths.map((rootPath) => discoverProjects(rootPath, maxDepth))
  )

  return Array.from(new Set(perRootResults.flat())).sort()
}

type InitArtifactResult = {
  path: string;
  action: 'created' | 'updated' | 'skipped';
};

type ProjectInitResult = {
  projectPath: string;
  governanceDir: string;
  directories: InitArtifactResult[];
  files: InitArtifactResult[];
};

const DEFAULT_TOOL_TEMPLATE_NAMES = [
  'projectInit',
  'projectScan',
  'projectNext',
  'projectLocate',
  'projectContext',
  'syncViews',
  'taskList',
  'taskNext',
  'taskContext',
  'taskCreate',
  'taskUpdate',
  'roadmapList',
  'roadmapContext',
  'roadmapCreate',
  'roadmapUpdate',
]

async function pathExists(targetPath: string): Promise<boolean> {
  const accessResult = await catchIt(fs.access(targetPath))
  return !accessResult.isError()
}

async function writeTextFile(targetPath: string, content: string, force: boolean): Promise<InitArtifactResult> {
  const exists = await pathExists(targetPath)
  if (exists && !force) {
    return { path: targetPath, action: 'skipped' }
  }

  await fs.writeFile(targetPath, content, 'utf-8')
  return { path: targetPath, action: exists ? 'updated' : 'created' }
}

function defaultReadmeMarkdown(governanceDirName: string): string {
  return [
    '# Projitive Governance Workspace',
    '',
    `This directory (\`${governanceDirName}/\`) is the governance root for this project.`,
    '',
    '## Conventions',
    '- Keep roadmap/task source of truth in .projitive governance store.',
    '- Treat roadmap.md/tasks.md as generated views from governance store.',
    '- Keep IDs stable (TASK-xxxx / ROADMAP-xxxx).',
    '- Update report evidence before status transitions.',
  ].join('\n')
}

function defaultRoadmapMarkdown(milestones: RoadmapMilestone[] = defaultRoadmapMilestones()): string {
  return renderRoadmapMarkdown(milestones)
}

function defaultTasksMarkdown(updatedAt = new Date().toISOString()): string {
  return renderTasksMarkdown([
    {
      id: 'TASK-0001',
      title: 'Bootstrap governance workspace',
      status: 'TODO',
      owner: 'unassigned',
      summary: 'Create initial governance artifacts and confirm task execution loop.',
      updatedAt,
      links: [],
      roadmapRefs: ['ROADMAP-0001'],
    },
  ])
}

function defaultRoadmapMilestones(): RoadmapMilestone[] {
  return [{
    id: 'ROADMAP-0001',
    title: 'Bootstrap governance baseline',
    status: 'active',
    time: '2026-Q1',
    updatedAt: new Date().toISOString(),
  }]
}

function defaultTemplateReadmeMarkdown(): string {
  return [
    '# Template Guide',
    '',
    'This directory stores response templates (one file per tool).',
    '',
    'How to enable:',
    '- Set env `PROJITIVE_MESSAGE_TEMPLATE_PATH` to a template directory.',
    '- Example: .projitive/templates/tools',
    '',
    'Rule:',
    '- Prefer one template per tool: <toolName>.md (e.g. taskNext.md).',
    '- Template directory mode only loads <toolName>.md files.',
    '- If a tool template file is missing, Projitive will auto-generate that file before rendering.',
    '- Include {{content}} to render original tool output.',
    '- If {{content}} is missing, original output is appended after template text.',
    '',
    'Basic Variables:',
    '- {{tool_name}}',
    '- {{summary}}',
    '- {{evidence}}',
    '- {{guidance}}',
    '- {{next_call}}',
    '- {{content}}',
  ].join('\n')
}

export async function initializeProjectStructure(inputPath: string, governanceDir?: string, force = false): Promise<ProjectInitResult> {
  const projectPath = normalizePath(inputPath)
  const governanceDirName = normalizeGovernanceDirName(governanceDir)

  const rootStat = await catchIt(fs.stat(projectPath))
  if (rootStat.isError()) {
    throw new Error(`Path not found: ${projectPath}`)
  }
  if (!rootStat.value.isDirectory()) {
    throw new Error(`projectPath must be a directory: ${projectPath}`)
  }

  const governancePath = path.join(projectPath, governanceDirName)
  const directories: InitArtifactResult[] = []

  const requiredDirectories = [
    governancePath,
    path.join(governancePath, 'designs'),
    path.join(governancePath, 'reports'),
    path.join(governancePath, 'templates'),
    path.join(governancePath, 'templates', 'tools'),
  ]
  for (const dirPath of requiredDirectories) {
    const exists = await pathExists(dirPath)
    await fs.mkdir(dirPath, { recursive: true })
    directories.push({ path: dirPath, action: exists ? 'skipped' : 'created' })
  }

  const markerPath = path.join(governancePath, PROJECT_MARKER)
  const defaultRoadmapData = defaultRoadmapMilestones()
  const defaultTaskUpdatedAt = new Date().toISOString()
  const markerExists = await pathExists(markerPath)

  await ensureStore(markerPath)
  if (force || !markerExists) {
    await replaceRoadmapsInStore(markerPath, defaultRoadmapData)
    await replaceTasksInStore(markerPath, [
      {
        id: 'TASK-0001',
        title: 'Bootstrap governance workspace',
        status: 'TODO',
        owner: 'unassigned',
        summary: 'Create initial governance artifacts and confirm task execution loop.',
        updatedAt: defaultTaskUpdatedAt,
        links: [],
        roadmapRefs: ['ROADMAP-0001'],
      },
    ])
  }

  const baseFiles = await Promise.all([
    writeTextFile(path.join(governancePath, 'README.md'), defaultReadmeMarkdown(governanceDirName), force),
    writeTextFile(path.join(governancePath, 'roadmap.md'), defaultRoadmapMarkdown(defaultRoadmapData), force),
    writeTextFile(path.join(governancePath, 'tasks.md'), defaultTasksMarkdown(defaultTaskUpdatedAt), force),
    writeTextFile(path.join(governancePath, 'templates', 'README.md'), defaultTemplateReadmeMarkdown(), force),
  ])

  const toolTemplateFiles = await Promise.all(
    DEFAULT_TOOL_TEMPLATE_NAMES.map((toolName) =>
      writeTextFile(path.join(governancePath, 'templates', 'tools', `${toolName}.md`), getDefaultToolTemplateMarkdown(toolName), force)
    )
  )

  const files = [...baseFiles, ...toolTemplateFiles]

  return {
    projectPath,
    governanceDir: governancePath,
    directories,
    files,
  }
}

export function registerProjectTools(server: McpServer): void {
  server.registerTool(
    ...createGovernedTool({
      name: 'projectInit',
      title: 'Project Init',
      description: 'Bootstrap governance files when a project has no .projitive yet (requires projectPath)',
      inputSchema: {
        projectPath: z.string(),
        governanceDir: z.string().optional(),
        force: z.boolean().optional(),
      },
      async execute({ projectPath, governanceDir, force }) {
        const initialized = await initializeProjectStructure(projectPath, governanceDir, force ?? false)
        const filesByAction = {
          created: initialized.files.filter((item) => item.action === 'created'),
          updated: initialized.files.filter((item) => item.action === 'updated'),
          skipped: initialized.files.filter((item) => item.action === 'skipped'),
        }
        return { initialized, filesByAction, force: force ?? false }
      },
      primary: ({ initialized, force }) => [
        `- projectPath: ${initialized.projectPath}`,
        `- governanceDir: ${initialized.governanceDir}`,
        `- force: ${force ? 'true' : 'false'}`,
      ],
      evidence: ({ initialized, filesByAction }) => [
        `- createdFiles: ${filesByAction.created.length}`,
        `- updatedFiles: ${filesByAction.updated.length}`,
        `- skippedFiles: ${filesByAction.skipped.length}`,
        '- directories:',
        ...initialized.directories.map((item) => `  - ${item.action}: ${item.path}`),
        '- files:',
        ...initialized.files.map((item) => `  - ${item.action}: ${item.path}`),
      ],
      guidance: () => [
        '- If files were skipped and you want to overwrite templates, rerun with force=true.',
        '- Continue with projectContext and taskList for execution.',
      ],
      lint: () => [
        '- After init, fill owner/roadmapRefs/links in .projitive task table before marking DONE.',
        '- Keep task source-of-truth inside .projitive governance store.',
      ],
      nextCall: ({ initialized }) => `projectContext(projectPath="${initialized.projectPath}")`,
    })
  )

  server.registerTool(
    ...createGovernedTool({
      name: 'projectScan',
      title: 'Project Scan',
      description: 'Start here when project path is unknown; discover all governance roots',
      inputSchema: {},
      async execute() {
        const roots = resolveScanRoots()
        const depth = resolveScanDepth()
        const governanceDirs = await discoverProjectsAcrossRoots(roots, depth)
        const projects = Array.from(new Set(governanceDirs.map((governanceDir) => toProjectPath(governanceDir)))).sort()
        return { roots, depth, projects }
      },
      primary: ({ roots, depth, projects }) => [
        `- rootPaths: ${roots.join(', ')}`,
        `- rootCount: ${roots.length}`,
        `- maxDepth: ${depth}`,
        `- discoveredCount: ${projects.length}`,
      ],
      evidence: ({ projects }) => [
        '- projects:',
        ...projects.map((project, index) => `${index + 1}. ${project}`),
      ],
      guidance: () => [
        '- Use one discovered project path and call `projectLocate` to lock governance root.',
        '- Then call `projectContext` to inspect current governance state.',
      ],
      lint: ({ projects }) =>
        projects.length === 0
          ? ['- No governance root discovered. Add `.projitive` marker and baseline artifacts before execution.']
          : ['- Run `projectContext` on a discovered project to receive module-level lint suggestions.'],
      nextCall: ({ projects }) =>
        projects[0] ? `projectLocate(inputPath="${projects[0]}")` : undefined,
    })
  )

  server.registerTool(
    ...createGovernedTool({
      name: 'projectNext',
      title: 'Project Next',
      description: 'Rank actionable projects and return the best execution target',
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional(),
      },
      async execute({ limit }) {
        const roots = resolveScanRoots()
        const depth = resolveScanDepth()
        const projects = await discoverProjectsAcrossRoots(roots, depth)
        const snapshots = await Promise.all(
          projects.map(async (governanceDir) => {
            const snapshot = await readTasksSnapshot(governanceDir)
            const actionable = snapshot.inProgress + snapshot.todo
            return {
              governanceDir,
              tasksExists: snapshot.exists,
              lintSuggestions: snapshot.lintSuggestions,
              inProgress: snapshot.inProgress,
              todo: snapshot.todo,
              blocked: snapshot.blocked,
              done: snapshot.done,
              actionable,
              latestUpdatedAt: snapshot.latestUpdatedAt,
              score: snapshot.score,
            }
          })
        )
        const ranked = snapshots
          .filter((item) => item.actionable > 0)
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score
            return b.latestUpdatedAt.localeCompare(a.latestUpdatedAt)
          })
          .slice(0, limit ?? 10)
        const topTasks = ranked[0] ? (await loadTasksDocument(ranked[0].governanceDir)).tasks : undefined
        return { roots, depth, projects, ranked, limit: limit ?? 10, topTasks }
      },
      primary: ({ roots, depth, projects, ranked, limit }) => [
        `- rootPaths: ${roots.join(', ')}`,
        `- rootCount: ${roots.length}`,
        `- maxDepth: ${depth}`,
        `- matchedProjects: ${projects.length}`,
        `- actionableProjects: ${ranked.length}`,
        `- limit: ${limit}`,
      ],
      evidence: ({ ranked }) => [
        '- rankedProjects:',
        ...ranked.map(
          (item, index) =>
            `${index + 1}. ${toProjectPath(item.governanceDir)} | actionable=${item.actionable} | in_progress=${item.inProgress} | todo=${item.todo} | blocked=${item.blocked} | done=${item.done} | latest=${item.latestUpdatedAt}${item.tasksExists ? '' : ' | store=missing'}`,
        ),
      ],
      guidance: () => [
        '- Pick top 1 project and call `projectContext` with its projectPath.',
        '- Then call `taskList` and `taskContext` to continue execution.',
        '- If governance store is missing, initialize governance before task-level operations.',
      ],
      lint: ({ topTasks }) => topTasks ? collectTaskLintSuggestions(topTasks) : [],
      nextCall: ({ ranked }) =>
        ranked[0] ? `projectContext(projectPath="${toProjectPath(ranked[0].governanceDir)}")` : undefined,
    })
  )

  server.registerTool(
    ...createGovernedTool({
      name: 'projectLocate',
      title: 'Project Locate',
      description: 'Resolve the nearest governance root from any in-project path',
      inputSchema: {
        inputPath: z.string(),
      },
      async execute({ inputPath }) {
        const resolvedFrom = normalizePath(inputPath)
        const governanceDir = await resolveGovernanceDir(resolvedFrom)
        const projectPath = toProjectPath(governanceDir)
        return { resolvedFrom, governanceDir, projectPath }
      },
      primary: ({ resolvedFrom, projectPath, governanceDir }) => [
        `- resolvedFrom: ${resolvedFrom}`,
        `- projectPath: ${projectPath}`,
        `- governanceDir: ${governanceDir}`,
      ],
      guidance: () => ['- Call `projectContext` with this projectPath to get task and roadmap summaries.'],
      lint: () => ['- Run `projectContext` to get governance/module lint suggestions for this project.'],
      nextCall: ({ projectPath }) => `projectContext(projectPath="${projectPath}")`,
    })
  )

  server.registerTool(
    ...createGovernedTool({
      name: 'syncViews',
      title: 'Sync Views',
      description: 'Materialize markdown views from .projitive governance store (tasks.md / roadmap.md)',
      inputSchema: {
        projectPath: z.string(),
        views: z.array(z.enum(['tasks', 'roadmap'])).optional(),
        force: z.boolean().optional(),
      },
      async execute({ projectPath, views, force }) {
        const governanceDir = await resolveGovernanceDir(projectPath)
        const normalizedProjectPath = toProjectPath(governanceDir)
        const tasksViewPath = path.join(governanceDir, 'tasks.md')
        const roadmapViewPath = path.join(governanceDir, 'roadmap.md')
        const dbPath = path.join(governanceDir, PROJECT_MARKER)
        const selectedViews = views && views.length > 0 ? Array.from(new Set(views)) : ['tasks', 'roadmap']
        const forceSync = force === true
        if (forceSync) {
          if (selectedViews.includes('tasks')) await markMarkdownViewDirty(dbPath, 'tasks_markdown')
          if (selectedViews.includes('roadmap')) await markMarkdownViewDirty(dbPath, 'roadmaps_markdown')
        }
        let taskCount: number | undefined
        let roadmapCount: number | undefined
        if (selectedViews.includes('tasks')) {
          const taskDoc = await loadTasksDocumentWithOptions(governanceDir, forceSync)
          taskCount = taskDoc.tasks.length
        }
        if (selectedViews.includes('roadmap')) {
          const roadmapDoc = await loadRoadmapDocumentWithOptions(governanceDir, forceSync)
          roadmapCount = roadmapDoc.milestones.length
        }
        return { normalizedProjectPath, governanceDir, tasksViewPath, roadmapViewPath, selectedViews, forceSync, taskCount, roadmapCount }
      },
      primary: ({ normalizedProjectPath, governanceDir, tasksViewPath, roadmapViewPath, selectedViews, forceSync }) => [
        `- projectPath: ${normalizedProjectPath}`,
        `- governanceDir: ${governanceDir}`,
        `- tasksView: ${tasksViewPath}`,
        `- roadmapView: ${roadmapViewPath}`,
        `- views: ${selectedViews.join(', ')}`,
        `- force: ${forceSync ? 'true' : 'false'}`,
      ],
      evidence: ({ taskCount, roadmapCount }) => [
        ...(typeof taskCount === 'number' ? [`- tasks.md synced | taskCount=${taskCount}`] : []),
        ...(typeof roadmapCount === 'number' ? [`- roadmap.md synced | roadmapCount=${roadmapCount}`] : []),
      ],
      guidance: () => [
        'Use this tool after batch updates when you need immediate markdown materialization.',
        'Routine workflows can rely on lazy sync and usually do not require force=true.',
      ],
      lint: () => [],
      nextCall: ({ normalizedProjectPath }) => `projectContext(projectPath="${normalizedProjectPath}")`,
    })
  )

  server.registerTool(
    ...createGovernedTool({
      name: 'projectContext',
      title: 'Project Context',
      description: 'Get project-level summary before selecting or executing a task',
      inputSchema: {
        projectPath: z.string(),
      },
      async execute({ projectPath }) {
        const governanceDir = await resolveGovernanceDir(projectPath)
        const normalizedProjectPath = toProjectPath(governanceDir)
        const artifacts = await discoverGovernanceArtifacts(governanceDir)
        const dbPath = path.join(governanceDir, PROJECT_MARKER)
        await ensureStore(dbPath)
        const taskStats = await loadTaskStatusStatsFromStore(dbPath)
        const { markdownPath: tasksMarkdownPath, tasks } = await loadTasksDocument(governanceDir)
        const { markdownPath: roadmapMarkdownPath, milestones } = await loadRoadmapDocumentWithOptions(governanceDir, false)
        const roadmapIds = milestones.map((item) => item.id)
        return { normalizedProjectPath, governanceDir, tasksMarkdownPath, roadmapMarkdownPath, roadmapIds, taskStats, artifacts, tasks }
      },
      primary: ({ normalizedProjectPath, governanceDir, tasksMarkdownPath, roadmapMarkdownPath, roadmapIds }) => [
        `- projectPath: ${normalizedProjectPath}`,
        `- governanceDir: ${governanceDir}`,
        `- tasksView: ${tasksMarkdownPath}`,
        `- roadmapView: ${roadmapMarkdownPath}`,
        `- roadmapIds: ${roadmapIds.length}`,
      ],
      evidence: ({ taskStats, artifacts }) => [
        '### Task Summary',
        `- total: ${taskStats.total}`,
        `- TODO: ${taskStats.todo}`,
        `- IN_PROGRESS: ${taskStats.inProgress}`,
        `- BLOCKED: ${taskStats.blocked}`,
        `- DONE: ${taskStats.done}`,
        '',
        '### Artifacts',
        renderArtifactsMarkdown(artifacts),
      ],
      guidance: () => [
        '- Start from `taskList` to choose a target task.',
        '- Then call `taskContext` with a task ID to retrieve evidence locations and reading order.',
      ],
      lint: ({ tasks }) => collectTaskLintSuggestions(tasks),
      nextCall: ({ normalizedProjectPath }) => `taskList(projectPath="${normalizedProjectPath}")`,
    })
  )
}
