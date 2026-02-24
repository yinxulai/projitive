# Projitive

Language: English | [简体中文](README_CN.md)

**Current Spec Version: projitive-spec v1.1.0**

Projitive is a governance model + MCP toolchain for Agent-driven software delivery.

It helps teams turn "AI can code" into "AI can continuously ship with traceability".

## Why Developers Use Projitive

- Ship faster with guardrails: standard task states, evidence rules, and stable execution loops.
- Keep repos auditable: every transition links to design/report evidence.
- Stay tool-agnostic: works with Copilot, Claude Code, and other MCP-compatible agents.
- Scale across projects: same conventions and method family (`List/Context/Next/Scan/Locate`).

## What You Get Today

- A complete governance spec under `design/`
- A production MCP server under `packages/mcp/`
- Built-in Resources + Prompts + Tools for agent workflow consistency
- Release-driven CI publishing pipeline for MCP package

## How It Helps Agents Manage and Advance Projects (Design Rationale)

Projitive is designed to solve a common failure mode in AI delivery: agents can edit code, but cannot reliably manage project state over time.

Its design uses four constraints to make agent execution stable:

- **State machine first**: task statuses (`TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`) define explicit progress semantics.
- **Evidence first**: transitions are valid only when artifacts (`designs/`, `reports/`) prove the change.
- **Context first**: agents resolve governance root and read canonical files before acting.
- **Loop first**: delivery is iterative, not one-shot (`discover -> decide -> execute -> verify -> next`).

In practice, this lets an agent manage projects like a lightweight operator:

1. Discover what to do (`taskNext` / `projectNext`)
2. Build actionable context (`taskContext` / `projectContext`)
3. Execute updates in governed artifacts
4. Re-verify consistency and move to next cycle

This is the core idea: **convert ad-hoc coding into auditable, repeatable project progression**.

## Quick Start (5 minutes)

1. Read `design/README.md` for governance conventions.
2. Add `.projitive` marker file in your governance root.
3. Prepare governance artifacts: `README.md`, `roadmap.md`, `tasks.md`, `designs/`, `reports/`, `hooks/`.
4. Start MCP server from `packages/mcp`.
5. Let agent run: `taskNext -> taskContext -> update -> verify`.

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

- Spec version: `projitive-spec v1.1.0`
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
5. Configure MCP client with npm package and operate through MCP tools

## MCP Install, Configure, and Use

### 1) Install MCP via npm package

Use the published package directly:

```bash
npx -y @projitive/mcp
```

Local build/start is not provided as the recommended usage path in this guide.

### 2) Configure MCP client

In your MCP client config (for example `mcp.json`), register the npm package as a stdio server:


```json
{
  "mcpServers": {
    "projitive": {
      "command": "npx",
      "args": ["-y", "@projitive/mcp"],
      "env": {
        "PROJITIVE_SCAN_ROOT_PATHS": "/workspace/a:/workspace/b",
        "PROJITIVE_SCAN_MAX_DEPTH": "3"
      }
    }
  }
}
```

Environment variables (required):

- `PROJITIVE_SCAN_ROOT_PATHS`: required scan root directories used by discovery methods (for example `projectNext` / `taskNext`).
  - Use platform delimiter string (`:` on Linux/macOS, `;` on Windows)
  - Fallback: legacy `PROJITIVE_SCAN_ROOT_PATH` is still supported when `PROJITIVE_SCAN_ROOT_PATHS` is unset
- `PROJITIVE_SCAN_MAX_DEPTH`: required scan depth used by discovery methods (integer `0-8`).

### 3) Verify and run the workflow

After connecting the server in your MCP client, run this minimal sequence:

```text
projectLocate -> projectContext -> taskNext -> taskContext
```

Then execute updates in governed artifacts (`tasks.md`, `designs/`, `reports/`) and re-check with `taskContext`.

For full method references and outputs, see `packages/mcp/README.md`.

## Release Notes

### v1.1.0 (2026-02-22)

**Spec Version**: projitive-spec v1.1.0  
**MCP Package**: @projitive/mcp@1.1.0

