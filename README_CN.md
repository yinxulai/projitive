# Projitive

Projitive 是一套面向 Agent 协作的抽象治理规则与执行工具集，而非某个具体业务任务系统。

它定义三层能力：
- 规则层：统一项目、任务、状态与证据语义
- 流程层：统一 Discover → Plan → Execute → Validate → Sync 闭环
- 工具层：通过 MCP Server 提供发现与更新能力

## 设计目标

- 不绑定业务域：规则适用于任意项目类型
- 不绑定仓库结构：不依赖固定目录结构
- 不绑定执行主体：支持 Agent 与人工协同
- 可追溯优先：任何状态变化都要有证据

## 设计理念

- 面向长期演进：不是一次性任务工具，而是可持续推进的项目治理机制
- 适配多类 Agent：可用于 Claude Code、Copilot 以及其他 AI 执行工具
- 通用治理模型：可跨业务域、跨团队结构复用
- 可自我推进：通过发现、规划、执行、验证、回写闭环，让 Agent 在最少人工编排下持续推进任务

## 最小约定

每个被治理项目使用 `.projitive` 文件作为定位锚点：
- 通过查找 `.projitive` 文件识别治理根目录
- `.projitive` 所在目录即治理目录

治理目录中建议包含：
- `README.md`：边界、术语、上下文
- `roadmap.md`：阶段目标与里程碑
- `tasks.md`：任务池与状态
- `designs/`：设计决策
- `reports/`：执行证据与结果
- `hooks/`：事件型 AI 提示（发放/完成/阻塞/重开）

## 仓库结构

- `design/`：治理设计规范与编写约定
- `packages/mcp/`：MCP Server 实现
- `packages/skill/`：扩展包预留

关键设计文档：
- `design/HOOKS.md`：HOOK 提示规范
- `design/HOOKS_CN.md`：中文版本
- `design/ROADMAP.md` 与 `design/TASKS.md`：内置 ID 分配与引用规则

## 语言规则

- 默认英文
- 中文使用 `_CN` 后缀

## 快速开始

1. 阅读 `design/` 下治理设计规范
2. 在目标治理目录放置 `.projitive`
3. 准备治理工件（`README.md`、`roadmap.md`、`tasks.md`、`designs/`、`reports/`、`hooks/`）
4. 在治理 `README.md` 中定义 `Agent 必读`（本地与外部指南）
5. 启动 `packages/mcp` 并通过 MCP 工具执行治理操作
