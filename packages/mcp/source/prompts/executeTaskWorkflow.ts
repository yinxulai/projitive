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

export function registerExecuteTaskWorkflowPrompt(server: McpServer): void {
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
