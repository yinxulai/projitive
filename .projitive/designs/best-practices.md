# Best Practices Guide

**Version**: projitive-spec v1.1.0  
**Last Updated**: 2026-02-22

---

## Project Setup Best Practices

### 1. Governance Root Location

**Recommended:**
- Place `.projitive` at the repository root
- Keep governance artifacts separate from source code
- Use `.projitive/` directory for all governance files

**Example structure:**
```
my-project/
├── .projitive/              # Governance root
│   ├── README.md
│   ├── roadmap.md
│   ├── tasks.md
│   ├── designs/
│   ├── reports/
│   └── hooks/
├── src/                     # Source code
├── tests/                   # Tests
└── package.json
```

### 2. Initial Governance Files

**Always create these first:**

1. **`.projitive/README.md`** - Project scope and required reading
2. **`.projitive/roadmap.md`** - Milestones and goals
3. **`.projitive/tasks.md`** - Task pool (starts empty)
4. **`.projitive/designs/`** - Design decisions directory
5. **`.projitive/reports/`** - Execution evidence directory
6. **`.projitive/hooks/`** - AI guidance hooks (optional)

### 3. Environment Configuration

**MCP Server Configuration:**

```json
{
  "mcpServers": {
    "projitive": {
      "command": "npx",
      "args": ["-y", "@projitive/mcp"],
      "env": {
        "PROJITIVE_SCAN_ROOT_PATH": "/path/to/your/workspace",
        "PROJITIVE_SCAN_MAX_DEPTH": "3"
      }
    }
  }
}
```

**Scan Depth Recommendations:**
- `0`: Only scan root directory (fast, limited)
- `1-2`: Small to medium workspaces
- `3-4`: Large workspaces (recommended default)
- `5-8`: Very deep directory structures (slower)

---

## Task Management Best Practices

### 1. Task Creation Guidelines

**A good task should have:**
- Clear, actionable title
- Detailed summary (2-3 sentences minimum)
- Assigned owner
- Related roadmap references
- Links to relevant designs or documents

**Example:**
```markdown
## TASK-0001 | TODO | Implement User Authentication
- owner: ai-copilot
- summary: Add OAuth2 authentication flow with Google and GitHub providers. Include token refresh logic and secure session management.
- updatedAt: 2026-02-22T00:00:00.000Z
- roadmapRefs: ROADMAP-0001
- links:
  - ./designs/auth-flow.md
  - ../docs/security-requirements.md
```

### 2. Task Status Transitions

**Always follow this flow:**

```
TODO → IN_PROGRESS → DONE
  ↓
BLOCKED (if needed)
```

**Status Transition Rules:**
- **TODO → IN_PROGRESS**: Only when you're ready to start working
- **IN_PROGRESS → DONE**: Only when task is complete with evidence
- **IN_PROGRESS → BLOCKED**: When waiting on external dependencies
- **BLOCKED → IN_PROGRESS**: When blocker is resolved
- **DONE → TODO**: Only if requirements change significantly

### 3. Using Spec v1.1.0 Sub-state Metadata

**When to use sub-state:**
- For longer running tasks (estimated > 1 hour)
- When you want to track progress through phases
- When working with multiple agents

**Phase definitions:**
- `discovery`: Researching requirements, reading documentation
- `design`: Creating architecture, writing design docs
- `implementation`: Writing code, implementing features
- `testing`: Running tests, validating functionality

**Example usage:**
```typescript
// Starting discovery
taskUpdate(
  projectPath="./my-project",
  taskId="TASK-0001",
  status="IN_PROGRESS",
  subState={
    "phase": "discovery",
    "confidence": 0.7,
    "estimatedCompletion": "2026-02-23T12:00:00.000Z"
  }
)

// Moving to design
taskUpdate(
  projectPath="./my-project",
  taskId="TASK-0001",
  subState={
    "phase": "design",
    "confidence": 0.85,
    "estimatedCompletion": "2026-02-23T18:00:00.000Z"
  }
)
```

