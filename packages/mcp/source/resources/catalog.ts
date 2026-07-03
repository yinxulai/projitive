import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerMethodCatalogResource(server: McpServer): void {
  server.registerResource(
    'methodCatalog',
    'projitive://mcp/method-catalog',
    {
      title: 'Projitive MCP Method Catalog',
      description: 'Concise usage guide for AI agents on how to use Projitive MCP tools, prompts, and resources',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: 'projitive://mcp/method-catalog',
          text: `# Projitive MCP Method Catalog

## Recommended workflow

1. projectScan() to locate governance roots when the project is unknown
2. projectContext(projectPath) to load overview and current state
3. taskNext(projectPath) to pick the next actionable task
4. taskContext(projectPath, taskId) to gather evidence and read order
5. taskUpdate(projectPath, taskId, updates) or roadmapUpdate(projectPath, roadmapId, updates) for state changes
6. taskContext(projectPath, taskId) again to verify consistency

## Working rules for agents

- Prefer '.projitive/' as the source of truth over generated markdown views
- Read context before making task or roadmap changes
- Use governance tools for writes instead of editing tasks.md or roadmap.md directly
- Re-verify after state changes and before declaring work complete
- If the project has no governance structure yet, begin with projectInit(projectPath)

## Core tools

- projectScan(projectPath?) : discover governable projects and roots
- projectContext(projectPath) : summarize governance context for a project
- taskNext(projectPath?) : choose the most actionable task
- taskContext(projectPath, taskId) : fetch evidence and read order
- taskCreate(projectPath, input) : create a new task
- taskUpdate(projectPath, taskId, updates) : update task state and metadata
- roadmapList(projectPath?) : list roadmaps and linked tasks
- roadmapContext(projectPath, roadmapId) : inspect roadmap context
- roadmapCreate(projectPath, input) : create a roadmap milestone
- roadmapUpdate(projectPath, roadmapId, updates) : update roadmap metadata

## Prompts

- quickStart(projectPath?) : start from project discovery and bootstrap guidance
- taskDiscovery(projectPath?) : find the first actionable task
- taskExecution(projectPath?, taskId?) : execute a known task with evidence-first guidance

## Resources

- projitive://governance/workspace
- projitive://governance/tasks
- projitive://governance/roadmap
- projitive://designs
- projitive://mcp/method-catalog

## Fast context checklist

- Read the governance overview first to understand project intent.
- Check the current task pool before creating new work.
- Read roadmap milestones to anchor new tasks in visible delivery goals.
- Review design docs and recent reports before changing architecture or implementation details.

## Governance directory conventions

- .projitive/README.md is the governance entry point and should be treated as the canonical project overview.
- .projitive/tasks.md and .projitive/roadmap.md are generated views for task and roadmap state; update them through the MCP tools rather than by hand.
- .projitive/designs/ stores design documents and evidence that should inform task execution and updates.
- Prefer the governance store in .projitive as the source of truth, and use syncViews() when you need refreshed markdown views.

## Guidance for AI agents

- Start with discovery and context, then execute, then verify.
- Keep task/roadmap updates evidence-backed and tied to reports, designs, or README changes.
- When work is blocked, capture blocker metadata fully before continuing.
- When core docs are missing or stale, treat that as actionable work and update them as part of the task.
`,
        },
      ],
    })
  )
}
