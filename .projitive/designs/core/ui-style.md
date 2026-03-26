# UI Style

## Scope

This repository is documentation-heavy and tool-first, so its primary UI surface today is markdown output, generated governance views, and agent-facing prompt language. Future visual surfaces should inherit these rules unless a dedicated product UI establishes a stronger local system.

## Presentation Principles

- Optimize for scanability: short sections, explicit labels, and predictable ordering.
- Prefer operational wording over marketing language in governance and prompt outputs.
- Keep generated markdown stable so agents can diff, parse, and re-read it reliably.

## Copy and Interaction Rules

- Tool outputs should expose summary, evidence, guidance, suggestions, and next call in a consistent order.
- Prompt language should direct agents toward concrete actions, not open-ended advice.
- Completion checkpoints should explicitly mention follow-up doc maintenance when architecture, code style, or UI guidance changed.

## Documentation Visual Rules

- Use tables only when they clarify structured comparisons.
- Use checklists for gates and completion criteria.
- Keep headings compact and avoid decorative formatting that reduces machine readability.

## Future UI Guidance

- If Projitive gains dashboards or richer visual clients, establish reusable states for task status, evidence health, blockers, and completion gates.
- New UI work should remain aligned with governance concepts already present in markdown and MCP responses.

## Change Triggers

Update this document when generated markdown structure changes, prompt output conventions shift, or the project introduces a visual product surface with reusable interaction patterns.
