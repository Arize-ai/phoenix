---
description: Active learning for a drifting image classification model
---

# Computer Vision

Imagine you're in charge of maintaining a model that classifies the action of people in photographs. Your model initially performs well in production, but its performance gradually degrades over time.

Phoenix helps you surface the reason for this regression by analyzing the embeddings representing each image. Your model was trained on crisp and high-resolution images, but as you'll discover, it's encountering blurred and noisy images in production that it can't correctly classify.

In this tutorial, you will:

* Download curated datasets of [embeddings](../concepts/embeddings.md) and predictions
* Define a [schema](../api/dataset-and-schema.md#phoenix.schema) to describe the format of your data
* [Launch](../api/session.md#phoenix.launch\_app) Phoenix to visually [explore](../concepts/phoenix-basics/phoenix-basics.md#embedding-details) your embeddings
* Investigate problematic clusters
* Export problematic production data for labeling and fine-tuning

Open the tutorial in Colab or GitHub to get started!

[![Open in Colab](https://img.shields.io/static/v1?message=Open%20in%20Colab\&logo=googlecolab\&labelColor=grey\&color=blue\&logoColor=orange\&label=%20)](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/image\_classification\_tutorial.ipynb) [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub\&logo=github\&labelColor=grey\&color=blue\&logoColor=white\&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/tutorials/image\_classification\_tutorial.ipynb)
