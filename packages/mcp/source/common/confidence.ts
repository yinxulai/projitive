/**
 * Projitive MCP - Confidence Scoring for Spec v1.1.0
 * 
 * This module implements the confidence scoring algorithm for auto-discovery
 * and task creation, along with validation hooks integration.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ConfidenceFactors, ConfidenceScore, Task } from "../types.js";
import { CONFIDENCE_WEIGHTS, CONFIDENCE_THRESHOLDS } from "../types.js";

// ============================================================================
// Confidence Scoring Algorithm
// ============================================================================

/**
 * Calculate confidence score based on the three factors
 * Formula: context_completeness * 0.4 + similar_task_history * 0.3 + specification_clarity * 0.3
 */
export function calculateConfidenceScore(factors: ConfidenceFactors): ConfidenceScore {
  // Validate input ranges
  const validateFactor = (value: number, name: string): number => {
    if (value < 0 || value > 1) {
      console.warn(`[Confidence] ${name} value ${value} is outside [0, 1] range, clamping`);
      return Math.max(0, Math.min(1, value));
    }
    return value;
  };

  const contextCompleteness = validateFactor(factors.contextCompleteness, "contextCompleteness");
  const similarTaskHistory = validateFactor(factors.similarTaskHistory, "similarTaskHistory");
  const specificationClarity = validateFactor(factors.specificationClarity, "specificationClarity");

  // Calculate weighted score
  const score = 
    contextCompleteness * CONFIDENCE_WEIGHTS.contextCompleteness +
    similarTaskHistory * CONFIDENCE_WEIGHTS.similarTaskHistory +
    specificationClarity * CONFIDENCE_WEIGHTS.specificationClarity;

  // Determine recommendation
  let recommendation: ConfidenceScore["recommendation"];
  if (score >= CONFIDENCE_THRESHOLDS.autoCreate) {
    recommendation = "auto_create";
  } else if (score >= CONFIDENCE_THRESHOLDS.reviewRequired) {
    recommendation = "review_required";
  } else {
    recommendation = "do_not_create";
  }

  return {
    score,
    factors: {
      contextCompleteness,
      similarTaskHistory,
      specificationClarity,
    },
    recommendation,
  };
}

// ============================================================================
// Factor Calculation Helpers
// ============================================================================

/**
 * Calculate context completeness factor by checking available governance artifacts
 */
export async function calculateContextCompleteness(governanceDir: string): Promise<number> {
  const requiredFiles = [
    "tasks.md",
    "roadmap.md", 
    "README.md"
  ];
  
  const optionalFiles = [
    "hooks/task_no_actionable.md",
    "hooks/task_auto_create_validation.md"
  ];

  let availableCount = 0;
  const totalFiles = requiredFiles.length + optionalFiles.length;

  // Check required files
  for (const file of requiredFiles) {
    const filePath = path.join(governanceDir, file);
    try {
      await fs.access(filePath);
      availableCount++;
    } catch {
      // File doesn't exist
    }
  }

  // Check optional files (weighted 0.5 each)
  for (const file of optionalFiles) {
    const filePath = path.join(governanceDir, file);
    try {
      await fs.access(filePath);
      availableCount += 0.5;
    } catch {
      // File doesn't exist
    }
  }

  return Math.min(1, availableCount / totalFiles);
}

/**
 * Calculate similar task history success rate
 */
export function calculateSimilarTaskHistory(
  tasks: Task[], 
  candidateTaskSummary: string
): number {
  // Filter similar tasks based on keyword matching
  const keywords = candidateTaskSummary.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  const similarTasks = tasks.filter(task => {
    const taskText = `${task.title} ${task.summary}`.toLowerCase();
    return keywords.some(keyword => taskText.includes(keyword));
  });

  if (similarTasks.length === 0) {
    return 0.5; // Neutral score when no history
  }

  // Calculate success rate
  const completedTasks = similarTasks.filter(task => task.status === "DONE");
  return completedTasks.length / similarTasks.length;
}

/**
 * Calculate specification clarity factor
 */
export function calculateSpecificationClarity(
  projectContext: { 
    hasRoadmap?: boolean;
    hasDesignDocs?: boolean;
    hasClearAcceptanceCriteria?: boolean;
  }
): number {
  let clarity = 0.3; // Base clarity

  if (projectContext.hasRoadmap) clarity += 0.2;
  if (projectContext.hasDesignDocs) clarity += 0.2;
  if (projectContext.hasClearAcceptanceCriteria) clarity += 0.3;

  return Math.min(1, clarity);
}

// ============================================================================
// Validation Hooks Integration
// ============================================================================

const TASK_AUTO_CREATE_VALIDATION_HOOK = "task_auto_create_validation.md";

