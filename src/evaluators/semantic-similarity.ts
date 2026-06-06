import type { CriterionScore } from "../types.js";

/**
 * Word-overlap based semantic similarity (Jaccard coefficient).
 * A lightweight, deterministic baseline. No API calls, no embeddings.
 *
 * In production, you'd swap this for cosine similarity on embeddings
 * (OpenAI text-embedding-3-small or a local model). The interface stays the same.
 */
export function semanticSimilarity(actual: unknown, expected: unknown): CriterionScore {
  const a = tokenize(toString(actual));
  const e = tokenize(toString(expected));

  if (a.size === 0 && e.size === 0) {
    return { criterion: "semanticSimilarity", score: 100, passed: true, reason: "Both empty" };
  }
  if (a.size === 0 || e.size === 0) {
    return { criterion: "semanticSimilarity", score: 0, passed: false, reason: "One side is empty" };
  }

  // Jaccard similarity
  let intersection = 0;
  for (const token of a) {
    if (e.has(token)) intersection++;
  }
  let union = 0;
  for (const token of a) union++;
  for (const token of e) {
    if (!a.has(token)) union++;
  }

  const score = Math.round((intersection / union) * 100);

  return {
    criterion: "semanticSimilarity",
    score,
    passed: score >= 50,
    reason:
      score >= 70
        ? "Strong semantic overlap"
        : score >= 50
          ? "Moderate overlap"
          : "Low semantic similarity",
    details: { intersection, union, jaccard: intersection / union },
  };
}

function toString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}
