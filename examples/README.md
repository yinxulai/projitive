# Projitive 示例项目

本目录包含 Projitive 的使用示例和演示项目，帮助你快速上手 Projitive 的 AI 驱动开发治理。

## 目录

- [简单演示项目](#简单演示项目)
- [快速入门教程](#快速入门教程)
- [视频教程脚本](#视频教程脚本)

---

## 简单演示项目

### `simple-demo/`

这是一个完整的 Projitive 项目示例，展示了基本的治理结构和工作流。

**包含内容：**
- ✅ 完整的 `.projitive` 治理目录结构
- ✅ 示例任务和路线图
- ✅ 设计文档和报告模板
- ✅ AI 指导提示

**使用方法：**
```bash
cd simple-demo

# 查看治理结构
ls -la .projitive/

# 阅读治理说明
cat .projitive/README.md

# 查看任务列表
cat .projitive/tasks.md
```

---

## 快速入门教程

### 5 分钟快速开始

#### 第 1 步：创建项目结构

```bash
# 1. 创建项目目录
mkdir my-projitive-project
cd my-projitive-project

# 2. 初始化 git（可选但推荐）
git init

# 3. 创建治理标记
touch .projitive

# 4. 创建治理目录结构
mkdir -p .projitive/designs
mkdir -p .projitive/reports
mkdir -p .projitive/hooks
```

#### 第 2 步：创建基本治理文件

创建 `.projitive/README.md`：

```markdown
# My Project Governance

**Spec Version**: projitive-spec v1.1.0  
**Last Updated**: 2026-02-23

---

## Governance Goals

- Enable AI-driven development with traceability
- Maintain auditable task transitions
- Follow Projitive spec v1.1.0 conventions

## Scope Boundaries

### In Scope
- All source code in this repository
- Documentation and design artifacts
- CI/CD configuration

### Out of Scope
- Deployment to production environments
- External service configurations

## Key Terms

- **Governance Root**: The directory containing .projitive marker
- **Task**: A unit of work with status and evidence
- **Evidence**: Designs and reports that prove task completion
- **Roadmap**: High-level project milestones and goals

## Required Reading for Agents

- Local: ./tasks.md
- Local: ./roadmap.md
- External: https://github.com/projitive/projitive/README.md

## Related Artifacts

- roadmap: ./roadmap.md
- tasks: ./tasks.md
- designs: ./designs/
- reports: ./reports/
```

创建 `.projitive/roadmap.md`：

```markdown
# Roadmap

## Phase 1 - Initial Setup

### Goals
- Establish basic governance structure
- Create first tasks with evidence
- Demonstrate complete Projitive workflow

### Milestones
- [x] ROADMAP-0001: Project initialized with .projitive marker
- [ ] ROADMAP-0002: First task completed with evidence
- [ ] ROADMAP-0003: Full workflow demonstrated (discover → execute → report)

### Risks
- Tasks updated without report evidence
- ID drift between roadmap/tasks/designs/reports

### Dependencies
- Governance artifacts stay in .projitive/ only
```

创建 `.projitive/tasks.md`：

```markdown
# Tasks

本文件由 Projitive MCP 维护，手动编辑请保持 Markdown 结构合法。

&lt;!-- PROJITIVE:TASKS:START --&gt;
## TASK-0001 | TODO | Initialize project governance structure
- owner: ai-copilot
- summary: Create basic Projitive governance structure with .projitive marker, README.md, roadmap.md, and tasks.md.
- updatedAt: 2026-02-23T00:00:00.000Z
- roadmapRefs: ROADMAP-0001
- links:
  - ./README.md
  - ./roadmap.md
  - ./tasks.md
&lt;!-- PROJITIVE:TASKS:END --&gt;
```

#### 第 3 步：配置 MCP 服务器

在你的 OpenClaw 配置文件中添加：

```json
{
  "mcpServers": {
    "projitive": {
      "command": "npx",
      "args": ["-y", "@projitive/mcp"],
      "env": {
        "PROJITIVE_SCAN_ROOT_PATHS": "/path/to/workspace-a:/path/to/workspace-b",
        "PROJITIVE_SCAN_MAX_DEPTH": "3"
      }
    }
  }
}
```

说明：`PROJITIVE_SCAN_ROOT_PATHS` 使用系统分隔符拼接多个目录（Linux/macOS 用 `:`，Windows 用 `;`）。

#### 第 4 步：开始使用！

现在 AI 代理可以自动：
1. 使用 `projectLocate` 定位你的项目
2. 使用 `projectContext` 获取项目上下文
3. 使用 `taskNext` 找到下一个任务
4. 使用 `taskContext` 获取任务详情

---

## 视频教程脚本

### Projitive 快速入门教程（文字版）

**时长：约 10 分钟**

---

#### [0:00 - 1:00] 介绍和概览

**旁白：**
"大家好，欢迎来到 Projitive 快速入门教程。在接下来的 10 分钟里，我将向你展示如何使用 Projitive 来管理 AI 驱动的开发工作流。"

**画面：**
- Projitive logo
- 项目治理结构示意图
- 简单的动画展示 AI 代理如何与项目交互

**旁白：**
"Projitive 是一个开源的项目治理规范，专为 AI 驱动的开发而设计。它提供了完整的任务追踪、证据留存和工作流管理功能。"

---

#### [1:00 - 3:00] 创建项目结构

**旁白：**
"让我们开始吧。首先，我们需要创建一个基本的项目结构。"

**画面：**
- 终端演示
- 逐步创建目录和文件

**旁白：**
"首先创建项目目录，然后初始化 git。接着创建 .projitive 标记文件，这是 Projitive 识别项目的关键。"

**演示命令：**
```bash
mkdir my-projitive-project
cd my-projitive-project
git init
touch .projitive
mkdir -p .projitive/designs
mkdir -p .projitive/reports
mkdir -p .projitive/hooks
```

---

#### [3:00 - 5:00] 创建治理文件

**旁白：**
"现在，让我们创建基本的治理文件。这些文件将告诉 AI 代理如何理解和管理你的项目。"

**画面：**
- 编辑器展示创建 README.md
- 编辑器展示创建 roadmap.md
- 编辑器展示创建 tasks.md

**旁白：**
"README.md 定义了治理目标和范围。roadmap.md 规划了项目的里程碑。tasks.md 用于管理具体的任务。"

---

#### [5:00 - 7:00] 配置 MCP 服务器

**旁白：**
"接下来，我们需要配置 MCP 服务器，这样 AI 代理才能使用 Projitive 工具。"

**画面：**
- 打开 OpenClaw 配置文件
- 添加 Projitive MCP 服务器配置
- 保存并重启

**旁白：**
"在配置中，我们需要指定扫描根目录和最大深度。这样 Projitive 就能自动发现你的项目了。"

---

#### [7:00 - 9:00] 演示完整工作流

**旁白：**
"现在，让我们看一下完整的工作流是如何运作的。"

**画面：**
- AI 代理自动发现项目
- 获取下一个任务
- 执行任务并创建证据
- 更新任务状态

**旁白：**
"AI 代理会自动定位项目，获取任务，执行工作，然后创建报告和设计文档作为证据。整个过程都是可追溯的。"

---

#### [9:00 - 10:00] 总结和下一步

**旁白：**
"恭喜你！你已经成功设置了你的第一个 Projitive 项目。"

**画面：**
- 总结要点
- 推荐学习资源
- 社区链接

**旁白：**
"接下来，你可以阅读我们的最佳实践指南，了解如何从 v1.0.0 迁移到 v1.1.0，或者探索更多的示例项目。感谢观看！"

---

## 更多资源

- [Projitive 主文档](../README.md)
- [用户指南示例](../.projitive/designs/user-guide-examples.md)
- [最佳实践](../.projitive/designs/best-practices.md)
- [v1.1.0 迁移指南](../.projitive/designs/migration-guide-v1.1.0.md)

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这些示例！

## 许可证

MIT License
