// 治理资源管理

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { readMarkdownOrFallback } from "../common/utils.js"

export function registerGovernanceResources(server: McpServer, repoRoot: string): void {
  server.registerResource(
    "governanceWorkspace",
    "projitive://governance/workspace",
    {
      title: "Governance Workspace",
      description: "Primary governance README under .projitive",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "projitive://governance/workspace",
          text: await readMarkdownOrFallback(".projitive/README.md", "Governance Workspace", repoRoot),
        },
      ],
    })
  )

  server.registerResource(
    "governanceTasks",
    "projitive://governance/tasks",
    {
      title: "Governance Tasks",
      description: "Current task pool and status under .projitive/tasks.md",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "projitive://governance/tasks",
          text: await readMarkdownOrFallback(".projitive/tasks.md", "Governance Tasks", repoRoot),
        },
      ],
    })
  )

  server.registerResource(
    "governanceRoadmap",
    "projitive://governance/roadmap",
    {
      title: "Governance Roadmap",
      description: "Current roadmap under .projitive/roadmap.md",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "projitive://governance/roadmap",
          text: await readMarkdownOrFallback(".projitive/roadmap.md", "Governance Roadmap", repoRoot),
        },
      ],
    })
  )
}
