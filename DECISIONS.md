# Decisions

Architecture choices behind the LLM eval framework.

---

## 1. Multi-criterion scoring, not pass/fail on exact match

**Options considered:**
- `assert actual === expected` like traditional tests
- Single overall score
- Multiple criteria scored independently

**Chosen: Multiple criteria scored independently.**

LLM outputs can be correct without being identical. A traditional assert fails when the model rewords something. Multi-criterion scoring means:
- exactMatch catches format deviations
- fuzzyMatch tolerates rewording
- hallucinationCheck catches made-up content
- formatCompliance validates structure
- semanticSimilarity checks meaning

Each test gets a scorecard, not a binary pass/fail.

---

## 2. Deterministic evaluators, not LLM-as-judge

**Options considered:**
- Use an LLM to evaluate another LLM's output
- Use deterministic algorithms

**Chosen: Deterministic algorithms (Levenshtein, Jaccard, keyword overlap).**

LLM-as-judge is circular — you're testing one LLM with another LLM that has its own biases and hallucinations. Deterministic evaluators are:
- Reproducible (same input → same score, always)
- Fast (no API calls to evaluate)
- Explainable (exact reason for every score)
- Free (no token costs)

The trade-off is that deterministic evaluators miss nuanced semantic errors. The README notes that semanticSimilarity can be swapped for embedding-based comparison in production — the interface stays the same.

---

## 3. JSON spec format, not code-based test definitions

**Options considered:**
- Test definitions as TypeScript/JavaScript files
- YAML config
- JSON config

**Chosen: JSON with a typed interface.**

Code-based tests require programming knowledge to add cases. JSON means:
- Non-engineers can add test cases
- Specs are portable across languages
- The schema is self-documenting
- TypeScript types provide IDE autocomplete for spec authors who want it

---

## 4. Mock LLM calls in CLI, real endpoint support via swap

**Options considered:**
- Always call real endpoints
- Mock-only
- Mock by default, easy swap to real

**Chosen: Mock by default.**

Real API calls cost money and are slow in CI. The mock returns expected output (simulating perfect extraction), which validates the evaluation logic itself. A comment marks exactly where to swap `mockLLMCall()` for `fetch()` — one function, 5 lines to change.

---

## 5. 5 evaluators, not 20

**Options considered:**
- Comprehensive evaluator library (BLEU, ROUGE, BERTScore, NLI, embedding cosine, etc.)
- 5 core evaluators

**Chosen: 5 core evaluators that cover the key quality dimensions.**

20 evaluators is a research project, not a portfolio demo. The 5 chosen evaluators cover:
- Accuracy (exactMatch, fuzzyMatch)
- Safety (hallucinationCheck)
- Structure (formatCompliance)
- Meaning (semanticSimilarity)

Each has a clear use case from the Question Bank pipeline. A recruiter can see the pattern and extrapolate.

---

## 6. Eval specs are version-controlled alongside code

**Options considered:**
- Specs in a separate repo
- Specs in the same repo

**Chosen: Same repo, `src/specs/` directory.**

Eval specs are tests — they should evolve with the pipeline they validate. Version-controlling them alongside the framework means every commit can answer: "Were the evals passing when this code shipped?"

---

## What I'd add in production

- Embedding-based semanticSimilarity (OpenAI text-embedding-3-small)
- LLM-as-judge for subjective criteria (tone, helpfulness) — only for dimensions deterministic evaluators can't catch
- Multi-model comparison runner (same spec against Claude vs GPT vs Gemini, side-by-side scores)
- Historical eval dashboard (score trends over time)
- CI integration that fails the build if eval scores regress
