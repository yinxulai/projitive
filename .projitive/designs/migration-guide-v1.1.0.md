# Migration Guide - v1.0.0 to v1.1.0

**Version**: projitive-spec v1.1.0  
**Last Updated**: 2026-02-22

---

## Overview

This guide helps you migrate from Projitive spec v1.0.0 to v1.1.0. The good news: **v1.1.0 is 100% backward compatible**! All your existing v1.0.0 projects will continue to work without modification.

v1.1.0 is an additive release - all new features are optional and opt-in.

---

## What's New in v1.1.0

### 1. Enhanced Task State Machine (Optional)

**New in v1.1.0:**
- Sub-state metadata for IN_PROGRESS tasks
- Phase tracking (discovery → design → implementation → testing)
- Confidence scoring (0.0 - 1.0)
- Estimated completion timestamps

**v1.0.0 tasks continue to work unchanged.**

### 2. Blocker Categorization (Optional)

**New in v1.1.0:**
- Structured blocker metadata
- Blocker types (internal_dependency, external_dependency, resource, approval)
- Detailed blocker information (blockingEntity, unblockCondition, escalationPath)

**v1.0.0 tasks without blocker metadata continue to work.**

### 3. Confidence Scoring & Validation Hooks (Optional)

**New in v1.1.0:**
- Three-factor confidence scoring algorithm
- Auto-creation thresholds
- Validation hooks for task auto-creation
- New MCP tools: taskCalculateConfidence, taskCreateValidationHook

**All existing MCP tools function exactly as before.**

---

## Migration Steps (Optional)

You don't need to do anything to keep using v1.1.0 - your existing projects will work fine. But if you want to adopt the new features, follow these steps.

### Step 1: Update @projitive/mcp Package

**First, update your MCP server:**

```bash
# If using npx (recommended)
# No action needed - npx will automatically use the latest version

# If using local installation
npm install @projitive/mcp@latest
```

**Verify the version:**
```bash
npx @projitive/mcp --version
# Should show 1.1.0 or higher
```

### Step 2: (Optional) Add Sub-state to Existing Tasks

If you want to use sub-state metadata for existing IN_PROGRESS tasks:

**Before (v1.0.0):**
```markdown
## TASK-0001 | IN_PROGRESS | Implement Feature X
- owner: ai-copilot
- summary: Implement feature X with Y and Z
- updatedAt: 2026-02-22T00:00:00.000Z
```

**After (v1.1.0, optional):**
```markdown
## TASK-0001 | IN_PROGRESS | Implement Feature X
- owner: ai-copilot
- summary: Implement feature X with Y and Z
- updatedAt: 2026-02-22T00:00:00.000Z
- subState:
  phase: implementation
  confidence: 0.85
  estimatedCompletion: 2026-02-23T18:00:00.000Z
```

**Or via MCP tool:**
```typescript
taskUpdate(
  projectPath="./my-project",
  taskId="TASK-0001",
  subState={
    "phase": "implementation",
    "confidence": 0.85,
    "estimatedCompletion": "2026-02-23T18:00:00.000Z"
  }
)
```

### Step 3: (Optional) Add Blocker Metadata to BLOCKED Tasks

If you have BLOCKED tasks and want to use the new categorization:

**Before (v1.0.0):**
```markdown
## TASK-0001 | BLOCKED | Implement Feature X
- owner: ai-copilot
- summary: Implement feature X with Y and Z
- updatedAt: 2026-02-22T00:00:00.000Z
```

**After (v1.1.0, optional):**
```markdown
## TASK-0001 | BLOCKED | Implement Feature X
- owner: ai-copilot
- summary: Implement feature X with Y and Z
- updatedAt: 2026-02-22T00:00:00.000Z
- blocker:
  type: external_dependency
  description: Waiting for API documentation
  blockingEntity: External API Team
  unblockCondition: API docs published
  escalationPath: Ping @api-lead if > 24h
```

**Or via MCP tool:**
```typescript
taskUpdate(
  projectPath="./my-project",
  taskId="TASK-0001",
  status="BLOCKED",
  blocker={
    "type": "external_dependency",
    "description": "Waiting for API documentation",
    "blockingEntity": "External API Team",
    "unblockCondition": "API docs published",
    "escalationPath": "Ping @api-lead if > 24h"
  }
)
```

### Step 4: (Optional) Create Validation Hook

If you want to use the new auto-creation validation:

```typescript
// Create the validation hook template
taskCreateValidationHook(projectPath="./my-project")

// This creates: .projitive/hooks/task_auto_create_validation.md
```

**Then edit the hook file** to customize your validation rules.

### Step 5: (Optional) Update CI/CD for Coverage

If you want to add test coverage reporting (like we did in TASK-0014):

**1. Update package.json:**
```json
{
  "scripts": {
    "test:coverage": "vitest run --coverage",
    "benchmark": "vitest bench --run"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^3.2.4"
  }
}
```

