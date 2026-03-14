import fs from 'node:fs/promises'
import path from 'node:path'
import type { BlockerMetadata, RoadmapMilestone, SubStateMetadata, Task, TaskStatus } from '../types.js'

type StoredTask = Task & { recordVersion: number };
type StoredRoadmap = RoadmapMilestone & { recordVersion: number };

type StoredViewState = {
  name: 'tasks_markdown' | 'roadmaps_markdown';
  dirty: boolean;
  lastSourceVersion: number;
  lastBuiltAt: string;
  recordVersion: number;
};

type StoreMeta = {
  tasks_version: number;
  roadmaps_version: number;
  store_schema_version: number;
};

type MigrationHistoryEntry = {
  id: string;
  from_version: number;
  to_version: number;
  checksum: string;
  started_at: string;
  finished_at: string;
  status: 'SUCCESS' | 'FAILED';
  error_message: string | null;
};

type JsonStore = {
  schema: 'projitive-json-store';
  tasks: StoredTask[];
  roadmaps: StoredRoadmap[];
  meta: StoreMeta;
  view_state: {
    tasks_markdown: StoredViewState;
    roadmaps_markdown: StoredViewState;
  };
  migration_history: MigrationHistoryEntry[];
};

const STORE_SCHEMA_VERSION = 3
const storeCache = new Map<string, JsonStore>()
const storeLocks = new Map<string, Promise<void>>()

export type MarkdownViewState = {
  dirty: boolean;
  lastSourceVersion: number;
  lastBuiltAt: string;
};

export type TaskStatusStats = {
  todo: number;
  inProgress: number;
  blocked: number;
  done: number;
  total: number;
  latestUpdatedAt: string;
};

function defaultViewState(name: 'tasks_markdown' | 'roadmaps_markdown'): StoredViewState {
  return {
    name,
    dirty: true,
    lastSourceVersion: 0,
    lastBuiltAt: '',
    recordVersion: 1,
  }
}

