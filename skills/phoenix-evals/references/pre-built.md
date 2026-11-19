# Pre-built evaluators

Pre-built evaluators are LLM judges with tested prompts for common failures. Import
them from `phoenix.evals.metrics` in Python (`<Name>Evaluator`, constructed with
`llm=`) and from `@arizeai/phoenix-evals` in TypeScript (`create<Name>Evaluator`,
constructed with `model:`). Use one only when its definition matches the failure you
care about, and check it against human labels like any other judge.

## LLM judges

Input names are snake_case in Python and camelCase in TypeScript. For example,
`available_tools` is `availableTools`, `tool_selection` is `toolSelection`,
`tool_call` is `toolCall`, `tool_result` is `toolResult`, and `user_message` is
`userMessage`. For `minimize` evaluators, 1.0 is the bad outcome.

| Evaluator | Inputs (Python names) | Labels (1.0 / 0.0) | Direction |
| --------- | --------------------- | ------------------ | --------- |
| Completeness | `conversation` | `complete` / `incomplete` | maximize |
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

`DocumentRelevanceEvaluator` (`createDocumentRelevanceEvaluator`) is deprecated. Use
RetrievalRelevance.

```python
from phoenix.evals import LLM
from phoenix.evals.metrics import FaithfulnessEvaluator

faithfulness = FaithfulnessEvaluator(llm=LLM(provider="openai", model="gpt-4o"))
scores = faithfulness.evaluate(
    {"input": "Where is Paris?", "output": "Paris is in France.", "context": "Paris is in France."}
)
```

```typescript
import { openai } from "@ai-sdk/openai";
import { createFaithfulnessEvaluator } from "@arizeai/phoenix-evals";

const faithfulness = createFaithfulnessEvaluator({ model: openai("gpt-4o") });
const result = await faithfulness.evaluate({
  input: "Where is Paris?",
  output: "Paris is in France.",
  context: "Paris is in France.",
});
```

The TypeScript factories also accept `name`, `choices`, `promptTemplate`,
`optimizationDirection`, and `inputMapping` overrides. Python pre-built evaluators
keep their own name and labels. When the user asked for a different annotation name
or label set, such as `pass` and `fail`, set `annotation_name` and map the labels
in the annotation dataframe before logging, or write a
`ClassificationEvaluator` with the name and choices they want.

## Code metrics

| Metric | Python (`phoenix.evals.metrics`) | TypeScript (`@arizeai/phoenix-evals/code`) |
| ------ | -------------------------------- | ------------------------------------------ |
| Exact string match, no normalization | `exact_match` (inputs `output`, `expected`) | none; write a `createEvaluator` |
| Regex match | `MatchesRegex(pattern=..., name=None)` | none; write a `createEvaluator` |
| Precision, recall, F-beta over a list of labels | `PrecisionRecallFScore(beta=1.0, average="macro", positive_label=None)` | `createPrecisionEvaluator`, `createRecallEvaluator`, `createF1Evaluator`, `createFBetaEvaluator`, `createPrecisionRecallFScoreEvaluators` |

The precision and recall metrics take the whole sequence of expected and predicted
labels at once, not one row.

```python
from phoenix.evals.metrics import MatchesRegex, exact_match

iso_date = MatchesRegex(pattern=r"\d{4}-\d{2}-\d{2}", name="iso_date")
print(exact_match.evaluate({"output": "Paris", "expected": "Paris"})[0].score)  # 1.0
print(iso_date.evaluate({"output": "Due 2026-11-18"})[0].score)  # 1.0
```

## Notes on specific evaluators

- **Faithfulness versus hallucination.** Both check whether a response is
  supported by a source of truth. They differ in what that source is.
  Faithfulness judges against a separately supplied `context`, such as
  retrieved documents, so use it for RAG. Hallucination judges against the
  conversation itself. Its `input` holds the full history the assistant saw,
  including tool calls and results, and it has no `context` field. Use it for
  multi-turn agents and chat.
- **Completeness scores finished work across the whole conversation.** The
  judge lists every request the user made in any turn and marks each one
  `fulfilled`, `withdrawn`, or `unfulfilled`. It labels the conversation
  `incomplete` if any request that wasn't withdrawn is unfulfilled, so pass the
  full history in `conversation`, not only the final turn. Fulfilled means the
  deliverable is visible in the record: an answer that covers every part asked
  for, an artifact with every required component, or an action whose success
  shows up in a tool result. A refusal, an "I don't know", a clarifying
  question, or a promise counts as unfulfilled. The judge doesn't check
  correctness, so a wrong answer that was delivered still counts as complete.
  For agent traces, include tool calls and results. Matching tool evidence
  overrides the assistant's claim, and without it the judge has to take the
  assistant's word. The `explanation` is an `INTENTIONS:` block with one line
  per request, giving its `state` and a `reason_code` of `pending`, `blocked`,
  `failed`, or `ignored`. Parse it to see which request was dropped and why.
- **PII detection screens the whole record.** Put everything in the single
  `conversation` field, including system instructions, tool calls and results,
  and retrieved documents, not only what the user saw. The judge's
  `explanation` is a structured `FINDINGS:` block, or `FINDINGS: none`, that
  you can parse for per-instance categories. The judge deliberately doesn't
  flag placeholders and redactions, such as `[REDACTED]`, `555-01xx` numbers,
  `example.com` addresses, or anything marked as a sample, so don't build test
  cases out of dummy identifiers.

## Retrieval relevance

`RetrievalRelevanceEvaluator` works with any retrieval source and scores the
retrieved information as a whole. If any meaningful part of it materially helps
address the request, the step is `relevant`. The labels are `relevant` (`1.0`)
and `irrelevant` (`0.0`), the direction is maximize, and each result carries an
`explanation` from the judge.

Pass one retrieved document as `context` for per-document evaluation. To judge
the whole retrieval step, join all returned items into one `context` value.

Two field conventions matter. Getting either one wrong changes what you measure
without raising an error:

- `input` should be the user's request, for example the trace root's
  `input.value`, not a reformulated tool argument or a generated SQL query.
- `context` should contain the retrieved information at the scope you want to
  judge: one document for per-document evaluation, or all returned items joined
  together for holistic step evaluation.

Relevance isn't correctness. Outdated or later-contradicted information still
scores `relevant` if it was about the right subject. A failed
retrieval (an error, a timeout, or "no results found") scores `irrelevant`.

```python
from phoenix.evals import LLM
from phoenix.evals.metrics import RetrievalRelevanceEvaluator

relevance_eval = RetrievalRelevanceEvaluator(llm=LLM(provider="openai", model="gpt-6-luna"))
scores = relevance_eval.evaluate({
    "input": "What is the capital of France?",
    "context": "Paris is the capital and largest city of France.",
})
print(scores[0].label)  # "relevant"
```

```typescript
import { createRetrievalRelevanceEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const evaluator = createRetrievalRelevanceEvaluator({ model: openai("gpt-6-luna") });
const result = await evaluator.evaluate({
  input: "What is the capital of France?",
  context: "Paris is the capital and largest city of France.",
});
console.log(result.label); // "relevant"
```

`RetrievalRelevanceEvaluator` takes `llm` and forwards any other keyword
arguments, such as `max_tokens`, to the LLM client. It requires a model that
supports tool calling or structured output. The TypeScript factory accepts optional `name`,
`choices`, `promptTemplate`, and `optimizationDirection` overrides on top of the
usual classification evaluator arguments.

