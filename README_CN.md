# Projitive

语言：简体中文 | [English](README.md)

**当前规范版本：projitive-spec v1.0.0**

Projitive 是一套面向 Agent 协作的抽象治理规则与执行工具集，而非某个具体业务任务系统。

## 它如何辅助 Agent 管理并推进项目（设计思路）

Projitive 要解决的核心问题是：Agent 会改代码，但往往无法长期、稳定地管理项目推进状态。

为此它采用四个约束来提高执行稳定性：

- **状态机优先**：任务状态（`TODO`、`IN_PROGRESS`、`BLOCKED`、`DONE`）有明确推进语义。
- **证据优先**：状态变化必须有 `designs/`、`reports/` 等工件作为证明。
- **上下文优先**：执行前先定位治理根并读取标准治理文档。
- **闭环优先**：不是一次性执行，而是持续循环（发现 -> 决策 -> 执行 -> 验证 -> 下一轮）。

落地到执行层，Agent 会按这个路径推进：

1. 先发现下一步目标（`taskNext` / `projectNext`）
2. 再构建可执行上下文（`taskContext` / `projectContext`）
3. 在治理工件中执行更新
4. 回查一致性后进入下一轮

核心价值是：**把零散的“会写代码”能力，变成可审计、可复用、可持续推进的项目执行能力**。

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

## 版本规范

- 规范版本：`projitive-spec v1.0.0`
- 对齐规则：各实现（包括 MCP）的主版本必须与规范主版本一致（`v1.x` 对 `v1.x`）
- 发布规则：
	- 规范发生破坏性升级（如 `v1` → `v2`）时，MCP 必须先升级主版本（如 `2.0.0`）
	- 向后兼容的新能力使用次版本升级（如 `1.1.0`）
	- 仅缺陷修复且不改接口语义时，使用补丁版本升级（如 `1.0.1`）

## 快速开始

1. 阅读 `design/` 下治理设计规范
2. 在目标治理目录放置 `.projitive`
3. 准备治理工件（`README.md`、`roadmap.md`、`tasks.md`、`designs/`、`reports/`、`hooks/`）
4. 在治理 `README.md` 中定义 `Agent 必读`（本地与外部指南）
5. 启动 `packages/mcp` 并通过 MCP 工具执行治理操作
