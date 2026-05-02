# Evaluators: LLM Evaluators in Python

LLM evaluators use a language model to judge outputs. Use when criteria are subjective.

## Quick Start

```python
from phoenix.evals import ClassificationEvaluator, LLM

llm = LLM(provider="openai", model="gpt-4o")

HELPFULNESS_TEMPLATE = """Rate how helpful the response is.

<question>{{input}}</question>
<response>{{output}}</response>

"helpful" means directly addresses the question.
"not_helpful" means does not address the question.

Your answer (helpful/not_helpful):"""

helpfulness = ClassificationEvaluator(
    name="helpfulness",
    prompt_template=HELPFULNESS_TEMPLATE,
    llm=llm,
    choices={"not_helpful": 0, "helpful": 1}
)
```

## Template Variables

Use XML tags to wrap variables for clarity:

| Variable | XML Tag |
| -------- | ------- |
| `{{input}}` | `<question>{{input}}</question>` |
| `{{output}}` | `<response>{{output}}</response>` |
| `{{reference}}` | `<reference>{{reference}}</reference>` |
| `{{context}}` | `<context>{{context}}</context>` |

## create_classifier (Factory)

Shorthand factory that returns a `ClassificationEvaluator`. Prefer direct
`ClassificationEvaluator` instantiation for more parameters/customization:

```python
from phoenix.evals import create_classifier, LLM

relevance = create_classifier(
    name="relevance",
    prompt_template="""Is this response relevant to the question?
<question>{{input}}</question>
<response>{{output}}</response>
Answer (relevant/irrelevant):""",
    llm=LLM(provider="openai", model="gpt-4o"),
    choices={"relevant": 1.0, "irrelevant": 0.0},
)
```

## PairwiseEvaluator

Use `PairwiseEvaluator` to compare exactly two outputs. Prompt templates must use
`{{item_1}}` and `{{item_2}}` for the randomized positions, and must not reference
the group names directly.

```python
from phoenix.evals import LLM, PairwiseEvaluator

pairwise = PairwiseEvaluator(
    name="helpfulness_pairwise",
    llm=LLM(provider="openai", model="gpt-4o"),
    prompt_template="""Compare responses for helpfulness.
<question>{{input}}</question>
<response-a>{{item_1}}</response-a>
<response-b>{{item_2}}</response-b>
Choose A, B, or tie.""",
    groups=("candidate", "baseline"),
    ordering="random",  # "random" | "both" | "fixed"
)

score = pairwise.evaluate({
    "input": "How do I reset my password?",
    "candidate": "Go to settings, then account, then reset password.",
    "baseline": "Use settings.",
})[0]
```

`ordering="both"` runs the judge twice with swapped positions and returns a tie
when the two passes disagree. `Score.metadata` records `presented_first`,
per-pass judge choices, rationales, and tie reason.

## Input Mapping

Column names must match template variables. Rename columns or use `bind_evaluator`:

```python
# Option 1: Rename columns to match template variables
df = df.rename(columns={"user_query": "input", "ai_response": "output"})

# Option 2: Use bind_evaluator
from phoenix.evals import bind_evaluator

bound = bind_evaluator(
    evaluator=helpfulness,
    input_mapping={"input": "user_query", "output": "ai_response"},
)
```

## Running

```python
from phoenix.evals import evaluate_dataframe

results_df = evaluate_dataframe(dataframe=df, evaluators=[helpfulness])
```

## Best Practices

1. **Be specific** - Define exactly what pass/fail means
2. **Include examples** - Show concrete cases for each label
3. **Explanations by default** - `ClassificationEvaluator` includes explanations automatically
4. **Study built-in prompts** - See
   `phoenix.evals.__generated__.classification_evaluator_configs` for examples
   of well-structured evaluation prompts (Faithfulness, Correctness, DocumentRelevance, etc.)
