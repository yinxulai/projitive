import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

function asUserPrompt(text: string) {
  return {
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text,
        },
      },
    ],
  }
}

export function registerQuickStartPrompt(server: McpServer): void {
  server.registerPrompt(
    'quickStart',
    {
      title: 'Quick Start',
      description: 'Complete workflow to discover project, load context, and start task execution',
      argsSchema: {
        projectPath: z.string().optional(),
      },
    },
    async ({ projectPath }) => {
      const text = [
        '# How to Govern a Project',
        '',
        'You are a Projitive governance assistant. Here is the complete workflow:',
        '',
        '## Step 1: Discover the Project',
        '',
        projectPath
          ? [
              `- Known project path: "${projectPath}"`,
              '- Call `projectContext(projectPath="' + projectPath + '")` directly to load project overview',
            ].join('\n')
          : [
              '- Unknown project path:',
              '  1. Call `projectScan()` to discover all governance roots',
              '  2. Select a target project',
              '  3. Call `projectLocate(inputPath="<selected-path>")` to lock governance root',
              '  4. Call `projectContext(projectPath="<project-path>")` to load project overview',
            ].join('\n'),
        '',
        '## Step 2: Understand the Project',
        '',
        'After loading project context, read these resources:',
        '- projitive://governance/workspace - Project overview',
        '- projitive://governance/tasks - Current task pool',
        '- projitive://governance/roadmap - Project roadmap',
        '- projitive://designs/* - Design documents',
        '',
        '## Step 3: Discover Tasks',
        '',
        'Two ways to discover tasks:',
        '',
        '### Option A: Auto-select (Recommended)',
        'Call `taskNext()` to get highest-priority actionable task.',
        'If no actionable tasks are returned and roadmap has active goals, analyze roadmap context and create 1-3 TODO tasks via `taskCreate()`.',
        'Then call `taskNext()` again to re-rank.',
        '',
        '### Option B: Manual select',
        '1. Call `taskList()` to list all tasks',
        '2. Select a task based on status and priority',
        '3. Call `taskContext(projectPath="...", taskId="...")` for details',
        '',
        '## Step 4: Execute the Task',
        '',
        'After getting task context:',
        '1. Read evidence links in Suggested Read Order',
        '2. Understand task requirements and acceptance criteria',
        '3. Write governance source via tools (`taskCreate` / `taskUpdate` / `roadmapCreate` / `roadmapUpdate`) instead of editing tasks.md/roadmap.md directly',
        '4. Update docs (`designs/` / `reports/`) as required by evidence',
        '5. taskCreate/taskUpdate/roadmapCreate/roadmapUpdate will auto-sync corresponding markdown views',
        '6. Update task status:',
        '   - TODO → IN_PROGRESS (when starting execution)',
        '   - IN_PROGRESS → DONE (when completed)',
        '   - IN_PROGRESS → BLOCKED (when blocked)',
        '7. Re-run taskContext() to verify changes',
        '',
        '## Autonomous Operating Loop',
        '',
        'Keep this loop until no high-value actionable work remains:',
        '1. Discover: `taskNext()`',
        '2. Execute: update governance store + docs + report evidence',
        '3. Verify: `taskContext()`',
        '4. Re-prioritize: `taskNext()`',
        '',
        'Stop and re-discover only when:',
        '- Current task is BLOCKED with a clear blocker description and unblock condition',
        '- Acceptance criteria are met and status is DONE',
        '- Project has no actionable tasks and requires roadmap-driven task creation',
        '',
        '## Special Cases',
        '',
        '### Case 1: No .projitive directory',
        'Call `projectInit(projectPath="<project-dir>")` to initialize governance structure.',
        '',
        '### Case 2: No actionable tasks',
        '1. Check if .projitive database is missing',
        '2. If roadmap has active goals, split milestones into 1-3 executable TODO tasks',
        '3. Apply task creation gate before adding each task:',
        '   - Clear outcome: one-sentence done condition',
        '   - Verifiable evidence: at least one report/designs/readme link target',
        '   - Small slice: should be completable in one focused execution cycle',
        '   - Traceability: include at least one roadmapRefs item when applicable',
        '   - Distinct scope: avoid overlap with existing DONE/BLOCKED tasks',
        '4. Prefer unblocking tasks that unlock multiple follow-up tasks',
        '5. Re-run `taskNext()` to pick the new tasks',
        '6. If still no tasks, read design documents in projitive://designs/ and create TODO tasks via `taskCreate()`',
        '',
        '## Hard Rules',
        '',
        '- **NEVER modify TASK/ROADMAP IDs** - Keep them immutable once assigned',
        '- **Every status transition must have report evidence** - Create execution reports in reports/ directory',
        '- **.projitive governance store is source of truth** - tasks.md/roadmap.md are generated views and may be overwritten',
        '- **Prefer tool writes over manual table/view edits** - Use taskCreate/taskUpdate/roadmapCreate/roadmapUpdate',
        '- **Always verify after updates** - Re-run taskContext() to confirm reference consistency',
      ].join('\n')

      return asUserPrompt(text)
    }
  )
}
