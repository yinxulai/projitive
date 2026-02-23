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

export function registerDesignContextResources(server: McpServer): void {
  // Register design context resources
  server.registerResource(
    "designContext",
    "projitive://design-context/designs",
    {
      title: "Design Context",
      description: "Design context and resources for the project",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "projitive://design-context/designs",
          text: `# Design Context\n\nThis is the design context for the project.`,
        },
      ],
    })
  )
}

export function registerDesignContextPrompts(server: McpServer): void {
  // Register design context prompts
  server.registerPrompt(
    "designContext",
    {
      title: "Design Context",
      description: "Get design context for the project",
      argsSchema: {
        projectPath: z.string().optional(),
      },
    },
    async ({ projectPath }) => {
      const text = [
        "You are exploring the design context for the project.",
        "",
        projectPath
          ? [
              `1) Project path is known: "${projectPath}"`,
              "2) Review the design context resources.",
              "3) Identify design patterns and guidelines.",
            ].join("\n")
          : [
              "1) Project path is unknown: Run projectScan() to discover all governance roots.",
              "2) Select a project to work on.",
              "3) Run projectContext() to load project summary.",
              "4) Review the design context resources.",
            ].join("\n"),
        "",
        "Key resources to read:",
        "- projitive://design-context/designs - Design context and resources",
        "- projitive://governance/workspace - Project overview",
        "- projitive://governance/roadmap - Project roadmap",
        "",
        "Hard rules:",
        "- Follow the design patterns and guidelines.",
        "- Keep design documents in the .projitive/designs/ directory.",
      ].join("\n")

      return asUserPrompt(text)
    }
  )
}
