/** Core types for the LLM evaluation framework */

export type CriterionType =
  | "exactMatch"
  | "fuzzyMatch"
  | "hallucinationCheck"
  | "formatCompliance"
  | "semanticSimilarity";

export interface TestCase {
  /** Unique test identifier */
  id: string;
  /** Description of what this test validates */
  description?: string;
  /** Prompt or input sent to the LLM */
  input: string;
  /** Expected output shape/content */
  expected: unknown;
  /** Which evaluators to run on this test */
  criteria: CriterionType[];
  /** Optional: source material for hallucination checks */
  sourceMaterial?: string;
  /** Optional: JSON Schema for format compliance checks */
  expectedSchema?: Record<string, unknown>;
  /** Optional: additional metadata */
  metadata?: Record<string, unknown>;
}

export interface EvalSpec {
  /** Suite name */
  name: string;
  /** Optional description */
  description?: string;
  /** Model identifier (for reporting) */
  model: string;
  /** API endpoint */
  endpoint: string;
  /** API key (reads from env var if prefixed with $) */
  apiKey?: string;
  /** Individual test cases */
  tests: TestCase[];
  /** Pass/fail thresholds */
  thresholds: {
    /** Overall percentage required to pass the suite */
    overallPass: number;
    /** Per-criterion minimum score */
    perCriterionPass: number;
  };
}

export interface CriterionScore {
  criterion: CriterionType;
  score: number;        // 0–100
  passed: boolean;
  reason: string;
  details?: unknown;    // mismatch info, extracted claims, etc.
}

export interface TestResult {
  testId: string;
  passed: boolean;
  input: string;
  actual: unknown;
  expected: unknown;
  scores: CriterionScore[];
  durationMs: number;
}

export interface EvalReport {
  specName: string;
  model: string;
  timestamp: string;
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    overallScore: number;
    suitePassed: boolean;
    thresholds: EvalSpec["thresholds"];
  };
  results: TestResult[];
}
