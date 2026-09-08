# Evaluators: Pre-Built

Use for exploration only. Validate before production.

Pre-built evaluators are importable from `phoenix.evals.metrics` (Python) and
`@arizeai/phoenix-evals` (TypeScript). Naming follows `<Name>Evaluator` in
Python and `create<Name>Evaluator` in TypeScript.

## The Evaluators

LLM-judged evaluators, with their required input fields, labels, and score
direction. Input field names are snake_case in Python and camelCase in
TypeScript. For `minimize` evaluators a high score is the bad outcome.

| Evaluator | Inputs (Python names) | Labels (1.0 / 0.0) | Direction |
| --------- | --------------------- | ------------------ | --------- |
| Conciseness | `input`, `output` | `concise` / `verbose` | maximize |
| Correctness | `input`, `output` | `correct` / `incorrect` | maximize |
| Faithfulness | `input`, `output`, `context` | `faithful` / `unfaithful` | maximize |
| Hallucination | `input`, `output` | `hallucinated` / `grounded` | minimize |
| PiiDetection | `conversation` | `pii_detected` / `no_pii_detected` | minimize |
| Refusal | `input`, `output` | `refused` / `answered` | neutral |
| RetrievalRelevance | `input`, `context` | `relevant` / `irrelevant` | maximize |
| ToolInvocation | `input`, `available_tools`, `tool_selection` | `correct` / `incorrect` | maximize |
| ToolResponseHandling | `input`, `tool_call`, `tool_result`, `output` | `correct` / `incorrect` | maximize |
| ToolSelection | `input`, `available_tools`, `tool_selection` | `correct` / `incorrect` | maximize |
| Toxicity | `text` | `toxic` / `non-toxic` | minimize |
| UserFriction | `conversation`, `user_message` | `friction` / `no_friction` | minimize |

Code-based evaluators ship alongside the LLM judges: `exact_match`,
`MatchesRegex`, and `PrecisionRecallFScore` in Python; the TypeScript
equivalents live in `@arizeai/phoenix-evals/code` — see
[evaluators-code-typescript.md](evaluators-code-typescript.md).

## Python

```python
from phoenix.evals import LLM
from phoenix.evals.metrics import FaithfulnessEvaluator

llm = LLM(provider="openai", model="gpt-4o")
faithfulness_eval = FaithfulnessEvaluator(llm=llm)
```

## TypeScript

```typescript
import { createFaithfulnessEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const faithfulnessEval = createFaithfulnessEvaluator({ model: openai("gpt-4o") });
```

## Notes on Specific Evaluators

- **Faithfulness vs. hallucination.** Both check whether a response is
  supported by a source of truth; they differ in what that source is.
  Faithfulness judges against a separately supplied `context` (retrieved
  documents — use it for RAG). Hallucination judges against the conversation
  itself: `input` holds the full history the assistant saw, including tool
  calls and results, and there is no `context` field — use it for multi-turn
  agents and chat.
- **PII detection screens the whole record.** The single `conversation` field
  should include everything — system instructions, tool calls and results,
  retrieved documents — not just what the user saw. The judge's `explanation`
  is a structured `FINDINGS:` block (or `FINDINGS: none`) you can parse for
  per-instance categories. Placeholders and redactions (`[REDACTED]`,
  `555-01xx` numbers, `example.com` addresses, anything marked as a sample)
  are deliberately not flagged, so don't build test cases out of dummy
  identifiers.

## Retrieval relevance

`RetrievalRelevanceEvaluator` is source-agnostic and scores the retrieved
information *as a whole*: if any meaningful part of it materially helps address
the request, the step is `relevant`. Labels are `relevant` / `irrelevant`, the
score is **maximized** (`relevant` is `1.0`, `irrelevant` is `0.0`), and each
result carries an `explanation` from the judge.

Pass one retrieved document as `context` for per-document evaluation. To judge
the whole retrieval step, join all returned items into one `context` value.

Two field conventions matter, and getting them wrong quietly changes what you
measured:

- `input` should be the **user's request** — e.g. the trace root's
  `input.value` — not a reformulated tool argument or a generated SQL query.
- `context` should contain the retrieved information at the scope you want to
  judge: one document for per-document evaluation, or all returned items joined
  together for holistic step evaluation.

Relevance is not correctness: outdated or later-contradicted information still
scores `relevant` if it was genuinely about the right subject. A failed
retrieval — an error, a timeout, or "no results found" — scores `irrelevant`.

```python
from phoenix.evals import LLM
from phoenix.evals.metrics import RetrievalRelevanceEvaluator

relevance_eval = RetrievalRelevanceEvaluator(llm=LLM(provider="openai", model="gpt-4o-mini"))
scores = relevance_eval.evaluate({
    "input": "What is the capital of France?",
    "context": "Paris is the capital and largest city of France.",
})
print(scores[0].label)  # "relevant"
```

```typescript
import { createRetrievalRelevanceEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const evaluator = createRetrievalRelevanceEvaluator({ model: openai("gpt-4o-mini") });
const result = await evaluator.evaluate({
  input: "What is the capital of France?",
  context: "Paris is the capital and largest city of France.",
});
console.log(result.label); // "relevant"
```

`RetrievalRelevanceEvaluator` takes `llm` plus arbitrary `**kwargs` forwarded to
the LLM client (e.g. `temperature=0.0`), and requires a model that supports tool
calling or structured output. The TypeScript factory accepts optional `name`,
`choices`, `promptTemplate`, and `optimizationDirection` overrides on top of the
usual classification evaluator arguments.

## When to Use

| Situation | Recommendation |
| --------- | -------------- |
| Exploration | Find traces to review |
| Find outliers | Sort by scores |
| Production | Validate first (>80% human agreement) |
| Domain-specific | Build custom |

## Exploration Pattern

```python
from phoenix.evals import evaluate_dataframe

results_df = evaluate_dataframe(dataframe=traces, evaluators=[faithfulness_eval])

# Score columns contain dicts — extract numeric scores
scores = results_df["faithfulness_score"].apply(
    lambda x: x.get("score", 0.0) if isinstance(x, dict) else 0.0
)
low_scores = results_df[scores < 0.5]   # Review these
high_scores = results_df[scores > 0.9]  # Also sample
```

## Validation Required

```python
from sklearn.metrics import classification_report

print(classification_report(human_labels, evaluator_results["label"]))
# Target: >80% agreement
```
