Task: TASK-0001
Roadmap: ROADMAP-0001
Owner: ai-copilot
Status: IN_PROGRESS
Last Updated: 2026-02-17

# Self-Management Bootstrap Design

## Objective
Enable this repository to self-govern through Projitive artifacts under `.projitive/` with one-step task discovery.

## Decisions
- Governance root is `.projitive/`.
- Marker file is `.projitive/.projitive`.
- Default execution path is `task.next`.

## Constraints
- Keep IDs immutable (`TASK-xxxx`, `ROADMAP-xxxx`).
- Keep evidence in markdown under `.projitive/reports/`.

## Validation Plan
- Run MCP tests in `packages/mcp`.
- Verify `task.next` can identify `TASK-0001` as actionable.
