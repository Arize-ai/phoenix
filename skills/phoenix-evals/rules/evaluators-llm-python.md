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

## Input Mapping

Map data columns to template variables:

```python
results = run_evals(
    dataframe=df,
    evaluators=[evaluator],
    input_mapping={"input": "user_query", "output": "ai_response", "context": "docs"}
)
```

## Best Practices

1. **Be specific** - Define exactly what pass/fail means
2. **Include examples** - Show concrete cases for each label
3. **Use chain of thought** - Better accuracy with `<thinking>` sections
4. **Get explanations** - `provide_explanation=True` for debugging

## Running

```python
from phoenix.evals import run_evals

results_df = run_evals(dataframe=df, evaluators=[helpfulness], provide_explanation=True)
```

**Library Reference:** [Phoenix Evals Python](https://arize-phoenix.readthedocs.io/projects/evals/en/latest/)
