# Replace legacy Python evals code

`arize-phoenix-evals` 3.0 removed the 1.x API. Code that imports any of these fails
with an `ImportError`, and no compatibility module exists:

| Removed | Use |
| ------- | --- |
| `OpenAIModel`, `AnthropicModel`, `GeminiModel`, other `*Model` classes | `LLM(provider=..., model=...)` |
| `llm_classify(dataframe, template, model, rails)` | `ClassificationEvaluator` plus `evaluate_dataframe` |
| `run_evals(dataframe, evaluators)` | `evaluate_dataframe(dataframe=..., evaluators=[...])` |
| `HallucinationEvaluator(model)`, `QAEvaluator(model)`, `RelevanceEvaluator(model)` | the evaluators in `phoenix.evals.metrics`, constructed with `llm=` |
| `PromptTemplate`, `*_PROMPT_TEMPLATE`, `*_PROMPT_RAILS_MAP` constants | your own template string, or a pre-built evaluator |
| `px.Client().get_spans_dataframe()` | `phoenix.client.Client().spans.get_spans_dataframe(project_identifier=...)` |
| `px.Client().log_evaluations(SpanEvaluations(...))` | `client.spans.log_span_annotations_dataframe(dataframe=...)` |

## `llm_classify` to `ClassificationEvaluator`

```python
from phoenix.evals import LLM, ClassificationEvaluator, evaluate_dataframe

# Legacy code passed template=RELEVANCE_TEMPLATE, rails=["relevant", "unrelated"],
# and read the "label" column from the result.
relevance = ClassificationEvaluator(
    name="relevance",
    llm=LLM(provider="openai", model="gpt-4o"),
    prompt_template=RELEVANCE_TEMPLATE,   # {query} placeholders become {{query}}
    choices={"relevant": 1.0, "unrelated": 0.0},
)
results_df = evaluate_dataframe(dataframe=df, evaluators=[relevance])
labels = results_df["relevance_score"].apply(lambda s: s.get("label"))
```

What changes when you port:

- **Template variables.** Legacy templates used `{name}`. The current library uses
  Mustache `{{name}}`. Convert every placeholder, or the variable is sent literally.
- **Rails become choices with scores.** Give each label the score it means, so `1.0`
  is the good outcome. Add `direction="minimize"` if 1.0 is the bad outcome.
- **No `provide_explanation`.** Explanations are on by default
  (`include_explanation=True`).
- **Result shape.** `llm_classify` returned `label` and `explanation` columns.
  `evaluate_dataframe` returns the input dataframe plus a `{name}_score` dict column
  and a `{name}_execution_details` column. Update every reader of the old columns.
- **Logging.** `SpanEvaluations` is gone. Convert results with
  `to_annotation_dataframe` and log them with `client.spans.log_span_annotations_dataframe`.
  See [score-traces-python](score-traces-python.md).

After porting, rerun the eval on data where you know the old results and compare
the label counts. A large change usually means a template variable didn't convert or
a label's score is inverted.
