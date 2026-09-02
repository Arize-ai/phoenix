# Evaluators: Pre-Built

Use for exploration only. Validate before production.

Pre-built evaluators are importable from `phoenix.evals.metrics` (Python) and
`@arizeai/phoenix-evals` (TypeScript). They cover RAG quality (faithfulness,
correctness, document relevance), conversation grounding (hallucination),
response quality (conciseness, refusal), safety (toxicity), privacy
(PII detection), conversation signals (user friction), agent tool use (tool
selection, invocation, response handling), and code-based checks (regex match,
exact match,
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

## Privacy: PII detection

`PiiDetectionEvaluator` / `createPiiDetectionEvaluator` screens a whole
conversation record for personally identifiable information. It differs from the
other pre-built evaluators in three ways that change how you wire it up:

- **One input field, and it is the whole record.** Python takes
  `conversation` (snake_case); TypeScript takes `conversation` as well. There is
  no `input`/`output` split — you concatenate the turns yourself.
- **Everything is in scope, not just what the user saw.** System instructions,
  tool calls and their results, and retrieved documents are all screened. That is
  the point: PII that leaks into a retrieved chunk never reaches the end user but
  is still exposure.
- **Direction is `minimize`.** Labels are `pii_detected` (score `1.0`) and
  `no_pii_detected` (score `0.0`), so a *high* score is the bad outcome — the
  same polarity as toxicity and user friction, the opposite of faithfulness.

The judge's `explanation` is a structured `FINDINGS:` block listing each instance
as `- type: <category> | source: <user_message|assistant_response|tool_call_or_result|system_instructions|retrieved_document>`,
or exactly `FINDINGS: none`. Parse it when you need per-instance categories
rather than a single pass/fail.

```python
from phoenix.evals import LLM
from phoenix.evals.metrics import PiiDetectionEvaluator

pii_eval = PiiDetectionEvaluator(llm=LLM(provider="openai", model="gpt-4o-mini"))
scores = pii_eval.evaluate({
    "conversation": (
        "User: Reset my account.\n"
        "Assistant: I can help. What email is on the account?\n"
        "User: jane.doe@acme.com"
    ),
})
print(scores[0].label)  # "pii_detected"
```

```typescript
import { createPiiDetectionEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const evaluator = createPiiDetectionEvaluator({ model: openai("gpt-4o-mini") });
const result = await evaluator.evaluate({
  conversation:
    "User: Reset my account.\nAssistant: What email is on the account?\nUser: jane.doe@acme.com",
});
console.log(result.label); // "pii_detected"
```

Placeholders and redactions are deliberately *not* flagged: conventional fill-ins
(`jane.doe`-style names on `example.com`, `123-45-6789`, `555-01xx`), anything the
surrounding text marks as a sample or template, and fully-replaced tokens like
`[REDACTED]` all score `no_pii_detected`. Don't build a regression suite whose
"positive" cases are dummy identifiers — they will come back clean by design.

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
