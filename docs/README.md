---
description: >-
  Phoenix provides MLOps insights at lightning speed with zero-config
  observability for model drift, performance, and data quality.
cover: >-
  https://images.unsplash.com/photo-1610296669228-602fa827fc1f?crop=entropy&cs=tinysrgb&fm=jpg&ixid=MnwxOTcwMjR8MHwxfHNlYXJjaHw1fHxzcGFjZXxlbnwwfHx8fDE2NzkwOTMzODc&ixlib=rb-4.0.3&q=80
coverY: 0
---

# ML Observability in Your Notebook



{% hint style="warning" %}
Phoenix is under active development and its API may change at any time.
{% endhint %}

Phoenix works with python 3.8 and above and is available to install via `pypi`

```shell
pip install arize-phoenix
```

you are now ready to use the `phoenix` package inside of your notebook!

## What is Phoenix?

Phoenix is an ML Observability tool designed for the Notebook. The toolset is designed to ingest model inference data for LLMs, CV, NLP and structured datasets, visualize/monitor performance, track down issues/insights, and easily export to improve. Unstructured data such as text and images are a first class citizen in Phoenix, with embeddings and latent structure analysis designed as a core foundation of the toolset.&#x20;

### Core Functionality:

* Ingest production inference data and embeddings&#x20;
* A/B Comparison workflows
* Embedding drift analysis
* Monitoring analysis to pinpoint issues&#x20;
* Automatic clustering to detect groups of problems&#x20;
* Workflows to export and fine tune (coming soon)

### Phoenix Architecture

![](https://lh5.googleusercontent.com/lGqPXbhn1bR7bUVFeIKaAn-MJ87rWr6cU8TXiPLolTDHKawLRCHMekas9uliO9ZLnWb8jxOeQ4Xq2bkr\_\_3bsRP5t9dGoXSkfHPg7iFpUeaO6ivxqnERVQjjQIaByRsKBGfCNA85MgwWaMwEXhGrgOo)

Phoenix is designed to run on a local server, directly on top of your data, in an environment that is Notebook centric. The power of running locally allows Phoenix to be designed for fast iteration on top of local data.

### Phoenix Vision

<figure><img src="https://lh3.googleusercontent.com/uzRSF5MXNsti1NVxbn82Pnsx-pPpFznpQyV8ZYofFr2maqc5KbmdAf2zQ1wmDMeVwB8n0quoqpNozuGjKFwwtEXjO45Q5fplz4Oo3CbdeAuP-UomkjFglxkFjVtGDjHnVZ_ZyQpDq7TmtX69Iwn9f4M" alt=""><figcaption></figcaption></figure>

The picture above shows the flow of Phoenix from pointing to your data, running it to find problems or insights, grabbing groups of data for insights and then exporting for fine tuning.&#x20;

\
