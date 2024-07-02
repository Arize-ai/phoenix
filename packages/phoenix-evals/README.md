# arize-phoenix-evals

Phoenix provides tooling to evaluate LLM applications, including tools to determine the relevance or irrelevance of documents retrieved by retrieval-augmented generation (RAG) application, whether or not the response is toxic, and much more.

Phoenix's approach to LLM evals is notable for the following reasons:

-   Includes pre-tested templates and convenience functions for a set of common Eval “tasks”
-   Data science rigor applied to the testing of model and template combinations
-   Designed to run as fast as possible on batches of data
-   Includes benchmark datasets and tests for each eval function

## Installation

Install the arize-phoenix sub-package via `pip`

```shell
pip install arize-phoenix-evals
```

Note you will also have to install the LLM vendor SDK you would like to use with LLM Evals. For example, to use OpenAI's GPT-4, you will need to install the OpenAI Python SDK:

```shell
pip install 'openai>=1.0.0'
```

## Usage

Here is an example of running the RAG relevance eval on a dataset of Wikipedia questions and answers:

```python
import os
from phoenix.evals import (
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    OpenAIModel,
    download_benchmark_dataset,
    llm_classify,
)
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix, ConfusionMatrixDisplay

os.environ["OPENAI_API_KEY"] = "<your-openai-key>"

# Download the benchmark golden dataset
df = download_benchmark_dataset(
    task="binary-relevance-classification", dataset_name="wiki_qa-train"
)
# Sample and re-name the columns to match the template
df = df.sample(100)
df = df.rename(
    columns={
        "query_text": "input",
        "document_text": "reference",
    },
)
model = OpenAIModel(
    model="gpt-4",
    temperature=0.0,
)


rails =list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values())
df[["eval_relevance"]] = llm_classify(df, model, RAG_RELEVANCY_PROMPT_TEMPLATE, rails)
#Golden dataset has True/False map to -> "irrelevant" / "relevant"
#we can then scikit compare to output of template - same format
y_true = df["relevant"].map({True: "relevant", False: "irrelevant"})
y_pred = df["eval_relevance"]

# Compute Per-Class Precision, Recall, F1 Score, Support
precision, recall, f1, support = precision_recall_fscore_support(y_true, y_pred)
```

To learn more about LLM Evals, see the [LLM Evals documentation](https://docs.arize.com/phoenix/concepts/llm-evals/).
