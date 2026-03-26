import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  candidateFilesFromArtifacts,
  discoverGovernanceArtifacts,
  catchIt,
  PROJECT_LINT_CODES,
  renderLintSuggestions,
  ensureStore,
  loadRoadmapsFromStore,
  loadTasksFromStore,
  replaceRoadmapsInStore,
  replaceTasksInStore,
  loadTaskStatusStatsFromStore,
  upsertRoadmapInStore,
  upsertTaskInStore,
  createGovernedTool,
  getDefaultToolTemplateMarkdown,
} from '../common/index.js'
import {
  collectProjectContextDocsLintSuggestions,
  collectTaskLintSuggestions,
  CORE_ARCHITECTURE_DOC_FILE,
  CORE_CODE_STYLE_DOC_FILE,
  CORE_UI_STYLE_DOC_FILE,
  inspectProjectContextDocsFromArtifacts,
  loadTasksDocument,
  loadTasksDocumentWithOptions,
  renderTasksMarkdown,
} from './task.js'
import { loadRoadmapDocumentWithOptions, renderRoadmapMarkdown } from './roadmap.js'
import type { RoadmapMilestone } from '../types.js'

export const PROJECT_MARKER = '.projitive'
const DEFAULT_GOVERNANCE_DIR = '.projitive'

const ignoreNames = new Set(['node_modules', '.git', '.next', 'dist', 'build'])
const MAX_SCAN_DEPTH = 8
const DEFAULT_SCAN_DEPTH = 3

function normalizePath(inputPath?: string): string {
  return inputPath ? path.resolve(inputPath) : process.cwd()
}

function normalizeGovernanceDirName(input?: string): string {
  const name = input?.trim() || DEFAULT_GOVERNANCE_DIR
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

function parseDepthFromEnv(rawDepth: string): number | undefined {
  const parsed = Number.parseInt(rawDepth, 10)
  if (!Number.isFinite(parsed)) {
    return undefined
  }

  return Math.min(MAX_SCAN_DEPTH, Math.max(0, parsed))
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

  return [os.homedir()]
}

export function resolveScanRoot(inputPath?: string): string {
  return resolveScanRoots(inputPath ? [inputPath] : undefined)[0]
}

export function resolveScanDepth(inputDepth?: number): number {
  if (typeof inputDepth === 'number') {
    return inputDepth
  }

  const configuredDepthRaw = process.env.PROJITIVE_SCAN_MAX_DEPTH
  if (typeof configuredDepthRaw === 'string' && configuredDepthRaw.trim().length > 0) {
    const configuredDepth = parseDepthFromEnv(configuredDepthRaw)
    if (typeof configuredDepth !== 'number') {
      throw new Error('Invalid PROJITIVE_SCAN_MAX_DEPTH: expected integer in range 0-8')
    }
    return configuredDepth
  }

  return DEFAULT_SCAN_DEPTH
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
  missingBeforeInit: ProjectInitMissingState;
  remediation: ProjectInitRemediation;
};

type BootstrapTaskBlueprint = {
  title: string;
  summary: string;
  links: string[];
};

type ProjectInitMissingState = {
  markerMissing: boolean;
  missingDirectories: string[];
  missingFiles: string[];
  missingBootstrapTaskTitles: string[];
  missingBootstrapRoadmap: boolean;
};

type ProjectInitRemediation = {
  createdBootstrapTaskIds: string[];
  createdBootstrapRoadmapId?: string;
};

type ProjectInitMissingClassification = {
  coreDocs: string[];
  templates: string[];
  bootstrapTasks: string[];
  otherFiles: string[];
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
    '- Maintain core docs under designs/core/: architecture.md, code-style.md, ui-style.md.',
    '- After each task completion, review whether architecture, code conventions, or UI rules changed and update the matching core docs.',
  ].join('\n')
}

function defaultRoadmapMarkdown(milestones: RoadmapMilestone[] = defaultRoadmapMilestones()): string {
  return renderRoadmapMarkdown(milestones)
}

function defaultTasksMarkdown(updatedAt = new Date().toISOString()): string {
  return renderTasksMarkdown(defaultBootstrapTasks(updatedAt))
}

