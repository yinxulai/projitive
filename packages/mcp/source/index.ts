#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import packageJson from "../package.json" with { type: "json" }
import { registerProjectTools } from "./projitive.js"
import { registerTaskTools } from "./tasks.js"
import { registerRoadmapTools } from "./roadmap.js"
import { registerDesignContextResources, registerDesignContextPrompts } from "./design-context.js"

const PROJITIVE_SPEC_VERSION = "1.0.0"

const currentFilePath = fileURLToPath(import.meta.url)
const sourceDir = path.dirname(currentFilePath)
const repoRoot = path.resolve(sourceDir, "..", "..", "..")

const MCP_RUNTIME_VERSION = typeof packageJson.version === "string" && packageJson.version.trim().length > 0
  ? packageJson.version.trim()
  : PROJITIVE_SPEC_VERSION

const server = new McpServer({
  name: "projitive",
  version: MCP_RUNTIME_VERSION,
  description: "Semantic Projitive MCP for project/task discovery and agent guidance with markdown-first outputs",
})

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
    "## Start Here",
    "- Unknown project path: `projectScan` -> `projectLocate` -> `projectContext` -> `taskNext`.",
    "- Known project path: `projectContext` -> `taskNext` (or `taskList`) -> `taskContext`.",
    "- Need to bootstrap governance: call `projectInit(projectPath=\"<project-dir>\")` only when `.projitive` is missing.",
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
    "| 7 | Roadmap | roadmapList | inspect roadmap-task linkage |",
    "| 8 | Roadmap | roadmapContext | inspect one roadmap with references |",
    "| 9 | Project | projectNext | rank actionable projects across workspace |",
    "| 10 | Project | projectInit | bootstrap governance files if missing |"
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
      description: "Primary execution prompt: select one task, execute, and verify evidence consistency",
      argsSchema: {
        projectPath: z.string().optional(),
        taskId: z.string().optional(),
      },
    },
    async ({ projectPath, taskId }) => {
      const taskEntry = taskId && projectPath
        ? `1) Run taskContext(projectPath=\"${projectPath}\", taskId=\"${taskId}\").`
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

  server.registerPrompt(
    "updateTaskStatusWithEvidence",
    {
      title: "Update Task Status With Evidence",
      description: "Safe status transition playbook with mandatory evidence backfill",
      argsSchema: {
        projectPath: z.string(),
        taskId: z.string(),
        targetStatus: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]),
      },
    },
    async ({ projectPath, taskId, targetStatus }) => {
      const text = [
        "Perform a safe task status update with evidence alignment.",
        "",
        `1) Run taskContext(projectPath=\"${projectPath}\", taskId=\"${taskId}\").`,
        `2) Confirm transition to ${targetStatus} is valid.`,
        "3) Update tasks.md status and updatedAt.",
        "4) Add or update a report under reports/ with concrete evidence.",
        "5) Re-run taskContext and confirm status/evidence/reference consistency.",
        "6) If lint remains, fix and re-run taskContext once more.",
        "",
        "Checklist:",
        "- Transition is valid per status machine.",
        "- links/roadmapRefs remain parseable and consistent.",
        "- Only `hooks/task_no_actionable.md` is used as global background hook for no-task discovery.",
      ].join("\n")

      return asUserPrompt(text)
    }
  )

  server.registerPrompt(
    "triageProjectGovernance",
    {
      title: "Triage Project Governance",
      description: "Discovery-first triage prompt to pick project and next executable task",
      argsSchema: {},
    },
    async () => {
      const text = [
        "Triage governance and pick one execution target quickly.",
        "",
        "0) If known project has no `.projitive`, run projectInit(projectPath=<project-dir>) first.",
        "1) If project path is unknown, run projectScan() and pick one discovered project.",
        "2) Run projectNext() to rank projects.",
        "3) Run projectContext(projectPath=<selectedProject>).",
        "4) Run taskNext() for best actionable task.",
        "5) If manual filtering is needed, run taskList(projectPath=<selectedProject>, status=IN_PROGRESS).",
        "6) Continue with taskContext(projectPath=<selectedProject>, taskId=<selectedTaskId>).",
      ].join("\n")

      return asUserPrompt(text)
    }
  )
}

registerProjectTools(server)
registerTaskTools(server)
registerRoadmapTools(server)
registerGovernanceResources()
registerGovernancePrompts()
registerDesignContextResources(server)
registerDesignContextPrompts(server)

async function main(): Promise<void> {
  console.error(`[projitive-mcp] starting server`)
  console.error(`[projitive-mcp] version=${MCP_RUNTIME_VERSION} spec=${PROJITIVE_SPEC_VERSION} transport=stdio pid=${process.pid}`)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

void main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})
