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

export function registerFindAndExecuteFirstTaskPrompt(server: McpServer): void {
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
}
