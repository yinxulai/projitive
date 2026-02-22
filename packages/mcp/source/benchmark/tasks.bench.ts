import { describe, bench } from 'vitest';
import { renderTasksMarkdown } from '../tasks.js';

const sampleTasks = [
  {
    id: 'TASK-0001',
    status: 'DONE' as const,
    title: 'Test Task 1',
    owner: 'ai-copilot',
    summary: 'Test task description',
    updatedAt: '2026-02-22T00:00:00.000Z',
    links: [],
    roadmapRefs: []
  },
  {
    id: 'TASK-0002',
    status: 'TODO' as const,
    title: 'Test Task 2',
    owner: 'ai-copilot',
    summary: 'Another test task',
    updatedAt: '2026-02-22T00:00:00.000Z',
    links: [],
    roadmapRefs: []
  },
  {
    id: 'TASK-0003',
    status: 'IN_PROGRESS' as const,
    title: 'Test Task 3',
    owner: 'ai-copilot',
    summary: 'Task in progress with links',
    updatedAt: '2026-02-22T00:00:00.000Z',
    links: ['./designs/test.md', './reports/test.md'],
    roadmapRefs: ['ROADMAP-0001']
  }
];

const largeTaskList = Array.from({ length: 50 }, (_, i) => ({
  id: `TASK-${String(i + 1).padStart(4, '0')}`,
  status: (['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const)[i % 4],
  title: `Test Task ${i + 1}`,
  owner: 'ai-copilot',
  summary: `This is a test task number ${i + 1} with some description text that is longer than the previous ones to test rendering performance with larger content.`,
  updatedAt: '2026-02-22T00:00:00.000Z',
  links: i % 3 === 0 ? [`./designs/task-${i + 1}.md`, `./reports/task-${i + 1}.md`] : [],
  roadmapRefs: i % 2 === 0 ? ['ROADMAP-0001'] : []
}));

describe('Tasks Benchmark', () => {
  bench('renderTasksMarkdown - small task list (3 tasks)', () => {
    renderTasksMarkdown(sampleTasks);
  });

  bench('renderTasksMarkdown - large task list (50 tasks)', () => {
    renderTasksMarkdown(largeTaskList);
  });
});
