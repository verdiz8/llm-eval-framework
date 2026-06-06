import type { CriterionScore } from "../types.js";

/**
 * Validates that the output conforms to an expected JSON schema or structure.
 * Checks: valid JSON parse, required keys present, value types match.
 */
export function formatCompliance(
  actual: unknown,
  expected: unknown,
  _sourceMaterial?: string,
  schema?: Record<string, unknown>
): CriterionScore {
  // Use explicit schema if provided, otherwise fall back to expected object shape
  const shape = schema ?? (typeof expected === "object" && expected !== null ? expected : null);

  if (!shape || typeof shape !== "object") {
    return {
      criterion: "formatCompliance",
      score: 100,
      passed: true,
      reason: "No schema to validate against — skipped",
    };
  }

  // Try to parse if actual is a string (LLM often returns JSON as string)
  let parsed: unknown = actual;
  if (typeof actual === "string") {
    try {
      parsed = JSON.parse(actual);
    } catch {
      return {
        criterion: "formatCompliance",
        score: 0,
        passed: false,
        reason: "Output is not valid JSON",
        details: { actual: String(actual).slice(0, 200) },
      };
    }
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      criterion: "formatCompliance",
      score: 0,
      passed: false,
      reason: `Expected object, got ${Array.isArray(parsed) ? "array" : typeof parsed}`,
    };
  }

  interface KeyCheck {
    key: string;
    expectedType: string;
    present: boolean;
    typeMatch: boolean;
  }

  const TYPE_NAMES = new Set(["string", "number", "boolean", "array", "object"]);

  const checks: KeyCheck[] = Object.entries(shape).map(([key, val]) => {
    const present = key in (parsed as Record<string, unknown>);
    const actualVal = (parsed as Record<string, unknown>)[key];
    // Support both type-name strings ("number") and actual values (42)
    const expectedType = Array.isArray(val)
      ? "array"
      : typeof val === "string" && TYPE_NAMES.has(val)
        ? val
        : typeof val;
    // typeof [] is "object", so handle array specially
    const actualType = Array.isArray(actualVal) ? "array" : typeof actualVal;
    const typeMatch = present && actualType === expectedType;
    return { key, expectedType, present, typeMatch };
  });

  const missing = checks.filter((c) => !c.present);
  const typeErrors = checks.filter((c) => c.present && !c.typeMatch);
  const total = checks.length;
  const passed = total - missing.length - typeErrors.length;
  const score = Math.round((passed / total) * 100);

  const reasons: string[] = [];
  if (missing.length) reasons.push(`missing keys: [${missing.map((m) => m.key).join(", ")}]`);
  if (typeErrors.length) reasons.push(`type mismatches: [${typeErrors.map((t) => `${t.key} (expected ${t.expectedType})`).join(", ")}]`);

  return {
    criterion: "formatCompliance",
    score,
    passed: score >= 80,
    reason: reasons.length ? reasons.join("; ") : "All keys present with correct types",
    details: { totalKeys: total, missing: missing.map((m) => m.key), typeErrors: typeErrors.map((t) => t.key) },
  };
}
