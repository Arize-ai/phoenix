---
description: Troubleshooting an LLM Summarization Task
---

# Generative LLMs

Imagine you're responsible for your media company's summarization model that condenses daily news into concise summaries. Your model's performance has recently declined, leading to negative feedback from readers around the globe.

This tutorial shows how Phoenix help you find the root-cause of LLM performance issues by analyzing prompt-response pairs.

In this tutorial, you will:

* Download curated LLM data for this walkthrough
* Compute embeddings for each prompt (article) and response (summary)
* Calculate ROUGE-L scores to evaluate the quality of your LLM-generated summaries against human-written reference summaries
* Launch Phoenix
* Find articles that your LLM is struggling to summarize

Open the tutorial in Colab or GitHub to get started!

[![Open in Colab](https://img.shields.io/static/v1?message=Open%20in%20Colab\&logo=googlecolab\&labelColor=grey\&color=blue\&logoColor=orange\&label=%20)](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/llm\_summarization\_tutorial.ipynb) [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub\&logo=github\&labelColor=grey\&color=blue\&logoColor=white\&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/tutorials/llm\_summarization\_tutorial.ipynb)