### 4. Managing Blocked Tasks

**Always provide blocker details:**

```typescript
taskUpdate(
  projectPath="./my-project",
  taskId="TASK-0001",
  status="BLOCKED",
  blocker={
    "type": "external_dependency",
    "description": "Waiting for API endpoint to be deployed",
    "blockingEntity": "Backend Team API",
    "unblockCondition": "API returns 200 OK for GET /users",
    "escalationPath": "Ping @backend-lead if not resolved by EOD"
  }
)
```

**Blocker Types:**
- `internal_dependency`: Another team/department within your org
- `external_dependency`: Third-party service, vendor, or open source project
- `resource`: Compute resources, licenses, budget, or personnel
- `approval`: Managerial, legal, or security approval

**Best practices for blockers:**
- Always set an `unblockCondition` so others know what to wait for
- Include an `escalationPath` for extended blocks
- Update the blocker description if circumstances change
- Don't leave tasks in BLOCKED state for more than 24-48 hours without escalation

---

## Evidence & Documentation Best Practices

### 1. Design Documents

**Create a design document when:**
- The task involves architectural decisions
- There are multiple implementation options
- The change affects multiple components
- Future maintainers will need context

**Design document template:**
```markdown
# Design: [Feature Name]

**Date**: 2026-02-22  
**Author**: ai-copilot  
**Status**: DRAFT | REVIEW | FINAL

## Context
What problem are we solving? Why now?

## Requirements
- Functional requirements
- Non-functional requirements (performance, security, etc.)

## Options Considered
1. Option A - Pros/Cons
2. Option B - Pros/Cons
3. Option C - Pros/Cons

## Decision
What we chose and why.

## Implementation Plan
Step-by-step plan.

## Risks & Mitigations
Potential issues and how we'll handle them.
```

### 2. Execution Reports

**Always create a report when:**
- A task is completed
- A significant decision is made
- A task is blocked for an extended period

**Report should include:**
- Summary of what was accomplished
- Steps taken
- Files modified
- Verification results
- Next steps

**Example report:**
```markdown
# TASK-0001 Execution Report

**Date**: 2026-02-22  
**Task ID**: TASK-0001  
**Status**: DONE

## Summary
Successfully implemented user authentication with OAuth2.

## Execution Steps
1. Researched OAuth2 providers
2. Created design document
3. Implemented authentication flow
4. Added tests
5. Verified functionality

## Files Modified
- src/auth/oauth2.ts - Created
- src/auth/session.ts - Created
- tests/auth.test.ts - Created
- package.json - Updated dependencies

## Verification
- ✅ All tests pass
- ✅ Manual verification complete
- ✅ Security review passed

## Next Steps
- TASK-0002: Add user profile management
```

### 3. Hook Configuration (Optional)

**Create hooks when:**
- You want consistent AI behavior across tasks
- You have specific completion requirements
- You want to enforce certain practices

**Hook location:** `.projitive/hooks/`

**Available hooks:**
- `task_auto_create_validation.md` - Pre/post creation validation (Spec v1.1.0)
- `task_assigned.md` - When task is assigned
- `task_completed.md` - When task is completed
- `task_blocked.md` - When task is blocked
- `task_reopened.md` - When task is reopened

---

## CI/CD Integration Best Practices

### 1. GitHub Actions Setup

**Basic lint and test workflow:**
```yaml
name: CI (Lint & Test)

on:
  push:
    branches: [main]
  pull_request:

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run test
```

**With coverage (Spec v1.1.0+):**
```yaml
- name: Test with Coverage
  run: npm run test:coverage

- name: Upload Coverage
  uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: coverage/
    retention-days: 30
```

### 2. Release Workflow

**Tag-based release trigger:**
```yaml
on:
  push:
    tags:
      - '[0-9]+.[0-9]+.[0-9]+'
  release:
    types: [published]
  workflow_dispatch:
```

