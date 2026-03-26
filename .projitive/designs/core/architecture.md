# Project Architecture

## Mission and Scope

Projitive is a governance model plus MCP toolchain for agent-driven delivery. This repository owns the governance specification documents, the MCP implementation in packages/mcp, and the reusable skill package in packages/skills.

## Repository Boundaries

- Root docs define the external product narrative and spec-facing materials.
- .projitive/ is the repository's self-governance workspace and source of truth for roadmap, tasks, reports, and internal design guidance.
- packages/mcp contains the MCP server implementation, prompts, resources, and governance tools.
- packages/skills contains skill packaging and reference-sync helpers for downstream agents.

## Major Modules

### packages/mcp

- source/tools/: governance operations such as projectInit, taskCreate, taskUpdate, roadmapCreate, and roadmapUpdate.
- source/prompts/: agent-facing workflow prompts that shape discovery, execution, and verification loops.
- source/resources/: MCP resources exposed from governance and design artifacts.
- source/common/: shared storage, markdown rendering, linting, and response templating helpers.

### packages/skills

- Skill packaging for Projitive-guided workflows.
- Publish-time sync script that mirrors selected design references into the skills package.

### .projitive

- Internal operating layer for this repository.
- Stores task/roadmap state, implementation reports, and design decisions for self-iteration.

## Key Flows

1. Project bootstrap: projectInit creates governance store, templates, core docs, and bootstrap tasks.
2. Task execution loop: taskNext -> taskContext -> implement -> taskUpdate -> taskContext -> taskNext.
3. Governance materialization: governance store is authoritative; tasks.md and roadmap.md are generated views.
4. Self-iteration: repository improvements should be tracked in .projitive tasks and backed by reports.

## Change Triggers

Update this document when tasks change package responsibilities, add new governance artifacts, alter the delivery loop, or introduce new extension points for prompts/resources/tools.
