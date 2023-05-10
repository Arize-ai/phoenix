---
description: Detecting fraud with tabular embeddings
---

# Tabular Data

Imagine you maintain a fraud-detection service for your e-commerce company. In the past few weeks, there's been an alarming spike in undetected cases of fraudulent credit card transactions. These false negatives are hurting your bottom line, and you've been tasked with solving the issue.

Phoenix provides opinionated workflows to surface feature drift and data quality issues quickly so you can get straight to the root-cause of the problem. As you'll see, your fraud-detection service is receiving more and more traffic from an untrustworthy merchant, causing your model's false negative rate to skyrocket.

In this tutorial, you will:

* Download curated datasets of credit card transaction and fraud-detection data
* Compute [tabular embeddings](../concepts/generating-embeddings.md#tabular-data-pandas-dataframe) to represent each transaction
* Pinpoint fraudulent transactions from a suspicious merchant
* Export data from this merchant to retrain your model

Open the tutorial in Colab or GitHub to get started!

[![Open in Colab](https://img.shields.io/static/v1?message=Open%20in%20Colab\&logo=googlecolab\&labelColor=grey\&color=blue\&logoColor=orange\&label=%20)](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/credit\_card\_fraud\_tutorial.ipynb) [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub\&logo=github\&labelColor=grey\&color=blue\&logoColor=white\&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/tutorials/credit\_card\_fraud\_tutorial.ipynb)
