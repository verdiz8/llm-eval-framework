# LLM Eval Framework

[![Tests](https://github.com/verdiz8/llm-eval-framework/actions/workflows/ci.yml/badge.svg)](https://github.com/verdiz8/llm-eval-framework/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

A test framework for **non-deterministic AI outputs**. Define evaluation specs in JSON, run against any OpenAI-compatible LLM endpoint, and get multi-dimensional scored results — not just pass/fail.

Built to validate the [Question Bank LLM extraction pipeline](https://verdigris.site) that powers automated past-paper question generation. The same engine that ensures AI-extracted questions are correct before they enter the bank.

---

## Why this exists

LLMs are non-deterministic. Traditional testing — `assert actual === expected` — fails because an LLM output can be **correct** without being **identical**. This framework replaces exact-match thinking with multi-dimensional scoring that reflects how humans actually judge AI output quality.

**What this proves for QA engineering:**
- QA thinking applied to AI systems — replace binary assertions with scored dimensions
- Test architecture for non-deterministic targets
- 5 deterministic evaluators (no "LLM judging LLM" circularity)
- CI-ready with pass/fail exit codes and structured JSON reports

---

## Prerequisites

- **Node.js** 18 or later ([download](https://nodejs.org))
- **npm** (comes with Node.js)
- A terminal (PowerShell, bash, zsh — any will work)

No API keys needed to run the demo — the framework uses mock LLM responses by default.

---

## Quick start

```bash
# Clone and enter the project
git clone https://github.com/verdiz8/llm-eval-framework.git
cd llm-eval-framework

# Install dependencies
npm install

# Verify everything works
npm test

# Run the demo eval suite (mock LLM — no API key needed)
npm run eval run ./src/specs/question-bank-extraction.json
```

You should see output like:

```
🧪 Question Bank — LLM Extraction Quality
   Model: claude-sonnet-4-6
   Tests: 4
   Thresholds: overall 80% | per-criterion 60%

  ✓ qb-basic-extraction — 100% (12ms)
    ✓ fuzzyMatch: 100% — Strings are sufficiently similar
    ✓ formatCompliance: 100% — All expected keys present with correct types
  ✓ qb-code-block — 100% (1ms)
    ...
  ✅ Suite PASSED — 100% (4/4)
```

---

## Project structure

```
llm-eval-framework/
├── src/
│   ├── types.ts                  ← EvalSpec, TestCase, CriterionScore, EvalReport
│   ├── evaluators/
│   │   ├── index.ts              ← evaluateTestCase(), testPassed(), registry
│   │   ├── exact-match.ts        ← Strict string equality
│   │   ├── fuzzy-match.ts        ← Levenshtein similarity (case/whitespace tolerant)
│   │   ├── hallucination-check.ts← Flags claims not in source material
│   │   ├── format-compliance.ts  ← JSON structure validation (keys, types)
│   │   └── semantic-similarity.ts← Jaccard word-overlap similarity
│   ├── runner/
│   │   └── cli.ts                ← CLI entry point — reads spec, runs evals, writes report
│   ├── providers/
│   │   ├── anthropic.ts          ← Anthropic Messages API provider
│   │   └── openai-compatible.ts  ← OpenAI-compatible /v1/chat/completions provider
│   └── specs/
│       ├── question-bank-extraction.json  ← Real eval suite: QBank pipeline
│       └── sentiment-analysis.json        ← Demo: sentiment classification
├── tests/
│   └── evaluators.test.ts        ← Jest unit tests for all evaluators
├── reports/                      ← Generated eval reports (gitignored)
├── DECISIONS.md                  ← Architecture decision log
├── CONTRIBUTING.md               ← How to extend the framework
└── README.md                     ← You are here
```

---

## Evaluators

Each evaluator scores 0–100. Combine them in any eval spec to build a multi-dimensional quality check.

| Evaluator | What it checks | Algorithm | Example |
|---|---|---|---|
| **exactMatch** | String equality after trim | Direct comparison | `"hello"` vs `"hello"` → 100% |
| **fuzzyMatch** | Similarity ignoring case, whitespace, punctuation | Levenshtein distance | `"Hello, World!"` vs `"hello world"` → 100% |
| **hallucinationCheck** | Output claims are supported by source material | Keyword overlap baseline | Output says "quantum computing" but source only mentions "binary" → flagged |
| **formatCompliance** | JSON structure matches expected keys and types | Schema validation | Response missing `marks` key → deducted |
| **semanticSimilarity** | Meaning overlap without exact wording | Jaccard word-overlap | `"Binary uses 0 and 1"` vs `"Computers use binary digits"` → high score |

**When to use which:**

```
Structured extraction (JSON output)?  → exactMatch + formatCompliance
Free-text generation?                 → fuzzyMatch + semanticSimilarity
RAG / summarization?                  → hallucinationCheck + semanticSimilarity
API endpoint testing?                 → formatCompliance + exactMatch
Chatbot evaluation?                   → fuzzyMatch + hallucinationCheck + semanticSimilarity
```

---

## Creating your own eval spec

Eval specs are JSON files. No code changes needed to add tests. Here's how to build one from scratch.

### Step 1: Define the spec skeleton

```json
{
  "name": "My First Eval Suite",
  "description": "What this suite validates",
  "model": "claude-sonnet-4-6",
  "endpoint": "https://api.anthropic.com/v1/messages",
  "apiKey": "$ANTHROPIC_API_KEY",
  "thresholds": {
    "overallPass": 80,
    "perCriterionPass": 60
  },
  "tests": []
}
```

| Field | Purpose |
|---|---|
| `name` | Human-readable suite name (shown in CLI output) |
| `model` | Model identifier for reporting |
| `endpoint` | API endpoint (used with `--real` flag) |
| `apiKey` | API key — prefix with `$` to read from an environment variable |
| `thresholds.overallPass` | % of tests that must pass for the suite to pass |
| `thresholds.perCriterionPass` | Minimum score each individual criterion needs |

### Step 2: Add a test case

```json
{
  "id": "greeting-sentiment",
  "description": "LLM correctly identifies positive sentiment",
  "input": "Classify the sentiment of: 'I absolutely loved this product, best purchase ever!'",
  "expected": {
    "sentiment": "positive",
    "confidence": 0.95
  },
  "criteria": ["formatCompliance", "semanticSimilarity"],
  "expectedSchema": {
    "sentiment": "string",
    "confidence": "number"
  }
}
```

| Field | Purpose |
|---|---|
| `id` | Unique identifier for this test (used in reports) |
| `description` | What this test validates |
| `input` | The prompt sent to the LLM |
| `expected` | The expected output shape/content |
| `criteria` | Which evaluators to run |
| `expectedSchema` | (For `formatCompliance`) The expected JSON shape |
| `sourceMaterial` | (For `hallucinationCheck`) The ground-truth source text |

### Step 3: Add a hallucination-check test

```json
{
  "id": "no-fabricated-facts",
  "description": "LLM doesn't invent details not in the source",
  "input": "Summarize the following: 'The Apollo 11 mission landed on the Moon on July 20, 1969.'",
  "expected": "Apollo 11 landed on the Moon on July 20, 1969.",
  "criteria": ["hallucinationCheck", "fuzzyMatch"],
  "sourceMaterial": "The Apollo 11 mission landed on the Moon on July 20, 1969."
}
```

### Step 4: Run it

```bash
npm run eval run ./src/specs/my-first-eval.json
```

---

## Connecting real LLMs

By default, the CLI uses mock responses — it returns `test.expected` as if the LLM extracted perfectly. This validates your **evaluation logic** without API costs.

### Option A: Use the `--real` flag (recommended)

```bash
# Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Run with real LLM calls
npm run eval run ./src/specs/question-bank-extraction.json -- --real
```

The `--real` flag reads `spec.endpoint` and `spec.apiKey` (resolving `$ENV_VAR` references) and calls the actual LLM. The provider is auto-detected from the endpoint URL:

| Endpoint contains | Provider used |
|---|---|
| `api.anthropic.com` | Anthropic Messages API |
| `openai.com` or any `/v1` path | OpenAI-compatible chat completions |

### Option B: Swap the mock manually

In `src/runner/cli.ts`, the `mockLLMCall()` function has a comment marking exactly where to swap. For a custom integration, replace it with your own `fetch()` call. The evaluators don't care where `actual` comes from — they just score it.

---

## CI integration

The framework exits with code `0` (pass) or `1` (fail), so it works as a drop-in CI step:

```yaml
# .github/workflows/ci.yml
- run: npm ci
- run: npm run build
- run: npm run eval run ./src/specs/question-bank-extraction.json
- uses: actions/upload-artifact@v4
  with:
    name: eval-reports
    path: reports/
```

Reports are written to `reports/report-<timestamp>.json` in this format:

```json
{
  "specName": "Question Bank — LLM Extraction Quality",
  "model": "claude-sonnet-4-6",
  "timestamp": "2026-06-06T12:00:00.000Z",
  "summary": {
    "totalTests": 4,
    "passedTests": 4,
    "failedTests": 0,
    "overallScore": 100,
    "suitePassed": true,
    "thresholds": { "overallPass": 80, "perCriterionPass": 60 }
  },
  "results": [
    {
      "testId": "qb-basic-extraction",
      "passed": true,
      "input": "1. State two reasons why...",
      "actual": { "question": "...", "marks": 2, "topic": "Data Representation", "difficulty": "easy" },
      "expected": { "question": "...", "marks": 2, "topic": "Data Representation", "difficulty": "easy" },
      "scores": [
        { "criterion": "fuzzyMatch", "score": 100, "passed": true, "reason": "Strings are sufficiently similar" },
        { "criterion": "formatCompliance", "score": 100, "passed": true, "reason": "All expected keys present with correct types" }
      ],
      "durationMs": 12
    }
  ]
}
```

---

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm test` | Run Jest unit tests for all evaluators |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run eval run <spec>` | Run an eval suite (mock LLM by default) |
| `npm run eval run <spec> -- --real` | Run with real LLM calls |
| `npm run eval list` | List available evaluators |

---

## Architecture decisions

See [DECISIONS.md](./DECISIONS.md) for the full decision log. Highlights:

1. **Multi-criterion scoring** — each test gets a scorecard, not binary pass/fail
2. **Deterministic evaluators** — Levenshtein, Jaccard, keyword overlap. Reproducible, fast, free, explainable
3. **JSON spec format** — non-engineers can add tests. Portable. Self-documenting
4. **Mock by default** — validates eval logic without API costs. One flag swaps to real endpoints
5. **5 evaluators, not 20** — covers accuracy, safety, structure, meaning. Pattern is clear and extensible

---

## Where to extend

- Swap `semanticSimilarity` for embedding-based cosine similarity (OpenAI `text-embedding-3-small`)
- Add LLM-as-judge for subjective criteria (tone, helpfulness) — only for dimensions deterministic evaluators can't catch
- Build a multi-model comparison runner (same spec → Claude vs GPT vs Gemini, side-by-side scores)
- Add a historical score dashboard (track eval scores over time)
- Add CI regression check (fail the build if scores drop below last run)

See [CONTRIBUTING.md](./CONTRIBUTING.md) for step-by-step extension guides.

---

## License

MIT — see [LICENSE](./LICENSE) for details.
