import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ensureStore,
  getMarkdownViewState,
  getStoreVersion,
  loadActionableTasksFromStore,
  loadRoadmapIdsFromStore,
  loadRoadmapsFromStore,
  loadTaskStatusStatsFromStore,
  loadTasksFromStore,
  markMarkdownViewBuilt,
  markMarkdownViewDirty,
  replaceRoadmapsInStore,
  replaceTasksInStore,
  upsertRoadmapInStore,
  upsertTaskInStore,
} from './store.js'
import type { RoadmapMilestone, Task } from '../types.js'

const tempPaths: string[] = []

async function createTempDbPath(): Promise<string> {
  const sandboxRoot = path.join(process.cwd(), '.tmp', 'store-tests')
  await fs.mkdir(sandboxRoot, { recursive: true })
  const dir = await fs.mkdtemp(path.join(sandboxRoot, 'case-'))
  tempPaths.push(dir)
  return path.join(dir, '.projitive')
}

async function readRawStore(dbPath: string) {
  const content = await fs.readFile(dbPath, 'utf8')
  return JSON.parse(content) as {
    schema: string;
    tasks: Array<{ id: string; recordVersion: number }>;
    meta: { store_schema_version: number; tasks_version: number; roadmaps_version: number };
    view_state: {
      tasks_markdown: { dirty: boolean; lastSourceVersion: number };
      roadmaps_markdown: { dirty: boolean; lastSourceVersion: number };
    };
    migration_history: unknown[];
  }
}

function task(input: Partial<Task> & { id: string; title: string; status?: Task['status'] }): Task {
  return {
    id: input.id,
    title: input.title,
    status: input.status ?? 'TODO',
    owner: input.owner ?? '',
    summary: input.summary ?? '',
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    links: input.links ?? [],
    roadmapRefs: input.roadmapRefs ?? [],
    subState: input.subState,
    blocker: input.blocker,
  }
}

