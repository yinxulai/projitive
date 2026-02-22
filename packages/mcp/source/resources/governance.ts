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

  server.registerResource(
    "mcpMethodCatalog",
    "projitive://mcp/method-catalog",
    {
      title: "MCP Method Catalog",
      description: "Method naming and purpose map for agent routing",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "projitive://mcp/method-catalog",
          text: renderMethodCatalogMarkdown(),
        },
      ],
    })
  )
}

function renderMethodCatalogMarkdown(): string {
  return [
    "# MCP Method Catalog",
    "",
    "## Start Here",
    "- Unknown project path: `projectScan` -> `projectLocate` -> `projectContext` -> `taskNext`.",
    "- Known project path: `projectContext` -> `taskNext` (or `taskList`) -> `taskContext`.",
    "- Need to bootstrap governance: call `projectInit(projectPath=\"<project-dir>\")` only when `.projitive` is missing.",
    "- Auto-creating tasks: use `taskCalculateConfidence` first to validate safety (Spec v1.1.0)",
    "",
    "## Methods",
    "| Order | Group | Method | Agent Use |",
    "|---|---|---|---|",
    "| 1 | Project | projectScan | discover governance roots when project is unknown |",
    "| 2 | Project | projectLocate | lock nearest governance root from any path |",
    "| 3 | Project | projectContext | load project summary before task decisions |",
    "| 4 | Task | taskNext | auto-pick highest-priority actionable task |",
    "| 5 | Task | taskList | list/filter tasks for manual selection |",
    "| 6 | Task | taskContext | inspect one task with evidence and read order |",
    "| 7 | Task | taskUpdate | update task status and metadata (supports Spec v1.1.0 subState/blocker) |",
    "| 8 | Task | taskCalculateConfidence | calculate confidence score for auto-creating tasks (Spec v1.1.0) |",
    "| 9 | Task | taskCreateValidationHook | create/update task auto-create validation hook (Spec v1.1.0) |",
    "| 10 | Roadmap | roadmapList | inspect roadmap-task linkage |",
    "| 11 | Roadmap | roadmapContext | inspect one roadmap with references |",
    "| 12 | Project | projectNext | rank actionable projects across workspace |",
    "| 13 | Project | projectInit | bootstrap governance files if missing |",
  ].join("\n")
}
