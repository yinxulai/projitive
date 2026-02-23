import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

function asUserPrompt(text: string) {
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text,
        },
      },
    ],
  }
}

export function registerDiscoverAndStartGovernancePrompt(server: McpServer): void {
  server.registerPrompt(
    "discoverAndStartGovernance",
    {
      title: "Discover and Start Governance",
      description: "Complete workflow to discover project, load context, and start task execution",
      argsSchema: {
        projectPath: z.string().optional(),
      },
    },
    async ({ projectPath }) => {
      const text = [
        "# 如何治理项目",
        "",
        "你是 Projitive 治理助手。以下是治理项目的完整流程：",
        "",
        "## 第一步：发现项目",
        "",
        projectPath
          ? [
              `- 已知项目路径: "${projectPath}"`,
              "- 直接调用 `projectContext(projectPath=\"" + projectPath + "\")` 加载项目概览",
            ].join("\n")
          : [
              "- 未知项目路径:",
              "  1. 调用 `projectScan()` 发现所有治理根目录",
              "  2. 选择一个目标项目",
              "  3. 调用 `projectLocate(inputPath=\"<selected-path>\")` 锁定治理根",
              "  4. 调用 `projectContext(projectPath=\"<project-path>\")` 加载项目概览",
            ].join("\n"),
        "",
        "## 第二步：理解项目",
        "",
        "项目上下文加载后，阅读以下资源：",
        "- projitive://governance/workspace - 项目概览",
        "- projitive://governance/tasks - 当前任务池",
        "- projitive://governance/roadmap - 项目路线图",
        "- projitive://designs/* - 设计文档",
        "",
        "## 第三步：发现任务",
        "",
        "有两种方式发现任务：",
        "",
        "### 方式 A：自动选择（推荐）",
        "调用 `taskNext()` 获取最高优先级的可执行任务。",
        "",
        "### 方式 B：手动选择",
        "1. 调用 `taskList()` 列出所有任务",
        "2. 根据状态和优先级选择一个任务",
        "3. 调用 `taskContext(projectPath=\"...\", taskId=\"...\")` 获取任务详情",
        "",
        "## 第四步：执行任务",
        "",
        "获取任务上下文后：",
        "1. 阅读 Suggested Read Order 中的证据链接",
        "2. 理解任务要求和验收标准",
        "3. 编辑治理文件（tasks.md / designs/*.md / reports/*.md / roadmap.md）",
        "4. 更新任务状态：",
        "   - TODO → IN_PROGRESS（开始执行时）",
        "   - IN_PROGRESS → DONE（完成后）",
        "   - IN_PROGRESS → BLOCKED（遇到阻塞时）",
        "5. 重新调用 `taskContext()` 验证变更",
        "",
        "## 特殊情况",
        "",
        "### 情况 1：没有 .projitive 目录",
        "调用 `projectInit(projectPath=\"<project-dir>\")` 初始化治理结构。",
        "",
        "### 情况 2：没有可执行任务",
        "1. 检查项目是否缺少 tasks.md",
        "2. 阅读 projitive://designs/ 中的设计文档",
        "3. 创建 1-3 个新的 TODO 任务",
        "",
        "## 硬性规则",
        "",
        "- **永远不要修改 TASK/ROADMAP ID** - ID 一旦分配就保持不变",
        "- **每次状态变更必须有报告证据** - 在 reports/ 目录创建执行报告",
        "- **只编辑 .projitive/ 目录下的文件** - 除非任务范围明确要求修改其他文件",
        "- **更新后必须验证** - 重新调用 `taskContext()` 确认引用一致",
      ].join("\n")

      return asUserPrompt(text)
    }
  )
}
