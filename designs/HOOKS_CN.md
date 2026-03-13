# `hooks/` 目录设计说明

语言：简体中文 | [English](HOOKS.md)

## 1、该文件的作用

定义一个全局后台 HOOK：当没有可执行任务时，引导 Agent 主动发现并创建任务。

## 2、设计理念

- 用户可控：提示内容由治理负责人维护
- 行为可预测：固定全局命名与加载行为
- 上下文安全：提示应限制范围，避免意图歧义
- 后台机制：HOOK 属于全局运行时控制，不是任务/路线图字段

## 3、内容或者子文件的编写风格/格式

- 目录位置：`<governanceDir>/hooks/`
- 当前支持的 HOOK 文件：
  - `task_no_actionable.md`：当 `taskNext` 返回 `actionableTasks: 0` 时使用的任务发现清单
- 提示编写建议：
  - 先写目标与约束
  - 明确输出格式
  - 避免与当前项目无关的泛化指令
- 可选 Front Matter 字段：
  - `id`：HOOK 标识（如 `HOOK-ASSIGN-001`）
  - `scope`：`global`
- 作用域规则：
  - HOOK 仅支持治理级全局作用域
  - `tasks.md` 与 `roadmap.md` 不应声明 hook 选择字段
  - `task_no_actionable.md` 缺失时，使用内置默认发现清单
- 容错规则：
  - 文件不存在：记录 warning 并继续
  - Front Matter 非法：忽略 Front Matter，回退正文
  - 文件为空：视为 no-op
  - 文件不可读：记录 error，但不阻塞任务生命周期

建议模板：

```md
---
id: HOOK-NO-TASK-001
scope: global
---

目标：
-

约束：
-

输出格式：
-
```

## 4、内建治理检查建议（模块内）

- HOOK 文件属于 `hooks/` 下的全局后台控制
- 若 `task_no_actionable.md` 存在但不可读，应告警
- 空 HOOK 文件应视为 no-op，不应阻断流程
- Front Matter 非法时应降级为正文解析
- HOOK 内容建议包含目标、约束、输出格式
