# `roadmap.md` Design Specification

Language: English | [简体中文](ROADMAP_CN.md)

## 1. Role in Project Governance

Defines stage goals and milestones, answering “what is next”.

## 2. Design Principles

- Stage-oriented instead of single-task oriented
- Milestone progress should be trackable
- Decoupled from `tasks.md`: roadmap defines targets, tasks drive execution

## 3. Writing Style / Format for Content or Subfiles

- Organize as “Phase → Milestone → Outcome”
- Keep a consistent heading hierarchy for each phase (recommended: level-2 headings)
- Each milestone should include goal, time window, risks, and dependencies
- Keep references aligned with `tasks.md` (tasks should map to phases)
- Recommended fixed fields per phase: `Goals`, `Milestones`, `Risks`, `Dependencies`
- Use checkbox format for milestone items to make status visible at a glance
- Standardize time format as `YYYY-MM-DD` or `YYYY-QN` (do not mix styles)
- Every milestone/task line in `roadmap.md` MUST include a unique roadmap ID
- Recommended roadmap ID format: `ROADMAP-0001`, `ROADMAP-0002`, ...
- IDs must be immutable once published (title/status can change, ID cannot)
- IDs should be referenced by `designs/` and `reports/` for reverse lookup

Recommended template:

```md
# Roadmap

## Phase 1 - <phase-name>
### Goals
-

### Milestones
- [ ] ROADMAP-0001: <milestone-name> (time: 2026-Q1)
- [ ] ROADMAP-0002: <milestone-name> (time: 2026-Q2)

### Risks
-

### Dependencies
-
```
