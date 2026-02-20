# `tasks.md` Design Specification

Language: English | [简体中文](TASKS_CN.md)

## 1. Role in Project Governance

Defines the executable task pool and status transitions, answering “what should be done now”.

## 2. Design Principles

- Atomicity: each task should be independently executable and verifiable
- Auditability: every state change should leave evidence
- Unified state machine: avoid semantic drift across projects

## 3. Writing Style / Format for Content or Subfiles

- Recommended statuses: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`
- Recommended transition rules:
  - `TODO -> IN_PROGRESS`: must include an execution plan
  - `IN_PROGRESS -> DONE`: must include validation evidence
  - `* -> BLOCKED`: must include blocker reason and unblock condition
- Recommended minimum fields: `id`, `title`, `status`, `owner`, `updatedAt`, `links`
- Recommended optional fields: `roadmapRefs`
- Keep task item format stable for Agent/tool parsing
- Canonical format is markdown-native task sections inside fixed markers
- Every task MUST have a unique task ID
- Recommended task ID format: `TASK-0001`, `TASK-0002`, ...
- Task item should include related roadmap IDs when applicable (for example `ROADMAP-0001`)
- Task IDs must be referenced by `designs/` and `reports/` for reverse lookup
- Hook mechanism is global and backend-managed under `hooks/`, not declared in task cards

Recommended field constraints:
- `id`: `TASK-\d{4}` (for example `TASK-0001`)
- `status`: only `TODO|IN_PROGRESS|BLOCKED|DONE`
- `updatedAt`: ISO8601 UTC timestamp
- `links`: relative paths or URLs only (do not place raw roadmap IDs here)
- `roadmapRefs`: optional string array, each item must match `ROADMAP-\d{4}`

Recommended markdown-native example:

~~~md
<!-- PROJITIVE:TASKS:START -->
## TASK-0001 | TODO | Define task state machine
- owner: team-platform
- summary: align transition and evidence rules
- updatedAt: 2026-02-17T00:00:00.000Z
- roadmapRefs: ROADMAP-0001
- links:
  - ./designs/task-state-machine-design.md
<!-- PROJITIVE:TASKS:END -->
~~~

## 4. Built-in Governance Checks (Module Guidance)

- Parse source of truth only inside marker block (`PROJITIVE:TASKS:START/END`)
- Warn if any `TASK-xxxx` appears outside marker block (possible split source)
- `IN_PROGRESS` should have non-empty `owner`
- `DONE` should have at least one `links` evidence
- `BLOCKED` should include blocker reason in `summary`
- `updatedAt` should be valid ISO8601 UTC
- `roadmapRefs` should link to existing `ROADMAP-xxxx` when applicable
