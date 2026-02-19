# Common Mistakes (Python)

Patterns that LLMs frequently generate incorrectly from training data.

## Quick Migrations (Simple Renames)

| Wrong | Right | Reason |
| ----- | ----- | ------ |
| `OpenAIModel(model=...)` | `LLM(provider="openai", model=...)` | Legacy 1.0 wrapper; use provider-agnostic `LLM` |
| `AnthropicModel(...)` | `LLM(provider="anthropic", model=...)` | Same as above |
| `HallucinationEvaluator(model)` | `FaithfulnessEvaluator(llm=LLM(...))` | Renamed; uses "faithful"/"unfaithful" labels |
| `project_name=` | `project_identifier=` | `project_identifier` also accepts IDs |

## run_evals → evaluate_dataframe

```python
# WRONG — legacy 1.0, returns list of DataFrames
from phoenix.evals import run_evals
results = run_evals(dataframe=df, evaluators=[eval1], provide_explanation=True)

# RIGHT — current 2.0, returns single DataFrame with {name}_score columns
from phoenix.evals import evaluate_dataframe
results_df = evaluate_dataframe(dataframe=df, evaluators=[eval1])
```

## Wrong Result Column Names

```python
# WRONG — columns don't exist or contain dicts
score = results_df["relevance"].mean()
score = results_df["relevance_score"].mean()  # dict, not number

# RIGHT — extract numeric score from the Score dict
scores = results_df["relevance_score"].apply(
    lambda x: x.get("score", 0.0) if isinstance(x, dict) else 0.0
)
```

`evaluate_dataframe` returns `{name}_score` columns containing `{"score": 1.0, "label": "...", "explanation": "..."}` dicts.

## Wrong Client Constructor

```python
# WRONG
client = Client(endpoint="https://app.phoenix.arize.com")  # no such param
client = Client(url="https://app.phoenix.arize.com")       # no such param

# RIGHT
client = Client(base_url="https://app.phoenix.arize.com", api_key="...")  # remote
client = Client()  # local (uses env vars or localhost:6006)
```

## Too-Aggressive Time Filters

```python
# WRONG — often returns zero spans
df = client.spans.get_spans_dataframe(
    project_identifier="my-project",
    start_time=datetime.now() - timedelta(hours=1),
)

# RIGHT — use limit instead
df = client.spans.get_spans_dataframe(project_identifier="my-project", limit=50)
```

## Not Filtering Spans Appropriately

```python
# For end-to-end evaluation
df = client.spans.get_spans_dataframe(project_identifier="my-project", root_spans_only=True)

# For RAG evaluation — need retriever + LLM spans separately
all_spans = client.spans.get_spans_dataframe(project_identifier="my-project")
retriever_spans = all_spans[all_spans["span_kind"] == "RETRIEVER"]
llm_spans = all_spans[all_spans["span_kind"] == "LLM"]
```

## Assuming Span Output is Plain Text

LangChain and similar frameworks often output structured JSON from root spans. Parse it:

```python
import json

def extract_answer(value):
    if not isinstance(value, str):
        return str(value) if value is not None else ""
    try:
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            for key in ("answer", "result", "output", "response"):
                if key in parsed:
                    return str(parsed[key])
    except (json.JSONDecodeError, TypeError):
        pass
    return value

df["output"] = df["attributes.output.value"].apply(extract_answer)
```

## @create_evaluator for LLM Evaluation

```python
# WRONG — @create_evaluator wraps a Python function; setting kind="llm" doesn't call an LLM
@create_evaluator(name="relevance", kind="llm")
def relevance(input: str, output: str) -> str:
    pass

# RIGHT — ClassificationEvaluator handles the LLM call and output parsing
from phoenix.evals import ClassificationEvaluator, LLM
relevance = ClassificationEvaluator(
    name="relevance",
    prompt_template="Is this relevant?\n{{input}}\n{{output}}\nAnswer:",
    llm=LLM(provider="openai", model="gpt-4o"),
    choices={"relevant": 1.0, "irrelevant": 0.0},
)
```

## llm_classify → ClassificationEvaluator

```python
# WRONG — legacy 1.0
from phoenix.evals import llm_classify
results = llm_classify(dataframe=df, template=tmpl, model=model, rails=["relevant", "irrelevant"])

# RIGHT — current 2.0
from phoenix.evals import ClassificationEvaluator, async_evaluate_dataframe, LLM
classifier = ClassificationEvaluator(
    name="relevance", prompt_template=tmpl,
    llm=LLM(provider="openai", model="gpt-4o"),
    choices={"relevant": 1.0, "irrelevant": 0.0},
)
results_df = await async_evaluate_dataframe(dataframe=df, evaluators=[classifier])
```
