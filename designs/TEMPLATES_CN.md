# `templates/` 目录设计说明

语言：简体中文 | [English](TEMPLATES.md)

## 1、该文件的作用

定义各 MCP 工具的响应模板，控制工具输出的渲染格式。
允许治理负责人在不修改 Projitive 源码的情况下，自定义工具输出结构。

## 2、设计理念

- 用户可控：模板文件由治理负责人维护
- 自动预置：首次渲染前如模板缺失，自动生成默认文件
- 工具隔离：每个工具一个模板文件，避免互相影响
- 变量驱动：模板使用 `{{变量名}}` 占位符注入动态内容

## 3、内容或者子文件的编写风格/格式

- 目录位置：`<governanceDir>/templates/tools/`
- 命名规则：`<toolName>.md`（如 `taskNext.md`、`taskContext.md`）
- 支持的模板变量：
  - `{{tool_name}}` — 当前工具名称
  - `{{summary}}` — 工具渲染的摘要段落
  - `{{evidence}}` — 工具渲染的证据段落
  - `{{guidance}}` — 工具渲染的 Agent 指导段落
  - `{{suggestions}}` — 工具渲染的 lint 建议段落
  - `{{next_call}}` — 推荐的下一步工具调用
- 环境变量覆盖：
  - 设置 `PROJITIVE_MESSAGE_TEMPLATE_PATH` 指向自定义模板目录
  - 若路径为目录，则加载 `<dir>/<toolName>.md`
  - 若路径为单个 `.md` 文件，则所有工具共用该文件
- 容错规则：
  - 模板文件不存在：自动从内置默认生成后继续
  - 模板文件为空：视为缺失，回退到内置默认
  - 模板文件不可读：记录错误，使用内置默认，不阻塞流程

默认模板扩展内容一览：

| 工具 | 扩展默认段落 |
|---|---|
| `taskNext` | `## Idle Discovery Checklist (When No Actionable Task)` |
| `projectContext`、`taskContext`、`roadmapContext` | `## Common Tool Guides To Read First` |
| `taskUpdate`、`roadmapUpdate` | `## Commit Reminder` |
| 其他工具 | 仅基础段落 |

基础模板结构：

```md
# {{tool_name}}

## Summary
{{summary}}

## Evidence
{{evidence}}

## Agent Guidance
{{guidance}}

## Lint Suggestions
{{suggestions}}

## Next Call
{{next_call}}
```

## 4、内建治理检查建议（模块内）

- 模板文件属于 `templates/tools/` 下的工具级控制
- 若模板文件存在但不可读，应告警
- 空模板文件应视为缺失（自动生成）
- 模板变量必须在渲染前完成注入；未知变量保留原样
- `projectInit` 会创建 `templates/` 目录，并为所有内置工具生成默认模板文件
