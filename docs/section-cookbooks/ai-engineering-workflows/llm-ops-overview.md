---
description: >-
  This tutorial demonstrates how to build, observe, evaluate, and analyze
  LLM-powered applications using Phoenix.
---

# LLM Ops Overview

This tutorial covers the complete LLM Ops workflow from tracing your application to running experiments and measuring performance improvements.

In this tutorial, you will:

* Build a RAG application using LlamaIndex and OpenAI
* Instrument and trace your application with Phoenix
* Evaluate your application using LLM Evals at both trace and span levels
* Create datasets and run experiments to measure performance changes
* Analyze results and identify areas for improvement

⚠️ **Prerequisites**: This tutorial requires an OpenAI API key and a [Phoenix Cloud](https://app.phoenix.arize.com/) account.

### Understanding LLM-Powered Applications

Building software with LLMs is fundamentally different from traditional software development. Rather than compiling source code into binary to run deterministic commands, we navigate datasets, embeddings, prompts, and parameter weights to generate consistent, accurate results. LLM outputs are probabilistic and don't produce the same deterministic outcome every time.

This probabilistic nature makes observability crucial for understanding and improving LLM applications.

### Observing Applications Using Traces

LLM Traces and Observability let us understand the system from the outside by allowing us to ask questions about the system without knowing its inner workings. This approach helps us troubleshoot novel problems and answer the question, "Why is this happening?"

#### What are LLM Traces?

LLM Traces are a category of telemetry data used to understand the execution of LLMs and surrounding application context such as:

* Retrieval from vector stores
* Usage of external tools (search engines, APIs)
* Individual steps your application takes
* Overall system performance

***

## Notebook Walkthrough

We will go through key code snippets on this page. To follow the full tutorial, check out the notebook or video above.

{% embed url="https://colab.research.google.com/github/arize-ai/phoenix/blob/main/tutorials/llm_ops_overview.ipynb" %}

### Building and Tracing a RAG Application

Let's build a RAG application that answers questions about Arize AI and trace its execution.

#### Build the RAG Application

```python
from gcsfs import GCSFileSystem
from llama_index.core import (
    Settings,
    StorageContext,
    load_index_from_storage,
)
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI

# Configure LlamaIndex settings
Settings.llm = OpenAI(model="gpt-4o-mini")
Settings.embed_model = OpenAIEmbedding(model="text-embedding-ada-002")

# Load pre-built index from Google Cloud Storage
file_system = GCSFileSystem(project="public-assets-275721")
index_path = "arize-phoenix-assets/datasets/unstructured/llm/llama-index/arize-docs/index/"
storage_context = StorageContext.from_defaults(
    fs=file_system,
    persist_dir=index_path,
)

index = load_index_from_storage(storage_context)
query_engine = index.as_query_engine()
```

#### View Traces in Phoenix UI

After running the queries, you can view the traces in the Phoenix UI, which provides an interactive troubleshooting experience. You can sort, filter, and search for traces, and view details of each trace to understand the response generation process.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/llm-ops-rag-app.png" %}

### Evaluating Applications Using LLM Evals

Evaluation should serve as the primary metric for assessing your application. While examining individual queries is beneficial, it becomes impractical as the volume of edge cases and failures increases. Instead, establish a suite of metrics and automated evaluations.

#### Trace-Level Evaluations

We'll evaluate the entire request in full context using two key metrics:

* **Hallucination Detection**: Whether the response contains false information
* **Q\&A Correctness**: Whether the application answers the question correctly

**Prepare Data for Evaluation**

```python
import pandas as pd

trace_df = (
    spans_df.groupby("context.trace_id")
    .agg(
        {
            "attributes.llm.input_messages": lambda x: " ".join(x.dropna().astype(str)),
            "attributes.llm.output_messages": lambda x: " ".join(x.dropna().astype(str)),
            "attributes.retrieval.documents": lambda x: " ".join(x.dropna().astype(str)),
        }
    )
    .rename(
        columns={
            "attributes.llm.input_messages": "input",
            "attributes.llm.output_messages": "output",
            "attributes.retrieval.documents": "reference",
        }
    )
    .reset_index()
)
```

**Define Evaluation Prompts**

```python
HALLUCINATION_PROMPT_TEMPLATE = """
In this task, you will be presented with a query, a reference text and an answer. The answer is
generated to the question based on the reference text. The answer may contain false information. You
must use the reference text to determine if the answer to the question contains false information,
if the answer is a hallucination of facts. Your objective is to determine whether the answer text
contains factual information and is not a hallucination. A 'hallucination' refers to
an answer that is not based on the reference text or assumes information that is not available in
the reference text.

    [BEGIN DATA]
    ************
    [Query]: {{input}}
    ************
    [Reference text]: {{reference}}
    ************
    [Answer]: {{output}}
    ************
    [END DATA]

    Is the answer above factual or hallucinated based on the query and reference text?

Please read the query, reference text and answer carefully, then write out in a step by step manner
an EXPLANATION to show how to determine if the answer is "factual" or "hallucinated". Avoid simply
stating the correct answer at the outset. Your response LABEL should be a single word: either
"factual" or "hallucinated", and it should not include any other text or characters. "hallucinated"
indicates that the answer provides factually inaccurate information to the query based on the
reference text. "factual" indicates that the answer to the question is correct relative to the
reference text, and does not contain made up information.
"""
```

**Run Evaluations**

```python
from openinference.instrumentation import suppress_tracing
from phoenix.evals import create_classifier
from phoenix.evals.evaluators import async_evaluate_dataframe
from phoenix.evals.llm import LLM

llm = LLM(provider="openai", model="gpt-4o")

hallucination_evaluator = create_classifier(
    name="hallucination",
    llm=llm,
    prompt_template=HALLUCINATION_PROMPT_TEMPLATE,
    choices={"factual": 1.0, "hallucinated": 0.0},
)

qa_evaluator = create_classifier(
    name="q&a",
    llm=llm,
    prompt_template=QA_PROMPT_TEMPLATE,
    choices={"correct": 1.0, "incorrect": 0.0},
)

with suppress_tracing():
    results_df = await async_evaluate_dataframe(
        dataframe=trace_df,
        evaluators=[hallucination_evaluator, qa_evaluator],
    )
```

**Log Evaluation Results**

```python
from phoenix.evals.utils import to_annotation_dataframe

root_spans = primary_df[primary_df["parent_id"].isna()][["context.trace_id", "context.span_id"]]

# Merge results with root spans to align on trace_id
results_with_spans = pd.merge(
    results_df.reset_index(), root_spans, on="context.trace_id", how="left"
).set_index("context.span_id", drop=False)

# Format for Phoenix logging
annotation_df = to_annotation_dataframe(results_with_spans)

hallucination_eval_results = annotation_df[
    annotation_df["annotation_name"] == "hallucination"
].copy()
qa_eval_results = annotation_df[annotation_df["annotation_name"] == "q&a"].copy()

# Log to Phoenix
await px_client.annotations.log_span_annotations_dataframe(
    dataframe=hallucination_eval_results,
    annotator_kind="LLM",
)

await px_client.annotations.log_span_annotations_dataframe(
    dataframe=qa_eval_results,
    annotator_kind="LLM",
)
```

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/llm-ops-rag-app-2.png" %}

#### Span-Level Evaluations

Now let's evaluate the retrieval process specifically to see if retrieved documents are relevant to the queries:

```python
# Filter for retrieval spans
filtered_df = primary_df[
    (primary_df["span_kind"] == "RETRIEVER")
    & (primary_df["attributes.retrieval.documents"].notnull())
]

filtered_df = filtered_df.rename(
    columns={"attributes.input.value": "input", "attributes.retrieval.documents": "documents"}
)

# Define relevancy evaluation prompt here

# Create and run relevancy evaluator
relevancy_evaluator = create_classifier(
    name="RAG Relevancy",
    llm=llm,
    prompt_template=RAG_RELEVANCY_PROMPT_TEMPLATE,
    choices={"relevant": 1.0, "unrelated": 0.0},
)

with suppress_tracing():
    results_df = await async_evaluate_dataframe(
        dataframe=filtered_df,
        evaluators=[relevancy_evaluator],
    )

# Log span-level evaluations
relevancy_eval_df = to_annotation_dataframe(results_df)
await px_client.annotations.log_span_annotations_dataframe(
    dataframe=relevancy_eval_df,
    annotator_kind="LLM",
)
```

### Creating Experimentation Workflows

Experiments allow you to measure how changes in your application affect evaluation metrics. This requires three main components:&#x20;

1. Dataset: dataset of inputs to run the task against.
2. Task: A task function that executes the system under test (for example, a function that queries your RAG system).
3. Evaluators: One or more evaluators that measure the quality of the task outputs (for example, hallucination and Q\&A correctness evaluators).

#### Define Task and Evaluators

```python
def query_system(input):
    response = query_engine.query(input["query"])
    return response

# Use the same evaluators as before
hallucination_evaluator = create_classifier(
    name="hallucination",
    llm=llm,
    prompt_template=HALLUCINATION_PROMPT_TEMPLATE,
    choices={"factual": 1.0, "hallucinated": 0.0},
)

qa_evaluator = create_classifier(
    name="q&a",
    llm=llm,
    prompt_template=QA_PROMPT_TEMPLATE,
    choices={"correct": 1.0, "incorrect": 0.0},
)
```

#### Run Experiment

```python
experiment = await px_client.experiments.run_experiment(
    dataset=dataset, 
    task=query_system, 
    evaluators=[hallucination_evaluator, qa_evaluator]
)
```

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/llm-ops-6.png" %}

The combination of tracing, evaluation, and experimentation provides a comprehensive approach to LLM Ops that scales from individual queries to systematic performance measurement.
