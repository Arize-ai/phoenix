<a href="https://colab.research.google.com/github/arize-ai/phoenix/blob/main/tutorials/experiments/run_experiments_with_llama_index.ipynb" target="_parent"><img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/></a>

```shell
pip install -Uqqq "arize-phoenix[llama-index]>=4.6" sentence-transformers torch
```


```python
import os
from getpass import getpass

if not os.getenv("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = getpass("🔑 Enter your OpenAI API key: ")
```


```python
import tempfile
from datetime import datetime, timezone
from time import sleep
from urllib.request import urlretrieve

import nest_asyncio
import pandas as pd
import phoenix as px
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex
from llama_index.core.postprocessor import SentenceTransformerRerank
from llama_index.core.settings import Settings
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from phoenix.evals import OpenAIModel
from phoenix.experiments import run_experiment
from phoenix.experiments.evaluators import ConcisenessEvaluator
from phoenix.experiments.types import EvaluationResult, Example, ExperimentRun

nest_asyncio.apply()
```

# Instrument LlamaIndex


```python
endpoint = "http://127.0.0.1:6006/v1/traces"
tracer_provider = trace_sdk.TracerProvider()
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))

LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider)
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

# Create Dataset


```python
df = pd.DataFrame(
    {
        "input_messages": [
            [{"role": "user", "content": "Which grad schools did the author apply for and why?"}],
            [{"role": "user", "content": "What did the author do growing up?"}],
        ],
        "output_message": [
            {
                "role": "assistant",
                "content": "The author applied to three grad schools: MIT and Yale, which were renowned for AI at the time, and Harvard, which the author had visited because a friend went there and it was also home to Bill Woods, who had invented the type of parser the author used in his SHRDLU clone. The author chose these schools because he wanted to learn about AI and Lisp, and these schools were known for their expertise in these areas.",
            },
            {
                "role": "assistant",
                "content": "The author took a painting class at Harvard with Idelle Weber and later became her de facto studio assistant. Additionally, the author worked on several different projects, including writing essays, developing spam filters, and painting.",
            },
        ],
    }
)
df
```

## Upload Dataset


```python
px.launch_app()
```


```python
dataset_name = datetime.now(timezone.utc).isoformat()
px.Client().upload_dataset(
    dataset_name=dataset_name,
    dataframe=df,
    input_keys=("input_messages",),
    output_keys=("output_message",),
)
sleep(1)
```

## Download Dataset


```python
ds = px.Client().get_dataset(name=dataset_name)
```

# Set Up Experiment Metadata


```python
experiment_metadata = {
    "llm": "gpt-4",
    "embed_model": "text-embedding-3-small",
    "reranker": "cross-encoder/ms-marco-MiniLM-L-2-v2",
}
```

# Set Up LLamaIndex


```python
Settings.llm = OpenAI(model=experiment_metadata["llm"])
Settings.embed_model = OpenAIEmbedding(model=experiment_metadata["embed_model"])
reranker = SentenceTransformerRerank(model=experiment_metadata["reranker"], top_n=2)

essay = "https://raw.githubusercontent.com/run-llama/llama_index/main/docs/docs/examples/data/paul_graham/paul_graham_essay.txt"
with tempfile.NamedTemporaryFile() as tf:
    urlretrieve(essay, tf.name)
    documents = SimpleDirectoryReader(input_files=[tf.name]).load_data()
index = VectorStoreIndex.from_documents(documents)
```

# Set Up Capture of Retrieved Documents

# Create Task


```python
def rag_with_reranker(input) -> str:
    chat_engine = index.as_chat_engine(similarity_top_k=10, node_postprocessors=[reranker])
    response = chat_engine.chat(input["input_messages"][-1]["content"])
    return str(response)
```

# Define Evaluator


```python
class ContainsSubstring:
    name = "contains_substring"
    annotator_kind = "CODE"

    def __init__(self, substring: str):
        self.substring = substring

    def evaluate(self, _: Example, exp_run: ExperimentRun) -> EvaluationResult:
        result = exp_run.output.result
        score = int(isinstance(result, str) and self.substring in result)
        return EvaluationResult(
            score=score,
            explanation=f"the substring `{repr(self.substring)}` was in the output",
        )

    async def async_evaluate(self, _: Example, exp_run: ExperimentRun) -> EvaluationResult:
        return self.evaluate(_, exp_run)
```


```python
print(ConcisenessEvaluator.template)
```

# Run Experiment with Evaluators


```python
model = OpenAIModel(model="gpt-4o")

experiment = run_experiment(
    dataset=ds,
    task=rag_with_reranker,
    experiment_metadata=experiment_metadata,
    evaluators=[ContainsSubstring(substring="school"), ConcisenessEvaluator(model)],
)
```


```python

```
