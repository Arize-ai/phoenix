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

## Decision Models

Any `ClassificationEvaluator`, including every built-in classification evaluator, also accepts a `DecisionModel` in place of `LLM`. A decision model such as OpenAI's `gpt-6-luna` or TypeSafe's Jev picks one of the labels directly instead of generating text, so it is a cheaper, faster judge for high-volume labeling. Extra keyword arguments such as `api_key` or `base_url` are forwarded to the provider's SDK client.

| Provider | Example | Install |
| -------- | ------- | ------- |
| `openai` (Decisions API) | `DecisionModel(provider="openai", model="gpt-6-luna")` | `pip install 'openai>=3.26.0'` |
| `typesafe` | `DecisionModel(provider="typesafe", model="jev-latest")` | `pip install typesafe-sdk` |

```python
from phoenix.evals import ClassificationEvaluator, DecisionModel

sentiment = ClassificationEvaluator(
    name="sentiment",
    llm=DecisionModel(provider="openai", model="gpt-6-luna"),
    prompt_template="Classify the sentiment: {{text}}",
    choices={"positive": 1, "neutral": 0.5, "negative": 0},
)
# Score(label="positive", score=1, explanation=None,
#       metadata={"model": "gpt-6-luna", "probabilities": {...}, "model_id": "...", "confidence": ...})
```

- **No explanation.** `explanation` is always `None`; `metadata["probabilities"]` maps each label to its probability, and `metadata["confidence"]` is set when the provider reports one.
- **Prompt shape.** Only text parts of the rendered template are sent. `openai` keeps message roles; `typesafe` flattens the messages into one plain-text state and drops roles.
- **Refusals raise.** When the OpenAI Decisions API refuses to answer, the call raises `PhoenixDecisionRefusal` (`from phoenix.evals.exceptions import PhoenixDecisionRefusal`).
- **Provider availability.** `from phoenix.evals.decision import show_decision_provider_availability` prints which providers are usable in the current environment.
- **Traced as DECISION spans.** Each call emits a DECISION span with `decision.*` attributes instead of an LLM span.
- **Not for calculations.** Decision models can't reason step by step; use an `LLM` for judgments that need arithmetic or unit conversion.

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
   of well-structured evaluation prompts (Faithfulness, Correctness, RetrievalRelevance, etc.)
