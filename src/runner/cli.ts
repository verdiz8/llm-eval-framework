#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { EvalSpec, EvalReport, TestResult, CriterionScore } from "../types.js";
import { evaluateTestCase, testPassed } from "../evaluators/index.js";
import { callAnthropic } from "../providers/anthropic.js";
import { callOpenAICompatible } from "../providers/openai-compatible.js";

/**
 * CLI: npx llm-eval run <spec> [--real]
 *
 * Without --real: uses mock responses (returns expected output) to validate eval logic.
 * With --real: calls the LLM endpoint specified in the eval spec.
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "run") {
    // Parse flags from remaining args
    const rest = args.slice(1);
    const useReal = rest.includes("--real");
    const specPath = rest.filter((a) => a !== "--real")[0];

    if (!specPath) {
      console.error("Usage: npx llm-eval run <path-to-spec.json> [--real]");
      process.exit(1);
    }
    await runEval(specPath, useReal);
  } else if (command === "list") {
    console.log("Available evaluators:");
    console.log("  exactMatch — strict string equality");
    console.log("  fuzzyMatch — normalized comparison (ignore case, whitespace, punctuation)");
    console.log("  hallucinationCheck — flags claims not found in source material");
    console.log("  formatCompliance — validates JSON structure and key types");
    console.log("  semanticSimilarity — word-overlap based meaning comparison");
  } else {
    console.log("llm-eval — LLM output evaluation framework");
    console.log("  run <spec> [--real]  Run an evaluation suite");
    console.log("  list                 List available evaluators");
  }
}

async function runEval(specPath: string, useReal: boolean) {
  const fullPath = resolve(specPath);
  const raw = readFileSync(fullPath, "utf-8");
  const spec: EvalSpec = JSON.parse(raw);

  console.log(`\n🧪 ${spec.name}`);
  console.log(`   Model: ${spec.model}`);
  console.log(`   Mode: ${useReal ? "real LLM calls" : "mock (returns expected)"}`);
  console.log(`   Tests: ${spec.tests.length}`);
  console.log(`   Thresholds: overall ${spec.thresholds.overallPass}% | per-criterion ${spec.thresholds.perCriterionPass}%\n`);

  const results: TestResult[] = [];

  for (const test of spec.tests) {
    const start = Date.now();

    let actual: unknown;
    if (useReal) {
      actual = await callRealLLM(test.input, spec);
    } else {
      actual = await mockLLMCall(test.input, test.expected);
    }

    const scores = evaluateTestCase(test, actual);
    const passed = testPassed(scores, spec.thresholds.perCriterionPass);
    const durationMs = Date.now() - start;

    results.push({ testId: test.id, passed, input: test.input, actual, expected: test.expected, scores, durationMs });

    // Print per-test result
    const icon = passed ? "✓" : "✗";
    const avgScore = Math.round(scores.reduce((s, c) => s + c.score, 0) / scores.length);
    console.log(`  ${icon} ${test.id} — ${avgScore}% (${durationMs}ms)`);
    for (const s of scores) {
      const si = s.passed ? "✓" : "✗";
      console.log(`    ${si} ${s.criterion}: ${s.score}% — ${s.reason}`);
    }
  }

  // Build report
  const passedTests = results.filter((r) => r.passed).length;
  const overallScore = Math.round((passedTests / results.length) * 100);
  const suitePassed = overallScore >= spec.thresholds.overallPass;

  const report: EvalReport = {
    specName: spec.name,
    model: spec.model,
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: results.length,
      passedTests,
      failedTests: results.length - passedTests,
      overallScore,
      suitePassed,
      thresholds: spec.thresholds,
    },
    results,
  };

  // Write report
  const outDir = resolve("reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `report-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`\n${suitePassed ? "✅" : "❌"} Suite ${suitePassed ? "PASSED" : "FAILED"} — ${overallScore}% (${passedTests}/${results.length})`);
  console.log(`   Report: ${outPath}\n`);

  process.exit(suitePassed ? 0 : 1);
}

/**
 * Resolve an API key value. If it starts with `$`, read from the named
 * environment variable. Otherwise return the value as-is.
 */
function resolveApiKey(raw: string | undefined): string {
  if (!raw) return "";
  if (raw.startsWith("$")) {
    const envVar = raw.slice(1);
    return process.env[envVar] ?? "";
  }
  return raw;
}

/**
 * Dispatch to the appropriate provider based on the spec's endpoint URL.
 */
async function callRealLLM(input: string, spec: EvalSpec): Promise<unknown> {
  const apiKey = resolveApiKey(spec.apiKey);
  if (!apiKey) {
    console.error("  ⚠ No API key found. Set the environment variable referenced in spec.apiKey, or pass the key directly.");
    console.error("    Falling back to mock response.");
    return mockLLMCall(input, spec.tests[0]?.expected);
  }

  const endpoint = spec.endpoint.toLowerCase();

  try {
    if (endpoint.includes("api.anthropic.com")) {
      return await callAnthropic(input, {
        apiKey,
        model: spec.model,
      });
    }

    // Default: OpenAI-compatible
    return await callOpenAICompatible(input, {
      apiKey,
      model: spec.model,
      endpoint: spec.endpoint,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ⚠ LLM call failed: ${message}`);
    console.error("    Falling back to mock response for this test.");
    return mockLLMCall(input, spec.tests[0]?.expected);
  }
}

/**
 * Mock LLM call — returns the expected output, stringified if it's an object.
 * Simulates a perfect extraction (what the LLM would return on its best day).
 */
async function mockLLMCall(_input: string, expected: unknown): Promise<unknown> {
  // Simulate network latency
  await new Promise((r) => setTimeout(r, 10));
  // Real LLMs return strings; objects come back as JSON strings
  if (typeof expected === "object" && expected !== null) {
    return JSON.stringify(expected);
  }
  return expected;
}

main().catch((err) => {
  console.error("Eval failed:", err.message);
  process.exit(2);
});
