#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { registerProjectTools } from "./projitive.js"
import { registerTaskTools } from "./tasks.js"
import { registerRoadmapTools } from "./roadmap.js"

const PROJITIVE_SPEC_VERSION = "1.0.0"

const server = new McpServer({
  name: "projitive",
  version: PROJITIVE_SPEC_VERSION,
  description: "Semantic Projitive MCP for project/task discovery and agent guidance with markdown-first outputs",
})

const currentFilePath = fileURLToPath(import.meta.url)
const sourceDir = path.dirname(currentFilePath)
const repoRoot = path.resolve(sourceDir, "..", "..", "..")

function resolveRepoFile(relativePath: string): string {
  return path.join(repoRoot, relativePath)
}

async function readMarkdownOrFallback(relativePath: string, fallbackTitle: string): Promise<string> {
  const absolutePath = resolveRepoFile(relativePath)
  const content = await fs.readFile(absolutePath, "utf-8").catch(() => undefined)
  if (typeof content === "string" && content.trim().length > 0) {
    return content
  }

  return [
    `# ${fallbackTitle}`,
    "",
    `- file: ${relativePath}`,
    "- status: missing-or-empty",
    "- next: create this file or ensure it has readable markdown content",
  ].join("\n")
}

function renderMethodCatalogMarkdown(): string {
  return [
    "# MCP Method Catalog",
    "",
    "## Core Pattern",
    "- Prefer List/Context for primary discovery/detail flows.",
    "- Use Next/Scan/Locate for acceleration and bootstrapping.",
    "",
    "## Methods",
    "| Group | Method | Role |",
    "|---|---|---|",
    "| Project | projectInit | initialize governance directory structure |",
    "| Project | projectScan | discover governance projects by marker |",
    "| Project | projectNext | rank actionable projects |",
    "| Project | projectLocate | resolve nearest governance root |",
    "| Project | projectContext | summarize project governance context |",
    "| Task | taskList | list tasks with optional filters |",
    "| Task | taskNext | select top actionable task |",
    "| Task | taskContext | inspect one task with references |",
    "| Roadmap | roadmapList | list roadmap IDs and linked tasks |",
    "| Roadmap | roadmapContext | inspect one roadmap with references |",
  ].join("\n")
}

function registerGovernanceResources(): void {
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
          text: await readMarkdownOrFallback(".projitive/README.md", "Governance Workspace"),
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
          text: await readMarkdownOrFallback(".projitive/tasks.md", "Governance Tasks"),
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
          text: await readMarkdownOrFallback(".projitive/roadmap.md", "Governance Roadmap"),
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

function registerGovernancePrompts(): void {
  server.registerPrompt(
    "executeTaskWorkflow",
    {
      title: "Execute Task Workflow",
      description: "Guide an agent through taskNext -> taskContext -> artifact update -> verification",
      argsSchema: {
        rootPath: z.string().optional(),
        projectPath: z.string().optional(),
        taskId: z.string().optional(),
      },
    },
    async ({ rootPath, projectPath, taskId }) => {
      const text = [
        "You are executing Projitive governance workflow.",
        "",
        "Execution order:",
        taskId && projectPath
          ? `1) Run taskContext(projectPath=\"${projectPath}\", taskId=\"${taskId}\").`
          : `1) Run taskNext(${rootPath ? `rootPath=\"${rootPath}\"` : ""}).`,
        "2) Read Suggested Read Order and collect blocking gaps.",
        "3) Update markdown artifacts only (tasks/designs/reports/roadmap as needed).",
        "4) Re-run taskContext for the selected task and verify references are consistent.",
        "",
        "Hard rules:",
        "- Keep TASK/ROADMAP IDs immutable.",
        "- Every status transition must have report evidence.",
        "- Do not introduce non-governance file edits unless task scope requires.",
      ].join("\n")

      return asUserPrompt(text)
    }
  )

  server.registerPrompt(
    "updateTaskStatusWithEvidence",
    {
      title: "Update Task Status With Evidence",
      description: "Template for safe task status transitions and evidence alignment",
      argsSchema: {
        projectPath: z.string(),
        taskId: z.string(),
        targetStatus: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]),
      },
    },
    async ({ projectPath, taskId, targetStatus }) => {
      const text = [
        "Perform a safe task status update using Projitive rules.",
        "",
        `1) Run taskContext(projectPath=\"${projectPath}\", taskId=\"${taskId}\").`,
        `2) Plan status transition toward ${targetStatus}.`,
        "3) Update tasks.md status and updatedAt.",
        "4) Add or update a report under reports/ with concrete evidence.",
        "5) Re-run taskContext and confirm status/evidence/reference consistency.",
        "",
        "Checklist:",
        "- Transition is valid per status machine.",
        "- links/roadmapRefs remain parseable and consistent.",
        "- Hook paths (if any) still resolve.",
      ].join("\n")

      return asUserPrompt(text)
    }
  )

  server.registerPrompt(
    "triageProjectGovernance",
    {
      title: "Triage Project Governance",
      description: "Template to inspect a project and select next actionable governance task",
      argsSchema: {
        rootPath: z.string().optional(),
      },
    },
    async ({ rootPath }) => {
      const text = [
        "Triage governance across projects and pick execution target.",
        "",
        `1) Run projectNext(${rootPath ? `rootPath=\"${rootPath}\"` : ""}).`,
        "2) Select top ranked project.",
        "3) Run projectContext(projectPath=<selectedProject>).",
        "4) Run taskList(projectPath=<selectedProject>, status=IN_PROGRESS).",
        "5) If none, run taskNext to select TODO/IN_PROGRESS candidate.",
        "6) Continue with taskContext for detailed evidence mapping.",
      ].join("\n")

      return asUserPrompt(text)
    }
  )
}

registerTaskTools(server)
registerProjectTools(server)
registerRoadmapTools(server)
registerGovernanceResources()
registerGovernancePrompts()

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

void main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})
