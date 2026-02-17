# `reports/` Directory Design Specification

## 1. Role in Project Governance

Captures execution results and validation conclusions, answering “what was delivered and how it is proven”.

## 2. Design Principles

- Evidence first: completion status must be backed by report evidence
- Traceable outcomes: change scope and validation process should be reviewable
- Handover-ready risks: unresolved items should have explicit follow-up actions

## 3. Writing Style / Format for Content or Subfiles

- Subfile naming recommendation: `YYYY-MM-DD-topic.md`
- Each report should include fixed sections: scope, change summary, validation, risks/follow-up
- Reports must reference corresponding tasks (`tasks.md`) and milestones (`roadmap.md`)
- Validation conclusions should use reviewable evidence (commands, outputs, screenshots, or links)
- Recommended fixed fields per report:
  - `Task`, `Roadmap`, `Owner`, `Date`
  - `Scope`
  - `Changes`
  - `Validation`
  - `Risk / Follow-up`
- `Validation` must contain at least one verifiable evidence item
- `Risk / Follow-up` must explicitly list unfinished items and expected handling time
- `Task` should use `TASK-xxxx` format and be mandatory
- `Roadmap` should use `ROADMAP-xxxx` format when linked to roadmap

Recommended template:

```md
# 2026-02-17-<topic>

Task: TASK-0001
Roadmap: ROADMAP-0001
Owner: team-platform
Date: 2026-02-17

## Scope

## Changes

## Validation
- Command:
- Result:
- Evidence:

## Risk / Follow-up
-
```
