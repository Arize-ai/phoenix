---
description: >-
  Phoenix provides ML insights at lightning speed with zero-config observability
  for model drift, performance, and data quality.
cover: >-
  https://images.unsplash.com/photo-1610296669228-602fa827fc1f?crop=entropy&cs=tinysrgb&fm=jpg&ixid=MnwxOTcwMjR8MHwxfHNlYXJjaHw1fHxzcGFjZXxlbnwwfHx8fDE2NzkwOTMzODc&ixlib=rb-4.0.3&q=80
coverY: 0
---

test change

# ML Observability in a Notebook

Running Phoenix for the first time? Check out the tutorials to explore the capabilities of Phoenix for various tasks and use cases.

<table data-card-size="large" data-view="cards"><thead><tr><th align="center"></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td align="center"><strong>Computer Vision</strong></td><td><a href="tutorials/computer-vision.md">computer-vision.md</a></td></tr><tr><td align="center"><strong>NLP</strong></td><td><a href="tutorials/nlp.md">nlp.md</a></td></tr><tr><td align="center"><strong>Tabular Data</strong></td><td><a href="tutorials/tabular-data.md">tabular-data.md</a></td></tr><tr><td align="center"><strong>Generative LLMs</strong></td><td><a href="tutorials/generative-llms.md">generative-llms.md</a></td></tr></tbody></table>

## What is Phoenix?

Phoenix is an Open Source ML Observability library designed for the Notebook. The toolset is designed to ingest model inference data for [LLMs](concepts/llm-observability.md), CV, NLP and tabular datasets. It allows Data Scientists to quickly visualize their model data, monitor performance, track down issues & insights, and easily export to improve.&#x20;

<figure><img src=".gitbook/assets/Docs graphics-02.jpg" alt=""><figcaption></figcaption></figure>

## Overview

#### Context&#x20;

* Deep Learning Models (CV, LLM, and Generative) are an amazing technology that will power many of the future ML use cases. &#x20;
* A large set of these technologies are being deployed into businesses (the real world) in what we consider a production setting.
* When they are in production, data scientists have no idea when models fail, when they make wrong decisions, or give poor responses (LLM), and incorrectly generalize.&#x20;
* One paradigm that has emerged is the use of embeddings and latent structure to analyze model decisions and find clusters of problems.&#x20;
* Fixing the problem typically consists of augmenting/editing upstream data, changing a prompt template or exporting data for use in training and/or fine tuning.&#x20;

#### Proposed Solution

This is where Phoenix comes in 😃 ML Observability helps you visualize, troubleshoot, and monitor complex model data.

* Lightweight connections to dataframes&#x20;
* Provides easy tools to generate and visualize [embeddings](concepts/embeddings.md#whats-an-embedding)
* Automatically find clusters of embeddings that represent "ideas" that the model has learned (manifolds)&#x20;
* Sorts clusters of issues using performance metrics or drift
* Built in workflows for model improvement&#x20;

<figure><img src=".gitbook/assets/Phoenix pipeline diagram - dark.png" alt=""><figcaption></figcaption></figure>

**Phoenix Functionality**&#x20;

* **Discover How Embeddings Represent Your Data:** Map structured features onto embeddings for deeper insights into how embeddings represent your data.&#x20;
* **Evaluate LLM Tasks:** Troubleshoot tasks such as summarization or question/answering to find problem clusters with misleading or false answers.&#x20;
* **Find Clusters of Issues to Export for Model Improvement:** Find [clusters](concepts/phoenix-basics.md#embedding-details) of problems using performance metrics or drift. Export clusters for fine-tuning workflows.&#x20;
* **Detect Anomalies:** Using LLM embeddings&#x20;
* **Surface Model Drift and Multivariate Drift:** Use embedding [drift](concepts/phoenix-basics.md#embedding-drift-over-time) to surface data drift for generative AI, LLMs, computer vision (CV) and tabular models.
* **Easily Compare A/B Datasets:** Uncover high-impact clusters of data points missing from model training data when comparing training and production datasets.&#x20;

### Phoenix Supported Model Types

* [Tabular](tutorials/tabular-data.md) - Regression, Classification&#x20;
* [CV](tutorials/computer-vision.md)&#x20;
* [NLP](tutorials/nlp.md)
* [LLM](tutorials/generative-llms.md)
* Ranking\* (coming soon)

\
