---
description: >-
  Phoenix provides MLOps insights at lightning speed with zero-config
  observability for model drift, performance, and data quality.
cover: >-
  https://images.unsplash.com/photo-1610296669228-602fa827fc1f?crop=entropy&cs=tinysrgb&fm=jpg&ixid=MnwxOTcwMjR8MHwxfHNlYXJjaHw1fHxzcGFjZXxlbnwwfHx8fDE2NzkwOTMzODc&ixlib=rb-4.0.3&q=80
coverY: 0
---

# 🌟 ML Observability in a Notebook

## What is Phoenix?

Phoenix is an ML Observability library designed for the Notebook. The toolset is designed to ingest model inference data for LLMs, CV, NLP and tabular datasets. It allows Data Scientists to quickly visualize their model data, monitor performance, track down issues & insights, and easily export to improve. Unstructured data such as text (prompts and responses) and images are a first class citizen in Phoenix, with embeddings analysis designed as the core foundation of the library.&#x20;

### Core Functionality:

* Unstructured & structured data drift&#x20;
* Troubleshooting LLM prompt/responses
* Analytical tools for NLP/Image/Generative & tabular model analysis&#x20;
* Automatic visualization and clustering of embeddings
* UMAP for dimension reduction & HDBScan for clustering analysis: designed to work together
* Easy A/B data comparison workflows
* Embedding drift analysis
* Ingest embeddings if you have them or leverage embedding generation SDK
* Generate embeddings using LLMs&#x20;
* Monitoring analysis to pinpoint issues\*&#x20;
* Automatic clustering to detect groups of problems&#x20;
* Workflows to export and fine tune

#### Coming Soon:

* Dashboards
* Monitors for structured data

### Phoenix Architecture

Phoenix is designed to run locally on a single server in conjunction with the Notebook.&#x20;

<figure><img src="https://lh3.googleusercontent.com/JVbbKGB2DocrWGNum_xKVZMRVAb7c4oBcJFCL23M-diqMmerKUJKVU9ZvMLhtNTIa4RuwbcNLAr3ZSd5pku5iFw-nb9pdHF-myKWLdtAkBxFPWu2jFQ_6ugHfaMLwGUDGc-kln4It1qLyVmP6m005Tk" alt=""><figcaption><p><strong>Phoenix Architecture</strong></p></figcaption></figure>

Phoenix runs locally, close to your data, in an environment that interfaces to Notebook cells on the Notebook server. Designing Phoenix to run locally, enables fast iteration on top of local data. &#x20;

In order to use Phoenix:

1. Load data into pandas dataframe
2. Leverage SDK embeddings and LLM eval generators&#x20;
3. Start Phoenix
   1. Single dataframe
   2. Two dataframes: primary and reference&#x20;
4. Investigate problems
5. Export data

<figure><img src="https://lh3.googleusercontent.com/uzRSF5MXNsti1NVxbn82Pnsx-pPpFznpQyV8ZYofFr2maqc5KbmdAf2zQ1wmDMeVwB8n0quoqpNozuGjKFwwtEXjO45Q5fplz4Oo3CbdeAuP-UomkjFglxkFjVtGDjHnVZ_ZyQpDq7TmtX69Iwn9f4M" alt=""><figcaption></figcaption></figure>

The picture above shows the flow of execution of Phoenix, from pointing it to your data, running it to find problems or insights, grabbing groups of data for insights and then exporting for fine tuning.&#x20;

#### Load Data Into Pandas:

Phoenix currently requires Pandas dataframes which can be downloaded from either an ML observability platform, a table or a raw log file. The data is assumed to be formatted in the Open Inference format with a well defined column structure, normally including a set of inputs/features, outputs/predictions and ground truth.&#x20;

#### Leverage SDK Embeddings and LLM Eval Generators:

The Phoenix library heavily uses embeddings as a method for data visualization and debugging. In order to use Phoenix with embeddings they can either be generated using an SDK call or they can be supplied by the user of the library. Phoenix supports generating embeddings for LLMs, Image, NLP, and tabular datasets.&#x20;

#### Start Phoenix:

Phoenix is typically started in a notebook from which a local Phoenix server is kicked off. Two approaches can be taken to the overall use of Phoenix::

1. **Single Dataset**

In the case of a team that only wants to investigate a single dataset for exploratory data analysis (EDA), a single dataset instantiation of Phoenix can be used. In this scenario, a team is normally analyzing the data in an exploratory manner and is not doing A/B comparisons. &#x20;

2. **Two Datasets**

A common use case in ML is for teams to have 2x datasets they are comparing such as: training vs production, model A vs model B, OR production time X vs production time Y, just to name a few. In this scenario there exists a primary and reference dataset. When using the primary and reference dataset, Phoenix supports drift analysis, embedding drift and many different A/B dataset comparisons.&#x20;

#### Investigate Problems:

Once instantiated, teams can dive into Phoenix on a feature by feature basis, analyzing performance and tracking down issues.&#x20;

<mark style="color:red;">< example of embedding drift></mark>&#x20;

The above example shows embedding drift between clusters of data, where a cluster in production has a large drift relative to the training set.&#x20;

#### Export Cluster:

Once an issue is found, the cluster can be exported back into a dataframe for further analysis. Clusters can be used to create groups of similar data points for use downstream, these include:

* Finding Similar Examples&#x20;
* Monitoring&#x20;
* Steering Vectors / Steering Prompts

### How Phoenix fits into the ML Stack

Phoenix is designed to monitor, analyze and troubleshoot issues on top of your model data allowing for interactive workflows all within a Notebook environment.&#x20;

<figure><img src="https://lh5.googleusercontent.com/hpNMLyQQ5lpaHzrLuPUzRn_2i-IMySUpaXr6kumnaLXnzR_-tAvQtBtuumYf10FwAmnFyHT1riAgeP-cvc7xDDqMhMllZ4wl1SWrF5kNDuF7BBoqm9jtjRKh3aMVaI9MM6SDdBG_nwgM_kdltPaM_NE" alt=""><figcaption><p><strong>How Phoenix Fits into the ML Stack</strong></p></figcaption></figure>

