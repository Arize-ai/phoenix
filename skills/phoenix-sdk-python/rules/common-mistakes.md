# Common Mistakes

Patterns that LLMs frequently generate incorrectly from training data.

## 1. Legacy Model Classes

```python
# WRONG
from phoenix.evals import OpenAIModel, AnthropicModel
model = OpenAIModel(model="gpt-4")

# RIGHT
from phoenix.evals.llm import LLM
llm = LLM(provider="openai", model="gpt-4o")
```

**Why**: `OpenAIModel`, `AnthropicModel`, etc. are legacy 1.0 wrappers. The `LLM` class
is provider-agnostic and is the current API.

## 2. Using run_evals Instead of evaluate_dataframe

```python
# WRONG
from phoenix.evals import run_evals
results = run_evals(dataframe=df, evaluators=[eval1], provide_explanation=True)
# Returns list of DataFrames

# RIGHT
from phoenix.evals import evaluate_dataframe
results_df = evaluate_dataframe(dataframe=df, evaluators=[eval1])
# Returns single DataFrame with {name}_score dict columns
```

**Why**: `run_evals` is the legacy 1.0 batch function. `evaluate_dataframe` is the current
2.0 function with a different return format.

## 3. Wrong Result Column Names

```python
# WRONG — column doesn't exist
score = results_df["relevance"].mean()

# WRONG — column exists but contains dicts, not numbers
score = results_df["relevance_score"].mean()

# RIGHT — extract numeric score from dict
scores = results_df["relevance_score"].apply(lambda x: x.get("score", 0.0))
score = scores.mean()
```

**Why**: `evaluate_dataframe` returns columns named `{name}_score` containing Score dicts
like `{"name": "...", "score": 1.0, "label": "...", "explanation": "..."}`.

## 4. Deprecated project_name Parameter

```python
# WRONG
df = client.spans.get_spans_dataframe(project_name="my-project")

# RIGHT
df = client.spans.get_spans_dataframe(project_identifier="my-project")
```

**Why**: `project_name` is deprecated in favor of `project_identifier`.

## 5. Wrong Client Constructor

```python
# WRONG
client = Client(endpoint="https://app.phoenix.arize.com")
client = Client(url="https://app.phoenix.arize.com")

# RIGHT
client = Client(base_url="https://app.phoenix.arize.com/s/your-space", api_key="...")
```

**Why**: The parameter is `base_url`, not `endpoint` or `url`. Also, the base URL
must NOT include `/v1/traces` (that's the OTEL collector endpoint, not the API base).

## 6. Too-Aggressive Time Filters

```python
# WRONG — often returns zero spans
from datetime import datetime, timedelta
df = client.spans.get_spans_dataframe(
    project_identifier="my-project",
    start_time=datetime.now() - timedelta(hours=1),
)

# RIGHT — either omit time filter or use generous window
df = client.spans.get_spans_dataframe(
    project_identifier="my-project",
    limit=50,  # Use limit to control result size instead
)
```

**Why**: Traces may be from any time period. A 1-hour window frequently returns
nothing. Use `limit=` to control result size instead.

## 7. Not Using root_spans_only

```python
# WRONG — fetches all spans including internal LLM calls, retrievers, etc.
df = client.spans.get_spans_dataframe(project_identifier="my-project")
root_spans = df[df["parent_id"].isna()]  # Manual filtering wastes bandwidth

# RIGHT — let the API filter
df = client.spans.get_spans_dataframe(
    project_identifier="my-project",
    root_spans_only=True,
)
```

**Why**: For evaluation, you typically want root spans (the top-level operation with
user input and final output). Fetching all spans returns internal sub-operations
(LLM calls, retriever calls, etc.) that aren't useful for output evaluation.

## 8. Assuming Span Output is Plain Text

```python
# WRONG — output may be JSON, not plain text
df = df.rename(columns={"attributes.output.value": "output"})
# Then passing to evaluators that expect plain text...

# RIGHT — parse JSON and extract the answer field
import json

def extract_answer(output_value):
    if not isinstance(output_value, str):
        return str(output_value) if output_value is not None else ""
    try:
        parsed = json.loads(output_value)
        if isinstance(parsed, dict) and "answer" in parsed:
            return parsed["answer"]
    except (json.JSONDecodeError, TypeError):
        pass
    return output_value

df["attributes.output.value"] = df["attributes.output.value"].apply(extract_answer)
```

**Why**: LangChain and other frameworks often output structured JSON from root spans,
like `{"context": "...", "question": "...", "answer": "..."}`. Evaluators need
the actual answer text, not the raw JSON.

## 9. Using @create_evaluator for LLM-Based Evaluation

```python
# WRONG — @create_evaluator doesn't call an LLM
@create_evaluator(name="relevance", kind="llm")
def relevance(input: str, output: str) -> str:
    # This is just a regular function — no LLM is involved
    pass

# RIGHT — use create_classifier for LLM-based evaluation
relevance = create_classifier(
    name="relevance",
    prompt_template="Is this relevant?\n{input}\n{output}\nAnswer:",
    llm=LLM(provider="anthropic", model="claude-sonnet-4-20250514"),
    choices={"relevant": 1.0, "irrelevant": 0.0},
)
```

**Why**: `@create_evaluator` wraps a plain Python function. Setting `kind="llm"`
does NOT make it call an LLM. For LLM-based evaluation, use `create_classifier()`
or `ClassificationEvaluator`.

## 10. Using llm_classify Instead of create_classifier

```python
# WRONG — legacy 1.0 API
from phoenix.evals import llm_classify
results = llm_classify(
    dataframe=df,
    template=template_str,
    model=model,
    rails=["relevant", "irrelevant"],
)

# RIGHT — current 2.0 API
from phoenix.evals import create_classifier, evaluate_dataframe
from phoenix.evals.llm import LLM

classifier = create_classifier(
    name="relevance",
    prompt_template=template_str,
    llm=LLM(provider="anthropic", model="claude-sonnet-4-20250514"),
    choices={"relevant": 1.0, "irrelevant": 0.0},
)
results_df = evaluate_dataframe(dataframe=df, evaluators=[classifier])
```

**Why**: `llm_classify` is the legacy 1.0 function. The current pattern is to create
an evaluator with `create_classifier()` and run it with `evaluate_dataframe()`.

## 11. Using HallucinationEvaluator

```python
# WRONG — deprecated
from phoenix.evals import HallucinationEvaluator
eval = HallucinationEvaluator(model)

# RIGHT — use FaithfulnessEvaluator
from phoenix.evals.metrics import FaithfulnessEvaluator
from phoenix.evals.llm import LLM
eval = FaithfulnessEvaluator(llm=LLM(provider="openai", model="gpt-4o"))
```

**Why**: `HallucinationEvaluator` is deprecated. `FaithfulnessEvaluator` is its replacement.
