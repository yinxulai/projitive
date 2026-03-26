# `templates/` Directory Design Specification

Language: English | [简体中文](TEMPLATES_CN.md)

## 1. Role in Project Governance

Defines per-tool response templates that control how MCP tool output is rendered.
Allows governance owners to customize tool output structure without modifying Projitive source code.

## 2. Design Principles

- User-controlled: template files are authored and owned by governance owners
- Auto-provisioned: missing template files are generated automatically before first render
- Tool-scoped: one template file per tool to keep customization isolated
- Variable-driven: templates use `{{variable}}` placeholders for dynamic content injection

## 3. Writing Style / Format for Content or Subfiles

- Directory location: `<governanceDir>/templates/tools/`
- Naming rule: `<toolName>.md` (e.g. `taskNext.md`, `taskContext.md`)
- Supported template variables:
  - `{{tool_name}}` — name of the tool being invoked
  - `{{summary}}` — summary section rendered by the tool
  - `{{evidence}}` — evidence section rendered by the tool
  - `{{guidance}}` — agent guidance section rendered by the tool
  - `{{suggestions}}` — lint suggestions section rendered by the tool
  - `{{next_call}}` — recommended next tool call
- Environment variable override:
  - Set `PROJITIVE_MESSAGE_TEMPLATE_PATH` to a directory path to load templates from a custom location
  - If the path is a directory, templates are loaded as `<dir>/<toolName>.md`
  - If the path is a single `.md` file, it is used for all tools
- Failure-handling rules:
  - Missing template file: auto-generate from built-in default and continue
  - Empty template file: treat as no-op, fall back to built-in default
  - Unreadable template file: log error, use built-in default without blocking

Default templates overview:

| Tool | Extended Default Sections |
|---|---|
| `taskNext` | `## Idle Discovery Checklist (When No Actionable Task)` |
| `projectContext`, `taskContext`, `roadmapContext` | `## Common Tool Guides To Read First` |
| `taskUpdate` | `## Governance Write Rule`, `## Core Docs Review Checklist (Required When Marking DONE)`, `## Commit Reminder` |
| `roadmapUpdate` | `## Governance Write Rule`, `## Commit Reminder` |
| All others | Base sections only |

Base template structure:

```md
# {{tool_name}}

## Summary
{{summary}}

## Evidence
{{evidence}}

## Agent Guidance
{{guidance}}

## Lint Suggestions
{{suggestions}}

## Next Call
{{next_call}}
```

## 4. Built-in Governance Checks (Module Guidance)

- Template files are per-tool controls under `templates/tools/`
- Warn when a template file exists but is unreadable
- Empty template file should be treated as missing (auto-generate)
- Template variables must be injected before rendering; unknown variables are left as-is
- `projectInit` creates the `templates/` directory and generates default template files for all built-in tools
- Generated templates should preserve governance-write constraints (tool writes only; do not edit `tasks.md`/`roadmap.md` directly)
