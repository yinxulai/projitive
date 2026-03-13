# `designs/` 目录设计说明

语言：简体中文 | [English](DESIGNS.md)

## 1、该文件的作用

记录方案设计与关键决策，回答“为什么这样做”。

## 2、设计理念

- 决策显式化：重要取舍必须文档化
- 上下文连续性：新人可以从设计文档快速接手
- 可关联性：设计文档应被 `tasks.md` 和 `reports/` 引用

## 3、内容或者子文件的编写风格/格式

- 子文件建议按“问题背景 → 方案对比 → 决策结论 → 风险”固定结构编写
- 命名建议：`feature-name-design.md`、`feature-name-review.md`
- 设计文档需引用关联任务 ID，并标注影响范围
- 一次关键决策只在一个主文档沉淀，避免多处冲突版本
- 每份 `*-design.md` 建议固定章节：
	- `## 背景`
	- `## 目标与非目标`
	- `## 方案选项`
	- `## 决策`
	- `## 影响范围`
	- `## 风险与回滚`
- 每份 `*-review.md` 建议固定章节：
	- `## 评审结论`
	- `## 变更意见`
	- `## 待解决问题`
- 设计文档头部建议加入元信息：`Task`、`Owner`、`Status`、`Last Updated`
- `Task` 字段必须使用 `TASK-xxxx` 格式
- 如关联里程碑，新增 `Roadmap` 字段并使用 `ROADMAP-xxxx` 格式
- 一个设计文档可关联多个 ID，但至少要有一个 `TASK-xxxx`

建议模板（design）：

```md
# <feature>-design

Task: TASK-0001
Roadmap: ROADMAP-0001
Owner: team-platform
Status: Draft
Last Updated: 2026-02-17

## 背景

## 目标与非目标

## 方案选项

## 决策

## 影响范围

## 风险与回滚
```

## 4、内建治理检查建议（模块内）

- `Task` 元信息必填且必须匹配 `TASK-xxxx`
- 若有 `Roadmap` 元信息，必须匹配 `ROADMAP-xxxx`
- `Last Updated` 建议使用可校验时间格式
- 设计文档应被相关任务 `links` 引用
- 同一决策范围避免出现多个主设计文档
