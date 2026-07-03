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

1. projectScan()
2. projectContext(projectPath)
3. taskNext(projectPath)
4. taskContext(projectPath, taskId)
5. taskUpdate(projectPath, taskId, updates)
6. taskContext(projectPath, taskId) for verification

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

## Governance directory conventions

- .projitive/README.md is the governance entry point and should be treated as the canonical project overview.
- .projitive/tasks.md and .projitive/roadmap.md are generated views for task and roadmap state; update them through the MCP tools rather than by hand.
- .projitive/designs/ stores design documents and evidence that should inform task execution and updates.
- Prefer the governance store in .projitive as the source of truth, and use syncViews() when you need refreshed markdown views.

## Guidance for AI agents

- Prefer the governance store in .projitive as the source of truth.
- Use taskContext before making changes so updates are evidence-backed.
- Re-run taskContext after taskUpdate or roadmapUpdate to verify results.
- When a project has no governance files, start with projectInit(projectPath).
`,
        },
      ],
    })
  )
}
