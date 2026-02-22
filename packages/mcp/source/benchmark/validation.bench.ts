import { describe, bench } from 'vitest';
import { 
  calculateConfidenceScore, 
  generateConfidenceReport
} from '../validation/index.js';

describe('Validation Benchmark', () => {
  bench('calculateConfidenceScore - full calculation', () => {
    calculateConfidenceScore({
      contextCompleteness: 0.8,
      similarTaskHistory: 0.7,
      specificationClarity: 0.9
    });
  });

  bench('generateConfidenceReport - report generation', () => {
    const confidenceScore = calculateConfidenceScore({
      contextCompleteness: 0.8,
      similarTaskHistory: 0.7,
      specificationClarity: 0.9
    });
    generateConfidenceReport(confidenceScore);
  });

  bench('calculateConfidenceScore - low score', () => {
    calculateConfidenceScore({
      contextCompleteness: 0.3,
      similarTaskHistory: 0.2,
      specificationClarity: 0.4
    });
  });

  bench('calculateConfidenceScore - perfect score', () => {
    calculateConfidenceScore({
      contextCompleteness: 1.0,
      similarTaskHistory: 1.0,
      specificationClarity: 1.0
    });
  });
});