#### What's New in v1.1.0

This release enhances agent autonomy while maintaining full backward compatibility with v1.0.0.

##### 1. Enhanced Task State Machine (Phase 1 - TASK-0008)
- **Sub-state Metadata**: Optional metadata for IN_PROGRESS tasks
  - `phase`: discovery|design|implementation|testing
  - `confidence`: 0.0-1.0 agent confidence score
  - `estimatedCompletion`: ISO timestamp for ETA
- **Backward Compatible**: All v1.0.0 tasks continue to work

##### 2. Blocker Categorization (Phase 2 - TASK-0009)
- **Structured Blocker Metadata**: Detailed information for BLOCKED tasks
  - `type`: internal_dependency|external_dependency|resource|approval
  - `description`: Human-readable explanation
  - `blockingEntity`: What's blocking the task
  - `unblockCondition`: Condition to resolve the block
  - `escalationPath`: What to do if blocked too long
- **Validation Rules**: 6 new lint codes for blocker/sub-state validation

##### 3. Confidence Scoring & Validation Hooks (Phase 3 - TASK-0010)
- **Confidence Scoring Algorithm**: Three-factor calculation
  ```
  confidence_score = context_completeness * 0.4 + 
                     similar_task_history * 0.3 + 
                     specification_clarity * 0.3
  ```
  - Auto-create threshold: >= 0.85
  - Requires review: 0.60 - 0.85
  - Must not create: < 0.60
- **Validation Hooks**: New governance artifact `.projitive/hooks/task_auto_create_validation.md`
- **New MCP Tools**:
  - `taskCalculateConfidence`: Calculate confidence score for auto-creation
  - `taskCreateValidationHook`: Create validation hook template

##### 4. Test Coverage Enhancement (TASK-0011)
- **6 New Test Files**: confidence.test.ts, design-context.test.ts, reports.test.ts, designs.test.ts, readme.test.ts, mcp-workflow.test.ts
- **Total Test Files**: 17
- **Spec v1.1 Coverage**: Full coverage for all new features

##### 5. Dependency Security Update (TASK-0012)
- **Security Fix**: Fixed 1 low-severity vulnerability (hono < 4.11.10)
- **Updated Dependencies**: All dependencies to latest stable versions
- **Test Verification**: 240 tests, 228 passing (all non-failing)

#### Migration Guide from v1.0.0 to v1.1.0

All changes are **additive only** - existing v1.0.0 projects continue to work without modification.

To adopt v1.1.0 features:
1. Update `@projitive/mcp` to 1.1.0
2. (Optional) Add sub-state metadata to IN_PROGRESS tasks
3. (Optional) Categorize BLOCKED tasks with blocker metadata
4. (Optional) Create validation hook for auto-discovery

#### Complete Task List

| Task ID | Description | Status |
|---------|-------------|--------|
| TASK-0008 | Implement Spec v1.1 - Phase 1: Sub-state Metadata Support | ✅ DONE |
| TASK-0009 | Implement Spec v1.1 - Phase 2: Blocker Categorization | ✅ DONE |
| TASK-0010 | Implement Spec v1.1 - Phase 3: Confidence Scoring & Validation Hooks | ✅ DONE |
| TASK-0011 | Enhance MCP Test Coverage - Add Unit and Integration Tests | ✅ DONE |
| TASK-0012 | Dependency Audit and Security Update | ✅ DONE |
| TASK-0013 | Prepare Spec v1.1.0 Release | ✅ DONE |

#### Roadmap Progress

- **ROADMAP-0001**: Governance baseline and task loop operational (In Progress)
- **ROADMAP-0002**: Spec v1.1 proposal and release checklist prepared ✅
- **ROADMAP-0003**: Continuous governance quality checks integrated (Pending)
- **ROADMAP-0004**: MCP self-iteration optimization (In Progress)

#### Backward Compatibility Guarantee

- ✅ All v1.0.0 tasks continue to work unchanged
- ✅ All existing MCP tools function as before
- ✅ New features are opt-in and additive only
- ✅ No breaking changes to the spec or API
