# LLM-Based Evaluators

Use an LLM to judge outputs when criteria are subjective or require reasoning.

## LLM Wrapper

The `LLM` class is provider-agnostic:

```python
from phoenix.evals.llm import LLM
# Also available: from phoenix.evals import LLM

# Anthropic
llm = LLM(provider="anthropic", model="claude-sonnet-4-20250514")

# OpenAI
llm = LLM(provider="openai", model="gpt-4o")

# Google
llm = LLM(provider="google", model="gemini-pro")
```

### DO NOT use legacy model classes

```python
# WRONG — these are legacy 1.0 classes
from phoenix.evals import OpenAIModel, AnthropicModel
model = OpenAIModel(model="gpt-4")      # OUTDATED
model = AnthropicModel(model="claude-3") # OUTDATED

# RIGHT — use the unified LLM wrapper
from phoenix.evals.llm import LLM
llm = LLM(provider="openai", model="gpt-4o")
```

## create_classifier (Recommended)

Factory function that returns a `ClassificationEvaluator`:

```python
from phoenix.evals import create_classifier
from phoenix.evals.llm import LLM

llm = LLM(provider="anthropic", model="claude-sonnet-4-20250514")

relevance = create_classifier(
    name="relevance",
    prompt_template="""Is this response relevant to the question?

<question>{input}</question>
<response>{output}</response>

Answer (relevant/irrelevant):""",
    llm=llm,
    choices={"relevant": 1.0, "irrelevant": 0.0},
)
```

### Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `name` | `str` | Evaluator name (used in result columns) |
| `prompt_template` | `str` | Template with `{input}`, `{output}`, etc. |
| `llm` | `LLM` | LLM instance to use for classification |
| `choices` | `dict` | Maps label strings to numeric scores |
| `direction` | `str` | `"maximize"` (default) or `"minimize"` |

### Choices Format

```python
# Labels → scores
choices = {"relevant": 1.0, "irrelevant": 0.0}

# Labels → (score, description) for more context
choices = {
    "relevant": (1.0, "Directly addresses the question"),
    "irrelevant": (0.0, "Does not address the question"),
}

# Labels only (no numeric scores)
choices = ["relevant", "irrelevant"]
```

### Template Variables

Both `{input}` (Python format) and `{{input}}` (Jinja) work in templates.
Variable names must match column names in the DataFrame.

Common variables:

| Variable | Typical column |
| -------- | -------------- |
| `{input}` | User query |
| `{output}` | AI response |
| `{context}` | Retrieved context/documents |
| `{reference}` | Reference/expected answer |

## ClassificationEvaluator (Direct)

Same as `create_classifier` but using the class directly:

```python
from phoenix.evals import ClassificationEvaluator, LLM

evaluator = ClassificationEvaluator(
    name="tone",
    llm=LLM(provider="openai", model="gpt-4o"),
    prompt_template="Is the tone professional?\n<text>{output}</text>\nAnswer (professional/casual):",
    choices={"professional": 1.0, "casual": 0.0},
    include_explanation=True,  # Default True — LLM explains its choice
)
```

## Pre-Built Evaluators

```python
from phoenix.evals.metrics import FaithfulnessEvaluator, DocumentRelevanceEvaluator
from phoenix.evals.llm import LLM

llm = LLM(provider="openai", model="gpt-4o")

# Checks if output is faithful to provided context
faithfulness = FaithfulnessEvaluator(llm=llm)
# Expects columns: input, output, context

# Checks if retrieved documents are relevant to query
doc_relevance = DocumentRelevanceEvaluator(llm=llm)
# Expects columns: input, output
```

**Note**: `HallucinationEvaluator` is DEPRECATED. Use `FaithfulnessEvaluator` instead.

## Best Practices

1. **Be specific in templates** — Define exactly what each label means
2. **Use XML tags** — `<question>`, `<response>`, `<context>` for clarity
3. **Binary labels** — Pass/fail is more reliable than Likert scales (1-5)
4. **Code first** — Use `@create_evaluator(kind="code")` for anything deterministic; reserve LLM for subjective judgments
