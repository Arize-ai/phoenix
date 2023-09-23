---
description: >-
  Learn how Phoenix fits into your ML stack and how to incorporate Phoenix into
  your workflows.
---

# Architecture

Phoenix is designed to run locally on a single server in conjunction with the Notebook.

<figure><img src="../.gitbook/assets/Docs graphics-03.jpg" alt=""><figcaption><p><strong>Phoenix Architecture</strong></p></figcaption></figure>

Phoenix runs locally, close to your data, in an environment that interfaces to Notebook cells on the Notebook server. Designing Phoenix to run locally, enables fast iteration on top of local data.

## How should I use Phoenix?

In order to use Phoenix:

1. Load data into pandas dataframe
2. (Optional) Leverage [SDK](http://127.0.0.1:5000/s/-MAlgpMyBRcl2qFZRQ67/api-reference/python-sdk/arize.pandas/autoembeddings#the-embeddinggenerator-class) embeddings and LLM eval generators
3. Start Phoenix
   1. Single dataframe
   2. (Optional) Two dataframes: primary and [reference](../concepts/phoenix-basics.md#which-dataset-is-which)
4. Investigate problems
5. (Optional) Export data

#### Load Data Into pandas:

Phoenix currently requires pandas dataframes which can be downloaded from either an ML observability platform, a table or a raw log file. The data is assumed to be formatted in the [Open Inference](../concepts/open-inference.md) format with a well defined column structure, normally including a set of inputs/features, outputs/predictions and ground truth.

#### Leverage SDK Embeddings and LLM Eval Generators:

The Phoenix library heavily uses [embeddings](../concepts/embeddings.md) as a method for data visualization and debugging. In order to use Phoenix with embeddings they can either be generated using an SDK call or they can be supplied by the user of the library. Phoenix supports [generating](../concepts/generating-embeddings.md) embeddings for LLMs, Image, NLP, and tabular datasets.

#### Start Phoenix with DataFrames:

Phoenix is typically started in a notebook from which a local Phoenix server is kicked off. Two approaches can be taken to the overall use of Phoenix:

1. **Single Dataset**

In the case of a team that only wants to investigate a single dataset for exploratory data analysis (EDA), a single dataset instantiation of Phoenix can be used. In this scenario, a team is normally analyzing the data in an exploratory manner and is not doing A/B comparisons.

2. **Two Datasets**

A common use case in ML is for teams to have 2x datasets they are comparing such as: training vs production, model A vs model B, OR production time X vs production time Y, just to name a few. In this scenario there exists a primary and reference dataset. When using the primary and reference dataset, Phoenix supports drift analysis, embedding drift and many different A/B dataset comparisons.

#### Investigate Problems:

Once instantiated, teams can dive into Phoenix on a feature by feature basis, analyzing performance and tracking down issues.

#### Export Cluster:

Once an issue is found, the cluster can be exported back into a dataframe for further analysis. Clusters can be used to create groups of similar data points for use downstream, these include:

* Finding Similar Examples
* Monitoring
* Steering Vectors / Steering Prompts

### How Phoenix fits into the ML Stack

Phoenix is designed to monitor, analyze and troubleshoot issues on top of your model data allowing for [interactive](../api/session.md#phoenix.launch\_app) workflows all within a Notebook environment.

<figure><img src="../.gitbook/assets/Docs graphics-01.jpg" alt=""><figcaption><p><strong>How Phoenix Fits into the ML Stack</strong></p></figcaption></figure>

The above picture shows the use of Phoenix with a cloud observability system (this is not required). In this example the cloud observability system allows the easy download (or synchronization) of data to the Notebook typically based on model, batch, environment, and time ranges. Normally this download is done to analyze data at the tail end of troubleshooting workflow, or periodically to use the notebook environment to monitor your models.&#x20;

Once in a notebook environment the downloaded data can power Observability workflows that are highly interactive. Phoenix can be used to find clusters of data problems and export those clusters back to the Observability platform for use in monitoring and active learning workflows.&#x20;

Note: Data can also be downloaded from any data warehouse system for use in Phoenix without the requirement of a cloud ML observability solution.&#x20;

In the first version of Phoenix it is assumed the data is available locally but we’ve also designed it with some broader visions in mind. For example, Phoenix was designed with a stateless metrics engine as a first class citizen, enabling any metrics checks to be run in any python data pipeline.&#x20;

