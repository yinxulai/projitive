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
- Local: ./designs/core/architecture.md
- Local: ./designs/core/code-style.md
- Local: ./designs/core/ui-style.md
- Local: ./designs/self-management-bootstrap.md
- Local: ./designs/mcp-self-iteration-2026-02.md
- External: ../README.md
- External: ../designs/ROADMAP.md
- External: ../designs/TASKS.md
- External: ../designs/HOOKS.md

## Operating Rules

- Keep ROADMAP/TASK IDs immutable after creation.
- Every status transition must leave evidence in `reports/`.
- Prefer one-step execution entry: use `task.next` as default.
- After finishing a task, re-check whether project architecture, code conventions, or UI guidance changed and update the matching core doc under `designs/core/`.

## Core Governance Docs

- `designs/core/architecture.md`: system boundary, packages, delivery loop, and extension points.
- `designs/core/code-style.md`: TypeScript, testing, patch discipline, and governance-writing conventions.
- `designs/core/ui-style.md`: documentation/UI copy tone, markdown presentation rules, and future UI-facing consistency guidance.