function defaultBootstrapTaskBlueprints(): BootstrapTaskBlueprint[] {
  return [
    {
      title: 'Initialize project architecture document',
      summary: `Establish system context, boundaries, modules, and integration flows in ${CORE_ARCHITECTURE_DOC_FILE}.`,
      links: [CORE_ARCHITECTURE_DOC_FILE],
    },
    {
      title: 'Initialize code style document',
      summary: `Capture naming, structure, testing, and review conventions in ${CORE_CODE_STYLE_DOC_FILE}.`,
      links: [CORE_CODE_STYLE_DOC_FILE],
    },
    {
      title: 'Initialize UI style document',
      summary: `Capture visual language, tokens, accessibility, and interaction rules in ${CORE_UI_STYLE_DOC_FILE}.`,
      links: [CORE_UI_STYLE_DOC_FILE],
    },
  ]
}

function defaultRoadmapMilestones(): RoadmapMilestone[] {
  return [{
    id: 'ROADMAP-0001',
    title: 'Bootstrap governance and core docs baseline',
    status: 'active',
    time: '2026-Q1',
    updatedAt: new Date().toISOString(),
  }]
}

function defaultBootstrapTasks(updatedAt = new Date().toISOString()) {
  return defaultBootstrapTaskBlueprints().map((blueprint, index) => ({
    id: `TASK-${String(index + 1).padStart(4, '0')}`,
    title: blueprint.title,
    status: 'TODO' as const,
    owner: 'unassigned',
    summary: blueprint.summary,
    updatedAt,
    links: blueprint.links,
    roadmapRefs: ['ROADMAP-0001'],
  }))
}

function nextGeneratedTaskId(taskIds: string[]): string {
  const maxSuffix = taskIds
    .map((taskId) => /^TASK-(\d+)$/.exec(taskId)?.[1])
    .map((value) => Number.parseInt(value ?? '-1', 10))
    .filter((value) => Number.isFinite(value) && value > 0)
    .reduce((max, value) => Math.max(max, value), 0)

  const next = maxSuffix + 1
  return `TASK-${String(next).padStart(Math.max(4, String(next).length), '0')}`
}

function buildBackfillTask(blueprint: BootstrapTaskBlueprint, taskId: string, roadmapRef: string) {
  return {
    id: taskId,
    title: blueprint.title,
    status: 'TODO' as const,
    owner: 'unassigned',
    summary: blueprint.summary,
    updatedAt: new Date().toISOString(),
    links: blueprint.links,
    roadmapRefs: [roadmapRef],
  }
}

async function inspectProjectInitMissingState(governancePath: string): Promise<ProjectInitMissingState> {
  const requiredDirectories = [
    governancePath,
    path.join(governancePath, 'designs'),
    path.join(governancePath, 'designs', 'core'),
    path.join(governancePath, 'designs', 'research'),
    path.join(governancePath, 'reports'),
    path.join(governancePath, 'templates'),
    path.join(governancePath, 'templates', 'tools'),
  ]
  const requiredFiles = [
    path.join(governancePath, 'README.md'),
    path.join(governancePath, 'roadmap.md'),
    path.join(governancePath, 'tasks.md'),
    path.join(governancePath, CORE_ARCHITECTURE_DOC_FILE),
    path.join(governancePath, CORE_CODE_STYLE_DOC_FILE),
    path.join(governancePath, CORE_UI_STYLE_DOC_FILE),
    path.join(governancePath, 'templates', 'README.md'),
    ...DEFAULT_TOOL_TEMPLATE_NAMES.map((toolName) => path.join(governancePath, 'templates', 'tools', `${toolName}.md`)),
  ]
  const missingDirectories = (await Promise.all(requiredDirectories.map(async (dirPath) => (await pathExists(dirPath)) ? undefined : dirPath)))
    .filter((item): item is string => item != null)
  const missingFiles = (await Promise.all(requiredFiles.map(async (filePath) => (await pathExists(filePath)) ? undefined : filePath)))
    .filter((item): item is string => item != null)

  const markerPath = path.join(governancePath, PROJECT_MARKER)
  const markerMissing = !(await pathExists(markerPath))
  if (markerMissing) {
    return {
      markerMissing,
      missingDirectories,
      missingFiles,
      missingBootstrapTaskTitles: defaultBootstrapTaskBlueprints().map((item) => item.title),
      missingBootstrapRoadmap: true,
    }
  }

  await ensureStore(markerPath)
  const [tasks, roadmaps] = await Promise.all([
    loadTasksFromStore(markerPath),
    loadRoadmapsFromStore(markerPath),
  ])
  const missingBootstrapTaskTitles = defaultBootstrapTaskBlueprints()
    .filter((blueprint) => !tasks.some((task) => task.title === blueprint.title || blueprint.links.some((link) => task.links.includes(link))))
    .map((item) => item.title)

  return {
    markerMissing,
    missingDirectories,
    missingFiles,
    missingBootstrapTaskTitles,
    missingBootstrapRoadmap: roadmaps.length === 0,
  }
}

