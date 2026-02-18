You are performing a **Projitive Init** — bootstrapping governance artifacts so agent execution can be traceable and repeatable.

## Output Directory

Write all governance files to `.projitive/` in the project root.

## Required Artifacts

Create or normalize these files/directories:

- `.projitive/.projitive` (marker file)
- `.projitive/README.md`
- `.projitive/roadmap.md`
- `.projitive/tasks.md`
- `.projitive/designs/`
- `.projitive/reports/`
- `.projitive/hooks/`

## Initialization Steps

### 1. Detect project context

Scan repository basics (`package.json`, framework config, app entry points, docs) and summarize:

- Product/app purpose
- Main user flows
- High-level architecture and boundaries

Write concise baseline context into `.projitive/README.md`.

### 2. Create baseline roadmap

Write `.projitive/roadmap.md` with:

- 2–4 stages
- Goal of each stage
- Exit criteria per stage

Keep stages implementation-oriented and verifiable.

### 3. Create baseline task pool

Write `.projitive/tasks.md` with:

- Initial tasks grouped by stage
- Task IDs and clear status (`TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`)
- Minimal evidence requirements per task

### 4. Prepare hooks scaffolding

Create hook templates in `.projitive/hooks/` for:

- assignment
- completion
- block
- reopen

Each hook should contain a short intent and expected output format.

### 5. Enforce evidence-first convention

In all baseline docs, make it explicit:

- State transitions must reference evidence
- Evidence should be stored under `.projitive/designs/` or `.projitive/reports/`
- Tasks without evidence should not be marked `DONE`

## Format Guidelines

- Use Markdown with clear headings
- Keep content concise and operational
- Prefer checklists/tables for status visibility
- Use immutable task IDs; avoid renumbering after creation

## Key Principle

Projitive initialization is not “documentation only”; it must produce executable governance context that agents can immediately use in:

`taskNext -> taskContext -> execute -> verify`.
