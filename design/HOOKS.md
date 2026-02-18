# `hooks/` Directory Design Specification

Language: English | [简体中文](HOOKS_CN.md)

## 1. Role in Project Governance

Defines user-managed hook prompts that provide extra AI guidance at task lifecycle events (especially assignment and completion).

## 2. Design Principles

- User-controlled guidance: prompts are authored by governance owners
- Event-driven injection: prompts are bound to explicit lifecycle events
- Deterministic behavior: stable file naming and loading priority
- Context-safe: prompts should constrain scope and avoid ambiguous intent

## 3. Writing Style / Format for Content or Subfiles

- Directory location: `<governanceDir>/hooks/`
- Recommended event files:
  - `on_task_assigned.md`: extra prompt when a task is assigned/started
  - `on_task_completed.md`: extra prompt when a task is marked done
- Optional event files:
  - `on_task_blocked.md`
  - `on_task_reopened.md`
- Prompt style recommendations:
  - start with objective and constraints
  - include expected output format
  - avoid project-irrelevant instructions
- Suggested front-matter fields (optional):
  - `id`: hook identifier (e.g., `HOOK-ASSIGN-001`)
  - `scope`: `global` or `task`
  - `appliesTo`: task ID list or wildcard
- Precedence rules:
  - Task-level hook path (from `tasks.md` `hooks.*`) has highest priority
  - If task-level hook is not configured, fallback to global event file in `hooks/`
  - If both missing, continue without hook injection
- Failure-handling rules:
  - Missing file: log warning and continue
  - Invalid front-matter: ignore front-matter, fallback to markdown body
  - Empty file: treat as no-op hook
  - Non-readable file: log error and continue without blocking task lifecycle

Recommended template:

```md
---
id: HOOK-ASSIGN-001
scope: task
appliesTo: ["TASK-0001", "TASK-0002"]
---

Objective:
-

Constraints:
-

Output Format:
-
```

## 4. Built-in Governance Checks (Module Guidance)

- Task-level hook path has higher priority than global hook file
- Warn when configured hook files are missing or unreadable
- Empty hook file should be treated as no-op, not fatal
- Invalid front-matter should degrade gracefully to markdown body
- Hook content should include objective + constraints + output format
