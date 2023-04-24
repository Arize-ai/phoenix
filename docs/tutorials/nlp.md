---
description: Root-cause analysis for a drifting sentiment classification model 
---

Imagine you're in charge of maintaining a model that takes as input online reviews of your U.S.-based product and classifies the sentiment of each review as positive, negative, or neutral. Your model initially performs well in production, but its performance gradually degrades over time.

Phoenix helps you surface the reason for this regression by analyzing the embeddings representing the text of each review. Your model was trained on English reviews, but as you'll discover, it's encountering Spanish reviews in production that it can't correctly classify.

In this tutorial, you will:

- Download curated datasets of embeddings and predictions
- Define a schema to describe the format of your data
- Launch Phoenix to visually explore your embeddings
- Investigate problematic clusters to identify the root cause of your model performance issue

Open the tutorial in Colab or GitHub to get started!

[![Open in Colab](https://img.shields.io/static/v1?message=Open%20in%20Colab\&logo=googlecolab\&labelColor=grey\&color=blue\&logoColor=orange\&label=%20)](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/sentiment\_classification\_tutorial.ipynb) [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub\&logo=github\&labelColor=grey\&color=blue\&logoColor=white\&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/tutorials/sentiment\_classification\_tutorial.ipynb)