**Version verification:**
```yaml
- name: Verify version matches tag
  env:
    RELEASE_TAG: ${{ github.ref_name }}
  run: |
    PACKAGE_VERSION=$(node -p "require('./package.json').version")
    if [ "$PACKAGE_VERSION" != "$RELEASE_TAG" ]; then
      echo "Version mismatch!"
      exit 1
    fi
```

---

## Agent Collaboration Best Practices

### 1. Multi-Agent Workflows

**When working with multiple agents:**
- Use clear task ownership
- Keep sub-state updated
- Document handoff points
- Use blockers for inter-agent dependencies

**Example handoff:**
```typescript
// Agent A completes their part
taskUpdate(
  projectPath="./my-project",
  taskId="TASK-0001",
  subState={
    "phase": "implementation",
    "confidence": 0.9,
    "estimatedCompletion": "2026-02-23T18:00:00.000Z"
  }
)

// Agent B picks up for testing
taskUpdate(
  projectPath="./my-project",
  taskId="TASK-0001",
  subState={
    "phase": "testing",
    "confidence": 0.85,
    "estimatedCompletion": "2026-02-24T00:00:00.000Z"
  }
)
```

### 2. Confidence Scoring for Auto-creation

**Use confidence scoring to:**
- Prevent low-quality task creation
- Focus agent attention on high-value tasks
- Reduce noise in the task list

**Best practices:**
- Aim for confidence >= 0.85 for auto-creation
- For 0.60-0.85, review and improve context first
- Never auto-create below 0.60 - gather more requirements

**How to improve confidence:**
- Add more detailed requirements
- Create a design document first
- Reference similar completed tasks
- Clarify acceptance criteria

---

## Troubleshooting Common Issues

### 1. Project not found by projectLocate

**Check:**
- Is there a `.projitive` marker file?
- Is `PROJITIVE_SCAN_ROOT_PATH` set correctly?
- Is the scan depth sufficient?

**Fix:**
```bash
# Create marker file
touch .projitive

# Verify scan path is correct
echo $PROJITIVE_SCAN_ROOT_PATH
```

### 2. Tasks not showing up in taskNext

**Check:**
- Are tasks in `tasks.md` between the markers?
- Are task IDs in format `TASK-0001`?
- Is the task status `TODO` or `IN_PROGRESS`?

**Fix:**
```markdown
<!-- PROJITIVE:TASKS:START -->
## TASK-0001 | TODO | Your Task Here
- owner: ai-copilot
- summary: Task description...
- updatedAt: 2026-02-22T00:00:00.000Z
<!-- PROJITIVE:TASKS:END -->
```

### 3. Coverage failing in CI

**Check:**
- Did you install `@vitest/coverage-v8`?
- Is `vitest.config.ts` configured correctly?
- Are benchmark files excluded?

**Fix:**
```typescript
// In vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'source/**/*.test.ts',
        'source/benchmark/**/*'  // Add this!
      ]
    },
    exclude: ['source/benchmark/**/*']  // And this!
  }
});
```

---

## Quick Reference Checklist

**Before starting a task:**
- [ ] Read `projectContext`
- [ ] Read `taskContext`
- [ ] Check for related designs
- [ ] Review similar completed tasks

**When working on a task:**
- [ ] Update status to IN_PROGRESS
- [ ] Use sub-state phases for long tasks
- [ ] Keep confidence updated
- [ ] Document decisions in designs

**When completing a task:**
- [ ] Verify all changes
- [ ] Create execution report
- [ ] Update task status to DONE
- [ ] Add evidence links
- [ ] Check for next task with taskNext

**When blocked:**
- [ ] Set status to BLOCKED
- [ ] Provide blocker details (type, description)
- [ ] Set unblockCondition
- [ ] Add escalationPath
- [ ] Document in a report if extended
