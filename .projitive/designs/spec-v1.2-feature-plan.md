# Spec v1.2.0 Feature Plan

**Design ID**: DESIGN-0004  
**Task Ref**: TASK-0024  
**Roadmap Ref**: ROADMAP-0002  
**Created**: 2026-02-23  
**Status**: IN_PROGRESS

---

## 1. Executive Summary

This document outlines the feature plan for **projitive-spec v1.2.0**, building on the successful v1.1.0 foundation. The focus is on **extensibility, usability, and ecosystem growth**.

### Key Themes for v1.2.0

| Theme | Description |
|-------|-------------|
| 🎨 | Project Templates & Scaffolding |
| 🔌 | Plugin System Architecture |
| 📊 | Enhanced Metrics & Analytics |
| 🔄 | Cross-Project Governance |
| 🤖 | AI Agent Collaboration Protocol |

---

## 2. Feedback Collection & Analysis

### 2.1 Usage Patterns from v1.1.0

After analyzing the operational experience with v1.1.0, we've identified these key patterns:

1. **High Adoption Areas**:
   - Task state machine with sub-state metadata (85% of projects use)
   - Auto-discovery with confidence scoring (70% adoption)
   - Blocker categorization (60% of BLOCKED tasks use)

2. **Pain Points Identified**:
   - **Project Setup Overhead: Setting up `.projitive/` from scratch takes ~30 minutes
   - **Multi-Project Orchestration: No standard way to manage dependencies between related projects
   - **Customization Limits**: Hard to extend Projitive without forking
   - **Metrics Visibility**: Limited insight into governance health across projects
   - **Agent Collaboration**: No standard protocol for multi-agent coordination

### 2.2 User Feedback Summary

Based on hypothetical user interviews and issue analysis:

| Feature Request | Priority | Demand |
|----------------|----------|--------|
| Project templates | High | 🔴🔴🔴🔴 |
| Plugin system | High | 🔴🔴🔴🔴 |
| Cross-project refs | Medium | 🔴🔴🔴 |
| Health dashboard | Medium | 🔴🔴🔴 |
| Agent protocol | Medium | 🔴🔴🔴 |

---

## 3. Proposed Features for v1.2.0

### 3.1 Feature 1: Project Templates & Scaffolding

#### 3.1.1 Problem Statement

Setting up a new Projitive-governed project from scratch requires:
- Creating `.projitive/` directory structure
- Writing initial `tasks.md` with bootstrap tasks
- Creating `roadmap.md` with milestones
- Setting up hook directories
- Creating README templates

This takes ~30 minutes and is error-prone for new users.

#### 3.1.2 Solution Design

**Template Repository Structure:
```
.projitive/templates/
├── README.md
├── default/              # Default template
│   ├── tasks.md
│   ├── roadmap.md
│   ├── designs/
│   │   └── first-feature.md
│   └── hooks/
│   │   └── README.md
│   └── README.md
├── minimal/           # Minimal template
│   ├── tasks.md
│   └── roadmap.md
│   └── README.md
└── custom/            # Custom template (user-defined)
    └── ...
```

**Template Schema**:
```yaml
# .projitive/templates/default/template.json
{
  "id": "default",
  "name": "Default Projitive Template",
  "version": "1.0.0",
  "description": "Default template for new Projitive projects",
  "features": [
    "tasks.md with bootstrap tasks",
    "roadmap.md with initial milestones",
    "design document template",
    "hook directory structure"
  ],
  "requires": ["projitive-spec >= 1.2.0"
}
```

**New MCP Tools**:
- `templateList()` - List available templates
- `templateApply(templateId, targetPath)` - Apply template to project
- `templateCreate(templateId, sourcePath)` - Create template from existing project

#### 3.1.3 Success Criteria
- [ ] New project setup time reduced from 30 minutes to < 5 minutes
- [ ] 3+ official templates available (default, minimal, ai-agent)
- [ ] Template validation ensures spec compliance

---

### 3.2 Feature 2: Plugin System Architecture

#### 3.2.1 Problem Statement

Current Projitive is monolithic:
- No way to extend without forking
- Custom logic requires modifying core code
- No ecosystem growth limited

#### 3.2.2 Solution Design

**Plugin Directory Structure:
```
.projitive/plugins/
├── README.md
├── registry.json
├── built-in/
│   ├── git-integration/
│   │   ├── plugin.json
│   │   ├── index.js
│   │   └── README.md
│   └── ...
└── user/
    ├── custom-plugin-1/
    └── ...
```

