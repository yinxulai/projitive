# User Guide - Usage Examples

**Version**: projitive-spec v1.1.0  
**Last Updated**: 2026-02-22

---

## Quick Start - 5 Minute Guide

### Step 1: Set up your project

```bash
# 1. Create a .projitive marker file in your project root
touch .projitive

# 2. Create the governance directory structure
mkdir -p .projitive/designs
mkdir -p .projitive/reports
mkdir -p .projitive/hooks

# 3. Create basic governance files
```

### Step 2: Create basic governance files

Create `.projitive/README.md`:

```markdown
# My Project Governance

## Governance Goals
- Enable AI-driven development with traceability
- Maintain auditable task transitions
- Follow Projitive spec v1.1.0

## Scope Boundaries
### In Scope
- All source code in this repository
- Documentation and design artifacts
- CI/CD configuration

### Out of Scope
- Deployment to production environments
- External service configurations

## Key Terms
- Governance Root: The directory containing .projitive marker
- Task: A unit of work with status and evidence
- Evidence: Designs and reports that prove task completion

## Required Reading for Agents
- Local: ./tasks.md
- Local: ./roadmap.md
- External: https://github.com/projitive/projitive/README.md

## Related Artifacts
- roadmap: ./roadmap.md
- tasks: ./tasks.md
- designs: ./designs/
- reports: ./reports/
```

Create `.projitive/roadmap.md`:

```markdown
# Roadmap

## Phase 1 - Initial Setup

### Goals
- Establish basic governance structure
- Create first tasks

### Milestones
- [x] ROADMAP-0001: Project initialized with .projitive marker
- [ ] ROADMAP-0002: First task completed with evidence
```

Create `.projitive/tasks.md`:

```markdown
# Tasks

<!-- PROJITIVE:TASKS:START -->
<!-- PROJITIVE:TASKS:END -->
```

### Step 3: Configure MCP Server

Create `mcp.json` in your OpenClaw config:

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

### Step 4: Start using Projitive!

The agent will now automatically:
1. Locate your project using `projectLocate`
2. Get project context with `projectContext`
3. Find next task with `taskNext`
4. Get task details with `taskContext`

---

## Common Workflow Examples

### Workflow 1: Starting a New Task

**What the agent does:**

1. **Discover the next task**
   ```
   taskNext()
   ```

2. **Get task context**
   ```
   taskContext(projectPath="./my-project", taskId="TASK-0001")
   ```

3. **Update task status to IN_PROGRESS**
   ```
   taskUpdate(
     projectPath="./my-project",
     taskId="TASK-0001",
     status="IN_PROGRESS",
     subState={
       "phase": "discovery",
       "confidence": 0.85,
       "estimatedCompletion": "2026-02-23T00:00:00.000Z"
     }
   )
   ```

4. **Execute the task** (make changes, create designs, etc.)

5. **Update task status to DONE**
   ```
   taskUpdate(
     projectPath="./my-project",
     taskId="TASK-0001",
     status="DONE"
   )
   ```

### Workflow 2: Using Spec v1.1.0 Sub-state Metadata

**When task is IN_PROGRESS:**

```typescript
// Phase 1: Discovery
taskUpdate(
  projectPath="./my-project",
  taskId="TASK-0001",
  subState={
    "phase": "discovery",
    "confidence": 0.75,
    "estimatedCompletion": "2026-02-23T12:00:00.000Z"
  }
)

// Phase 2: Design
taskUpdate(
  projectPath="./my-project",
  taskId="TASK-0001",
  subState={
    "phase": "design",
    "confidence": 0.85,
    "estimatedCompletion": "2026-02-23T18:00:00.000Z"
  }
)

// Phase 3: Implementation
taskUpdate(
  projectPath="./my-project",
  taskId="TASK-0001",
  subState={
    "phase": "implementation",
    "confidence": 0.90,
    "estimatedCompletion": "2026-02-24T00:00:00.000Z"
  }
)

// Phase 4: Testing
taskUpdate(
  projectPath="./my-project",
  taskId="TASK-0001",
  subState={
    "phase": "testing",
    "confidence": 0.95,
    "estimatedCompletion": "2026-02-24T06:00:00.000Z"
  }
)
```

### Workflow 3: Managing Blocked Tasks (Spec v1.1.0)

**When a task is blocked:**

```typescript
taskUpdate(
  projectPath="./my-project",
  taskId="TASK-0001",
  status="BLOCKED",
  blocker={
    "type": "external_dependency",
    "description": "Waiting for API documentation from team X",
    "blockingEntity": "Team X API Documentation",
    "unblockCondition": "API docs published to Confluence",
    "escalationPath": "Ping @team-x-lead if blocked > 24 hours"
  }
)
```

**Blocker Types:**
- `internal_dependency`: Waiting on another team/resource within the organization
- `external_dependency`: Waiting on external service/vendor
- `resource`: Waiting for compute resources, licenses, etc.
- `approval`: Waiting for managerial/legal approval

### Workflow 4: Confidence Scoring for Auto-creation

**Before auto-creating a task:**

```typescript
// Calculate confidence score
taskCalculateConfidence(
  projectPath="./my-project",
  candidateTaskSummary="Implement user authentication with OAuth2",
  contextCompleteness=0.9,
  similarTaskHistory=0.7,
  specificationClarity=0.8
)

// Returns:
// - confidenceScore: 82%
// - recommendation: review_required
// - validationPassed: true
```

**Confidence Thresholds:**
- `>= 0.85`: Auto-create recommended
- `0.60 - 0.85`: Review required before creating
- `< 0.60`: Do not auto-create

**Three-factor calculation:**
```
confidence_score = context_completeness * 0.4 + 
                   similar_task_history * 0.3 + 
                   specification_clarity * 0.3
```

---

## MCP Tool Reference

### Project Discovery Tools

| Tool | Description |
|------|-------------|
| `projectLocate` | Find governance root by .projitive marker |
| `projectList` | List all discovered projects |
| `projectScan` | Scan project structure |
| `projectContext` | Get complete project context |

### Task Management Tools

| Tool | Description |
|------|-------------|
| `taskNext` | Get next actionable task |
| `taskContext` | Get task details and context |
| `taskList` | List all tasks |
| `taskUpdate` | Update task status and metadata |

### Spec v1.1.0 Tools

| Tool | Description |
|------|-------------|
| `taskCalculateConfidence` | Calculate confidence for auto-creation |
| `taskCreateValidationHook` | Create validation hook template |

### Report & Evidence Tools

| Tool | Description |
|------|-------------|
| `reportCreate` | Create execution report |
| `evidenceAdd` | Add evidence file |

---

## Next Steps

- Read the [Best Practices Guide](./best-practices.md)
- Learn about [Migration from v1.0.0 to v1.1.0](./migration-guide-v1.1.0.md)
- Explore the [Design Documentation](../design/)
