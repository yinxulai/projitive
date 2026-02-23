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
}
