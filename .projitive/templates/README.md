# Template Guide

This directory stores response templates (one file per tool).

How to enable:
- Set env `PROJITIVE_MESSAGE_TEMPLATE_PATH` to a template directory.
- Example: .projitive/templates/tools

Rule:
- Prefer one template per tool: <toolName>.md (e.g. taskNext.md).
- Template directory mode only loads <toolName>.md files.
- If a tool template file is missing, Projitive will auto-generate that file before rendering.
- Include {{content}} to render original tool output.
- If {{content}} is missing, original output is appended after template text.

Basic Variables:
- {{tool_name}}
- {{summary}}
- {{evidence}}
- {{guidance}}
- {{next_call}}
- {{content}}