---
description: >-
  Learn about LLM Observability and how to evaluate foundation models in
  production.
---

# LLM Observability

The use of GPT-4 as a replacement for various model tasks is growing daily. What many teams consider a model today, may just be a prompt & response pair in the future. As teams deploy LLM’s to production the same challenges around performance and task measurement do still exist.

<figure><img src=".gitbook/assets/Phoenix docs graphics-05 (1).jpg" alt=""><figcaption><p><strong>Evolution of Models</strong></p></figcaption></figure>

The above example shows a set of niche text models from Huggingface that many teams deploy in production today. The movement toward using a foundational model and APIs is happening very fast given a single model can cover the broad set of tasks that used to be accomplished by many models.

<figure><img src=".gitbook/assets/Phoenix docs graphics-06.jpg" alt=""><figcaption><p><strong>Prompt and Response Paradigm</strong></p></figcaption></figure>

The following is an example of prompt and response pairs that occur as a user interacts with an LLM. The user interacts with a model continuously with prompt and responses as the core interaction paradigm.&#x20;

<figure><img src=".gitbook/assets/Phoenix docs graphics-07 (1).jpg" alt=""><figcaption></figcaption></figure>

The above picture shows what LLM observability looks like in the world of foundational models. The interface into and out of the system are strings of prompt/response pairs. The inputs and outputs are construct a set of data that is collected by the observability system that include the following:

* Prompt and Response
* Prompt and Response embedding
* Pre-prompt and context data that pre-pends user prompts
* Prompt token length
* Step in conversation&#x20;
* Conservation ID
* Response token length
* Structured Metadata, tagging groups of predictions&#x20;
* Embedded Metadata, additional metadata that is embedded

<figure><img src="https://lh3.googleusercontent.com/gwlk5Ynk8sp_CNAjwr3qU84kMWe45-0Jd4SkwxkkBQNG1KGDWkmfJHv9l38V2VsyQVWa4YjcxijAonBaJ10ztl5tr1u0BTM3URWYmCdwAqjoCMDaxEBQFUmWpobpBYXGJa3-EJ-pHYaeplrOrzIogBs" alt=""><figcaption><p><strong>Example of Prompt &#x26; Response Dataframe</strong> </p></figcaption></figure>

The above data is collected from the interaction with the LLM. The above data can be seen as structured data that describes the LLM interaction, language like text strings which are inputs/outputs and embeddings which are latent structure information.&#x20;

\
Embeddings are internal latent representations of information, they are an internal representation of what a model is “thinking” and how it sees that specific data. In a foundational model like GPT-4, teams do not have access to the internal embeddings for that specific model but can still generate embeddings using an embedding generator model. The embedding generator models can be locally run models such as GPT-J or BERT.&#x20;

The approaches to troubleshooting LLM prompt/response failures in production are currently centered around finding clusters/cohorts of problems, understanding what the issues are in those groups of data points and building workflows for fine tuning or prompt engineering to fix.

<figure><img src=".gitbook/assets/Phoenix docs graphics-08.jpg" alt=""><figcaption><p><strong>Cluster of Problems</strong></p></figcaption></figure>

One method of finding problem responses involves clustering prompts and responses then finding problem clusters through looking at evaluation metrics per cluster, drift per cluster or users feedback such as thumbs up / thumbs down per cluster.&#x20;

<figure><img src=".gitbook/assets/Phoenix docs graphics-09.jpg" alt=""><figcaption><p><strong>Problem Examples</strong></p></figcaption></figure>

The problems captured as part of the detections are shown above where a certain format of misleading responses are grouped together and highlighted. These misleading responses can be fixed through a number of iterative workflows through prompt engineering or fine-tuning.

<figure><img src=".gitbook/assets/Phoenix docs graphics-10.jpg" alt=""><figcaption><p><strong>Cluster and Prompt Analysis</strong></p></figcaption></figure>

Once you find a cluster of issues, understanding what specifically in that cluster is problematic can take some work. We recommend integrating an LLM to do the heavy lifting for you. Your LLM Observability tool should pre-prompt the LLM with cluster data to do cluster analysis and cluster comparisons to baseline datasets, with interactive workflows for EDA type analysis.&#x20;

<figure><img src=".gitbook/assets/Phoenix docs graphics-11.jpg" alt=""><figcaption><p><strong>Filter by Structured Data</strong></p></figcaption></figure>

In addition to cluster analysis on the full datastream many teams want Observability solutions to segment their data on structured data related to the prompt and response pairs This Metadata can be API latency information, so that teams can look only prompt/response pairs causing a large latency, then zoom into clusters. Or they can dig in based on structured metadata provided by the production integration, these can be related to pre-prompt task categories or any metadata relevant to the prediction. &#x20;

**Structured Tagging Groups of Queries**&#x20;

Unlike the previous sections that highlighted clustering prompt and responses by their embeddings, this section highlights adding structured metadata to prompt/response pairs. The LLM / GPT-4 API is a single call with a string as input and string as output. In order to group calls together externally with metadata tags can be added to the observability tracking SDK. The tags can be used in filtered visualizations or colorizations of prompt and response data.&#x20;

<figure><img src=".gitbook/assets/Phoenix docs graphics-12.jpg" alt=""><figcaption><p><strong>Tagging of Prompt and Response</strong></p></figcaption></figure>

The above example shows a set of prompts and responses running an edit task. The edit task prompts are tagged as such with metadata when they are sent to the observability platform.&#x20;

\
\
\
