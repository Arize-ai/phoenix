---
description: Get started with Phoenix in three easy steps
---

# Quickstart

Follow along in your local Jupyter environment or in the Colab linked below to take your first flight with Phoenix.

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
datasets = px.load_example("sentiment_classification_language_drift")
session = px.launch_app(datasets.primary, datasets.reference)
session
```

Follow the instructions in the cell output to launch the Phoenix UI in either your notebook or a new browser tab.

## Explore Your Data

Navigate to the "Embeddings" tab and click on "text\_embedding" to explore your datasets.

To go further in depth with this particular example, check out the [tutorial notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/sentiment\_classification\_tutorial.ipynb). TODO: Link Colab

## Next Steps

Congrats! You've taken your first flight with Phoenix. We recommend that you next:

* Understand the [foundational concepts of the Phoenix API](concepts/phoenix-basics.md)
* Experiment with our end-to-end [example notebooks](tutorials/notebooks.md)
* Learn how to [use Phoenix with your own data](how-to/define-your-schema.md) and how to [manage](how-to/manage-the-app.md) and [use the app](how-to/use-the-app.md)
