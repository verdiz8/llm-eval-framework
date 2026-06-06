import type { CriterionScore } from "../types.js";

/**
 * Strict string equality. Best for structured outputs where format is deterministic.
 * Score: 100 if identical, 0 otherwise.
 */
export function exactMatch(actual: unknown, expected: unknown): CriterionScore {
  const a = toString(actual).trim();
  const e = toString(expected).trim();

  if (a === e) {
    return { criterion: "exactMatch", score: 100, passed: true, reason: "Exact match" };
  }

  // Show first difference for debugging
  const diffIdx = [...a].findIndex((c, i) => c !== e[i]);
  const snippet = diffIdx >= 0 ? `diverge at char ${diffIdx}: "${a.slice(Math.max(0, diffIdx - 5), diffIdx + 15)}" vs "${e.slice(Math.max(0, diffIdx - 5), diffIdx + 15)}"` : "different lengths";

  return {
    criterion: "exactMatch",
    score: 0,
    passed: false,
    reason: `Mismatch — ${snippet}`,
    details: { actual: a.slice(0, 200), expected: e.slice(0, 200) },
  };
}

function toString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
