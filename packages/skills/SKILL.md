---
name: projitive
description: >
  Projitive is an MCP-first governance skill for agent-driven delivery. Use this before changing task states or writing governance artifacts. Core flow: taskNext -> taskContext -> execute -> verify -> taskNext. Always prefer Projitive MCP methods for discovery, context, and proactive task advancement.
metadata:
  author: projitive
  version: "1.0.0"
---

# MCP Setup (Default Required)

Install (always use latest):

```bash
npm install -g @projitive/mcp@latest
```

> `@projitive/mcp` must be kept up to date — outdated versions may be missing tools or contain bugs.

Key methods:

- Discovery: `projectLocate` / `projectScan` / `projectNext`
- Context: `projectContext` / `taskList` / `taskContext` / `roadmapContext`
- Execution: `taskNext`
- Planning: `taskCreate` / `roadmapCreate`

# Init: Repo Governance Setup

When `.projitive/` does not exist or is incomplete, call `projectInit(projectPath="<project-dir>")` immediately. Do NOT ask the user to do this manually.

# Mandatory Governance Files

- `README.md` — scope, glossary, required reading
- `roadmap.md` — stage goals and milestones
- `tasks.md` — task pool with status + evidence
- `designs/` — design decisions and rationale
- `reports/` — execution reports and evidence
- `templates/` — per-tool response templates

# Execution Loop

1. `taskNext` — pick actionable task
2. `taskContext` — get evidence and hints
3. Execute; update `designs/` and `reports/`
4. `taskContext` — verify alignment
5. Repeat

If `taskNext` returns empty: `projectContext` → `roadmapContext` → `taskCreate` 1–3 focused TODOs (+ `roadmapCreate` if needed) → `taskNext`.

# Task Status Rules

- `TODO` → `IN_PROGRESS`: execution started, scope clear
- `IN_PROGRESS` → `DONE`: evidence exists, criteria met
- `IN_PROGRESS` → `BLOCKED`: external dependency blocks progress
- `BLOCKED` → `TODO/IN_PROGRESS`: after blocker resolution is documented

Never mark `DONE` without evidence references.

# Evidence Rules

- Design rationale → `.projitive/designs/`
- Execution outcome → `.projitive/reports/`
- Task updates must reference exact evidence files

# Always-on Rules

- Resolve governance root before any task decisions
- Governance state writes MUST go through MCP tools; never directly edit `tasks.md`/`roadmap.md`
- Keep status transitions explicit and evidence-linked
- Preserve ID stability in roadmap/tasks/designs/reports
- Prefer smallest valid step that moves one task forward

# Fallback (no MCP)

1. Find nearest `.projitive/`
2. Read `README.md` + `roadmap.md` + `tasks.md`
3. Execute one narrow task
4. Write evidence to `designs/` or `reports/`
5. Update task status in `tasks.md`
