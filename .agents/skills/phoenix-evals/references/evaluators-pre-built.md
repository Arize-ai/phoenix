# Evaluators: Pre-Built

Use for exploration only. Validate before production.

Pre-built evaluators are importable from `phoenix.evals.metrics` (Python) and
`@arizeai/phoenix-evals` (TypeScript). They cover RAG and retrieval quality
(faithfulness, correctness, document relevance, retrieval relevance),
conversation grounding (hallucination),
response quality (conciseness, refusal), safety (toxicity), conversation
signals (user friction), agent tool use (tool selection, invocation, response
handling), and code-based checks (regex match, exact match,
precision/recall/F-score). Naming follows `<Name>Evaluator` in Python and
`create<Name>Evaluator` in TypeScript — enumerate the module exports for the
full list.

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

Before using an evaluator, check its required input fields and score direction —
some score toward 1.0 for the *bad* outcome and are meant to be minimized
(e.g., toxicity, user friction). Input field names follow the runtime's
convention: snake_case in Python, camelCase in TypeScript.

Code-based evaluators (precision/recall/F-score) are also available in
TypeScript via `@arizeai/phoenix-evals/code` — see
[evaluators-code-typescript.md](evaluators-code-typescript.md).

## Grounding: faithfulness vs. hallucination

Two pre-built evaluators check whether a response is supported by its source of
truth. They differ in *what* the source of truth is, and picking the wrong one
scores against the wrong evidence:

| Evaluator | Source of truth | Reach for it when |
| --------- | --------------- | ----------------- |
| Faithfulness | A separately supplied context (e.g. retrieved documents) | RAG — you have the retrieved chunks and want claims checked against them |
| Hallucination | The conversation itself — prior turns, tool calls, tool results | Multi-turn agents and chat, where what the assistant was told *is* the history |

`HallucinationEvaluator` takes `input` (the full conversation the assistant had
access to; its last message is the turn being answered) and `output` (the reply
being judged). It accepts no `context` field. Labels are
`hallucinated` / `grounded`, and the score is **minimized** — `hallucinated` is
`1.0`, `grounded` is `0.0`.

```python
from phoenix.evals import LLM
from phoenix.evals.metrics import HallucinationEvaluator

hallucination_eval = HallucinationEvaluator(llm=LLM(provider="openai", model="gpt-4o-mini"))
scores = hallucination_eval.evaluate({
    "input": (
        "User: What's our refund window?\n"
        "Tool (lookup_policy): Refunds: 30 days from delivery.\n"
        "Assistant: 30 days from delivery.\n"
        "User: And for electronics?"
    ),
    "output": "Electronics can be returned within 90 days.",
})
print(scores[0].label)  # "hallucinated"
```

```typescript
import { createHallucinationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const evaluator = createHallucinationEvaluator({ model: openai("gpt-4o-mini") });
const result = await evaluator.evaluate({
  input:
    "User: What's our refund window?\nTool (lookup_policy): Refunds: 30 days from delivery.\nAssistant: 30 days from delivery.\nUser: And for electronics?",
  output: "Electronics can be returned within 90 days.",
});
console.log(result.label); // "hallucinated"
```

The TypeScript evaluator changed shape: it previously took a separate `context`
field and returned `factual` / `hallucinated`. Existing stored evaluations,
dashboards, thresholds, and label filters built on the old labels need migrating
— do not compare old and new scores directly.

## Retrieval quality: document relevance vs. retrieval relevance

Two pre-built evaluators judge whether retrieved material bears on the request.
They differ in *granularity* and in *what counts as a retrieval*:

| Evaluator | Unit judged | Input fields | Reach for it when |
| --------- | ----------- | ------------ | ----------------- |
| Document relevance | One document at a time | `input`, `document_text` (`documentText` in TS) | Classic RAG — you want a per-chunk label to compute precision@k / recall@k |
| Retrieval relevance | The whole retrieval step, holistically | `input`, `context` | Any retrieval step, source-agnostic — vector search, a tool or function call, an MCP server, a web search, or a database query |

`RetrievalRelevanceEvaluator` is source-agnostic and scores the retrieved
information *as a whole*: if any meaningful part of it materially helps address
the request, the step is `relevant`. Labels are `relevant` / `irrelevant`, the
score is **maximized** (`relevant` is `1.0`, `irrelevant` is `0.0`), and each
result carries an `explanation` from the judge.

Two field conventions matter, and getting them wrong quietly changes what you
measured:

- `input` should be the **user's request** — e.g. the trace root's
  `input.value` — not a reformulated tool argument or a generated SQL query.
- `context` should be the retrieved information for the step with **all
  returned items joined together**, not one item at a time.

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
