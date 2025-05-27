---
description: How to use Pydantic Evals with Phoenix to evaluate AI applications using structured evaluation frameworks
---

# Pydantic Evals

[Pydantic Evals](https://github.com/pydantic/pydantic-evals) is an evaluation library that provides preset direct evaluations and LLM Judge evaluations. It can be used to run evaluations over dataframes of cases defined with Pydantic models. This guide shows you how to use Pydantic Evals alongside Arize Phoenix to run evaluations on traces captured from your running application.

## Launch Phoenix

{% tabs %}
{% tab title="Phoenix Cloud" %}
**Sign up for Phoenix:**

Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Set your Phoenix endpoint and API Key:**

```python
import os

# Add Phoenix API Key for tracing
PHOENIX_API_KEY = "ADD YOUR API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"
```

Your **Phoenix API key** can be found on the Keys section of your [dashboard](https://app.phoenix.arize.com).
{% endtab %}

{% tab title="Command Line" %}
**Launch your local Phoenix instance:**

```bash
pip install arize-phoenix
phoenix serve
```

For details on customizing a local terminal deployment, see [Terminal Setup](https://docs.arize.com/phoenix/setup/environments#terminal).

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Set your Phoenix endpoint:**

```python
import os

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "http://localhost:6006"
```

See Terminal for more details
{% endtab %}

{% tab title="Docker" %}
**Pull latest Phoenix image from** [**Docker Hub**](https://hub.docker.com/r/arizephoenix/phoenix)**:**

```bash
docker pull arizephoenix/phoenix:latest
```

**Run your containerized instance:**

```bash
docker run -p 6006:6006 arizephoenix/phoenix:latest
```

This will expose the Phoenix on `localhost:6006`

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Set your Phoenix endpoint:**

```python
import os

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "http://localhost:6006"
```

For more info on using Phoenix with Docker, see [Docker](https://docs.arize.com/phoenix/self-hosting/deployment-options/docker).
{% endtab %}

{% tab title="Notebook" %}
**Install packages:**

```bash
pip install arize-phoenix
```

**Launch Phoenix:**

```python
import phoenix as px
px.launch_app()
```

{% hint style="info" %}
By default, notebook instances do not have persistent storage, so your traces will disappear after the notebook is closed. See [self-hosting](https://docs.arize.com/phoenix/self-hosting) or use one of the other deployment options to retain traces.
{% endhint %}
{% endtab %}
{% endtabs %}

## Install

```bash
pip install pydantic-evals arize-phoenix openai openinference-instrumentation-openai
```

## Setup

Enable Phoenix tracing to capture traces from your application:

```python
from phoenix.otel import register

tracer_provider = register(
    project_name="pydantic-evals-tutorial",
    auto_instrument=True,  # Automatically instrument OpenAI calls
)
```

## Basic Usage

### 1. Generate Traces to Evaluate

First, create some example traces by running your AI application. Here's a simple example:

```python
from openai import OpenAI
import os

client = OpenAI()

inputs = [
    "What is the capital of France?",
    "Who wrote Romeo and Juliet?", 
    "What is the largest planet in our solar system?",
]

def generate_trace(input):
    client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are a helpful assistant. Only respond with the answer to the question as a single word or proper noun.",
            },
            {"role": "user", "content": input},
        ],
    )

for input in inputs:
    generate_trace(input)
```

### 2. Export Traces from Phoenix

Export the traces you want to evaluate:

```python
import phoenix as px
from phoenix.trace.dsl import SpanQuery

query = SpanQuery().select(
    input="llm.input_messages",
    output="llm.output_messages",
)

# Query spans from Phoenix
spans = px.Client().query_spans(query, project_name="pydantic-evals-tutorial")
spans["input"] = spans["input"].apply(lambda x: x[1].get("message").get("content"))
spans["output"] = spans["output"].apply(lambda x: x[0].get("message").get("content"))
```

### 3. Define Evaluation Dataset

Create a dataset of test cases using Pydantic Evals:

```python
from pydantic_evals import Case, Dataset

cases = [
    Case(
        name="capital of France", 
        inputs="What is the capital of France?", 
        expected_output="Paris"
    ),
    Case(
        name="author of Romeo and Juliet",
        inputs="Who wrote Romeo and Juliet?",
        expected_output="William Shakespeare",
    ),
    Case(
        name="largest planet",
        inputs="What is the largest planet in our solar system?",
        expected_output="Jupiter",
    ),
]
```

### 4. Create Custom Evaluators

Define evaluators to assess your model's performance:

```python
from pydantic_evals.evaluators import Evaluator, EvaluatorContext

class MatchesExpectedOutput(Evaluator[str, str]):
    def evaluate(self, ctx: EvaluatorContext[str, str]) -> float:
        is_correct = ctx.expected_output == ctx.output
        return is_correct

class FuzzyMatchesOutput(Evaluator[str, str]):
    def evaluate(self, ctx: EvaluatorContext[str, str]) -> float:
        from difflib import SequenceMatcher
        
        def similarity_ratio(a, b):
            return SequenceMatcher(None, a, b).ratio()
        
        # Consider it correct if similarity is above 0.8 (80%)
        is_correct = similarity_ratio(ctx.expected_output, ctx.output) > 0.8
        return is_correct
```

### 5. Setup Task and Dataset

Create a task that retrieves outputs from your traced data:

```python
import nest_asyncio
nest_asyncio.apply()

async def task(input: str) -> str:
    output = spans[spans["input"] == input]["output"].values[0]
    return output

# Create dataset with evaluators
dataset = Dataset(
    cases=cases,
    evaluators=[MatchesExpectedOutput(), FuzzyMatchesOutput()],
)
```

### 6. Add LLM Judge Evaluator

For more sophisticated evaluation, add an LLM judge:

```python
from pydantic_evals.evaluators import LLMJudge

dataset.add_evaluator(
    LLMJudge(
        rubric="Output and Expected Output should represent the same answer, even if the text doesn't match exactly",
        include_input=True,
        model="openai:gpt-4o-mini",
    ),
)
```

### 7. Run Evaluation

Execute the evaluation:

```python
report = dataset.evaluate_sync(task)
print(report)
```

## Advanced Usage

### Upload Results to Phoenix

Upload your evaluation results back to Phoenix for visualization:

```python
from phoenix.trace import SpanEvaluations

# Extract results from the report
results = report.model_dump()

# Create dataframes for each evaluator
meo_spans = spans.copy()
fuzzy_label_spans = spans.copy()
llm_label_spans = spans.copy()

for case in results.get("cases"):
    # Extract evaluation results
    meo_label = case.get("assertions").get("MatchesExpectedOutput").get("value")
    fuzzy_label = case.get("assertions").get("FuzzyMatchesOutput").get("value")
    llm_label = case.get("assertions").get("LLMJudge").get("value")
    
    input = case.get("inputs")
    
    # Update labels in dataframes
    meo_spans.loc[meo_spans["input"] == input, "label"] = str(meo_label)
    fuzzy_label_spans.loc[fuzzy_label_spans["input"] == input, "label"] = str(fuzzy_label)
    llm_label_spans.loc[llm_label_spans["input"] == input, "label"] = str(llm_label)

# Add scores for Phoenix metrics
meo_spans["score"] = meo_spans["label"].apply(lambda x: 1 if x == "True" else 0)
fuzzy_label_spans["score"] = fuzzy_label_spans["label"].apply(lambda x: 1 if x == "True" else 0)
llm_label_spans["score"] = llm_label_spans["label"].apply(lambda x: 1 if x == "True" else 0)

# Upload to Phoenix
px.Client().log_evaluations(
    SpanEvaluations(
        dataframe=meo_spans,
        eval_name="Direct Match Eval",
    ),
    SpanEvaluations(
        dataframe=fuzzy_label_spans,
        eval_name="Fuzzy Match Eval",
    ),
    SpanEvaluations(
        dataframe=llm_label_spans,
        eval_name="LLM Match Eval",
    ),
)
```

### Custom Evaluation Workflows

You can create more complex evaluation workflows by combining multiple evaluators:

```python
from pydantic_evals.evaluators import Evaluator, EvaluatorContext
from typing import Dict, Any

class ComprehensiveEvaluator(Evaluator[str, str]):
    def evaluate(self, ctx: EvaluatorContext[str, str]) -> Dict[str, Any]:
        # Multiple evaluation criteria
        exact_match = ctx.expected_output == ctx.output
        
        # Length similarity
        length_ratio = min(len(ctx.output), len(ctx.expected_output)) / max(len(ctx.output), len(ctx.expected_output))
        
        # Semantic similarity (simplified)
        from difflib import SequenceMatcher
        semantic_score = SequenceMatcher(None, ctx.expected_output.lower(), ctx.output.lower()).ratio()
        
        return {
            "exact_match": exact_match,
            "length_similarity": length_ratio,
            "semantic_similarity": semantic_score,
            "overall_score": (exact_match * 0.5) + (semantic_score * 0.3) + (length_ratio * 0.2)
        }
```

## Observe

Once you have evaluation results uploaded to Phoenix, you can:

- **View evaluation metrics**: See overall performance across different evaluation criteria
- **Analyze individual cases**: Drill down into specific examples that passed or failed
- **Compare evaluators**: Understand how different evaluation methods perform
- **Track improvements**: Monitor evaluation scores over time as you improve your application
- **Debug failures**: Identify patterns in failed evaluations to guide improvements

The Phoenix UI will display your evaluation results with detailed breakdowns, making it easy to understand your AI application's performance and identify areas for improvement.

## Resources

* [Pydantic Evals Documentation](https://github.com/pydantic/pydantic-evals)
* [Phoenix Evaluation Guide](https://docs.arize.com/phoenix/evaluation)
* [Pydantic Evals Tutorial Notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/evals/pydantic-evals.ipynb) 