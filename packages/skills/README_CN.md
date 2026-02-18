# @projitive/skills

面向 Projitive 治理项目的可复用 Skills 包。

## 安装

```bash
npx skills add @projitive/skills
```

在你的编码 Agent 中使用：

```text
/projitive 帮我用治理流程继续推进这个项目
```

## 内置 Skill

- `projitive`
  - 入口：`SKILL.md`
  - 初始化指南：`INIT.md`
  - 主执行规则：已直接写入 `SKILL.md`

## 发布时 references 自动同步

- 在 `npm publish` / `npm pack` 时，会自动将仓库根目录 `design/` 下英文文件复制到 `references/`。
- 同步规则：`design/*.md` 且排除 `*_CN.md`。

## 这个 skill 解决什么问题

- 治理结构初始化（`.projitive` 根与标准工件）
- 最短执行闭环（`taskNext -> taskContext -> 执行 -> 验证`）
- 证据优先的任务状态推进
- 与 `@projitive/mcp` 方法族的协同使用（可选，推荐）

## MCP 可选模式

- 已安装 MCP：优先用 MCP 方法做发现与上下文构建，效率更高。
- 未安装 MCP：仍可直接基于 `.projitive/*` 文件执行完整治理流程。
