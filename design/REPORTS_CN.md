# `reports/` 目录设计说明

## 1、该文件的作用

沉淀实施结果与验证结论，回答“做完了什么，如何证明”。

## 2、设计理念

- 证据优先：状态完成必须有报告支撑
- 结果可追溯：可定位变更范围与验证过程
- 风险可交接：未完成事项要有明确后续动作

## 3、内容或者子文件的编写风格/格式

- 子文件命名建议：`YYYY-MM-DD-topic.md`
- 每份报告建议固定包含：目标范围、变更摘要、验证结果、风险与后续动作
- 报告必须关联对应任务（`tasks.md`）与里程碑（`roadmap.md`）
- 验证结论建议使用可复查描述（命令、结果、截图或链接）
- 每份报告建议固定字段（可直接复制）：
	- `Task`、`Roadmap`、`Owner`、`Date`
	- `Scope`
	- `Changes`
	- `Validation`
	- `Risk / Follow-up`
- `Validation` 至少包含一条可复查证据：命令输出、测试结果、构建记录或截图链接
- `Risk / Follow-up` 必须显式写未完成项与预计处理时间
- `Task` 字段必须使用 `TASK-xxxx` 格式
- `Roadmap` 字段在关联 roadmap 时必须使用 `ROADMAP-xxxx` 格式

建议模板：

```md
# 2026-02-17-<topic>

Task: TASK-0001
Roadmap: ROADMAP-0001
Owner: team-platform
Date: 2026-02-17

## Scope

## Changes

## Validation
- Command:
- Result:
- Evidence:

## Risk / Follow-up
-
```
