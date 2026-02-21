# Tasks

本文件由 Projitive MCP 维护，手动编辑请保持 Markdown 结构合法。

<!-- PROJITIVE:TASKS:START -->
## TASK-0001 | DONE | Bootstrap repository self-management governance
- owner: ai-copilot
- summary: Create baseline governance artifacts in .projitive and validate one-step task execution path.
- updatedAt: 2026-02-21T07:48:00.000Z
- roadmapRefs: ROADMAP-0001
- links:
  - ./README.md
  - ./roadmap.md
  - ./tasks.md
  - ./designs/self-management-bootstrap.md
  - ./reports/bootstrap-2026-02-17.md
  - ./reports/task-0001-completion-2026-02-21.md

## TASK-0002 | TODO | Stabilize default task.next workflow
- owner: ai-copilot
- summary: Audit docs and MCP responses to ensure agents always discover actionable tasks in one call.
- updatedAt: 2026-02-17T23:50:00.000Z
- roadmapRefs: ROADMAP-0001
- links:
  - ../packages/mcp/README.md
  - ../packages/mcp/source/index.ts
  - ../packages/mcp/source/tasks.ts

## TASK-0003 | TODO | Prepare spec v1.1 governance change proposal
- owner: ai-copilot
- summary: Draft roadmap and task-level changes for next spec version and migration guidance.
- updatedAt: 2026-02-17T23:50:00.000Z
- roadmapRefs: ROADMAP-0002
- links:
  - ../README.md
  - ../design/ROADMAP.md
  - ../design/TASKS.md

## TASK-0004 | DONE | Consolidate recommended task discovery workflow
- owner: ai-copilot
- summary: Align docs, prompts, and tool guidance on one canonical flow (`taskNext -> taskContext -> update -> verify`) with clear fallback paths.
- updatedAt: 2026-02-21T04:48:00.000Z
- roadmapRefs: ROADMAP-0004
- links:
  - ../README.md
  - ../packages/mcp/README.md
  - ../packages/mcp/source/tasks.ts
  - ./README.md
  - ./reports/task-0004-consolidation-2026-02-21.md

## TASK-0005 | TODO | Improve auto-discovery and task creation mechanism
- owner: ai-copilot
- summary: Propose and implement safer auto-discovery defaults plus a governed task creation mechanism with validation rules.
- updatedAt: 2026-02-20T00:00:00.000Z
- roadmapRefs: ROADMAP-0004
- links:
  - ../packages/mcp/source/projitive.ts
  - ../packages/mcp/source/tasks.ts
  - ../design/TASKS.md
  - ./roadmap.md

## TASK-0006 | TODO | Enhance MCP design onboarding context
- owner: ai-copilot
- summary: Add fast-start context for agents to understand Projitive design goals, constraints, and execution rules in minimal calls.
- updatedAt: 2026-02-20T00:00:00.000Z
- roadmapRefs: ROADMAP-0004
- links:
  - ../design/README.md
  - ../design/PROJITIVE.md
  - ../packages/mcp/source/index.ts
  - ../packages/mcp/README.md
<!-- PROJITIVE:TASKS:END -->
