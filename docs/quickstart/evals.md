---
description: Evaluate your LLM application with Phoenix
---

# Quickstart: Evals

This quickstart guide will show you through the basics of evaluating data from your LLM application.

## 1. Install Phoenix Evals

{% tabs %}
{% tab title="Using pip" %}
```python
pip install arize-phoenix[evals]
```
{% endtab %}

{% tab title="Using conda" %}
```git
conda install -c conda-forge arize-phoenix[evals]
```
{% endtab %}
{% endtabs %}

## 2. Export Data and Launch Phoenix

Export a dataframe from your Phoenix session that contains traces from your LLM application.

{% hint style="info" %}
If you are interested in a subset of your data, you can export with a custom query. Learn more [here](../tracing/how-to-tracing/extract-data-from-spans.md).
{% endhint %}

For the sake of this guide, we'll download some pre-existing trace data collected from a LlamaIndex application (in practice, this data would be collected by [instrumenting your LLM application](llm-traces.md) with an OpenInference-compatible tracer).

```python
from urllib.request import urlopen
from phoenix.trace.trace_dataset import TraceDataset
from phoenix.trace.utils import json_lines_to_df

# Replace with the URL to your trace data
traces_url = "https://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/llm/context-retrieval/trace.jsonl"
with urlopen(traces_url) as response:
    lines = [line.decode("utf-8") for line in response.readlines()]
trace_ds = TraceDataset(json_lines_to_df(lines))
```

Then, start Phoenix to view and manage your evaluations.

```python
import phoenix as px
session = px.launch_app(trace=trace_ds)
session.view()
```

You should now see a view like this.

![A view of the Phoenix UI prior to adding evaluation annotations](https://storage.googleapis.com/arize-assets/phoenix/assets/docs/notebooks/evals/traces\_without\_evaluation\_annotations.png)

## 3. Evaluate and Log Results

Set up evaluators (in this casefor hallucinations and Q\&A correctness), run the evaluations, and log the results to visualize them in Phoenix.

{% tabs %}
{% tab title="Hallucinations and Q&A Evaluations" %}
```python
!pip install openai

from phoenix.experimental.evals import OpenAIModel, HallucinationEvaluator, QAEvaluator
from phoenix.experimental.evals import run_evals
import nest_asyncio
nest_asyncio.apply()  # This is needed for concurrency in notebook environments

# Set your OpenAI API key
api_key = "your-api-key"  # Replace with your actual API key
eval_model = OpenAIModel(model="gpt-4-turbo-preview", api_key=api_key)

# Define your evaluators
hallucination_evaluator = HallucinationEvaluator(eval_model)
qa_evaluator = QAEvaluator(eval_model)

# Run the evaluations
# Assume 'queries_df' is your input dataframe for Q&A correctness
# and 'spans_df' is your input dataframe for hallucinations
hallucination_eval_df, qa_eval_df = run_evals(
    dataframe=queries_df,
    evaluators=[hallucination_evaluator, qa_evaluator],
    provide_explanation=True
)

# Log the evaluations
from phoenix.trace import SpanEvaluations

px.Client().log_evaluations(
    SpanEvaluations(eval_name="Hallucination", dataframe=hallucination_eval_df),
    SpanEvaluations(eval_name="QA Correctness", dataframe=qa_eval_df)
)
```
{% endtab %}
{% endtabs %}

{% hint style="info" %}
This quickstart uses OpenAI and requires an OpenAI API key, but we support a wide variety of APIs and [models](../api/evaluation-models.md).
{% endhint %}

## 4. Analyze Your Evaluations

After logging your evaluations, open Phoenix to review your results. Inspect evaluation statistics, identify problematic spans, and explore the reasoning behind each evaluation.

```python
print(f"🔥🐦 Open back up Phoenix in case you closed it: {session.url}")
```

You can view aggregate evaluation statistics, surface problematic spans, and understand the LLM's reason for each evaluation by simply reading the corresponding explanation. Phoenix seamlessly pinpoints the cause (irrelevant retrievals, incorrect parameterization of your LLM, etc.) of your LLM application's poor responses.

![A view of the Phoenix UI with evaluation annotations](https://storage.googleapis.com/arize-assets/phoenix/assets/docs/notebooks/evals/traces\_with\_evaluation\_annotations.png)

If you're interested in extending your evaluations to include relevance, explore our detailed [Colab guide](https://colab.research.google.com/).

Now that you're set up, read through the [Concepts Section](https://docs.arize.com/phoenix/evaluation/concepts-evals) to get an understanding of the different components.

If you want to learn how to accomplish a particular task, check out the [How-To Guides](https://docs.arize.com/phoenix/evaluation/how-to-evals).