**2. Create vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'source/**/*.test.ts',
        'source/benchmark/**/*'
      ]
    },
    exclude: ['source/benchmark/**/*']
  }
});
```

**3. Update GitHub Actions workflow:**
See TASK-0014 for complete examples.

---

## Backward Compatibility Guarantee

We take backward compatibility seriously. Here's what you can count on:

### ✅ What continues to work exactly as before:

1. **All v1.0.0 task formats**
   - TODO/IN_PROGRESS/BLOCKED/DONE statuses
   - Task without subState or blocker
   - All existing task fields

2. **All v1.0.0 MCP tools**
   - projectLocate
   - projectContext
   - projectList
   - projectScan
   - taskNext
   - taskContext
   - taskList
   - taskUpdate (without subState/blocker)
   - reportCreate
   - evidenceAdd

3. **All v1.0.0 file formats**
   - tasks.md format
   - roadmap.md format
   - All design and report formats

### ⚠️ What's new and optional:

1. **taskUpdate with subState** - Optional, you can still use the v1.0.0 signature
2. **taskUpdate with blocker** - Optional, you can still use the v1.0.0 signature
3. **taskCalculateConfidence** - New tool, completely optional
4. **taskCreateValidationHook** - New tool, completely optional

---

## Feature Adoption Guide

### When to Adopt Sub-state Metadata

**Adopt if:**
- You have tasks that take longer than 1 hour
- You want to track progress through phases
- Multiple agents work on the same task
- You want more visibility into task progress

**Don't worry about it if:**
- Your tasks are small and quick (< 30 minutes)
- You're just getting started with Projitive
- You prefer simplicity over detailed tracking

### When to Adopt Blocker Categorization

**Adopt if:**
- You frequently have blocked tasks
- You want better visibility into why tasks are blocked
- You need to escalate blocked tasks
- You want to track blocker resolution time

**Don't worry about it if:**
- You rarely have blocked tasks
- You prefer simple status tracking
- You're just getting started

### When to Adopt Confidence Scoring

**Adopt if:**
- You use auto-discovery for task creation
- You want to prevent low-quality tasks
- You have agents creating tasks automatically
- You want to maintain task quality

**Don't worry about it if:**
- You create all tasks manually
- You have a small number of tasks
- You prefer flexibility over strict quality gates

---

## Quick Comparison Table

| Feature | v1.0.0 | v1.1.0 | Change |
|---------|--------|--------|--------|
| Task Statuses | TODO, IN_PROGRESS, BLOCKED, DONE | Same | None ✅ |
| Task Fields | id, title, status, owner, summary, updatedAt, links, roadmapRefs | Same + subState (opt), blocker (opt) | Additive ✅ |
| MCP Tools | project*, task*, report*, evidence* | Same + taskCalculateConfidence, taskCreateValidationHook | Additive ✅ |
| File Formats | All existing formats | Same, can include new optional fields | Compatible ✅ |

---

## Migration Checklist

**If you want to adopt v1.1.0 features:**

- [ ] Update @projitive/mcp to 1.1.0+
- [ ] (Optional) Add subState to existing IN_PROGRESS tasks
- [ ] (Optional) Add blocker metadata to BLOCKED tasks
- [ ] (Optional) Create validation hook for auto-creation
- [ ] (Optional) Update CI/CD for coverage reporting
- [ ] Read the [User Guide Examples](./user-guide-examples.md)
- [ ] Read the [Best Practices Guide](./best-practices.md)

**If you just want to keep using v1.0.0:**

- [ ] Do nothing! Everything continues to work ✅

---

## Getting Help

If you run into issues during migration:

1. Check the [User Guide](./user-guide-examples.md) for examples
2. Check the [Best Practices](./best-practices.md) for recommendations
3. Review the original [Spec v1.1 Proposal](./spec-v1.1-governance-change-proposal.md)
4. Look at the [TASK-0008](./../reports/TASK-0008-execution-2026-02-22.md) through [TASK-0013](./../reports/TASK-0013-execution-2026-02-22.md) reports to see how we implemented v1.1.0

---

## Example: Complete v1.0.0 → v1.1.0 Migration

Here's a complete example of migrating a project:

### Before (v1.0.0)

**tasks.md:**
```markdown
<!-- PROJITIVE:TASKS:START -->
## TASK-0001 | TODO | Add Authentication
- owner: ai-copilot
- summary: Add user authentication
- updatedAt: 2026-02-22T00:00:00.000Z
<!-- PROJITIVE:TASKS:END -->
```

### After (v1.1.0, with new features)

**tasks.md:**
```markdown
<!-- PROJITIVE:TASKS:START -->
## TASK-0001 | IN_PROGRESS | Add Authentication
- owner: ai-copilot
- summary: Add user authentication with OAuth2
- updatedAt: 2026-02-22T12:00:00.000Z
- subState:
  phase: design
  confidence: 0.85
  estimatedCompletion: 2026-02-23T18:00:00.000Z
<!-- PROJITIVE:TASKS:END -->
```

**And you still have the option to:**
- Use taskCalculateConfidence before creating TASK-0002
- Use blocker metadata if TASK-0001 gets blocked
- Add coverage reporting to your CI/CD

---

**Happy migrating! Remember - all changes are optional. Adopt what works for you.**
