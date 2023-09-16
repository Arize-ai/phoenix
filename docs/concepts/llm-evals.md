# LLM Evals

## What are LLM Evals?

Evaluations of LLM outputs are best tackled by using a separate evaluation LLM. The Phoenix LLM Evals library is designed for simple, fast and accurate LLM based evaluations.&#x20;

This package attempts to make the use of the evaluation LLM easy to implement.&#x20;

<figure><img src="../.gitbook/assets/Screenshot 2023-09-04 at 9.46.39 PM.png" alt=""><figcaption><p>LLM Evals</p></figcaption></figure>

### _The problem with Evaluations:_&#x20;

-   Evaluation libraries are hard to trust and benchmarking lacks rigor&#x20;
-   Production LLM Evals need to benchmark the combo of a model AND "_a prompt template"_
    -   Open AI “model” Evals only focus on evaluating the model, a different use case
-   Evaluations harness should be usable in benchmarking, development, production or LangChain/LlamaIndex call back system
-   Evals should run as fast as possible on batches of data
-   LLM Evals should not require you to use chain abstractions - you shouldn't have to use LangChain to get Evals for pipelines that don't use LanngChain

### _The solution provided by the Phoenix Evals:_

-   Includes pre-tested templates and convenience functions for a set of common Eval “tasks”
-   We apply data science rigor to the testing of model and template combinations
-   Designed to run as fast as possible on batches of Eval data
-   Includes benchmark datasets and tests to reproduce achieved results for the Eval task
-   Evaluation support for benchmarking task, python pipelines and LangChain/LlamaIndex callbacks

Evals are supported on a span level for LangChain and LlamaIndex

<figure><img src="../.gitbook/assets/Screenshot 2023-09-10 at 8.19.49 AM.png" alt=""><figcaption><p>Running on Spans/Callbacks</p></figcaption></figure>

This below picture shows an Eval running on a span from LangChain or LlamaIndex.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-10 at 8.20.05 AM.png" alt=""><figcaption></figcaption></figure>

Evals are also supported in Python pipelines for normal LLM deployments not using LlamaIndex or LangChain.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-12 at 9.42.45 PM.png" alt=""><figcaption><p>How Evals Work</p></figcaption></figure>

The above picture shows the running of the Evals library in a normal LLM environment unreleated to LangChain or LlamaIndex.

This library is split into high level functions to easily run rigorously pre-tested functions and building blocks to modify and create your own Evals.

Options for using Evals:

1. Pre-Tested Eval Templates
2. Customize Your Own Templates&#x20;

## Running Evals

Running an Eval is only a couple lines of code:

```python
from phoenix.experimental import evals
from phoenix.experimental.evals.models import BaseEvalModel
from phoenix.experimental.evals.templates import PromptTemplate

#Contexts retrieved for a given query
eval_test_data['reference'] = contexts
#Copy the same query to every row
eval_test_data['query'] = query
#Evals model
model_to_use = evals.OpenAIModel(model_name="gpt-4")
##### RUN RAG Retrieval Performance EVALS #####
eval_result = llm_eval_binary(eval_test_data, evals.RAG_RELEVANCY_PROMPT_TEMPLATE_STR, model_to_use)
```

The results are designed for easy analysis is Scikit learn or our convience functions built on top of Scikit learn.

```python
from phoenix.experimental.evals import (
    RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    OpenAIModel,
    download_benchmark_dataset,
    llm_eval_binary,
)
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix, ConfusionMatrixDisplay

dataset_name = "wiki_qa-train"
df = download_benchmark_dataset(
    task="binary-relevance-classification", dataset_name="wiki_qa-train"
)

df["eval_relevance"] = llm_eval_binary(df, evals.RAG_RELEVANCY_PROMPT_TEMPLATE_STR, model_to_use)
#Golden dataset has True/False map to -> "irrelevant" / "relevant"
#we can then scikit compare to output of template - same format
y_true = df["relevant"].map({True: "relevant", False: "irrelevant"})
y_pred = df["eval_relevance"]

# Compute Per-Class Precision, Recall, F1 Score, Support
precision, recall, f1, support = precision_recall_fscore_support(y_true, y_pred)
```

The example above shows how to run a pretested

### Binary Performance Evaluation

We've tested a lot of different performance evaluation options. We've found approaches similar to <> are problematic in getting repeatable and understandable metrics for troubleshooting. Namely the variance in the LLM Eval generation when extracting a score (number) can distributed in non-intuitive manner. We found LLMs provide a testable and repeatable performance evaluation approach when asked to make a hard binary or categorical decision.&#x20;

{% hint style="info" %}
LLM Evals where the Eval output is a numeric score or rating needs more research and investigation. We have not found them comparable in performance to binary and categorical Evals.&#x20;
{% endhint %}

LLM Evals included currently in the library make a speific binary decision "hallucination" or "factual" for example. These binary decisions generate traditional Precision/Recall/F1/MRR metrics that can be applied to the decisions giving a very intuitive understanding of performance and provide comparable metrics across models.