async function backfillBootstrapTasks(markerPath: string): Promise<ProjectInitRemediation> {
  await ensureStore(markerPath)
  const [tasks, roadmaps] = await Promise.all([
    loadTasksFromStore(markerPath),
    loadRoadmapsFromStore(markerPath),
  ])

  let createdBootstrapRoadmapId: string | undefined
  let roadmapRef = roadmaps[0]?.id
  if (!roadmapRef) {
    const milestone = defaultRoadmapMilestones()[0]
    await upsertRoadmapInStore(markerPath, milestone)
    createdBootstrapRoadmapId = milestone.id
    roadmapRef = milestone.id
  }

  const mutableTasks = [...tasks]
  const createdBootstrapTaskIds: string[] = []
  for (const blueprint of defaultBootstrapTaskBlueprints()) {
    const exists = mutableTasks.some((task) => task.title === blueprint.title || blueprint.links.some((link) => task.links.includes(link)))
    if (exists) {
      continue
    }

    const nextTaskId = nextGeneratedTaskId(mutableTasks.map((task) => task.id))
    const task = buildBackfillTask(blueprint, nextTaskId, roadmapRef)
    await upsertTaskInStore(markerPath, task)
    mutableTasks.push(task)
    createdBootstrapTaskIds.push(nextTaskId)
  }

  return { createdBootstrapTaskIds, createdBootstrapRoadmapId }
}

function defaultProjectArchitectureMarkdown(): string {
  return [
    '# Project Architecture',
    '',
    '## Mission and Scope',
    '- Describe the product or repository purpose.',
    '- Define the operational boundary of this project.',
    '',
    '## System Boundaries',
    '- List primary inputs, outputs, external integrations, and ownership boundaries.',
    '',
    '## Modules and Responsibilities',
    '- Document the major modules, packages, or services and their responsibilities.',
    '',
    '## Key Flows',
    '- Summarize the highest-value runtime and maintenance flows.',
    '',
    '## Change Triggers',
    '- Update this document when tasks change architecture boundaries, data flow, or integration contracts.',
  ].join('\n')
}

function defaultCodeStyleMarkdown(): string {
  return [
    '# Code Style',
    '',
    '## Core Principles',
    '- Document the repository coding principles and non-negotiable constraints.',
    '',
    '## Naming and Structure',
    '- Define naming rules, module boundaries, and file organization expectations.',
    '',
    '## Testing and Validation',
    '- Record expectations for unit tests, integration tests, and verification commands.',
    '',
    '## Review Checklist',
    '- List the code quality checks every completed task should re-evaluate.',
    '',
    '## Change Triggers',
    '- Update this document when tasks establish or revise reusable engineering conventions.',
  ].join('\n')
}

function defaultUiStyleMarkdown(): string {
  return [
    '# UI Style',
    '',
    '## Visual Language',
    '- Describe the intended product tone, typography, spacing, and visual hierarchy.',
    '',
    '## Components and Patterns',
    '- Record reusable UI patterns, interaction rules, and component expectations.',
    '',
    '## Accessibility and Quality',
    '- Document accessibility expectations, responsiveness rules, and UX quality bars.',
    '',
    '## Design Tokens',
    '- Capture colors, spacing, motion, and other token-level guidance if applicable.',
    '',
    '## Change Triggers',
    '- Update this document when tasks change UI behavior, interaction rules, or visual consistency guidance.',
  ].join('\n')
}

