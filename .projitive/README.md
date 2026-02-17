# Projitive Governance Workspace

This directory is the governance root for the `projitive` repository.

## Scope

- Governance target: the whole repository
- Execution model: Agent-first, markdown-first
- Source of truth: artifacts under this directory

## Required Reading for Agents

- Local: ./README.md
- Local: ./roadmap.md
- Local: ./tasks.md
- Local: ./designs/self-management-bootstrap.md
- External: ../README.md
- External: ../design/ROADMAP.md
- External: ../design/TASKS.md
- External: ../design/HOOKS.md

## Operating Rules

- Keep ROADMAP/TASK IDs immutable after creation.
- Every status transition must leave evidence in `reports/`.
- Prefer one-step execution entry: use `task.next` as default.
