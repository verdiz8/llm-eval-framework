import type { CriterionScore } from "../types.js";

/**
 * Flags claims in the model output that can't be found in the source material.
 * Uses keyword overlap as a lightweight proxy for a full NLI model.
 *
 * In a production system this would use an NLI model (e.g. DeBERTa) or a
 * second LLM pass. This implementation demonstrates the pattern with a
 * fast, deterministic baseline.
 */
export function hallucinationCheck(
  actual: unknown,
  _expected: unknown,
  sourceMaterial?: string
): CriterionScore {
  // Normalize: if actual is an object, JSON-stringify it for claim extraction
  const rawOutput =
    actual === null || actual === undefined ? "" :
    typeof actual === "object" ? JSON.stringify(actual) :
    String(actual);
  const output = rawOutput.toLowerCase();
  const source = (sourceMaterial ?? "").toLowerCase();

  if (!source) {
    return {
      criterion: "hallucinationCheck",
      score: 100,
      passed: true,
      reason: "No source material provided — skipped",
    };
  }

  // Extract potential claims (sentences or bullet points)
  const claims = output
    .split(/[.\n•·-]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (claims.length === 0) {
    return {
      criterion: "hallucinationCheck",
      score: 100,
      passed: true,
      reason: "No extractable claims to check",
    };
  }

  interface FlaggedClaim {
    claim: string;
    confidence: number;
  }

  const flagged: FlaggedClaim[] = [];

  for (const claim of claims) {
    // Check if key terms from the claim appear in the source
    const keywords = claim
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .filter((w) => !isStopWord(w));
    const found = keywords.filter((w) => wordOverlaps(w, source));
    const coverage = keywords.length > 0 ? found.length / keywords.length : 0;

    if (coverage < 0.4) {
      flagged.push({
        claim: claim.slice(0, 120),
        confidence: Math.round(coverage * 100),
      });
    }
  }

  const hallucinationRate = flagged.length / claims.length;
  const score = Math.round((1 - hallucinationRate) * 100);

  return {
    criterion: "hallucinationCheck",
    score,
    passed: hallucinationRate < 0.3,
    reason:
      flagged.length === 0
        ? "All claims verified in source"
        : `${flagged.length}/${claims.length} claims not found in source material`,
    details: { totalClaims: claims.length, flagged, hallucinationRate },
  };
}

const STOP_WORDS = new Set([
  "this", "that", "with", "from", "have", "been", "were", "they", "their", "will",
  "about", "which", "there", "would", "could", "should", "each", "than", "then",
]);

function isStopWord(w: string): boolean {
  return STOP_WORDS.has(w);
}

/**
 * Check if a keyword appears in the source text using word-level fuzzy matching.
 * Handles basic variations like "use"/"uses" by checking if either
 * word contains the other.
 */
function wordOverlaps(keyword: string, source: string): boolean {
  // Direct substring match
  if (source.includes(keyword)) return true;

  // Word-level check with basic stemming
  const sourceWords = source.split(/\s+/);
  // Use 4-char stem for words >= 5 chars (compute/computing), 3-char for shorter
  const stemLen = keyword.length >= 5 ? 4 : 3;
  return sourceWords.some((sw) => {
    // Source word contains keyword (e.g., "computing" contains "compute")
    if (sw.includes(keyword)) return true;
    // Stem comparison: first N chars match
    if (sw.length >= stemLen && keyword.length >= stemLen && sw.slice(0, stemLen) === keyword.slice(0, stemLen)) return true;
    return false;
  });
}