function toRelativeGovernancePath(governanceDir: string, targetPath: string): string {
  const relative = path.relative(governanceDir, targetPath).replace(/\\/g, '/')
  return relative.length > 0 ? relative : '.'
}

function classifyProjectInitMissing(initialized: ProjectInitResult): ProjectInitMissingClassification {
  const coreDocFiles = new Set([
    CORE_ARCHITECTURE_DOC_FILE,
    CORE_CODE_STYLE_DOC_FILE,
    CORE_UI_STYLE_DOC_FILE,
  ])
  const relativeMissingFiles = initialized.missingBeforeInit.missingFiles
    .map((item) => toRelativeGovernancePath(initialized.governanceDir, item))

  const coreDocs = relativeMissingFiles.filter((item) => coreDocFiles.has(item))
  const templates = relativeMissingFiles.filter((item) => item === 'templates/README.md' || item.startsWith('templates/tools/'))
  const otherFiles = relativeMissingFiles.filter((item) => !coreDocFiles.has(item) && !(item === 'templates/README.md' || item.startsWith('templates/tools/')))

  return {
    coreDocs,
    templates,
    bootstrapTasks: initialized.missingBeforeInit.missingBootstrapTaskTitles,
    otherFiles,
  }
}

function renderProjectInitRepairSummary(initialized: ProjectInitResult): string[] {
  const classified = classifyProjectInitMissing(initialized)
  return [
    '### Repair Summary (Missing Before Init)',
    '- core docs:',
    `  - count: ${classified.coreDocs.length}`,
    ...(classified.coreDocs.length > 0 ? classified.coreDocs.map((item) => `  - ${item}`) : ['  - (none)']),
    '- templates:',
    `  - count: ${classified.templates.length}`,
    ...(classified.templates.length > 0 ? classified.templates.map((item) => `  - ${item}`) : ['  - (none)']),
    '- bootstrap tasks:',
    `  - count: ${classified.bootstrapTasks.length}`,
    ...(classified.bootstrapTasks.length > 0 ? classified.bootstrapTasks.map((item) => `  - ${item}`) : ['  - (none)']),
    '- other required files:',
    `  - count: ${classified.otherFiles.length}`,
    ...(classified.otherFiles.length > 0 ? classified.otherFiles.map((item) => `  - ${item}`) : ['  - (none)']),
    '- remediation actions:',
    `  - created bootstrap tasks: ${initialized.remediation.createdBootstrapTaskIds.length}`,
    `  - created bootstrap roadmap: ${initialized.remediation.createdBootstrapRoadmapId ?? '(none)'}`,
  ]
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
    '',
    'Basic Variables:',
    '- {{tool_name}}',
    '- {{summary}}',
    '- {{evidence}}',
    '- {{guidance}}',
    '- {{lint_suggestions}}',
    '- {{next_call}}',
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
  const missingBeforeInit = await inspectProjectInitMissingState(governancePath)
  const directories: InitArtifactResult[] = []

  const requiredDirectories = [
    governancePath,
    path.join(governancePath, 'designs'),
    path.join(governancePath, 'designs', 'core'),
    path.join(governancePath, 'designs', 'research'),
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
  let remediation: ProjectInitRemediation = { createdBootstrapTaskIds: [] }
  if (force || !markerExists) {
    await replaceRoadmapsInStore(markerPath, defaultRoadmapData)
    await replaceTasksInStore(markerPath, defaultBootstrapTasks(defaultTaskUpdatedAt))
  } else {
    remediation = await backfillBootstrapTasks(markerPath)
  }

  const baseFiles = await Promise.all([
    writeTextFile(path.join(governancePath, 'README.md'), defaultReadmeMarkdown(governanceDirName), force),
    writeTextFile(path.join(governancePath, 'roadmap.md'), defaultRoadmapMarkdown(defaultRoadmapData), force),
    writeTextFile(path.join(governancePath, 'tasks.md'), defaultTasksMarkdown(defaultTaskUpdatedAt), force),
    writeTextFile(path.join(governancePath, CORE_ARCHITECTURE_DOC_FILE), defaultProjectArchitectureMarkdown(), force),
    writeTextFile(path.join(governancePath, CORE_CODE_STYLE_DOC_FILE), defaultCodeStyleMarkdown(), force),
    writeTextFile(path.join(governancePath, CORE_UI_STYLE_DOC_FILE), defaultUiStyleMarkdown(), force),
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
    missingBeforeInit,
    remediation,
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
      summary: ({ initialized, force }) => [
        `- projectPath: ${initialized.projectPath}`,
        `- governanceDir: ${initialized.governanceDir}`,
        `- force: ${force ? 'true' : 'false'}`,
      ],
      evidence: ({ initialized, filesByAction }) => [
        `- createdFiles: ${filesByAction.created.length}`,
        `- updatedFiles: ${filesByAction.updated.length}`,
        `- skippedFiles: ${filesByAction.skipped.length}`,
        `- missingDirectoriesBeforeInit: ${initialized.missingBeforeInit.missingDirectories.length}`,
        `- missingFilesBeforeInit: ${initialized.missingBeforeInit.missingFiles.length}`,
        `- missingBootstrapTasksBeforeInit: ${initialized.missingBeforeInit.missingBootstrapTaskTitles.length}`,
        `- missingBootstrapRoadmapBeforeInit: ${initialized.missingBeforeInit.missingBootstrapRoadmap ? 'true' : 'false'}`,
        `- createdBootstrapTasks: ${initialized.remediation.createdBootstrapTaskIds.length}`,
        `- createdBootstrapRoadmap: ${initialized.remediation.createdBootstrapRoadmapId ?? '(none)'}`,
        '- directories:',
        ...initialized.directories.map((item) => `  - ${item.action}: ${item.path}`),
        '- files:',
        ...initialized.files.map((item) => `  - ${item.action}: ${item.path}`),
        ...(initialized.missingBeforeInit.missingDirectories.length > 0
          ? ['- missingDirectoriesBeforeInit.list:', ...initialized.missingBeforeInit.missingDirectories.map((item) => `  - ${item}`)]
          : []),
        ...(initialized.missingBeforeInit.missingFiles.length > 0
          ? ['- missingFilesBeforeInit.list:', ...initialized.missingBeforeInit.missingFiles.map((item) => `  - ${item}`)]
          : []),
        ...(initialized.missingBeforeInit.missingBootstrapTaskTitles.length > 0
          ? ['- missingBootstrapTasksBeforeInit.list:', ...initialized.missingBeforeInit.missingBootstrapTaskTitles.map((item) => `  - ${item}`)]
          : []),
        ...(initialized.remediation.createdBootstrapTaskIds.length > 0
          ? ['- createdBootstrapTaskIds.list:', ...initialized.remediation.createdBootstrapTaskIds.map((item) => `  - ${item}`)]
          : []),
        '',
        ...renderProjectInitRepairSummary(initialized),
      ],
      guidance: ({ initialized }) => [
        ...(initialized.missingBeforeInit.markerMissing
          ? ['- Governance root was missing before init. This call performed a full bootstrap.']
          : ['- Governance root already existed. This call inspected the current initialization state and backfilled missing artifacts where possible.']),
        ...(initialized.missingBeforeInit.missingFiles.length > 0 || initialized.missingBeforeInit.missingDirectories.length > 0 || initialized.missingBeforeInit.missingBootstrapTaskTitles.length > 0 || initialized.missingBeforeInit.missingBootstrapRoadmap
          ? ['- This project was partially initialized. Review the created files and bootstrap tasks, then complete any placeholder content.']
          : ['- No initialization gaps were detected. Use force=true only when you intentionally want to overwrite templates/files.']),
        '- If files were skipped and you want to overwrite templates, rerun with force=true.',
        '- Continue with projectContext and taskList for execution.',
        '- Start with the three bootstrap TODO tasks for architecture, code style, and UI style docs.',
      ],
      suggestions: () => [
        '- After init, fill owner/roadmapRefs/links in .projitive task table before marking DONE.',
        '- Keep designs/core/architecture.md, designs/core/code-style.md, and designs/core/ui-style.md in sync with completed work.',
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
      summary: ({ roots, depth, projects }) => [
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
      suggestions: ({ projects }) =>
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
      summary: ({ roots, depth, projects, ranked, limit }) => [
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
      suggestions: ({ topTasks }) => topTasks ? collectTaskLintSuggestions(topTasks) : [],
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
      summary: ({ resolvedFrom, projectPath, governanceDir }) => [
        `- resolvedFrom: ${resolvedFrom}`,
        `- projectPath: ${projectPath}`,
        `- governanceDir: ${governanceDir}`,
      ],
      guidance: () => ['- Call `projectContext` with this projectPath to get task and roadmap summaries.'],
      suggestions: () => ['- Run `projectContext` to get governance/module lint suggestions for this project.'],
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
        const selectedViews = views && views.length > 0 ? Array.from(new Set(views)) : ['tasks', 'roadmap']
        const forceSync = force === true
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
      summary: ({ normalizedProjectPath, governanceDir, tasksViewPath, roadmapViewPath, selectedViews, forceSync }) => [
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
      suggestions: () => [],
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
        const projectContextDocsState = inspectProjectContextDocsFromArtifacts(candidateFilesFromArtifacts(artifacts))
        const dbPath = path.join(governanceDir, PROJECT_MARKER)
        await ensureStore(dbPath)
        const taskStats = await loadTaskStatusStatsFromStore(dbPath)
        const { markdownPath: tasksMarkdownPath, tasks } = await loadTasksDocument(governanceDir)
        const { markdownPath: roadmapMarkdownPath, milestones } = await loadRoadmapDocumentWithOptions(governanceDir, false)
        const roadmapIds = milestones.map((item) => item.id)
        return { normalizedProjectPath, governanceDir, tasksMarkdownPath, roadmapMarkdownPath, roadmapIds, taskStats, artifacts, tasks, projectContextDocsState }
      },
      summary: ({ normalizedProjectPath, governanceDir, tasksMarkdownPath, roadmapMarkdownPath, roadmapIds, projectContextDocsState }) => [
        `- projectPath: ${normalizedProjectPath}`,
        `- governanceDir: ${governanceDir}`,
        `- tasksView: ${tasksMarkdownPath}`,
        `- roadmapView: ${roadmapMarkdownPath}`,
        `- roadmapIds: ${roadmapIds.length}`,
        `- projectArchitectureDocsStatus: ${projectContextDocsState.missingArchitectureDocs ? 'MISSING' : 'READY'}`,
        `- codeStyleDocsStatus: ${projectContextDocsState.missingCodeStyleDocs ? 'MISSING' : 'READY'}`,
        `- uiStyleDocsStatus: ${projectContextDocsState.missingUiStyleDocs ? 'MISSING' : 'READY'}`,
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
      guidance: ({ normalizedProjectPath, projectContextDocsState }) => [
        ...(!projectContextDocsState.ready
          ? [
              '- Project-level governance gate is NOT satisfied because required core docs are missing.',
              `- Rerun projectInit to repair missing governance artifacts and bootstrap tasks: projectInit(projectPath="${normalizedProjectPath}")`,
              '- After projectInit backfills missing files/tasks, update any placeholder content in the created docs.',
            ]
          : []),
        '- Governance state must be changed via tools; do not directly edit tasks.md/roadmap.md generated views.',
        '- Start from `taskList` to choose a target task.',
        '- Then call `taskContext` with a task ID to retrieve evidence locations and reading order.',
      ],
      suggestions: ({ tasks, projectContextDocsState }) => [
        ...collectTaskLintSuggestions(tasks),
        ...renderLintSuggestions(collectProjectContextDocsLintSuggestions(projectContextDocsState)),
      ],
      nextCall: ({ normalizedProjectPath, projectContextDocsState }) =>
        projectContextDocsState.ready
          ? `taskList(projectPath="${normalizedProjectPath}")`
          : `projectInit(projectPath="${normalizedProjectPath}")`,
    })
  )
}