```python
df["eval_relevance"] = llm_eval_binary(df, evals.RAG_RELEVANCY_PROMPT_TEMPLATE_STR, model_to_use)
#Golden dataset has True/False map to -> "irrelevant" / "relevant"
#we can then scikit compare to output of template - same format
y_true = df["relevant"].map({True: "relevant", False: "irrelevant"})
y_pred = df["eval_relevance"]

### Designed to generate quick precision and recall metrics from sklearn ###
from sklearn.metrics import precision_recall_fscore_support
# Compute Per-Class Precision, Recall, F1 Score, Support
precision, recall, f1, support = precision_recall_fscore_support(y_true, y_pred)
```

The above approach allows us to compare models easily in an understandable format:

<table><thead><tr><th>Hallucination Eval</th><th width="85">GPT-4</th><th width="99">GPT-3.5</th><th width="185">Plam 2 (soon)</th><th>Llama 7B (soon)</th></tr></thead><tbody><tr><td>Precision</td><td>0.94</td><td>0.94</td><td></td><td></td></tr><tr><td>Recall</td><td>0.75</td><td>0.71</td><td></td><td></td></tr><tr><td>F1</td><td>0.83</td><td>0.81</td><td></td><td></td></tr></tbody></table>

### Designed for Throughput

The library was designed to maximize the volume and throughput you can run for Evals. Running a dataframe generates asynchonous calls and maximizing the throughput and usage of your API key. We found the library 10x faster in throughput than current call by call based approaches integrated into the LLM App Framework Evals.

-   Batch Evals: Run across a dataframe
-   One-by-one: Real-time Eval event by event

## Pre-Tested Evals

The following are simple functions on top of the LLM Evals building blocks that are pre-tested with benchmark datasets.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-12 at 9.43.28 PM.png" alt=""><figcaption></figcaption></figure>

Each of these is tested against golden datasets that are available as part of the LLM eval library as part of the benchmarking datasets.&#x20;

### &#x20;RAG Retrieval Performance:

-   RAG individual retrieval&#x20;
-   RAG group retrieval&#x20;

### Hallucinations:

-   Hallucinations on answers to private data
-   Hallucinations on answer to public data

### Summarization:

-   Summarization performance

### Question and Answering:

-   Private data Q\&A Eval

### User Frustration (coming soon)_<mark style="color:green;">:</mark>_&#x20;

-   User frustration deteection&#x20;

### Toxicity:

-   Is the AI response racist, biased or toxic

### Coding Performance:

-   Code writing correctness

## Customize Your Own Eval Templates&#x20;

The LLM Evals library is designed to support the building of any custom Eval templates.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-04 at 10.06.26 PM.png" alt=""><figcaption><p>Custom Eval Templates</p></figcaption></figure>

In order to create a new template all that is needed is the setting of the input string to the Eval function.&#x20;

```python
MY_CUSTOM_TEMPLATE = '''
    You are evaluating the positivity or negativity of the responses to questions.
    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [Response]: {response}
    [END DATA]

    Please forcus on the tone of the response.
    Your answer must be single word, either "positive" or "negative"
    '''
```

The above template shows an example creation of an easy to use string template. The Phoenix Eval templates support both strings and objects.&#x20;

```python

model = OpenAIModel(model_name="gpt-4",temperature=0.6)
positive_eval = llm_eval_binary_jason(
    dataframe=df,
    template= MY_CUSTOM_TEMPLATE,
    model=model
)
```

The above example shows a use of the custom created template on the df dataframe.&#x20;

```python
#Phoenix Evals support using either stirngs or objects as templates
MY_CUSTOM_TEMPLATE = " ..."
MY_CUSTOM_TEMPLATE = PromptTemplate("This is a test {prompt}")
```

## Models Supported

We currently support OpenAI with Palm 2 and Llama coming very very soon.&#x20;

The model are instantiated and usable in the LLM Eval function. The models are also directly callable with strings.&#x20;

```python
model = OpenAIModel(model_name="gpt-4",temperature=0.6)
model("What is the largest costal city in France?")
```

## Run Across Environments

The Evals are designed to run on Dataframes, in Python pipelines or in LangChain & LlamaIndex callbacks.&#x20;

<figure><img src="../.gitbook/assets/Screenshot 2023-09-06 at 3.22.15 PM.png" alt=""><figcaption><p>Same Eval Harness Different Environment</p></figcaption></figure>

The above diagram shows examples of different environments the Eval harness is desinged to run. The benchmarking environment is designed to enable the testing of the Eval model & Eval template performance against a designed set of datasets.&#x20;

### Benchmarking

The Evals dataset is designed or easy benchmarking and pre-set downloadable test datasets.

```python
from phoenix.experimental.evals import download_benchmark_dataset

df = download_benchmark_dataset(
    task="binary-hallucination-classification", dataset_name="halueval_qa_data"
)
df.head()
```

The datasets are pre-tested, many are hand crafted and designed for testing specific Eval tasks.
