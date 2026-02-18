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

Recommended example (key-value mode):

```yaml
version: 1
name: expense-governance
owner: team-platform
```
