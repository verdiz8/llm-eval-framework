import type { CriterionType, CriterionScore, TestCase } from "../types.js";
import { exactMatch } from "./exact-match.js";
import { fuzzyMatch } from "./fuzzy-match.js";
import { hallucinationCheck } from "./hallucination-check.js";
import { formatCompliance } from "./format-compliance.js";
import { semanticSimilarity } from "./semantic-similarity.js";

export type EvaluatorFn = (
  actual: unknown,
  expected: unknown,
  sourceMaterial?: string,
  schema?: Record<string, unknown>
) => CriterionScore;

const registry: Record<CriterionType, EvaluatorFn> = {
  exactMatch,
  fuzzyMatch,
  hallucinationCheck,
  formatCompliance,
  semanticSimilarity,
};

/**
 * Score a single test case against actual model output.
 * Runs all specified criteria and returns scored results.
 */
export function evaluateTestCase(
  test: TestCase,
  actual: unknown
): CriterionScore[] {
  return test.criteria.map((criterion) => {
    const fn = registry[criterion];
    if (!fn) {
      return {
        criterion,
        score: 0,
        passed: false,
        reason: `Unknown criterion: ${criterion}`,
      };
    }
    return fn(actual, test.expected, test.sourceMaterial, test.expectedSchema);
  });
}

/**
 * Check if all criteria scores pass the configured threshold.
 */
export function testPassed(
  scores: CriterionScore[],
  perCriterionPass: number
): boolean {
  return scores.every((s) => s.score >= perCriterionPass);
}

export { exactMatch, fuzzyMatch, hallucinationCheck, formatCompliance, semanticSimilarity };
