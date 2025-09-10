---
description: >-
  Evaluate the relevance of documents retrieved by RAG applications using
  Phoenix's evaluation framework.
---

# Relevance Classification Evaluation

This tutorial shows how to classify documents as relevant or irrelevant to queries using benchmark datasets with ground-truth labels.

**Key Points:**

* Download and prepare benchmark datasets for relevance classification
* Compare different LLM models (GPT-4, GPT-3.5, GPT-4 Turbo) for classification accuracy
* Analyze results with confusion matrices and detailed reports
* Get explanations for LLM classifications to understand decision-making
* Measure retrieval quality using ranking metrics like precision@k

***

## Notebook Walkthrough

We will go through key code snippets on this page. To follow the full tutorial, check out the full notebook.

{% embed url="https://colab.research.google.com/github/arize-ai/phoenix/blob/main/tutorials/evals/evaluate_relevance_classifications.ipynb" %}

## Download Benchmark Dataset

```python
df = download_benchmark_dataset(
    task="binary-relevance-classification", 
    dataset_name="wiki_qa-train"
)
```

## Configure Evaluation

```python
N_EVAL_SAMPLE_SIZE = 100
df_sample = df.sample(n=N_EVAL_SAMPLE_SIZE).reset_index(drop=True)
df_sample = df_sample.rename(columns={
    "query_text": "input",
    "document_text": "reference",
})
```

## Run Relevance Classification

```python
model = OpenAIModel(model="gpt-4", temperature=0.0)
rails = list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values())

relevance_classifications = llm_classify(
    dataframe=df_sample,
    template=RAG_RELEVANCY_PROMPT_TEMPLATE,
    model=model,
    rails=rails,
    concurrency=20,
)["label"].tolist()
```

## Evaluate Results

```python
true_labels = df_sample["relevant"].map(RAG_RELEVANCY_PROMPT_RAILS_MAP).tolist()

print(classification_report(true_labels, relevance_classifications, labels=rails))
confusion_matrix = ConfusionMatrix(
    actual_vector=true_labels, predict_vector=relevance_classifications, classes=rails
)
confusion_matrix.plot(
    cmap=plt.colormaps["Blues"],
    number_label=True,
    normalized=True,
)
```

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/relevance-classification-cookbook.png" %}

## Get Explanations

```python
relevance_classifications_df = llm_classify(
    dataframe=df_sample.sample(n=5),
    template=RAG_RELEVANCY_PROMPT_TEMPLATE,
    model=model,
    rails=rails,
    provide_explanation=True,
    concurrency=20,
)
```

## Compare Models

Run the same evaluation with different models:

```python
# GPT-3.5
model_gpt35 = OpenAIModel(model="gpt-3.5-turbo", temperature=0.0)

# GPT-4 Turbo
model_gpt4turbo = OpenAIModel(model="gpt-4-turbo-preview", temperature=0.0)
```
