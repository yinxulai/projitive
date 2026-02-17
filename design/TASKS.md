# `tasks.md` Design Specification

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
- Recommended optional fields: `roadmapRefs`, `hooks`
- Optional field: `hooks` for task-level hook selection (e.g., assign/complete prompt overrides)
- Keep task item format stable, including field ordering, for Agent/tool parsing
- If structured blocks are used, wrap JSON with fixed markers for machine readability
- Every task MUST have a unique task ID
- Recommended task ID format: `TASK-0001`, `TASK-0002`, ...
- Task item should include related roadmap IDs when applicable (for example `ROADMAP-0001`)
- Task IDs must be referenced by `designs/` and `reports/` for reverse lookup
- Task lifecycle events may trigger hooks in `hooks/` (especially assignment and completion)

Recommended field constraints:
- `id`: `TASK-\d{4}` (for example `TASK-0001`)
- `status`: only `TODO|IN_PROGRESS|BLOCKED|DONE`
- `updatedAt`: ISO8601 UTC timestamp
- `links`: relative paths or URLs only (do not place raw roadmap IDs here)
- `roadmapRefs`: optional string array, each item must match `ROADMAP-\d{4}`
- `hooks`: optional object, keys like `onAssigned`, `onCompleted`, values are relative paths under `hooks/`

Recommended structured example:

~~~md
<!-- PROJITIVE:TASKS:START -->
```json
[
  {
    "id": "TASK-0001",
    "title": "Define task state machine",
    "status": "TODO",
    "owner": "team-platform",
    "updatedAt": "2026-02-17T00:00:00.000Z",
    "links": ["./designs/task-state-machine-design.md"],
    "roadmapRefs": ["ROADMAP-0001"],
    "hooks": {
      "onAssigned": "./hooks/on_task_assigned.md",
      "onCompleted": "./hooks/on_task_completed.md"
    }
  }
]
```
<!-- PROJITIVE:TASKS:END -->
~~~
