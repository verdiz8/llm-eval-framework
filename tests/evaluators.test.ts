import { exactMatch } from "../src/evaluators/exact-match.js";
import { fuzzyMatch } from "../src/evaluators/fuzzy-match.js";
import { hallucinationCheck } from "../src/evaluators/hallucination-check.js";
import { formatCompliance } from "../src/evaluators/format-compliance.js";
import { semanticSimilarity } from "../src/evaluators/semantic-similarity.js";
import { evaluateTestCase, testPassed } from "../src/evaluators/index.js";
import type { TestCase } from "../src/types.js";

describe("exactMatch", () => {
  it("scores 100 for identical strings", () => {
    const result = exactMatch("hello world", "hello world");
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it("scores 0 for different strings", () => {
    const result = exactMatch("hello", "world");
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });

  it("trims whitespace before comparison", () => {
    const result = exactMatch("  hello  ", "hello");
    expect(result.score).toBe(100);
  });
});

describe("fuzzyMatch", () => {
  it("tolerates case differences", () => {
    const result = fuzzyMatch("Hello World", "hello world");
    expect(result.score).toBe(100);
  });

  it("tolerates extra whitespace", () => {
    const result = fuzzyMatch("hello   world", "hello world");
    expect(result.score).toBe(100);
  });

  it("detects significant differences", () => {
    const result = fuzzyMatch("The cat sat on the mat", "The dog ran across the field");
    expect(result.score).toBeLessThan(70);
  });
});

describe("hallucinationCheck", () => {
  it("passes when all claims are in source", () => {
    const result = hallucinationCheck(
      "Binary uses only 0 and 1.",
      null,
      "Computers use binary which consists of 0 and 1 digits."
    );
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it("flags claims not in source", () => {
    const result = hallucinationCheck(
      "Quantum mechanics relies on wavefunction collapse. Entanglement allows faster-than-light communication.",
      null,
      "Classical computing uses bits for calculations."
    );
    expect(result.score).toBeLessThan(100);
    // Quantum claims should be flagged
    const details = result.details as any;
    expect(details.flagged.length).toBeGreaterThan(0);
  });

  it("skips when no source material provided", () => {
    const result = hallucinationCheck("Some output", null, undefined);
    expect(result.score).toBe(100);
    expect(result.reason).toContain("No source material");
  });
});

describe("formatCompliance", () => {
  it("validates JSON structure matches expected shape", () => {
    const actual = JSON.stringify({ question: "What is binary?", marks: 2, topic: "Data" });
    const schema = { question: "string", marks: 0, topic: "string" };
    const result = formatCompliance(actual, schema, undefined, schema);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it("flags missing keys", () => {
    const actual = JSON.stringify({ question: "What is binary?" });
    const schema = { question: "string", marks: 0, topic: "string" };
    const result = formatCompliance(actual, schema, undefined, schema);
    expect(result.score).toBeLessThan(100);
    expect(result.passed).toBe(false);
  });

  it("fails on invalid JSON", () => {
    const result = formatCompliance("not json", { key: "value" });
    expect(result.score).toBe(0);
    expect(result.reason).toContain("not valid JSON");
  });
});

describe("semanticSimilarity", () => {
  it("returns high score for semantically similar text", () => {
    const result = semanticSimilarity(
      "Binary uses zeros and ones for calculations",
      "Computers calculate using binary digits zero and one"
    );
    expect(result.score).toBeGreaterThan(0);
  });

  it("returns low score for unrelated text", () => {
    const result = semanticSimilarity(
      "Binary uses zeros and ones",
      "The weather is sunny today"
    );
    expect(result.score).toBe(0);
  });
});

describe("evaluateTestCase", () => {
  it("runs multiple criteria and returns scores", () => {
    const test: TestCase = {
      id: "test-1",
      input: "Extract the question",
      expected: { question: "What is binary?" },
      criteria: ["fuzzyMatch", "formatCompliance"],
      expectedSchema: { question: "string" },
    };

    const actual = JSON.stringify({ question: "What is binary?" });
    const scores = evaluateTestCase(test, actual);

    expect(scores.length).toBe(2);
    expect(scores.every((s) => s.criterion === "fuzzyMatch" || s.criterion === "formatCompliance")).toBe(true);
  });
});

describe("testPassed", () => {
  it("returns true when all criteria meet threshold", () => {
    const scores = [
      { criterion: "fuzzyMatch" as const, score: 90, passed: true, reason: "ok" },
      { criterion: "exactMatch" as const, score: 100, passed: true, reason: "ok" },
    ];
    expect(testPassed(scores, 60)).toBe(true);
  });

  it("returns false when any criterion falls below threshold", () => {
    const scores = [
      { criterion: "fuzzyMatch" as const, score: 90, passed: true, reason: "ok" },
      { criterion: "hallucinationCheck" as const, score: 30, passed: false, reason: "fail" },
    ];
    expect(testPassed(scores, 60)).toBe(false);
  });
});
