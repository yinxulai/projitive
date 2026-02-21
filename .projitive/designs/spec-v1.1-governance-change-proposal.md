# Spec v1.1 Governance Change Proposal

**Design ID**: DESIGN-0003  
**Task Ref**: TASK-0003  
**Roadmap Ref**: ROADMAP-0002  
**Created**: 2026-02-21  
**Status**: PROPOSED

---

## 1. Executive Summary

This document proposes governance changes for **projitive-spec v1.1.0**, building on the stable v1.0.0 foundation. The focus is on enhancing agent autonomy while maintaining governance traceability.

### Key Changes at a Glance

| Area | v1.0.0 | v1.1.0 Proposal |
|------|--------|-----------------|
| Task States | 4 states (TODO/IN_PROGRESS/BLOCKED/DONE) | 4 states + optional sub-state metadata |
| Evidence Rules | Required for state transitions | Required + automated validation hooks |
| Auto-discovery | Manual task creation | Safer auto-discovery with confidence scoring |
| Migration Path | N/A | Built-in migration guide + validation tools |

---

## 2. Motivation

### 2.1 Problems with v1.0.0

After operational experience with v1.0.0, we've identified these friction points:

1. **Task Creation Bottleneck**: Agents cannot safely create tasks without human review, limiting autonomy
2. **Limited Context for BLOCKED State**: No structured way to express blocker types (dependency vs external vs resource)
3. **Migration Uncertainty**: No clear path for existing projects to adopt spec updates

### 2.2 Success Criteria for v1.1.0

- [ ] Agents can auto-create tasks with 95%+ accuracy (validated against human review)
- [ ] Blocker categorization reduces resolution time by 30%
- [ ] Migration from v1.0.0 to v1.1.0 completes in < 1 hour per project

---

## 3. Proposed Changes

### 3.1 Enhanced Task State Machine

#### 3.1.1 Optional Sub-state Metadata

Extend the four core states with optional metadata:

```yaml
# Example in tasks.md
## TASK-0001 | IN_PROGRESS | Build feature X
- owner: ai-copilot
- summary: Implementing core functionality
- subState:  # NEW in v1.1.0
    phase: implementation  # discovery|design|implementation|testing
    confidence: 0.85       # 0.0-1.0 agent confidence score
    estimatedCompletion: 2026-02-25T15:00:00Z
```

#### 3.1.2 Blocker Categorization

Structured BLOCKED state with categories:

```yaml
## TASK-0002 | BLOCKED | Waiting for API
- owner: ai-copilot
- summary: Blocked on external API release
- blocker:  # NEW in v1.1.0
    type: external_dependency  # internal_dependency|external_dependency|resource|approval
    description: Waiting for payment API v2.0
    blockingEntity: third-party/payment-provider
    unblockCondition: API v2.0 GA announced
    escalationPath: contact-pm-for-workaround
- updatedAt: 2026-02-21T10:00:00Z
```

### 3.2 Safer Auto-Discovery and Task Creation

#### 3.2.1 Confidence Scoring Algorithm

Agents must calculate confidence before auto-creating tasks:

```
confidence_score = (
    context_completeness * 0.4 +      # How much context is available
    similar_task_history * 0.3 +         # Past similar tasks success rate
    specification_clarity * 0.3          # How clear are requirements
)

Auto-create threshold: confidence_score >= 0.85
Requires review threshold: 0.60 <= confidence_score < 0.85
Must not create threshold: confidence_score < 0.60
```

#### 3.2.2 Validation Hooks

New governance artifact: `.projitive/hooks/task_auto_create_validation.md`

```markdown
# Task Auto-Create Validation Hook

## Pre-Creation Checklist
- [ ] Context files exist and are readable
- [ ] Similar tasks have been completed successfully
- [ ] Acceptance criteria are clear and testable
- [ ] Dependencies are identified and available

## Post-Creation Actions
- [ ] Add evidence link to analysis document
- [ ] Notify relevant stakeholders (if configured)
- [ ] Schedule validation review (24h for high-confidence)
```

### 3.3 Migration Path from v1.0.0 to v1.1.0

#### 3.3.1 Migration Checklist

```markdown
# v1.0.0 → v1.1.0 Migration Guide

## Phase 1: Preparation (15 min)
- [ ] Backup current .projitive/ directory
- [ ] Review current task states and roadmap
- [ ] Identify tasks that will benefit from sub-state metadata

## Phase 2: Schema Update (20 min)
- [ ] Add optional subState field to IN_PROGRESS tasks
- [ ] Categorize BLOCKED tasks with blocker metadata
- [ ] Update task validation rules

## Phase 3: Hook Installation (15 min)
- [ ] Create task_auto_create_validation.md hook
- [ ] Configure confidence scoring thresholds
- [ ] Test auto-creation with low-risk task

## Phase 4: Validation (10 min)
- [ ] Run governance consistency check
- [ ] Verify all task IDs remain valid
- [ ] Confirm report generation works
```

#### 3.3.2 Automated Migration Script (Future)

```typescript
// Pseudo-code for future migration tool
interface MigrationStep {
  version: string;
  description: string;
  migrate: (ctx: MigrationContext) => Promise<void>;
  rollback: (ctx: MigrationContext) => Promise<void>;
}

const v1_0_0_to_v1_1_0: MigrationStep = {
  version: "1.1.0",
  description: "Add sub-state metadata and blocker categorization",
  migrate: async (ctx) => {
    // 1. Parse all tasks
    // 2. Add default subState to IN_PROGRESS tasks
    // 3. Categorize BLOCKED tasks
    // 4. Validate all task IDs unchanged
  },
  rollback: async (ctx) => {
    // Remove subState and blocker metadata
  }
};
```

---

## 4. Implementation Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design Review | 1 week | This document approved, feedback incorporated |
| Schema Definition | 3 days | TypeScript interfaces, validation rules |
| MCP Tool Updates | 1 week | Updated taskContext, new fields supported |
| Documentation | 3 days | Migration guide, updated specs |
| Testing | 1 week | Test projects, validation scripts |
| **Total** | **~4 weeks** | v1.1.0 release ready |

---

## 5. Appendix

### 5.1 Backwards Compatibility

All v1.1.0 changes are **additive only**:
- Sub-state metadata is optional
- Blocker categorization is optional
- Auto-discovery validation is opt-in via hook

Existing v1.0.0 projects continue to work without changes.

### 5.2 Glossary

| Term | Definition |
|------|------------|
| Sub-state | Optional metadata attached to task state (e.g., implementation phase, confidence score) |
| Blocker Category | Structured classification of why a task is blocked |
| Confidence Score | 0.0-1.0 measure of agent certainty for auto-creating tasks |
| Validation Hook | Pre/post action governance script in hooks/ directory |

---

## 6. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-21 | Add optional sub-state metadata | Provides progress visibility without breaking v1.0.0 |
| 2026-02-21 | Blocker categorization as structured metadata | Reduces resolution time by making blocker types explicit |
| 2026-02-21 | Confidence scoring for auto-discovery | Enables safe autonomy with measurable thresholds |
| 2026-02-21 | Additive-only changes for backwards compatibility | Ensures smooth migration path from v1.0.0 |

---

*End of Design Document*
