// 治理工作流程提示

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function registerGovernancePrompts(server: McpServer): void {
  // 新增：发现和启动治理的 Prompt
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
        "You are starting Projitive governance workflow from scratch.",
        "",
        "Complete discovery and startup workflow:",
        projectPath
          ? [
              `1) Project path is known: "${projectPath}"`,
              "2) Run projectContext(projectPath=\"" + projectPath + "\") to load project summary.",
              "3) Run taskNext() to get highest-priority actionable task.",
              "4) Run taskContext(projectPath=\"" + projectPath + "\", taskId=\"<taskId>\") to get full context.",
            ].join("\n")
          : [
              "1) Project path is unknown: Run projectScan() to discover all governance roots.",
              "2) Review scan results and select a project to work on.",
              "3) Run projectLocate(inputPath=\"<selected-path>\") to lock the governance root.",
              "4) Run projectContext(projectPath=\"<project-path>\") to load project summary.",
              "5) Run taskNext() to get highest-priority actionable task.",
              "6) Run taskContext(projectPath=\"<project-path>\", taskId=\"<taskId>\") to get full context.",
            ].join("\n"),
        "",
        "Key resources to read:",
        "- projitive://governance/workspace - Project overview",
        "- projitive://governance/tasks - Current task pool",
        "- projitive://governance/roadmap - Project roadmap",
        "- projitive://designs/* - Design documents",
        "",
        "Hard rules:",
        "- Keep TASK/ROADMAP IDs immutable.",
        "- Every status transition must have report evidence.",
        "- Only edit files in .projitive/ directory.",
      ].join("\n")

      return asUserPrompt(text)
    }
  )

  // 新增：查找并执行第一个任务的简化 Prompt
  server.registerPrompt(
    "findAndExecuteFirstTask",
    {
      title: "Find and Execute First Task",
      description: "Minimal steps to find, context, and execute the first actionable task",
      argsSchema: {
        projectPath: z.string().optional(),
      },
    },
    async ({ projectPath }) => {
      const text = [
        "Execute the minimal Projitive workflow to find and start your first task.",
        "",
        projectPath
          ? [
              "Fast path (known project):",
              `1) Run taskNext() to auto-select highest-priority task.`,
              "2) Run taskContext(taskId=\"<selected-task-id>\") for detailed context.",
              "3) Follow suggested read order to understand requirements.",
              "4) Execute the task by editing governance markdown.",
              "5) Re-run taskContext to verify changes.",
            ].join("\n")
          : [
              "Full path (unknown project):",
              "1) Run projectScan() to find governance roots.",
              "2) Run projectLocate() to select a project.",
              "3) Run projectContext() to load project overview.",
              "4) Run taskNext() to auto-select task.",
              "5) Run taskContext() to get task details.",
              "6) Execute the task and verify.",
            ].join("\n"),
        "",
        "Quick reference:",
        "- taskNext() - Find best task",
        "- taskContext() - Get task details",
        "- taskUpdate() - Update status",
      ].join("\n")

      return asUserPrompt(text)
    }
  )

  server.registerPrompt(
    "executeTaskWorkflow",
    {
      title: "Execute Task Workflow",
      description: "Primary execution prompt: select one task, execute, and verify evidence consistency",
      argsSchema: {
        projectPath: z.string().optional(),
        taskId: z.string().optional(),
      },
    },
    async ({ projectPath, taskId }) => {
      const taskEntry = taskId && projectPath
        ? `1) Run taskContext(projectPath="${projectPath}", taskId="${taskId}").`
        : "1) Run taskNext().";

      const text = [
        "You are executing Projitive governance workflow in agent-first mode.",
        "",
        "Fast path:",
        taskEntry,
        "2) Follow Suggested Read Order and identify execution blockers.",
        "3) Edit governance markdown only (tasks/designs/reports/roadmap).",
        "4) Re-run taskContext for the selected task and verify references.",
        "",
        "Fallbacks:",
        "- If `.projitive` is missing for a known project, run `projectInit(projectPath=\"<project-dir>\")` first.",
        "- If taskNext returns no actionable task, follow its no-task checklist and create 1-3 TODO tasks.",
        "- If project is unknown, run projectScan -> projectLocate -> projectContext before task tools.",
        "",
        "Hard rules:",
        "- Keep TASK/ROADMAP IDs immutable.",
        "- Every status transition must have report evidence.",
        "- Do not introduce non-governance file edits unless task scope requires.",
      ].join("\n")

      return asUserPrompt(text)
    }
  )
}

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
