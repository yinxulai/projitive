# `README.md` 设计说明

语言：简体中文 | [English](README.md)

## 1、该文件的作用

定义“被治理项目中的 `README.md` 工件规范”，并作为 Agent 的治理入口说明。
该文件用于向 AI 明确项目背景，以及执行前必须阅读的本地/外部规范

## 2、设计理念

- 边界优先：先明确治理范围，再拆解 roadmap 与 tasks
- 语义统一：统一术语，减少跨角色沟通歧义
- 引导执行：显式告诉 AI（如 Claude Code / Copilot）必须先读哪些文件
- 上下文最小闭环：读完 `README.md` 即可理解治理范围、规则和必读参考

## 3、内容或者子文件的编写风格/格式

- 建议固定章节（顺序固定，便于解析和比较版本）：
	1. `## 治理目标`
	2. `## 范围边界`
	3. `## 关键术语`
	4. `## Agent 必读`
	5. `## 关联工件`
- `范围边界` 必须明确区分：`In Scope` 与 `Out of Scope`
- `关键术语` 使用“术语：定义”一行一条，避免段落描述
- `关联工件` 必须使用相对路径链接到 `roadmap.md`、`tasks.md`、`designs/`、`reports/`
- 若配置生命周期提示，`关联工件` 应包含 `hooks/`
- `Agent 必读` 应明确列出：
	- 本项目治理文件
	- 外部官方指南文件（若有）
	- 工具特定说明文件（如 Claude/Copilot 指南）
- 文风以“定义式 + 列表化”为主，避免叙事性长段落

建议模板：

```md
# <项目治理名称>

## 治理目标
-

## 范围边界
### In Scope
-
### Out of Scope
-

## 关键术语
- 术语A：
- 术语B：

## Agent 必读
- Local: ./tasks.md
- Local: ./roadmap.md
- Local: ./hooks/on_task_assigned.md
- External: <official-guide-path-or-link>

## 关联工件
- roadmap: ./roadmap.md
- tasks: ./tasks.md
- designs: ./designs/
- reports: ./reports/
- hooks: ./hooks/
```