function defaultStore(): JsonStore {
  return {
    schema: 'projitive-json-store',
    tasks: [],
    roadmaps: [],
    meta: {
      tasks_version: 0,
      roadmaps_version: 0,
      store_schema_version: STORE_SCHEMA_VERSION,
    },
    view_state: {
      tasks_markdown: defaultViewState('tasks_markdown'),
      roadmaps_markdown: defaultViewState('roadmaps_markdown'),
    },
    migration_history: [],
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeTaskStatus(status: string): TaskStatus {
  if (status === 'IN_PROGRESS' || status === 'BLOCKED' || status === 'DONE') {
    return status
  }
  return 'TODO'
}

function normalizeRoadmapStatus(status: string): 'active' | 'done' {
  return status === 'done' ? 'done' : 'active'
}

function normalizeStore(input: Partial<JsonStore>): JsonStore {
  const base = defaultStore()
  const meta: Partial<StoreMeta> = input.meta ?? {}

  const tasks: StoredTask[] = Array.isArray(input.tasks)
    ? input.tasks.map((task) => ({
        id: String(task.id ?? ''),
        title: String(task.title ?? ''),
        status: normalizeTaskStatus(String(task.status ?? 'TODO')),
        owner: String(task.owner ?? ''),
        summary: String(task.summary ?? ''),
        updatedAt: String(task.updatedAt ?? nowIso()),
        links: Array.isArray(task.links) ? task.links.map((item) => String(item)) : [],
        roadmapRefs: Array.isArray(task.roadmapRefs) ? task.roadmapRefs.map((item) => String(item)) : [],
        subState: task.subState as SubStateMetadata | undefined,
        blocker: task.blocker as BlockerMetadata | undefined,
        recordVersion: Number.isFinite(Number(task.recordVersion)) ? Number(task.recordVersion) : 1,
      }))
    : []

  const roadmaps: StoredRoadmap[] = Array.isArray(input.roadmaps)
    ? input.roadmaps.map((milestone) => ({
        id: String(milestone.id ?? ''),
        title: String(milestone.title ?? ''),
        status: normalizeRoadmapStatus(String(milestone.status ?? 'active')),
        time: typeof milestone.time === 'string' && milestone.time.length > 0 ? milestone.time : undefined,
        updatedAt: String(milestone.updatedAt ?? nowIso()),
        recordVersion: Number.isFinite(Number(milestone.recordVersion)) ? Number(milestone.recordVersion) : 1,
      }))
    : []

  const tasksView = input.view_state?.tasks_markdown
  const roadmapsView = input.view_state?.roadmaps_markdown

  return {
    schema: 'projitive-json-store',
    tasks,
    roadmaps,
    meta: {
      tasks_version: Number.isFinite(Number(meta.tasks_version)) ? Number(meta.tasks_version) : base.meta.tasks_version,
      roadmaps_version: Number.isFinite(Number(meta.roadmaps_version)) ? Number(meta.roadmaps_version) : base.meta.roadmaps_version,
      store_schema_version: STORE_SCHEMA_VERSION,
    },
    view_state: {
      tasks_markdown: {
        ...base.view_state.tasks_markdown,
        dirty: typeof tasksView?.dirty === 'boolean' ? tasksView.dirty : base.view_state.tasks_markdown.dirty,
        lastSourceVersion: Number.isFinite(Number(tasksView?.lastSourceVersion))
          ? Number(tasksView?.lastSourceVersion)
          : base.view_state.tasks_markdown.lastSourceVersion,
        lastBuiltAt: typeof tasksView?.lastBuiltAt === 'string' ? tasksView.lastBuiltAt : base.view_state.tasks_markdown.lastBuiltAt,
        recordVersion: Number.isFinite(Number(tasksView?.recordVersion))
          ? Number(tasksView?.recordVersion)
          : base.view_state.tasks_markdown.recordVersion,
      },
      roadmaps_markdown: {
        ...base.view_state.roadmaps_markdown,
        dirty: typeof roadmapsView?.dirty === 'boolean' ? roadmapsView.dirty : base.view_state.roadmaps_markdown.dirty,
        lastSourceVersion: Number.isFinite(Number(roadmapsView?.lastSourceVersion))
          ? Number(roadmapsView?.lastSourceVersion)
          : base.view_state.roadmaps_markdown.lastSourceVersion,
        lastBuiltAt: typeof roadmapsView?.lastBuiltAt === 'string' ? roadmapsView.lastBuiltAt : base.view_state.roadmaps_markdown.lastBuiltAt,
        recordVersion: Number.isFinite(Number(roadmapsView?.recordVersion))
          ? Number(roadmapsView?.recordVersion)
          : base.view_state.roadmaps_markdown.recordVersion,
      },
    },
    migration_history: Array.isArray(input.migration_history) ? input.migration_history : [],
  }
}

async function persistStore(dbPath: string, store: JsonStore): Promise<void> {
  await fs.mkdir(path.dirname(dbPath), { recursive: true })
  const tempPath = `${dbPath}.tmp-${process.pid}-${Date.now()}`
  const body = `${JSON.stringify(store, null, 2)}\n`
  await fs.writeFile(tempPath, body, 'utf8')
  await fs.rename(tempPath, dbPath)
}

async function loadStoreFromDisk(dbPath: string): Promise<{ store: JsonStore; shouldPersist: boolean }> {
  const file = await fs.readFile(dbPath).catch(() => undefined)
  if (!file || file.length === 0) {
    return { store: defaultStore(), shouldPersist: true }
  }

  const text = file.toString('utf8').trim()
  if (text.length === 0) {
    return { store: defaultStore(), shouldPersist: true }
  }

  try {
    const parsed = JSON.parse(text) as Partial<JsonStore>
    const normalized = normalizeStore(parsed)
    return { store: normalized, shouldPersist: normalized.meta.store_schema_version !== STORE_SCHEMA_VERSION }
  } catch {
    // Legacy plain-text marker or corrupted content: bootstrap empty JSON store.
    return { store: defaultStore(), shouldPersist: true }
  }
}

async function openStore(dbPath: string): Promise<JsonStore> {
  const cached = storeCache.get(dbPath)
  if (cached) {
    return cached
  }

  const { store, shouldPersist } = await loadStoreFromDisk(dbPath)
  storeCache.set(dbPath, store)
  if (shouldPersist) {
    await persistStore(dbPath, store)
  }
  return store
}

async function withStoreLock<T>(dbPath: string, action: () => Promise<T>): Promise<T> {
  const previous = storeLocks.get(dbPath) ?? Promise.resolve()
  let resolveCurrent: (() => void) | undefined
  const current = new Promise<void>((resolve) => {
    resolveCurrent = resolve
  })
  storeLocks.set(dbPath, previous.then(() => current))

  await previous
  try {
    return await action()
  } finally {
    resolveCurrent?.()
    if (storeLocks.get(dbPath) === current) {
      storeLocks.delete(dbPath)
    }
  }
}

function bumpVersionAndDirtyView(store: JsonStore, kind: 'tasks' | 'roadmaps'): number {
  if (kind === 'tasks') {
    store.meta.tasks_version += 1
    const view = store.view_state.tasks_markdown
    view.dirty = true
    view.recordVersion += 1
    return store.meta.tasks_version
  }

  store.meta.roadmaps_version += 1
  const view = store.view_state.roadmaps_markdown
  view.dirty = true
  view.recordVersion += 1
  return store.meta.roadmaps_version
}

function toPublicTask(stored: StoredTask): Task {
  return {
    id: stored.id,
    title: stored.title,
    status: stored.status,
    owner: stored.owner,
    summary: stored.summary,
    updatedAt: stored.updatedAt,
    links: [...stored.links],
    roadmapRefs: [...stored.roadmapRefs],
    subState: stored.subState,
    blocker: stored.blocker,
  }
}

function toPublicRoadmap(stored: StoredRoadmap): RoadmapMilestone {
  return {
    id: stored.id,
    title: stored.title,
    status: stored.status,
    time: stored.time,
    updatedAt: stored.updatedAt,
  }
}

function safeTime(value: string): number {
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

function normalizeStatusForSort(status: string): number {
  if (status === 'IN_PROGRESS') return 2
  if (status === 'TODO') return 1
  return 0
}

export async function ensureStore(dbPath: string): Promise<void> {
  await openStore(dbPath)
}

export async function getStoreVersion(dbPath: string, kind: 'tasks' | 'roadmaps'): Promise<number> {
  const store = await openStore(dbPath)
  return kind === 'tasks' ? store.meta.tasks_version : store.meta.roadmaps_version
}

export async function getMarkdownViewState(dbPath: string, viewName: 'tasks_markdown' | 'roadmaps_markdown'): Promise<MarkdownViewState> {
  const store = await openStore(dbPath)
  const view = store.view_state[viewName]
  return {
    dirty: view.dirty,
    lastSourceVersion: view.lastSourceVersion,
    lastBuiltAt: view.lastBuiltAt,
  }
}

export async function markMarkdownViewBuilt(
  dbPath: string,
  viewName: 'tasks_markdown' | 'roadmaps_markdown',
  sourceVersion: number,
  builtAt = nowIso()
): Promise<void> {
  await withStoreLock(dbPath, async () => {
    const store = await openStore(dbPath)
    const view = store.view_state[viewName]
    view.dirty = false
    view.lastSourceVersion = sourceVersion
    view.lastBuiltAt = builtAt
    view.recordVersion += 1
    await persistStore(dbPath, store)
  })
}

export async function markMarkdownViewDirty(
  dbPath: string,
  viewName: 'tasks_markdown' | 'roadmaps_markdown'
): Promise<void> {
  await withStoreLock(dbPath, async () => {
    const store = await openStore(dbPath)
    const view = store.view_state[viewName]
    view.dirty = true
    view.recordVersion += 1
    await persistStore(dbPath, store)
  })
}

export async function loadTasksFromStore(dbPath: string): Promise<Task[]> {
  const store = await openStore(dbPath)
  return store.tasks.map(toPublicTask)
}

export async function loadTaskStatusStatsFromStore(dbPath: string): Promise<TaskStatusStats> {
  const tasks = await loadTasksFromStore(dbPath)
  const todo = tasks.filter((task) => task.status === 'TODO').length
  const inProgress = tasks.filter((task) => task.status === 'IN_PROGRESS').length
  const blocked = tasks.filter((task) => task.status === 'BLOCKED').length
  const done = tasks.filter((task) => task.status === 'DONE').length
  const total = tasks.length
  const latestUpdatedAt = tasks
    .map((task) => task.updatedAt)
    .sort((a, b) => safeTime(b) - safeTime(a))[0] ?? ''

  return { todo, inProgress, blocked, done, total, latestUpdatedAt }
}

export async function loadActionableTasksFromStore(dbPath: string, limit?: number): Promise<Task[]> {
  const tasks = await loadTasksFromStore(dbPath)
  const sorted = tasks
    .filter((task) => task.status === 'IN_PROGRESS' || task.status === 'TODO')
    .sort((a, b) => {
      const ap = normalizeStatusForSort(a.status)
      const bp = normalizeStatusForSort(b.status)
      if (bp !== ap) {
        return bp - ap
      }
      const timeDelta = safeTime(b.updatedAt) - safeTime(a.updatedAt)
      if (timeDelta !== 0) {
        return timeDelta
      }
      return b.id.localeCompare(a.id)
    })

  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    return sorted.slice(0, Math.floor(limit))
  }
  return sorted
}

export async function upsertTaskInStore(dbPath: string, task: Task): Promise<void> {
  await withStoreLock(dbPath, async () => {
    const store = await openStore(dbPath)
    const index = store.tasks.findIndex((item) => item.id === task.id)
    if (index >= 0) {
      const previous = store.tasks[index]
      store.tasks[index] = {
        ...task,
        status: normalizeTaskStatus(task.status),
        links: [...(task.links ?? [])],
        roadmapRefs: [...(task.roadmapRefs ?? [])],
        recordVersion: previous.recordVersion + 1,
      }
    } else {
      store.tasks.push({
        ...task,
        status: normalizeTaskStatus(task.status),
        links: [...(task.links ?? [])],
        roadmapRefs: [...(task.roadmapRefs ?? [])],
        recordVersion: 1,
      })
    }

    bumpVersionAndDirtyView(store, 'tasks')
    await persistStore(dbPath, store)
  })
}

export async function replaceTasksInStore(dbPath: string, tasks: Task[]): Promise<void> {
  await withStoreLock(dbPath, async () => {
    const store = await openStore(dbPath)
    store.tasks = tasks.map((task) => ({
      ...task,
      status: normalizeTaskStatus(task.status),
      links: [...(task.links ?? [])],
      roadmapRefs: [...(task.roadmapRefs ?? [])],
      recordVersion: 1,
    }))
    bumpVersionAndDirtyView(store, 'tasks')
    await persistStore(dbPath, store)
  })
}

export async function loadRoadmapsFromStore(dbPath: string): Promise<RoadmapMilestone[]> {
  const store = await openStore(dbPath)
  return store.roadmaps.map(toPublicRoadmap)
}

export async function loadRoadmapIdsFromStore(dbPath: string): Promise<string[]> {
  const roadmaps = await loadRoadmapsFromStore(dbPath)
  return roadmaps
    .sort((a, b) => {
      const timeDelta = safeTime(b.updatedAt) - safeTime(a.updatedAt)
      if (timeDelta !== 0) {
        return timeDelta
      }
      return b.id.localeCompare(a.id)
    })
    .map((item) => item.id)
}

export async function replaceRoadmapsInStore(dbPath: string, milestones: RoadmapMilestone[]): Promise<void> {
  await withStoreLock(dbPath, async () => {
    const store = await openStore(dbPath)
    store.roadmaps = milestones.map((milestone) => ({
      ...milestone,
      status: normalizeRoadmapStatus(milestone.status),
      recordVersion: 1,
    }))
    bumpVersionAndDirtyView(store, 'roadmaps')
    await persistStore(dbPath, store)
  })
}

export async function upsertRoadmapInStore(dbPath: string, milestone: RoadmapMilestone): Promise<void> {
  await withStoreLock(dbPath, async () => {
    const store = await openStore(dbPath)
    const index = store.roadmaps.findIndex((item) => item.id === milestone.id)
    if (index >= 0) {
      const previous = store.roadmaps[index]
      store.roadmaps[index] = {
        ...milestone,
        status: normalizeRoadmapStatus(milestone.status),
        recordVersion: previous.recordVersion + 1,
      }
    } else {
      store.roadmaps.push({
        ...milestone,
        status: normalizeRoadmapStatus(milestone.status),
        recordVersion: 1,
      })
    }

    bumpVersionAndDirtyView(store, 'roadmaps')
    await persistStore(dbPath, store)
  })
}
