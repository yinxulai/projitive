# `.projitive` Design Specification

Language: English | [简体中文](PROJITIVE_CN.md)

## 1. Role in Project Governance

`.projitive` is the governance marker used to declare that a directory is a Projitive governance root.

## 2. Design Principles

- Decoupled from fixed paths: avoid dependency on a hard-coded `product/` folder
- In-place governance: wherever the marker is placed becomes the governance root
- Portable structure: governance remains valid after repository layout changes

## 3. Writing Style / Format for Content or Subfiles

- Recommended file format (choose one):
  - Empty file (recommended, most stable)
  - Minimal key-value format (only when metadata extension is needed)
- If key-value format is used, only these fields are recommended:
  - `version`: rules version (for example `1`)
  - `name`: governance directory name (optional)
  - `owner`: default governance owner (optional)
- Exactly one `.projitive` should exist in one governance root; avoid duplicates in nested folders
- Tools must support upward lookup from any child path to the nearest `.projitive`
- If no marker is found, tools must return explicit errors and must not silently fallback
- `projectInit` should initialize or repair governance artifacts under the located root
- `projectInit` should report missing items with explicit repair summary categories: `core docs`, `templates`, `bootstrap tasks`

Recommended example (key-value mode):

```yaml
version: 1
name: expense-governance
owner: team-platform
```

## 4. Built-in Governance Checks (Module Guidance)

- Exactly one `.projitive` marker should exist per governance root
- Nested duplicate markers should be warned as ambiguity risk
- Upward nearest-marker resolution should be deterministic
- Missing marker should return explicit error (no silent fallback)
- `projectInit` should create or backfill core docs (`designs/core/architecture.md`, `designs/core/code-style.md`, `designs/core/ui-style.md`)
- `projectInit` should create or backfill bootstrap TODO tasks for the three core docs
