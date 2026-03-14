# Projitive MCP 架构文档索引

本文档用于统一管理 `packages/mcp` 的架构设计与演进方案，避免设计信息分散在多个重构草稿中。

## 核心语义（先读）

- 数据唯一事实源是 `.projitive`（governance store）。
- `taskCreate` / `taskUpdate` / `roadmapCreate` / `roadmapUpdate` 写入治理存储，而不是直接写 `tasks.md` / `roadmap.md`。
- `tasks.md` / `roadmap.md` 是物化视图：默认按需惰性同步，也可通过 `syncViews` 立即同步。
- 手工编辑 `tasks.md` / `roadmap.md` 不具备权威性，后续同步可能覆盖改动。

## 文档结构

- `ARCHITECTURE_CN.md`
  - 当前可运行架构（governance-store-first）
  - 模块职责、数据流、读写路径
  - 运行期约束与可观测性建议

- `MIGRATION_ARCHITECTURE_CN.md`
  - 自动迁移架构设计
  - 版本治理策略（schema version / row version）
  - 迁移执行器、失败恢复、兼容窗口

## 维护规则

- 架构变更先更新设计文档，再进入实现。
- 每次修改 schema 或启动流程时，必须同步更新迁移文档。
- `REFACTOR_CN.md` 与 `REFACTOR_V2_CN.md` 作为历史设计记录，不作为当前主文档。

## 推荐阅读顺序

1. `ARCHITECTURE_CN.md`
2. `MIGRATION_ARCHITECTURE_CN.md`
3. `../README_CN.md`（工具入口与调用语义）
4. `../REFACTOR_V2_CN.md`（历史上下文）
