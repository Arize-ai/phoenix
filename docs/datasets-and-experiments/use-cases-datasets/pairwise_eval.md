<center>
    <p style="text-align:center">
        <img alt="phoenix logo" src="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/9e6101d95936f4bd4d390efc9ce646dc6937fb2d/images/socal/github-large-banner-phoenix.jpg" width="1000"/>
        <br>
        <br>
        <a href="https://docs.arize.com/phoenix/">Docs</a>
        |
        <a href="https://github.com/Arize-ai/phoenix">GitHub</a>
        |
        <a href="https://arize-ai.slack.com/join/shared_invite/zt-2w57bhem8-hq24MB6u7yE_ZF_ilOYSBw#/shared-invite/email">Community</a>
    </p>
</center>
<h1 align="center">Pairwise Eval</h1>
<h5 align="center">👉 See Llama-Index <a href="https://github.com/run-llama/llama_index/blob/a7c79201bbc5e195a0447ae557980791010b4747/docs/docs/examples/evaluation/pairwise_eval.ipynb">notebook</a> for more info 👈</h5>


<a href="https://colab.research.google.com/github/arize-ai/phoenix/blob/main/tutorials/experiments/llama-index/pairwise_eval.ipynb" target="_parent"><img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/></a>



```shell
pip install -Uqqq "arize-phoenix[llama-index]>=4.6" nest_asyncio
```

# Enter OpenAI API Key


```python
import os
from getpass import getpass

if not os.getenv("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = getpass("🔑 Enter your OpenAI API key: ")
```

# Import Modules


```python
import json
from textwrap import shorten
from time import time_ns
from typing import Tuple

import nest_asyncio
import pandas as pd
import phoenix as px
from llama_index.core.evaluation import (
    PairwiseComparisonEvaluator,
)
from llama_index.llms.openai import OpenAI
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from phoenix.experiments import evaluate_experiment, run_experiment
from phoenix.experiments.types import Explanation, Score

nest_asyncio.apply()
```

# Launch Phoenix


```python
px.launch_app()
```

# Instrument Llama-Index


```python
endpoint = "http://127.0.0.1:4317"
(tracer_provider := TracerProvider()).add_span_processor(
    SimpleSpanProcessor(OTLPSpanExporter(endpoint))
)
LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider)
```

# Upload Dataset to Phoenix


```python
sample_size = 7
category = "creative_writing"
url = "hf://datasets/databricks/databricks-dolly-15k/databricks-dolly-15k.jsonl"
df = pd.read_json(url, lines=True)
df = df.loc[df.category == category, ["instruction", "response"]]
df = df.sample(sample_size, random_state=42)
dataset = px.Client().upload_dataset(
    dataset_name=f"{category}_{time_ns()}",
    dataframe=df,
)
```

# Dataset Can be Viewed as Dataframe


```python
dataset.as_dataframe()
```

# Take a Look at the Data Structure of an Example


```python
dataset[0]
```

# Define Task Function on Examples

Task function can be either sync or async.


```python
async def task(input):
    return (await OpenAI(model="gpt-3.5-turbo").acomplete(input["instruction"])).text
```

# Check that Task Can Run Successfully


```python
example = dataset[0]
task_output = await task(example.input)
print(shorten(json.dumps(task_output), width=80))
```

# Dry-Run Experiment

On 3 randomly selected examples


```python
experiment = run_experiment(dataset, task, dry_run=3)
```

# Experiment Results Can be Viewed as Dataframe


```python
experiment.as_dataframe()
```

# Take a Look at the Data Structure of an Experiment Run


```python
experiment[0]
```

# Define Evaluators For Each Experiment Run

Evaluators can be sync or async.

Function arguments `output` and `expected` refer to the attributes of the same name in the `ExperimentRun` data structure shown above.


```python
llm = OpenAI(temperature=0, model="gpt-4o")


async def pairwise(output, input, expected) -> Tuple[Score, Explanation]:
    ans = await PairwiseComparisonEvaluator(llm=llm).aevaluate(
        query=input["instruction"],
        response=output,
        second_response=expected["response"],
    )
    return ans.score, ans.feedback


evaluators = [pairwise]
```

# Check that Evals Can Run Successfully


```python
run = experiment[0]
example = dataset.examples[run.dataset_example_id]
for fn in evaluators:
    _ = await fn(run.output, example.input, example.output)
    print(fn.__qualname__)
    print(shorten(json.dumps(_), width=80))
```

# Run Evaluations


```python
experiment = evaluate_experiment(experiment, evaluators)
```

# Evaluation Results Can be Viewed as Dataframe


```python
experiment.get_evaluations()
```

# Run Task and Evals Together


```python
_ = run_experiment(dataset, task, evaluators)
```
