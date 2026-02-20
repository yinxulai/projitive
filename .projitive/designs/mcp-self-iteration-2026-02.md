Task: TASK-0004, TASK-0005, TASK-0006
Roadmap: ROADMAP-0004
Owner: ai-copilot
Status: TODO
Last Updated: 2026-02-20

# MCP Self-Iteration Design Brief

## Objective
Create a focused self-iteration track for Projitive MCP so agents can:
- follow one clear task discovery path,
- improve automatic discovery and governed task creation,
- quickly load Projitive design context before execution.

## Scope
- In scope: docs alignment, MCP prompt/resource/tool enhancements, governance-safe task creation proposal.
- Out of scope: breaking spec changes without v1.1 proposal.

## Proposed Execution Order
1. TASK-0004: stabilize and publish canonical workflow.
2. TASK-0006: improve design onboarding context in MCP.
3. TASK-0005: implement auto-discovery + task creation enhancements with safety guards.

## Canonical Discovery Workflow (Recommended)
- Default: `taskNext -> taskContext -> update artifacts -> taskContext (verify) -> taskNext`
- Fallback (already in project path): `projectLocate -> projectContext -> taskList -> taskContext`

## Key Constraints
- Keep TASK/ROADMAP IDs immutable.
- Preserve markdown-first outputs and evidence-first transitions.
- Any task creation mechanism must validate ID format, status enum, and required fields.

## Validation Targets
- MCP tests remain green.
- `taskNext` selection remains deterministic under same input.
- New task creation path (if added) rejects malformed payloads with actionable errors.
