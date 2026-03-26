# Code Style

## Core Principles

- Favor small, explicit TypeScript modules over hidden behavior.
- Keep governance-store writes inside tools and helpers instead of hand-editing generated views.
- Extend existing patterns before introducing new abstractions.

## File and Module Rules

- packages/mcp/source/common/ holds reusable infrastructure; domain behavior belongs in tools/, prompts/, or resources/.
- Prompts should stay operational and deterministic: concrete tool calls, clear stop conditions, and minimal ambiguity.
- Tests should live beside the module family they validate and target behavior rather than implementation trivia.

## Editing Discipline

- Use focused patches with minimal unrelated reformatting.
- Preserve stable public tool names and governance semantics unless a spec-level change requires otherwise.
- Prefer backwards-compatible transitions when evolving governance rules, especially around task state and artifact layout.

## Testing and Validation

- For mcp package changes, run targeted Vitest files first, then the full packages/mcp test suite.
- Treat prompt text, lint guidance, and generated artifact expectations as test-worthy behavior.
- When modifying initialization or sync behavior, verify both file creation and governance-store effects.

## Governance Writing Rules

- Task and roadmap IDs remain immutable.
- Reports are required evidence for meaningful task completion.
- After marking work DONE, review whether architecture, code conventions, or UI guidance changed and update the corresponding core docs.

## Change Triggers

Update this document when repository coding conventions, test strategy, prompt-authoring rules, or governance-writing practices materially change.
