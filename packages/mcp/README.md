# @projitive/mcp

**Current Spec Version: projitive-spec v1.0.0 | MCP Version: 1.0.0**

Projitive MCP server（语义化接口设计版），用于帮助 Agent 发现项目、发现任务、定位证据，并按治理流程推进。

## 规范版本

- 当前遵循规范版本：`projitive-spec v1.0.0`
- 说明：Projitive 是通用治理规范，MCP 只是该规范的一种工具实现。
- 对齐规则：MCP 的主版本必须与规范主版本一致（当前均为 `v1.x`）

## 设计边界

- MCP 负责：发现、定位、汇总、推进指导。
- AI 负责：读取与更新 Markdown 正文内容。
- MCP 不提供：`task.update_*`、`roadmap.update_*`、`sync_*` 这类直接写入治理工件的方法。
- 所有工具返回内容：面向 Agent 的 Markdown（不是 JSON 对象）。
- 输出结构统一为：`Summary` / `Evidence` / `Agent Guidance`。
- 错误结构统一为：`Error` / `Next Step`。

## Tools Methods

### 发现层

#### `project.next`

- **作用**：直接拉取最近可推进的项目（按可执行任务数和最近更新时间排序）。
- **输入**：`rootPath?`、`maxDepth?`、`limit?`
- **输出示例（Markdown）**：

```markdown
# project.next

## Summary
- rootPath: /workspace
- maxDepth: 3
- matchedProjects: 8
- actionableProjects: 3
- limit: 10

## Evidence
- rankedProjects:
1. /workspace/proj-a | actionable=5 | in_progress=2 | todo=3 | blocked=1 | done=4 | latest=2026-02-17T12:00:00.000Z | tasksPath=/workspace/proj-a/tasks.md
2. /workspace/proj-b | actionable=3 | in_progress=1 | todo=2 | blocked=0 | done=7 | latest=2026-02-16T09:00:00.000Z | tasksPath=/workspace/proj-b/tasks.md

## Agent Guidance
- Pick top 1 project and call `project.overview` with its governanceDir.
- Then call `task.list` and `task.get` to continue execution.
```

#### `project.scan`

- **作用**：扫描目录并发现可治理项目。
- **输入**：`rootPath?`、`maxDepth?`
- **输出示例（Markdown）**：

```markdown
# project.scan

## Summary
- rootPath: /workspace
- maxDepth: 3
- discoveredCount: 2

## Evidence
- projects:
1. /workspace/proj-a
2. /workspace/proj-b

## Agent Guidance
- Next: call `project.locate` with one target path to lock the active governance root.
- Then: call `project.overview` to view artifact and task status.
```

#### `project.locate`

- **作用**：当 Agent 已经在某个项目目录内时，向上定位最近 `.projitive`，确定当前项目治理根目录。
- **输入**：`inputPath`
- **输出示例（Markdown）**：

```markdown
# project.locate

## Summary
- resolvedFrom: /workspace/proj-a/packages/mcp
- governanceDir: /workspace/proj-a
- markerPath: /workspace/proj-a/.projitive

## Agent Guidance
- Next: call `project.overview` with this governanceDir to get task and roadmap summaries.
```

#### `project.overview`

- **作用**：自动汇总治理状态，而不是只返回文件列表。
- **输入**：`projectPath`
- **输出示例（Markdown）**：

```markdown
# project.overview

## Summary
- governanceDir: /workspace/proj-a
- tasksFile: /workspace/proj-a/tasks.md
- roadmapIds: 3

## Evidence
### Task Summary
- total: 12
- TODO: 4
- IN_PROGRESS: 3
- BLOCKED: 1
- DONE: 4

### Artifacts
- ✅ README.md
- ✅ roadmap.md
- ✅ tasks.md
- ✅ designs/
- ✅ reports/
- ✅ hooks/

## Agent Guidance
- Next: call `task.list` to choose a target task.
- Then: call `task.get` with a task ID to retrieve evidence locations and reading order.
```

### 任务层

#### `task.next`

- **作用**：一步完成“发现项目 + 选择最可推进任务 + 返回证据定位与阅读顺序”，用于 Agent 直接开工。
- **输入**：`rootPath?`、`maxDepth?`、`topCandidates?`
- **输出示例（Markdown）**：

```markdown
# task.next

## Summary
- rootPath: /workspace
- maxDepth: 3
- matchedProjects: 8
- actionableTasks: 12
- selectedProject: /workspace/proj-a
- selectedTaskId: TASK-0003
- selectedTaskStatus: IN_PROGRESS

## Evidence
### Selected Task
- id: TASK-0003
- title: Build MCP tools
- taskLocation: /workspace/proj-a/tasks.md#L42

### Top Candidates
1. TASK-0003 | IN_PROGRESS | Build MCP tools | project=/workspace/proj-a | projectScore=6
2. TASK-0007 | TODO | Add docs examples | project=/workspace/proj-b | projectScore=5

### Suggested Read Order
1. /workspace/proj-a/tasks.md
2. /workspace/proj-a/designs/mcp-design.md
3. /workspace/proj-a/reports/mcp-progress.md

## Agent Guidance
- Start immediately with Suggested Read Order and execute the selected task.
- Re-run `task.get` for the selectedTaskId after edits to verify evidence consistency.
```

