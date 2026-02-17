# `hooks/` 目录设计说明

## 1、该文件的作用

定义用户可维护的 HOOK 提示，在任务生命周期事件（尤其是发放与完成）时，为 AI 注入额外指引。

## 2、设计理念

- 用户可控：提示内容由治理负责人维护
- 事件驱动：提示绑定到明确生命周期事件
- 行为可预测：固定命名与加载优先级
- 上下文安全：提示应限制范围，避免意图歧义

## 3、内容或者子文件的编写风格/格式

- 目录位置：`<governanceDir>/hooks/`
- 推荐事件文件：
  - `on_task_assigned.md`：任务发放/开始时注入额外提示
  - `on_task_completed.md`：任务完成时注入额外提示
- 可选事件文件：
  - `on_task_blocked.md`
  - `on_task_reopened.md`
- 提示编写建议：
  - 先写目标与约束
  - 明确输出格式
  - 避免与当前项目无关的泛化指令
- 可选 Front Matter 字段：
  - `id`：HOOK 标识（如 `HOOK-ASSIGN-001`）
  - `scope`：`global` 或 `task`
  - `appliesTo`：任务 ID 列表或通配符
- 优先级规则：
  - 任务级 HOOK（`tasks.md` 中 `hooks.*`）优先级最高
  - 若未配置任务级 HOOK，则回退到 `hooks/` 目录中的全局事件文件
  - 两者都不存在时，按“无 HOOK”继续执行
- 容错规则：
  - 文件不存在：记录 warning 并继续
  - Front Matter 非法：忽略 Front Matter，回退正文
  - 文件为空：视为 no-op
  - 文件不可读：记录 error，但不阻塞任务生命周期

建议模板：

```md
---
id: HOOK-ASSIGN-001
scope: task
appliesTo: ["TASK-0001", "TASK-0002"]
---

目标：
-

约束：
-

输出格式：
-
```
