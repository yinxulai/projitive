---
name: projitive
description: >
  Projitive is a governance skill for agent-driven delivery. Use this before changing task states or writing governance artifacts. Core flow: taskNext -> taskContext -> execute -> verify. Supports project-level triage and roadmap context.
metadata:
  author: projitive
  version: "1.0.0"
---

Projitive helps agents continuously ship under governance constraints, not just edit code.

---

# Core scenarios (what this skill handles)

1. **projitive init** — initialize governance structure in a repository
2. **Continue project execution** — pick actionable task and advance with evidence
3. **Project triage** — scan/locate project root and summarize governance health
4. **Task status transition** — update task status with design/report evidence discipline

# Init: Repo Governance Setup

When `.projitive/` directory does not exist or is incomplete, you MUST automatically:

1. Create/initialize governance structure
2. Follow init prompt below to build baseline artifacts and writing standards

```
https://raw.githubusercontent.com/yinxulai/projitive/main/packages/skills/INIT.md
```

Do NOT ask the user to do this manually — just do it.

# Mandatory Governance Files

At the governance root, these artifacts should exist and be read before task execution:

- `README.md` — scope, glossary, required reading for agents
- `roadmap.md` — stage goals and milestones
- `tasks.md` — task pool with status + evidence
- `designs/` — design decisions and rationale
- `reports/` — execution reports and evidence
- `hooks/` — event guidance hooks

# MCP Tooling Prerequisite

Projitive MCP is **optional but recommended**.

- If MCP is available, prefer MCP methods for discovery/context/next-step acceleration.
- If MCP is not available, continue with manual governance workflow by reading/updating `.projitive/*` files directly.
- Do not block execution solely because MCP is missing.

Recommended install (optional):

```bash
npm install -g @projitive/mcp
```

Preferred methods for daily execution:

- Discovery: `projectNext`, `projectScan`, `projectLocate`
- Context: `projectContext`, `taskList`, `taskContext`, `roadmapContext`
- Execution accelerator: `taskNext`

# How it works

Use the execution contract below directly.

# Execution SOP: Existing Governed Project

Execution mode decision:

- **Mode A (preferred)**: MCP-assisted execution
- **Mode B (fallback)**: Manual file-driven execution (no MCP)

## Step 1 (Resolve governance context)

In one assistant message, trigger parallel context discovery:

- Mode A: project root resolution (`projectLocate` or `projectScan/projectNext`) + governance summary (`projectContext`)
- Mode B: locate nearest `.projitive/` manually, then read `README.md`, `roadmap.md`, `tasks.md` for current context

If `.projitive/` is missing or incomplete, run full init first (follow `INIT.md`) before continuing.

## Step 2 (Pick actionable target)

Default path (fastest):

- Mode A: `taskNext` to pick one actionable task, then `taskContext`
- Mode B: read `tasks.md`, pick top actionable task using status + dependency + evidence completeness

Alternative path (manual):

- Mode A: `taskList` -> choose one task -> `taskContext`
- Mode B: manual task selection with explicit reasoning in report/design artifact

## Step 3 (Execute with evidence discipline)

During execution:

- Update implementation/code as required by the selected task
- Create or update evidence in `.projitive/designs/` and/or `.projitive/reports/`
- Keep task scope narrow and verifiable

## Step 4 (Verify and continue)

After updates:

- Mode A: re-run `taskContext` to verify status/evidence alignment
- Mode B: manually verify task state in `tasks.md` + evidence links in `.projitive/designs/` / `.projitive/reports/`
- If still actionable, continue to next task using `taskNext`
- If blocked, record blocker and required dependency explicitly

---

# Execution SOP: New or Ungoverned Project

1. Run governance init (`INIT.md`)
2. Confirm baseline artifacts exist
3. Start loop with `taskNext`
4. Execute and verify with evidence

---

# Task Status Rules

- `TODO` -> `IN_PROGRESS`: when execution has started and scope is clear
- `IN_PROGRESS` -> `DONE`: only when evidence exists and acceptance criteria are met
- `IN_PROGRESS` -> `BLOCKED`: when external dependency prevents progress
- `BLOCKED` -> `TODO/IN_PROGRESS`: only after blocker resolution is documented

Never mark `DONE` without evidence references.

# Evidence Rules

- Design rationale belongs in `.projitive/designs/`
- Implementation outcome and validation belong in `.projitive/reports/`
- Task updates should reference exact evidence files
- Prefer append-only updates to preserve audit history

# Tool Use Rule

Default method priority:

1. `taskNext`
2. `taskContext`
3. execute updates
4. `taskContext` (verify)
5. repeat

Use project-level tools when task-level context is insufficient:

- `projectContext`
- `roadmapContext`
- `roadmapList`

No-MCP fallback order:

1. read `.projitive/tasks.md`
2. read related references from `.projitive/README.md` and `.projitive/roadmap.md`
3. execute one narrow task
4. write evidence to `.projitive/designs/` or `.projitive/reports/`
5. update task status in `.projitive/tasks.md`

# Always-on Rules

- Governance root must be resolved before making task decisions
- Prefer smallest valid step that moves one task forward
- Keep status transitions explicit and evidence-linked
- Do not rewrite unrelated tasks while executing current task
- Preserve ID stability in roadmap/tasks/design/report documents

# MCP Command Contract (when available)

- `projectLocate`: resolve nearest governance root from any path
- `projectScan` / `projectNext`: discover actionable projects
- `projectContext`: summarize governance health and artifact state
- `taskList`: list tasks for selection
- `taskNext`: choose most actionable task with guidance
- `taskContext`: retrieve one task’s evidence and execution hints
- `roadmapList` / `roadmapContext`: roadmap-level planning context

If method output conflicts with local assumptions, trust method output first, then re-check affected files.

# Manual Contract (no MCP)

- Root discovery: find nearest `.projitive/`
- Project context: read `.projitive/README.md` + `.projitive/roadmap.md`
- Task selection: parse `.projitive/tasks.md` and choose one actionable task
- Evidence update: write to `.projitive/designs/` and/or `.projitive/reports/`
- Status transition: update `.projitive/tasks.md` with evidence references
- Verification: re-check task state/evidence consistency before proceeding
