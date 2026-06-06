# CLAUDE.md — llm-eval-framework

LLM output evaluation framework. Define eval specs in JSON, run against any OpenAI-compatible endpoint, get scored pass/fail results. Built for the SDET portfolio at [verdigris.site](https://verdigris.site) / [github.com/verdiz8](https://github.com/verdiz8).

## What this proves

- QA thinking applied to AI: replace "assert actual === expected" with multi-dimensional scoring
- Test architecture for non-deterministic systems
- Production use case: validates the Question Bank LLM extraction pipeline
- 5 deterministic evaluators (no LLM-as-judge circularity)
- CI-ready with pass/fail exit codes

## Commands

```bash
npm install
npm test                     # Jest unit tests for all evaluators
npm run eval run ./src/specs/question-bank-extraction.json  # Run an eval suite
```

## Structure

```
src/
  types.ts                    ← EvalSpec, TestCase, TestResult, CriterionScore, EvalReport
  evaluators/
    index.ts                  ← evaluateTestCase(), testPassed(), registry
    exact-match.ts            ← Strict string equality
    fuzzy-match.ts            ← Levenshtein similarity (case/whitespace/punctuation tolerant)
    hallucination-check.ts    ← Flags claims not in source material (keyword-overlap baseline)
    format-compliance.ts      ← JSON structure validation (keys, types)
    semantic-similarity.ts    ← Jaccard word-overlap similarity
  runner/
    cli.ts                    ← `npx llm-eval run <spec>` — reads spec, runs evals, writes report
  specs/
    question-bank-extraction.json  ← Real eval suite for the QBank LLM pipeline
tests/
  evaluators.test.ts          ← Jest tests covering all 5 evaluators + integration
DECISIONS.md                  ← Architecture decision log
```

## Architecture decisions (see DECISIONS.md for full rationale)

1. **Multi-criterion scoring** — each test gets a scorecard, not binary pass/fail. LLM outputs can be correct without being identical.
2. **Deterministic evaluators** — no LLM-as-judge circularity. Levenshtein, Jaccard, keyword overlap. Reproducible, fast, free, explainable.
3. **JSON spec format** — non-engineers can add tests. Portable. Self-documenting.
4. **Mock by default** — `mockLLMCall()` returns expected output to validate eval logic. Swap to `fetch()` in one function for real endpoints.
5. **5 evaluators, not 20** — covers accuracy, safety, structure, meaning. Pattern is clear, extensible.

## Where to extend

- Swap semanticSimilarity for embedding-based cosine similarity
- Add real LLM endpoint calls (replace mockLLMCall in cli.ts)
- Multi-model comparison runner (same spec → Claude vs GPT vs Gemini)
- Historical score dashboard
- CI regression check (fail build if scores drop)

## Quick orientation

| File | Purpose |
|---|---|
| `src/types.ts` | All type definitions — start here to understand the data model |
| `src/evaluators/index.ts` | Orchestrator — `evaluateTestCase()` runs all criteria |
| `src/evaluators/hallucination-check.ts` | The most interesting evaluator — keyword-overlap baseline for detecting made-up content |
| `src/specs/question-bank-extraction.json` | Real eval spec — 4 test cases from the Cambridge CS past paper pipeline |
| `src/runner/cli.ts` | CLI entry point — reads spec, runs tests, writes JSON report, exits 0/1 |
| `tests/evaluators.test.ts` | Jest unit tests for all evaluators + integration |