- **推荐路径**：优先调用 `task.next`，避免 `project.next -> project.overview -> task.list -> task.get` 的多跳链路。

#### `task.list`

- **作用**：返回当前项目任务清单，支持按状态过滤与排序。
- **输入**：`projectPath`、`status?`、`limit?`
- **输出示例（Markdown）**：

```markdown
# task.list

## Summary
- governanceDir: /workspace/proj-a
- tasksPath: /workspace/proj-a/tasks.md
- filter.status: IN_PROGRESS
- returned: 2

## Evidence
- tasks:
- TASK-0003 | IN_PROGRESS | Build MCP tools | owner=alice | updatedAt=2026-02-17T12:00:00.000Z
- TASK-0007 | IN_PROGRESS | Add docs examples | owner=bob | updatedAt=2026-02-17T13:30:00.000Z

## Agent Guidance
- Next: pick one task ID and call `task.get`.
```

#### `task.get`

- **作用**：基于任务 ID 一次性返回任务详情 + 关联证据位置（替代 `trace.references`）。
- **输入**：`projectPath`、`taskId`
- **HOOKS 注入**：
  - 若存在 `hooks/task_get_head.md`，其内容会自动追加到返回结果最前面。
  - 若存在 `hooks/task_get_footer.md`，其内容会自动追加到返回结果最后面。
  - 用于给 Agent 注入项目级自定义提示，不改变 task.get 核心结构。
- **输出示例（Markdown）**：

```markdown
[hooks/task_get_head.md 内容（如果存在）]

---

# task.get

## Summary
- governanceDir: /workspace/proj-a
- taskId: TASK-0003
- title: Build MCP tools
- status: IN_PROGRESS
- owner: alice
- updatedAt: 2026-02-17T12:00:00.000Z
- roadmapRefs: ROADMAP-0001
- taskLocation: /workspace/proj-a/tasks.md#L42
- hookStatus: head=loaded, footer=missing

## Evidence
### Related Artifacts
- /workspace/proj-a/tasks.md
- /workspace/proj-a/designs/mcp-design.md
- /workspace/proj-a/reports/mcp-progress.md

### Reference Locations
- /workspace/proj-a/tasks.md#L42: "id": "TASK-0003"
- /workspace/proj-a/designs/mcp-design.md#L18: Ref: TASK-0003

### Suggested Read Order
1. /workspace/proj-a/tasks.md
2. /workspace/proj-a/designs/mcp-design.md
3. /workspace/proj-a/reports/mcp-progress.md

## Agent Guidance
- Read the files in Suggested Read Order.
- Verify whether current status and evidence are consistent.

---

[hooks/task_get_footer.md 内容（如果存在）]
```

### 路线层

#### `roadmap.list`

- **作用**：列出路线图项目及其关联任务概览。
- **输入**：`projectPath`
- **输出示例（Markdown）**：

```markdown
# roadmap.list

## Summary
- governanceDir: /workspace/proj-a
- roadmapCount: 2

## Evidence
- roadmaps:
- ROADMAP-0001 | linkedTasks=6
- ROADMAP-0002 | linkedTasks=3

## Agent Guidance
- Next: call `roadmap.get` with a roadmap ID to inspect references and related tasks.
```

#### `roadmap.get`

- **作用**：获取单个路线图详情与证据定位信息。
- **输入**：`projectPath`、`roadmapId`
- **输出示例（Markdown）**：

```markdown
# roadmap.get

## Summary
- governanceDir: /workspace/proj-a
- roadmapId: ROADMAP-0001
- relatedTasks: 6
- references: 9

## Evidence
### Related Tasks
- TASK-0001 | DONE | Bootstrap governance
- TASK-0003 | IN_PROGRESS | Build MCP tools

### Reference Locations
- /workspace/proj-a/roadmap.md#L21: ROADMAP-0001
- /workspace/proj-a/tasks.md#L42: "roadmapRefs": ["ROADMAP-0001"]

## Agent Guidance
- Read roadmap references first, then related tasks.
- Keep ROADMAP/TASK IDs unchanged while updating markdown files.
```

## 统一错误输出示例

```markdown
# task.get

## Error
- cause: Invalid task ID format: TASK-12

## Next Step
- expected format: TASK-0001
- retry with a valid task ID
```

## Agent 推荐调用流程

1. `task.next`：一步发现并选择最可推进任务，直接开工（默认路径）。
2. `task.get`：在需要更完整上下文时，按 taskId 拉取详细证据。
3. `project.next`：仅在需要“先选项目、再选任务”的项目级调度场景使用（可选）。
4. 当 Agent 已在项目内时，用 `project.locate` 快速定位当前项目治理根目录。
