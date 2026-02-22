/**
 * Projitive MCP - Core Type Definitions
 * Spec v1.1.0 - Sub-state Metadata Support
 */

// ============================================================================
// Task State Machine
// ============================================================================

export const ALLOWED_STATUS = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
export type TaskStatus = (typeof ALLOWED_STATUS)[number];

// ============================================================================
// Sub-state Metadata (Spec v1.1.0)
// ============================================================================

/**
 * Phase of work within IN_PROGRESS state
 * - discovery: Researching requirements and constraints
 * - design: Creating architecture and implementation plan
 * - implementation: Writing and testing code
 * - testing: Validation and verification
 */
export const SUB_STATE_PHASES = ["discovery", "design", "implementation", "testing"] as const;
export type SubStatePhase = (typeof SUB_STATE_PHASES)[number];

/**
 * Sub-state metadata for enhanced task tracking
 * Optional in v1.1.0 for backwards compatibility
 */
export interface SubStateMetadata {
  /** Current phase of work (only applicable for IN_PROGRESS) */
  phase?: SubStatePhase;
  /** Agent confidence score (0.0 - 1.0) */
  confidence?: number;
  /** Estimated completion timestamp (ISO8601) */
  estimatedCompletion?: string;
}

/**
 * Blocker categorization for BLOCKED state (Spec v1.1.0)
 */
export const BLOCKER_TYPES = [
  "internal_dependency",
  "external_dependency", 
  "resource",
  "approval"
] as const;
export type BlockerType = (typeof BLOCKER_TYPES)[number];

/**
 * Structured blocker metadata
 */
export interface BlockerMetadata {
  /** Type of blocker */
  type: BlockerType;
  /** Human-readable description */
  description: string;
  /** Entity causing the block (team, service, person) */
  blockingEntity?: string;
  /** Condition required to unblock */
  unblockCondition?: string;
  /** Escalation path if block persists */
  escalationPath?: string;
}

// ============================================================================
// Core Task Interface
// ============================================================================

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  owner: string;
  summary: string;
  updatedAt: string;
  links: string[];
  roadmapRefs: string[];
  /** Sub-state metadata (Spec v1.1.0, optional) */
  subState?: SubStateMetadata;
  /** Blocker metadata (Spec v1.1.0, optional, for BLOCKED state) */
  blocker?: BlockerMetadata;
}

// ============================================================================
// Validation Types
// ============================================================================

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  fixHint?: string;
}

// ============================================================================
// Confidence Scoring (Spec v1.1.0)
// ============================================================================

export interface ConfidenceFactors {
  /** Context completeness (0.0 - 1.0) */
  contextCompleteness: number;
  /** Similar task history success rate (0.0 - 1.0) */
  similarTaskHistory: number;
  /** Specification clarity (0.0 - 1.0) */
  specificationClarity: number;
}

export interface ConfidenceScore {
  /** Final score (0.0 - 1.0) */
  score: number;
  /** Individual factors */
  factors: ConfidenceFactors;
  /** Recommended action */
  recommendation: "auto_create" | "review_required" | "do_not_create";
}

// Weight factors for confidence calculation
export const CONFIDENCE_WEIGHTS = {
  contextCompleteness: 0.4,
  similarTaskHistory: 0.3,
  specificationClarity: 0.3,
} as const;

// Confidence thresholds
export const CONFIDENCE_THRESHOLDS = {
  autoCreate: 0.85,
  reviewRequired: 0.6,
} as const;

// ============================================================================
// Task Document Types
// ============================================================================

export interface TaskDocument {
  tasksPath: string;
  tasks: Task[];
  markdown: string;
}

export interface ActionableTaskCandidate {
  governanceDir: string;
  tasksPath: string;
  task: Task;
  projectScore: number;
  projectLatestUpdatedAt: string;
  taskUpdatedAtMs: number;
  taskPriority: number;
}

// ============================================================================
// Parser Constants
// ============================================================================

export const TASKS_START = "<!-- PROJITIVE:TASKS:START -->";
export const TASKS_END = "<!-- PROJITIVE:TASKS:END -->";
export const TASK_ID_REGEX = /^TASK-\d{4}$/;

// ============================================================================
// Linter Types
// ============================================================================

export interface LintSuggestion {
  code: string;
  message: string;
  fixHint?: string;
}

export interface TaskLintSuggestion extends LintSuggestion {}

export const TASK_LINT_CODES = {
  DUPLICATE_ID: "TASK_DUPLICATE_ID",
  IN_PROGRESS_OWNER_EMPTY: "TASK_IN_PROGRESS_OWNER_EMPTY",
  DONE_LINKS_MISSING: "TASK_DONE_LINKS_MISSING",
  BLOCKED_SUMMARY_EMPTY: "TASK_BLOCKED_SUMMARY_EMPTY",
  UPDATED_AT_INVALID: "TASK_UPDATED_AT_INVALID",
  ROADMAP_REFS_EMPTY: "TASK_ROADMAP_REFS_EMPTY",
  OUTSIDE_MARKER: "TASK_OUTSIDE_MARKER",
  FILTER_EMPTY: "TASK_FILTER_EMPTY",
  LINK_TARGET_MISSING: "TASK_LINK_TARGET_MISSING",
  HOOK_FILE_MISSING: "TASK_HOOK_FILE_MISSING",
  CONTEXT_HOOK_HEAD_MISSING: "TASK_CONTEXT_HOOK_HEAD_MISSING",
  CONTEXT_HOOK_FOOTER_MISSING: "TASK_CONTEXT_HOOK_FOOTER_MISSING",
  // Spec v1.1.0 - Blocker Categorization
  BLOCKED_WITHOUT_BLOCKER: "TASK_BLOCKED_WITHOUT_BLOCKER",
  BLOCKER_TYPE_INVALID: "TASK_BLOCKER_TYPE_INVALID",
  BLOCKER_DESCRIPTION_EMPTY: "TASK_BLOCKER_DESCRIPTION_EMPTY",
  // Spec v1.1.0 - Sub-state Metadata
  IN_PROGRESS_WITHOUT_SUBSTATE: "TASK_IN_PROGRESS_WITHOUT_SUBSTATE",
  SUBSTATE_PHASE_INVALID: "TASK_SUBSTATE_PHASE_INVALID",
  SUBSTATE_CONFIDENCE_INVALID: "TASK_SUBSTATE_CONFIDENCE_INVALID",
} as const;
