# Projitive

**Current Spec Version: projitive-spec v1.0.0**

Projitive is an abstract governance model and toolset for Agent-driven project execution, not a domain-specific task system.

It defines three capability layers:
- Rules layer: unified semantics for projects, tasks, states, and evidence
- Process layer: a consistent Discover → Plan → Execute → Validate → Sync loop
- Tool layer: MCP Server tools for discovery and updates under governance rules

## Design Goals

- Domain-agnostic: rules apply across project types
- Structure-agnostic: no hard dependency on repository layout
- Actor-agnostic: supports agents and human collaborators
- Traceability-first: every state change should have evidence

## Design Philosophy

- Long-term oriented: built for continuous project evolution instead of one-off task execution
- Agent-agnostic: works across different agent systems (such as Claude Code, Copilot, and other AI tools)
- General-purpose governance: reusable across project domains and team structures
- Self-propelling workflow: enables agents to discover, plan, execute, validate, and sync with minimal manual orchestration

## Minimal Convention

Each governed project is identified by a `.projitive` marker file:
- locate the governance root by finding `.projitive`
- the directory containing `.projitive` is the governance directory

Recommended artifacts under the governance directory:
- `README.md`: scope, terminology, context
- `roadmap.md`: stage goals and milestones
- `tasks.md`: task pool and statuses
- `designs/`: design decisions
- `reports/`: execution evidence and summaries
- `hooks/`: event-based AI guidance prompts (assignment/completion/block/reopen)

## Repository Structure

- `design/`: governance design specifications and writing conventions
- `packages/mcp/`: MCP Server implementation
- `packages/skill/`: reserved extension package

Key design specs include:
- `design/HOOKS.md`: hook prompt conventions and lifecycle events
- `design/ROADMAP.md` and `design/TASKS.md`: integrated ID allocation and reference rules

## Language Policy

- English is the default document language
- Chinese versions use `_CN` suffix

## Versioning

- Spec version: `projitive-spec v1.0.0`
- Alignment rule: implementation major versions (including MCP) must match the spec major version (`v1.x` with `v1.x`)
- Release policy:
	- Breaking spec upgrade (e.g. `v1` → `v2`) requires MCP major upgrade first (e.g. `2.0.0`)
	- Backward-compatible feature additions use minor upgrades (e.g. `1.1.0`)
	- Bug-fix only changes use patch upgrades (e.g. `1.0.1`)

## Quick Start

1. Read design specifications in `design/`
2. Add `.projitive` to your target governance directory
3. Prepare governance artifacts (`README.md`, `roadmap.md`, `tasks.md`, `designs/`, `reports/`, `hooks/`)
4. In governance `README.md`, define `Required Reading for Agents` (local + external guides)
5. Run `packages/mcp` and operate through MCP tools
