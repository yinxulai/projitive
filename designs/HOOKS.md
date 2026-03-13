# `hooks/` Directory Design Specification

Language: English | [简体中文](HOOKS_CN.md)

## 1. Role in Project Governance

Defines one global backend hook used when no actionable task exists, so agents can proactively discover and create tasks.

## 2. Design Principles

- User-controlled guidance: prompts are authored by governance owners
- Deterministic behavior: stable global file naming and loading behavior
- Context-safe: prompts should constrain scope and avoid ambiguous intent
- Backend mechanism: hooks are global runtime controls, not task/roadmap-facing fields

## 3. Writing Style / Format for Content or Subfiles

- Directory location: `<governanceDir>/hooks/`
- Supported hook file:
  - `task_no_actionable.md`: checklist prompt used when `taskNext` finds `actionableTasks: 0`
- Prompt style recommendations:
  - start with objective and constraints
  - include expected output format
  - avoid project-irrelevant instructions
- Scope rules:
  - Hook scope is global at governance level only
  - `tasks.md` and `roadmap.md` must not define hook selection fields
  - If `task_no_actionable.md` is missing, built-in default checklist is used
- Failure-handling rules:
  - Missing file: log warning and continue
  - Invalid front-matter: ignore front-matter, fallback to markdown body
  - Empty file: treat as no-op hook
  - Non-readable file: log error and continue without blocking task lifecycle

Recommended template:

```md
---
id: HOOK-NO-TASK-001
scope: global
---

Objective:
-

Constraints:
-

Output Format:
-
```

## 4. Built-in Governance Checks (Module Guidance)

- Hook files are global backend controls under `hooks/`
- Warn when `task_no_actionable.md` exists but is unreadable
- Empty hook file should be treated as no-op, not fatal
- Invalid front-matter should degrade gracefully to markdown body
- Hook content should include objective + constraints + output format
