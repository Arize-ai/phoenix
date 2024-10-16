<a href="https://colab.research.google.com/github/arize-ai/phoenix/blob/main/tutorials/experiments/langchain_email_extraction.ipynb" target="_parent"><img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/></a>

```shell
pip install -Uqqq "arize-phoenix>=4.6" langchain langchain-core langchain-community langchain-benchmarks nest_asyncio jarowinkler
```

# Set Up OpenAI API Key


```python
import os
from getpass import getpass

if not os.getenv("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = getpass("🔑 Enter your OpenAI API key: ")
```

# Import Modules


```python
import json
import tempfile
from datetime import datetime, timezone

import jarowinkler
import nest_asyncio
import pandas as pd
import phoenix as px
from langchain.output_parsers.openai_functions import JsonOutputFunctionsParser
from langchain_benchmarks import download_public_dataset, registry
from langchain_openai.chat_models import ChatOpenAI
from openinference.instrumentation.langchain import LangChainInstrumentor
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from phoenix.experiments import evaluate_experiment, run_experiment

nest_asyncio.apply()
```

# Launch Phoenix


```python
px.launch_app()
```

# Instrument LangChain and OpenAI


```python
endpoint = "http://127.0.0.1:4317"
(tracer_provider := TracerProvider()).add_span_processor(
    SimpleSpanProcessor(OTLPSpanExporter(endpoint))
)

LangChainInstrumentor().instrument(tracer_provider=tracer_provider)
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

# Download JSON Data


```python
dataset_name = "Email Extraction"

with tempfile.NamedTemporaryFile(suffix=".json") as f:
    download_public_dataset(registry[dataset_name].dataset_id, path=f.name)
    df = pd.read_json(f.name)[["inputs", "outputs"]]
df = df.sample(10, random_state=42)
df
```

# Upload Dataset to Phoenix


```python
dataset = px.Client().upload_dataset(
    dataset_name=f"{dataset_name}{datetime.now(timezone.utc)}",
    inputs=df.inputs,
    outputs=df.outputs.map(lambda obj: obj["output"]),
)
```

# Set Up LangChain


```python
llm = ChatOpenAI(model="gpt-4o").bind_functions(
    functions=[registry[dataset_name].schema],
    function_call=registry[dataset_name].schema.schema()["title"],
)
output_parser = JsonOutputFunctionsParser()
extraction_chain = registry[dataset_name].instructions | llm | output_parser
```

# Define Task Function


```python
def task(input) -> str:
    return extraction_chain.invoke(input)
```

# Check that the task is working by running it on at least one Example


```python
task(dataset.examples[0].input)
```

# Run Experiment


```python
experiment = run_experiment(dataset, task)
```

# Define Evaluator


```python
def jarowinkler_similarity(output, expected) -> float:
    return jarowinkler.jarowinkler_similarity(
        json.dumps(output, sort_keys=True),
        json.dumps(expected, sort_keys=True),
    )
```

# Evaluate Experiment


```python
evaluate_experiment(experiment, jarowinkler_similarity)
```
