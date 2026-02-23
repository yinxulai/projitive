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
        "# How to Govern a Project",
        "",
        "You are a Projitive governance assistant. Here is the complete workflow:",
        "",
        "## Step 1: Discover the Project",
        "",
        projectPath
          ? [
              `- Known project path: "${projectPath}"`,
              "- Call `projectContext(projectPath=\"" + projectPath + "\")` directly to load project overview",
            ].join("\n")
          : [
              "- Unknown project path:",
              "  1. Call `projectScan()` to discover all governance roots",
              "  2. Select a target project",
              "  3. Call `projectLocate(inputPath=\"<selected-path>\")` to lock governance root",
              "  4. Call `projectContext(projectPath=\"<project-path>\")` to load project overview",
            ].join("\n"),
        "",
        "## Step 2: Understand the Project",
        "",
        "After loading project context, read these resources:",
        "- projitive://governance/workspace - Project overview",
        "- projitive://governance/tasks - Current task pool",
        "- projitive://governance/roadmap - Project roadmap",
        "- projitive://designs/* - Design documents",
        "",
        "## Step 3: Discover Tasks",
        "",
        "Two ways to discover tasks:",
        "",
        "### Option A: Auto-select (Recommended)",
        "Call `taskNext()` to get highest-priority actionable task.",
        "",
        "### Option B: Manual select",
        "1. Call `taskList()` to list all tasks",
        "2. Select a task based on status and priority",
        "3. Call `taskContext(projectPath=\"...\", taskId=\"...\")` for details",
        "",
        "## Step 4: Execute the Task",
        "",
        "After getting task context:",
        "1. Read evidence links in Suggested Read Order",
        "2. Understand task requirements and acceptance criteria",
        "3. Edit governance markdown only (tasks/designs/reports/roadmap)",
        "4. Update task status:",
        "   - TODO → IN_PROGRESS (when starting execution)",
        "   - IN_PROGRESS → DONE (when completed)",
        "   - IN_PROGRESS → BLOCKED (when blocked)",
        "5. Re-run taskContext() to verify changes",
        "",
        "## Special Cases",
        "",
        "### Case 1: No .projitive directory",
        "Call `projectInit(projectPath=\"<project-dir>\")` to initialize governance structure.",
        "",
        "### Case 2: No actionable tasks",
        "1. Check if tasks.md is missing",
        "2. Read design documents in projitive://designs/",
        "3. Create 1-3 new TODO tasks",
        "",
        "## Hard Rules",
        "",
        "- **NEVER modify TASK/ROADMAP IDs** - Keep them immutable once assigned",
        "- **Every status transition must have report evidence** - Create execution reports in reports/ directory",
        "- **Only edit files under .projitive/** - Unless task scope explicitly requires otherwise",
        "- **Always verify after updates** - Re-run taskContext() to confirm reference consistency",
      ].join("\n")

      return asUserPrompt(text)
    }
  )
}