const DEFAULT_TASK_AUTO_CREATE_VALIDATION_HOOK = `# Task Auto-Create Validation Hook

## Pre-Creation Checklist
- [ ] Context files exist and are readable
- [ ] Similar tasks have been completed successfully
- [ ] Acceptance criteria are clear and testable
- [ ] Dependencies are identified and available

## Post-Creation Actions
- [ ] Add evidence link to analysis document
- [ ] Notify relevant stakeholders (if configured)
- [ ] Schedule validation review (24h for high-confidence)
`;

/**
 * Check if task auto-create validation hook exists
 */
export async function hasTaskAutoCreateValidationHook(governanceDir: string): Promise<boolean> {
  const hookPath = path.join(governanceDir, "hooks", TASK_AUTO_CREATE_VALIDATION_HOOK);
  try {
    await fs.access(hookPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get or create task auto-create validation hook
 */
export async function getOrCreateTaskAutoCreateValidationHook(governanceDir: string): Promise<string> {
  const hooksDir = path.join(governanceDir, "hooks");
  const hookPath = path.join(hooksDir, TASK_AUTO_CREATE_VALIDATION_HOOK);

  try {
    // Try to read existing hook
    const content = await fs.readFile(hookPath, "utf-8");
    return content;
  } catch {
    // Create hooks directory if it doesn't exist
    try {
      await fs.mkdir(hooksDir, { recursive: true });
    } catch {
      // Directory already exists or creation failed silently
    }

    // Create default hook
    await fs.writeFile(hookPath, DEFAULT_TASK_AUTO_CREATE_VALIDATION_HOOK, "utf-8");
    return DEFAULT_TASK_AUTO_CREATE_VALIDATION_HOOK;
  }
}

/**
 * Run pre-creation validation checklist
 */
export async function runPreCreationValidation(
  governanceDir: string,
  confidenceScore: ConfidenceScore
): Promise<{
  passed: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // Check confidence score first
  if (confidenceScore.recommendation === "do_not_create") {
    issues.push(`Confidence score ${confidenceScore.score.toFixed(2)} is below threshold (${CONFIDENCE_THRESHOLDS.reviewRequired})`);
  }

  // Check context completeness
  if (confidenceScore.factors.contextCompleteness < 0.6) {
    issues.push(`Context completeness (${confidenceScore.factors.contextCompleteness.toFixed(2)}) is low - more governance artifacts recommended`);
  }

  // Check for validation hook
  const hasHook = await hasTaskAutoCreateValidationHook(governanceDir);
  if (!hasHook) {
    issues.push("Task auto-create validation hook not found - will create default hook");
  }

  return {
    passed: issues.length === 0 || confidenceScore.recommendation === "auto_create",
    issues,
  };
}

// ============================================================================
// Confidence Report Generation
// ============================================================================

/**
 * Generate a human-readable confidence report
 */
export function generateConfidenceReport(confidenceScore: ConfidenceScore): string {
  const lines: string[] = [
    "# Confidence Score Report",
    "",
    `## Final Score: ${(confidenceScore.score * 100).toFixed(0)}%`,
    `**Recommendation**: ${confidenceScore.recommendation.replace(/_/g, " ")}`,
    "",
    "## Factor Breakdown",
    "",
    `| Factor | Score | Weight | Contribution |`,
    `|--------|-------|--------|--------------|`,
    `| Context Completeness | ${(confidenceScore.factors.contextCompleteness * 100).toFixed(0)}% | ${(CONFIDENCE_WEIGHTS.contextCompleteness * 100).toFixed(0)}% | ${(confidenceScore.factors.contextCompleteness * CONFIDENCE_WEIGHTS.contextCompleteness * 100).toFixed(0)}% |`,
    `| Similar Task History | ${(confidenceScore.factors.similarTaskHistory * 100).toFixed(0)}% | ${(CONFIDENCE_WEIGHTS.similarTaskHistory * 100).toFixed(0)}% | ${(confidenceScore.factors.similarTaskHistory * CONFIDENCE_WEIGHTS.similarTaskHistory * 100).toFixed(0)}% |`,
    `| Specification Clarity | ${(confidenceScore.factors.specificationClarity * 100).toFixed(0)}% | ${(CONFIDENCE_WEIGHTS.specificationClarity * 100).toFixed(0)}% | ${(confidenceScore.factors.specificationClarity * CONFIDENCE_WEIGHTS.specificationClarity * 100).toFixed(0)}% |`,
    "",
    "## Thresholds",
    "",
    `- Auto-create: >= ${(CONFIDENCE_THRESHOLDS.autoCreate * 100).toFixed(0)}%`,
    `- Review required: ${(CONFIDENCE_THRESHOLDS.reviewRequired * 100).toFixed(0)}% - ${(CONFIDENCE_THRESHOLDS.autoCreate * 100).toFixed(0)}%`,
    `- Do not create: < ${(CONFIDENCE_THRESHOLDS.reviewRequired * 100).toFixed(0)}%`,
  ];

  return lines.join("\n");
}