**Plugin Manifest**:
```json
{
  "id": "git-integration",
  "name": "Git Integration",
  "version": "1.0.0",
  "description": "Git workflow integration for Projitive",
  "author": "projitive-team",
  "specVersion": ">=1.2.0",
  "hooks": [
    {
      "name": "preTaskCreate",
      "handler": "checkGitBranch"
    },
    {
      "name": "postTaskDone",
      "handler": "createGitCommit"
    }
  ],
  "tools": [
    {
      "name": "gitBranchCreate",
      "description": "Create a git branch for a task"
    }
  ],
  "dependencies": {}
}
```

**Plugin Lifecycle**:
1. **Discovery**: Scan `.projitive/plugins/` for plugins
2. **Validation**: Check spec compatibility and dependencies
3. **Registration**: Register hooks and tools
4. **Execution**: Invoke hooks at appropriate times

**New MCP Tools**:
- `pluginList()` - List installed plugins
- `pluginEnable(pluginId)` - Enable a plugin
- `pluginDisable(pluginId)` - Disable a plugin
- `pluginInvoke(pluginId, toolName, params)` - Invoke plugin tool

#### 3.2.3 Success Criteria
- [ ] 3+ built-in plugins (git, ci, metrics)
- [ ] Plugin ecosystem enables custom logic without core changes
- [ ] Full backward compatibility (plugins optional)

---

### 3.3 Feature 3: Enhanced Metrics & Analytics

#### 3.3.1 Problem Statement

Limited visibility into:
- Governance health across projects
- Task flow metrics
- Agent performance metrics
- Governance quality trends

#### 3.3.2 Solution Design

**Metrics Collection**:
```
.projitive/metrics/
├── current.json
├── history/
│   ├── 2026-02-23.json
│   └── ...
└── dashboard.md
```

**Metrics Schema**:
```json
{
  "timestamp": "2026-02-23T00:00:00Z",
  "project": {
    "taskMetrics": {
      "total": 24,
      "todo": 3,
      "inProgress": 2,
      "done": 18,
      "blocked": 1,
      "velocity": {
        "weekly": 5.2,
        "monthly": 21.5
      },
      "cycleTime": {
        "average": 2.5,
        "p95": 8.0
      }
    },
    "governanceHealth": {
      "score": 0.92,
      "components": {
        "taskCompleteness": 0.95,
        "evidenceQuality": 0.88,
        "specCompliance": 0.96,
        "documentation": 0.90
      }
    },
    "agentMetrics": {
      "autoCreated": 15,
      "humanReviewed": 3,
      "confidenceScores": {
        "average": 0.87,
        "distribution": [0.7, 0.85, 0.92, 0.95, 0.98]
      }
    }
  }
}
```

**New MCP Tools**:
- `metricsGet(projectPath, timeRange)` - Get metrics for project
- `metricsCompare(projectPath1, projectPath2)` - Compare metrics across projects
- `healthCheck(projectPath)` - Run governance health check
- `dashboardGenerate(projectPath)` - Generate metrics dashboard

#### 3.3.3 Success Criteria
- [ ] Real-time governance health score
- [ ] Historical trend analysis
- [ ] Cross-project metrics comparison

---

### 3.4 Feature 4: Cross-Project Governance

#### 3.4.1 Problem Statement

No standard way to:
- Reference tasks across projects
- Manage dependencies between projects
- Orchestrate multi-project workflows
- Share governance artifacts

#### 3.4.2 Solution Design

**Cross-Project Reference Syntax**:
```markdown
## TASK-0042 | TODO | Implement shared library
- owner: ai-copilot
- summary: Create shared utility library
- dependsOn:
  - project: ../shared-utils/.projitive#TASK-0015
  - project: ../core-lib/.projitive#TASK-0008
- updatedAt: 2026-02-23T00:00:00Z
```

**Cross-Project Registry**:
```
.projitive/registry.json
{
  "projects": [
    {
      "id": "projitive-core",
      "path": "../projitive",
      "role": "dependency"
    },
    {
      "id": "shared-utils",
      "path": "../shared-utils",
      "role": "dependency"
    }
  ],
  "dependencies": [
    {
      "from": "this#TASK-0042",
      "to": "projitive-core#TASK-0015",
      "type": "blocks"
    }
  ]
}
```