function milestone(input: Partial<RoadmapMilestone> & { id: string; title: string }): RoadmapMilestone {
  return {
    id: input.id,
    title: input.title,
    status: input.status ?? 'active',
    time: input.time,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('store', () => {
  it('initializes JSON store with default meta/view state', async () => {
    const dbPath = await createTempDbPath()
    await ensureStore(dbPath)

    const store = await readRawStore(dbPath)
    expect(store.schema).toBe('projitive-json-store')
    expect(store.meta.store_schema_version).toBe(3)
    expect(store.meta.tasks_version).toBe(0)
    expect(store.meta.roadmaps_version).toBe(0)
    expect(store.view_state.tasks_markdown.dirty).toBe(true)
    expect(store.view_state.tasks_markdown.lastSourceVersion).toBe(0)
    expect(store.view_state.roadmaps_markdown.dirty).toBe(true)
    expect(store.view_state.roadmaps_markdown.lastSourceVersion).toBe(0)
    expect(Array.isArray(store.migration_history)).toBe(true)
  })

  it('tracks view state dirty/build transitions', async () => {
    const dbPath = await createTempDbPath()
    await ensureStore(dbPath)

    const initial = await getMarkdownViewState(dbPath, 'tasks_markdown')
    expect(initial.dirty).toBe(true)

    await markMarkdownViewBuilt(dbPath, 'tasks_markdown', 7, '2026-03-13T00:00:00.000Z')
    const built = await getMarkdownViewState(dbPath, 'tasks_markdown')
    expect(built.dirty).toBe(false)
    expect(built.lastSourceVersion).toBe(7)
    expect(built.lastBuiltAt).toBe('2026-03-13T00:00:00.000Z')

    await markMarkdownViewDirty(dbPath, 'tasks_markdown')
    const dirtyAgain = await getMarkdownViewState(dbPath, 'tasks_markdown')
    expect(dirtyAgain.dirty).toBe(true)
    expect(dirtyAgain.lastSourceVersion).toBe(7)
  })

  it('upserts tasks and updates source/view versions', async () => {
    const dbPath = await createTempDbPath()
    await ensureStore(dbPath)

    await upsertTaskInStore(dbPath, task({
      id: 'TASK-0001',
      title: 'First',
      status: 'TODO',
      owner: 'alice',
      summary: 'first',
      updatedAt: '2026-03-13T00:00:00.000Z',
      roadmapRefs: ['ROADMAP-0001'],
    }))

    await upsertTaskInStore(dbPath, task({
      id: 'TASK-0001',
      title: 'First Updated',
      status: 'IN_PROGRESS',
      owner: 'alice',
      summary: 'updated',
      updatedAt: '2026-03-13T01:00:00.000Z',
      roadmapRefs: ['ROADMAP-0001'],
      links: ['reports/r1.md'],
    }))

    const tasks = await loadTasksFromStore(dbPath)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('First Updated')
    expect(tasks[0].status).toBe('IN_PROGRESS')
    expect(tasks[0].links).toEqual(['reports/r1.md'])

    const tasksVersion = await getStoreVersion(dbPath, 'tasks')
    expect(tasksVersion).toBe(2)

    const viewState = await getMarkdownViewState(dbPath, 'tasks_markdown')
    expect(viewState.dirty).toBe(true)

    const store = await readRawStore(dbPath)
    const updated = store.tasks.find((item) => item.id === 'TASK-0001')
    expect(updated?.recordVersion).toBe(2)
  })

  it('replaces task set and computes actionable ranking/stats', async () => {
    const dbPath = await createTempDbPath()
    await ensureStore(dbPath)

    await replaceTasksInStore(dbPath, [
      task({ id: 'TASK-0001', title: 'Todo older', status: 'TODO', updatedAt: '2026-03-10T00:00:00.000Z' }),
      task({ id: 'TASK-0002', title: 'In progress', status: 'IN_PROGRESS', updatedAt: '2026-03-12T00:00:00.000Z' }),
      task({ id: 'TASK-0003', title: 'Todo newer', status: 'TODO', updatedAt: '2026-03-13T00:00:00.000Z' }),
      task({ id: 'TASK-0004', title: 'Blocked', status: 'BLOCKED', updatedAt: '2026-03-11T00:00:00.000Z' }),
      task({ id: 'TASK-0005', title: 'Done', status: 'DONE', updatedAt: '2026-03-09T00:00:00.000Z' }),
    ])

    const stats = await loadTaskStatusStatsFromStore(dbPath)
    expect(stats.todo).toBe(2)
    expect(stats.inProgress).toBe(1)
    expect(stats.blocked).toBe(1)
    expect(stats.done).toBe(1)
    expect(stats.total).toBe(5)
    expect(stats.latestUpdatedAt).toBe('2026-03-13T00:00:00.000Z')

    const actionable = await loadActionableTasksFromStore(dbPath, 2)
    expect(actionable).toHaveLength(2)
    expect(actionable[0].id).toBe('TASK-0002')
    expect(actionable[1].id).toBe('TASK-0003')

    const tasksVersion = await getStoreVersion(dbPath, 'tasks')
    expect(tasksVersion).toBe(1)
  })

  it('upserts/replaces roadmaps and updates versions', async () => {
    const dbPath = await createTempDbPath()
    await ensureStore(dbPath)

    await upsertRoadmapInStore(dbPath, milestone({
      id: 'ROADMAP-0001',
      title: 'Phase 1',
      status: 'active',
      updatedAt: '2026-03-10T00:00:00.000Z',
    }))

    await upsertRoadmapInStore(dbPath, milestone({
      id: 'ROADMAP-0001',
      title: 'Phase 1 done',
      status: 'done',
      time: '2026-Q1',
      updatedAt: '2026-03-11T00:00:00.000Z',
    }))

    const list1 = await loadRoadmapsFromStore(dbPath)
    expect(list1).toHaveLength(1)
    expect(list1[0].title).toBe('Phase 1 done')
    expect(list1[0].status).toBe('done')
    expect(list1[0].time).toBe('2026-Q1')

    await replaceRoadmapsInStore(dbPath, [
      milestone({ id: 'ROADMAP-0002', title: 'Phase 2', status: 'active', updatedAt: '2026-03-12T00:00:00.000Z' }),
      milestone({ id: 'ROADMAP-0003', title: 'Phase 3', status: 'done', updatedAt: '2026-03-13T00:00:00.000Z' }),
    ])

    const ids = await loadRoadmapIdsFromStore(dbPath)
    expect(ids).toEqual(['ROADMAP-0003', 'ROADMAP-0002'])

    const roadmapsVersion = await getStoreVersion(dbPath, 'roadmaps')
    expect(roadmapsVersion).toBe(3)

    const viewState = await getMarkdownViewState(dbPath, 'roadmaps_markdown')
    expect(viewState.dirty).toBe(true)
  })
})
