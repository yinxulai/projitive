# `tasks.md` 设计说明

语言：简体中文 | [English](TASKS.md)

## 1、该文件的作用

定义可执行任务池与状态流转，回答“现在做什么”。

## 2、设计理念

- 原子化：任务应可独立执行与验证
- 可审计：状态变化必须留下证据
- 统一状态机：避免项目间语义漂移

## 3、内容或者子文件的编写风格/格式

- 推荐状态：`TODO`、`IN_PROGRESS`、`BLOCKED`、`DONE`
- 推荐流转约束：
	- `TODO -> IN_PROGRESS`：必须有执行计划
	- `IN_PROGRESS -> DONE`：必须有验证证据
	- `* -> BLOCKED`：必须记录阻塞原因与解锁条件
- 最小字段建议：`id`、`title`、`status`、`owner`、`updatedAt`、`links`
- 可选字段：`roadmapRefs`、`hooks`
- 可选字段：`hooks`，用于任务级 HOOK 选择（如发放/完成提示覆盖）
- 任务条目格式要求统一，便于 Agent 与工具解析
- 标准格式为 marker 内的 Markdown 原生任务分段
- 每个任务必须有唯一任务 ID
- 推荐任务 ID 格式：`TASK-0001`、`TASK-0002` ...
- 任务应在适用时包含关联 roadmap ID（如 `ROADMAP-0001`）
- `designs/` 和 `reports/` 必须引用任务 ID 以支持反查
- 任务生命周期事件可触发 `hooks/` 中的提示（尤其是发放与完成）

推荐字段规范：
- `id`：`TASK-\d{4}`（如 `TASK-0001`）
- `status`：仅允许 `TODO|IN_PROGRESS|BLOCKED|DONE`
- `updatedAt`：ISO8601 UTC 时间
- `links`：仅放相对路径或 URL
- `links`：仅放相对路径或 URL（不要放纯 roadmap ID）
- `roadmapRefs`：可选字符串数组，元素必须匹配 `ROADMAP-\d{4}`
- `hooks`：可选对象，键如 `onAssigned`、`onCompleted`，值为 `hooks/` 下相对路径

推荐 Markdown 原生示例：

~~~md
<!-- PROJITIVE:TASKS:START -->
## TASK-0001 | TODO | 定义任务状态机
- owner: team-platform
- summary: 对齐状态流转与证据规则
- updatedAt: 2026-02-17T00:00:00.000Z
- roadmapRefs: ROADMAP-0001
- links:
  - ./designs/task-state-machine-design.md
- hooks:
  - onAssigned: ./hooks/on_task_assigned.md
  - onCompleted: ./hooks/on_task_completed.md
<!-- PROJITIVE:TASKS:END -->
~~~