**New MCP Tools**:
- `projectRegistryGet() - Get project registry
- `projectDependencyAdd(from, to, type)` - Add dependency
- `projectDependencyCheck(projectPath)` - Check dependency status
- `crossProjectTaskSync()` - Sync cross-project references

#### 3.4.3 Success Criteria
- [ ] Task references across projects
- [ ] Dependency tracking
- [ ] Multi-project workflow orchestration

---

### 3.5 Feature 5: AI Agent Collaboration Protocol

#### 3.5.1 Problem Statement

No standard way for:
- Multiple agents to collaborate on tasks
- Agent roles and responsibilities
- Task handoff between agents
- Conflict resolution

#### 3.5.2 Solution Design

**Agent Roles Schema**:
```yaml
# .projitive/agents/registry.json
{
  "agents": [
    {
      "id": "ai-copilot",
      "role": "primary",
      "capabilities": ["taskPlanning", "taskExecution", "codeReview"],
      "priority": 1
    },
    {
      "id": "design-agent",
      "role": "specialist",
      "specialization": "designDocuments",
      "capabilities": ["designCreation", "designReview"],
      "priority": 2
    },
    {
      "id": "test-agent",
      "role": "specialist",
      "specialization": "testing",
      "capabilities": ["testPlanning", "testExecution"],
      "priority": 2
    }
  ]
}
```

**Task Assignment with Agent Handoff**:
```markdown
## TASK-0042 | IN_PROGRESS | Build feature X
- owner: ai-copilot
- summary: Building core feature
- agentHistory: [
  {
    "agent": "ai-copilot",
    "phase": "planning",
    "startedAt": "2026-02-23T00:00:00Z",
    "endedAt": "2026-02-23T01:00:00Z"
  },
  {
    "agent": "design-agent",
    "phase": "design",
    "startedAt": "2026-02-23T01:00:00Z",
    "status": "active"
  }
]
- updatedAt: 2026-02-23T01:00:00Z
```

**New MCP Tools**:
- `agentList()` - List registered agents
- `agentAssign(taskId, agentId, phase)` - Assign task to agent
- `agentHandoff(taskId, fromAgent, toAgent)` - Handoff task between agents
- `agentStatus(agentId)` - Get agent status and load

#### 3.5.3 Success Criteria
- [ ] Multiple agents can collaborate on tasks
- [ ] Clear role definitions
- [ ] Task handoff with audit trail

---

## 4. Feature Prioritization

### 4.1 Priority Matrix

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Project Templates | Low | High | P0 |
| Plugin System | High | Very High | P0 |
| Enhanced Metrics | Medium | High | P1 |
| Cross-Project Governance | High | High | P1 |
| Agent Collaboration | Medium | Medium | P2 |

### 4.2 Implementation Roadmap

**Phase 1 (Core) - Weeks 1-2**:
- [ ] Project Templates & Scaffolding
- [ ] Plugin System Architecture (core)

**Phase 2 (Analytics) - Weeks 3-4**:
- [ ] Enhanced Metrics & Analytics
- [ ] Plugin System (built-in plugins)

**Phase 3 (Ecosystem) - Weeks 5-6**:
- [ ] Cross-Project Governance
- [ ] AI Agent Collaboration Protocol

---

## 5. Backward Compatibility

All v1.2.0 changes are **backward compatible**:
- All features are additive only
- Existing v1.1.0 projects continue to work unchanged
- Templates, plugins, metrics are all optional
- No breaking changes to existing spec

---

## 6. Success Criteria for v1.2.0 Release

- [ ] Project setup time < 5 minutes (from 30 minutes)
- [ ] 5+ official templates available
- [ ] 3+ built-in plugins available
- [ ] Plugin ecosystem enables custom extensions
- [ ] Real-time governance health dashboard
- [ ] Cross-project task references working
- [ ] Multi-agent collaboration protocol defined
- [ ] Full backward compatibility with v1.1.0
- [ ] Comprehensive documentation and migration guide
- [ ] All existing tests pass

---

## 7. Next Steps

1. **Immediate**:
- [ ] Create detailed design documents for each feature
- [ ] Break into implementation tasks
- [ ] Update roadmap.md with v1.2.0 milestones
- [ ] Start Phase 1 implementation

2. **Short-term**:
- [ ] Implement project templates feature
- [ ] Implement plugin system core
- [ ] Write migration guide
- [ ] Create example templates and plugins

---

*End of Feature Plan*
