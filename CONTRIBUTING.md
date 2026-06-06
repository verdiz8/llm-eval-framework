# Contributing to llm-eval-framework

Thanks for your interest! This guide covers how to extend the framework — whether you're adding an evaluator, a provider, or a new eval spec.

## Architecture overview

```
┌─────────────────────────────────────────────────┐
│                   Eval Spec (JSON)                │
│  test cases + criteria + thresholds              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│              CLI (src/runner/cli.ts)              │
│  reads spec → calls LLM → evaluates → reports    │
└──────┬─────────────────────────────┬────────────┘
       │                             │
       ▼                             ▼
┌──────────────┐          ┌──────────────────────┐
│   Providers   │          │     Evaluators        │
│  anthropic.ts │          │   exact-match.ts      │
│  openai-*.ts  │          │   fuzzy-match.ts      │
│               │          │   hallucination-*.ts  │
│  (get actual  │          │   format-compliance.ts│
│   LLM output) │          │   semantic-*.ts       │
└──────────────┘          └──────────────────────┘
       │                             │
       ▼                             ▼
  LLM response               CriterionScore[]
       │                             │
       └──────────┬──────────────────┘
                  ▼
           TestResult { passed, scores }
                  │
                  ▼
            EvalReport (JSON)
```

## Adding a new evaluator

1. Create `src/evaluators/your-evaluator.ts`:

```typescript
import type { CriterionScore } from "../types.js";

export function yourEvaluator(
  actual: unknown,
  expected: unknown,
  sourceMaterial?: string,
  schema?: Record<string, unknown>
): CriterionScore {
  // Your evaluation logic here
  const score = /* 0-100 */;
  return {
    criterion: "yourEvaluator", // Must match the key in registry
    score,
    passed: score >= 60,
    reason: "Explanation of the score",
    details: { /* optional debug info */ },
  };
}
```

2. Register it in `src/evaluators/index.ts`:

```typescript
import { yourEvaluator } from "./your-evaluator.js";

const registry: Record<CriterionType, EvaluatorFn> = {
  // ... existing entries
  yourEvaluator,  // Add this line
};
```

3. Add the type to `src/types.ts`:

```typescript
export type CriterionType =
  | "exactMatch"
  | "fuzzyMatch"
  // ... existing
  | "yourEvaluator";  // Add this
```

4. Add unit tests in `tests/evaluators.test.ts`.

5. Add your evaluator to the CLI `list` command in `src/runner/cli.ts`.

**Design principles:**
- Deterministic — same input always gives same score
- Scores 0–100, with 60 as the default pass threshold
- Return a human-readable `reason` string
- Put debug info in `details`

## Adding a new LLM provider

1. Create `src/providers/your-provider.ts`:

```typescript
export async function callYourProvider(
  prompt: string,
  config: { apiKey: string; model: string; endpoint: string }
): Promise<unknown> {
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const data = await response.json();
  // Parse the response into the format evaluators expect
  return data.choices[0].message.content;
}
```

2. Wire it into `src/runner/cli.ts` in the `callRealLLM()` function by adding a new endpoint detection branch.

## Adding a new eval spec

Create a JSON file in `src/specs/`:

```json
{
  "name": "My Eval Suite",
  "model": "claude-sonnet-4-6",
  "endpoint": "https://api.anthropic.com/v1/messages",
  "apiKey": "$ANTHROPIC_API_KEY",
  "thresholds": {
    "overallPass": 80,
    "perCriterionPass": 60
  },
  "tests": [
    {
      "id": "unique-test-id",
      "description": "What this test validates",
      "input": "Prompt sent to the LLM",
      "expected": { "key": "value" },
      "criteria": ["formatCompliance", "fuzzyMatch"],
      "expectedSchema": { "key": "string" },
      "sourceMaterial": "Optional source for hallucination checks"
    }
  ]
}
```

Run it with:

```bash
npm run eval run ./src/specs/my-eval-suite.json
```

## Project philosophy

See [DECISIONS.md](./DECISIONS.md) for the full architecture decision log. The key principles:

1. **Multi-criterion scoring** — not binary pass/fail
2. **Deterministic evaluators** — no LLM-as-judge circularity
3. **JSON spec format** — non-engineers can add tests
4. **Mock by default** — validates eval logic without API costs
5. **5 evaluators, not 20** — pattern is clear and extensible

## Quick checks before submitting

```bash
npm test        # All tests pass
npm run build   # TypeScript compiles
npm run eval run ./src/specs/question-bank-extraction.json  # Eval suite runs
```
