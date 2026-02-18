# @projitive/skills

Reusable Skills package for agent workflows in Projitive-governed projects.

## Install

```bash
npx skills add @projitive/skills
```

Then prompt in your coding agent:

```text
/ projitive help me continue this project with governance workflow
```

## Included Skills

- `projitive`
  - Entry: `SKILL.md`
  - Init guide: `INIT.md`
  - Runtime rules: included directly in `SKILL.md`

## References sync on publish

- During `npm publish`/`npm pack`, the package auto-copies English files from repo `design/` to `references/`.
- Source rule: `design/*.md` excluding `*_CN.md`.

## What this skill focuses on

- Governance bootstrap (`.projitive` root and standard artifacts)
- Shortest execution loop (`taskNext -> taskContext -> execute -> verify`)
- Evidence-first task transition discipline
- Practical use of MCP methods from `@projitive/mcp` (optional, recommended)

## MCP optional mode

- If MCP is installed, use MCP methods for faster discovery/context building.
- If MCP is not installed, this skill still works via direct `.projitive/*` file workflow.
