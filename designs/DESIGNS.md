# `designs/` Directory Design Specification

Language: English | [简体中文](DESIGNS_CN.md)

## 1. Role in Project Governance

Records solution design and key decisions, answering “why this approach is chosen”.

## 2. Design Principles

- Explicit decisions: key trade-offs must be documented
- Context continuity: newcomers should be able to onboard via design docs
- Linkability: design docs should be referenced by `tasks.md` and `reports/`

## 3. Writing Style / Format for Content or Subfiles

- Subfiles should follow a fixed structure: background → options → decision → risks
- Naming recommendation: `feature-name-design.md`, `feature-name-review.md`
- Design docs should reference related task IDs and impact scope
- One major decision should have one primary document to avoid conflicting versions
- Recommended fixed sections for each `*-design.md`:
  - `## Background`
  - `## Goals and Non-Goals`
  - `## Options`
  - `## Decision`
  - `## Impact Scope`
  - `## Risks and Rollback`
- Recommended fixed sections for each `*-review.md`:
  - `## Review Result`
  - `## Change Requests`
  - `## Open Questions`
- Recommended metadata header: `Task`, `Owner`, `Status`, `Last Updated`
- `Task` should use `TASK-xxxx` format and be mandatory
- Add `Roadmap` metadata (for example `ROADMAP-0001`) when linked to a milestone
- One design file may reference multiple IDs, but at least one `TASK-xxxx` is required

Recommended template (design):

```md
# <feature>-design

Task: TASK-0001
Roadmap: ROADMAP-0001
Owner: team-platform
Status: Draft
Last Updated: 2026-02-17

## Background

## Goals and Non-Goals

## Options

## Decision

## Impact Scope

## Risks and Rollback
```

## 4. Built-in Governance Checks (Module Guidance)

- `Task` metadata is required and must match `TASK-xxxx`
- `Roadmap` metadata, if present, must match `ROADMAP-xxxx`
- `Last Updated` should be valid timestamp/date format
- Ensure decision docs are referenced by related task `links`
- Avoid duplicate primary design docs for the same decision scope
