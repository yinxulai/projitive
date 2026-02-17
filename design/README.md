# `README.md` Design Specification

## 1. Role in Project Governance

Defines the specification of the governance artifact `README.md` as the Agent onboarding entry.
It introduces core project governance context and explicitly tells AI tools what files/guides must be read before execution.

## 2. Design Principles

- Boundary first: define governance scope before breaking down roadmap and tasks
- Shared semantics: unify terminology to reduce cross-role communication ambiguity
- Guided execution: make required-reading inputs explicit for AI tools (Claude Code / Copilot / other agents)
- Minimal context loop: after reading `README.md`, the agent should know scope, rules, and required references

## 3. Writing Style / Format for Content or Subfiles

- Recommended fixed section order (for stable parsing and version comparison):
  1. `## Governance Goals`
  2. `## Scope Boundaries`
  3. `## Key Terms`
  4. `## Required Reading for Agents`
  5. `## Related Artifacts`
- `Scope Boundaries` must explicitly split `In Scope` and `Out of Scope`
- `Key Terms` should use one-line entries in `Term: Definition` form
- `Related Artifacts` must use relative links to `roadmap.md`, `tasks.md`, `designs/`, and `reports/`
- `Related Artifacts` should include `hooks/` when lifecycle prompts are configured
- `Required Reading for Agents` should list:
  - governance files (this repo/project)
  - external official guidance files when available
  - tool-specific instruction files (for example Claude/Copilot instruction docs)
- Prefer a definition-first, list-oriented style over long narrative paragraphs

Recommended template:

```md
# <Governance Name>

## Governance Goals
-

## Scope Boundaries
### In Scope
-
### Out of Scope
-

## Key Terms
- Term A:
- Term B:

## Required Reading for Agents
- Local: ./tasks.md
- Local: ./roadmap.md
- Local: ./hooks/on_task_assigned.md
- External: <official-guide-path-or-link>

## Related Artifacts
- roadmap: ./roadmap.md
- tasks: ./tasks.md
- designs: ./designs/
- reports: ./reports/
- hooks: ./hooks/
```
