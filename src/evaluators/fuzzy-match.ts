import type { CriterionScore } from "../types.js";

/**
 * Normalized comparison that tolerates whitespace, case, and minor formatting differences.
 * Score: Levenshtein similarity as percentage.
 */
export function fuzzyMatch(actual: unknown, expected: unknown): CriterionScore {
  const a = normalize(toString(actual));
  const e = normalize(toString(expected));

  if (!a && !e) {
    return { criterion: "fuzzyMatch", score: 100, passed: true, reason: "Both empty" };
  }
  if (!a || !e) {
    return { criterion: "fuzzyMatch", score: 0, passed: false, reason: "One side is empty" };
  }

  const distance = levenshtein(a, e);
  const maxLen = Math.max(a.length, e.length);
  const score = Math.round(((maxLen - distance) / maxLen) * 100);

  return {
    criterion: "fuzzyMatch",
    score,
    passed: score >= 60, // threshold controlled by suite config
    reason: score >= 80
      ? "Strong match"
      : score >= 60
        ? "Partial match"
        : "Significant differences",
    details: { similarity: score, maxLength: maxLen },
  };
}

function toString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
