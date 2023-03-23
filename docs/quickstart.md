---
description: Get started with Phoenix in three easy steps
---

# Quickstart

Follow along in your local Jupyter environment or in the Colab linked below to take your first flight with Phoenix.

TODO: Add Colab link

## Install and Import Phoenix

In your Jupyter or Colab environment, run

```
pip install arize-phoenix
```

to install Phoenix and its dependencies. Once installed, import Phoenix inside of your notebook with

```python
import phoenix as px
```

## Launch Phoenix with Example Datasets

Run the following to download an example dataset and launch the app.

```python
datasets = px.load_datasets("sentiment_classification_language_drift")
session = px.launch_app(datasets.primary, datasets.reference)
session
```

Follow the instructions in the cell output to launch the Phoenix UI in either your notebook or a new browser tab.

## Find the Root Cause of Your Model's Performance Issue

This example contains inference data on both training and production examples from a model that classifies the sentiment of product reviews as positive, negative, or neutral. You've noticed a dip in your model's performance in production that you want to investigate.

1. Navigate to the "Embeddings" tab and click on "text\_embedding".
2. The graph at the top of the page measures drift over time. Click on a period of high drift and examine the point cloud below.
3. Click on the first cluster in the panel on the left. This cluster consists almost entirely of production data, meaning that your model is seeing data in production the likes of which it never saw during training.
4. Use the panel on the bottom to examine the data points in this cluster and ponder the question below.

<details>

<summary>Question: What's gone wrong with your model in production?</summary>

**Answer:** Your model was fine-tuned on examples of labeled product reviews in English. In production, however, your model is encountering product reviews in Spanish whose sentiment it cannot correctly predict.

</details>

