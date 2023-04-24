---
description: >-
  Learn about LLM Observability and how to evaluate foundation models in
  production.
---

# LLM Observability

The use of GPT-4 as a replacement for various model tasks is growing daily. What many teams consider a model today, may just be a prompt & response pair in the future. As teams deploy LLM’s to production the same challenges around performance and task measurement do still exist.

<figure><img src="../.gitbook/assets/Docs graphics-05.jpg" alt=""><figcaption><p><strong>Evolution of Models</strong></p></figcaption></figure>

The above example shows a set of niche text models from Huggingface that many teams deploy in production today. The movement toward using a foundational model and APIs is happening very fast given a single model can cover the broad set of tasks that used to be accomplished by many models.

<figure><img src="../.gitbook/assets/Docs graphics-06.jpg" alt=""><figcaption><p><strong>Prompt and Response Paradigm</strong></p></figcaption></figure>

The following is an example of prompt and response pairs that occur as a user interacts with an LLM. The user interacts with a model continuously with prompt and responses as the core interaction paradigm.&#x20;

<figure><img src="../.gitbook/assets/Docs graphics-07.jpg" alt=""><figcaption></figcaption></figure>

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

<figure><img src="../.gitbook/assets/01 - OSS pandas chart-v2.png" alt=""><figcaption><p><strong>Example of Prompt &#x26; Response Dataframe</strong> </p></figcaption></figure>

The above data is collected from the interaction with the LLM. The above data can be seen as structured data that describes the LLM interaction, language like text strings which are inputs/outputs and embeddings which are latent structure information.&#x20;

The approaches to troubleshooting LLM prompt/response failures in production are currently centered around finding clusters/cohorts of problems, understanding what the issues are in those groups of data points and building workflows for fine tuning or prompt engineering to fix.

<figure><img src="../.gitbook/assets/Docs graphics-09.jpg" alt=""><figcaption><p><strong>Problem Examples</strong></p></figcaption></figure>

The problems captured as part of the detections are shown above where a certain format of misleading responses are grouped together and highlighted. These misleading responses can be fixed through a number of iterative workflows through prompt engineering or fine-tuning.

<figure><img src="../.gitbook/assets/Docs graphics-10.jpg" alt=""><figcaption><p><strong>Cluster and Prompt Analysis</strong></p></figcaption></figure>

Once you find a cluster of issues, understanding what specifically in that cluster is problematic can take some work. We recommend integrating an LLM to do the heavy lifting for you. Your LLM Observability tool should pre-prompt the LLM with cluster data to do cluster analysis and cluster comparisons to baseline datasets, with interactive workflows for EDA type analysis.&#x20;

### Embeddings for Cluster Analysis

Embeddings are internal latent representations of information, they are an internal representation of what a model is “thinking” and how it sees that specific data. In a foundational model like GPT-4, teams do not have access to the internal embeddings for that specific model but can still generate embeddings using an embedding generator model. The embedding generator models can be locally run models such as GPT-J or BERT.&#x20;

<figure><img src="../.gitbook/assets/Docs graphics-08.jpg" alt=""><figcaption><p><strong>Cluster of Problems</strong></p></figcaption></figure>

One method of finding problem responses involves clustering prompts and responses then finding problem clusters through looking at evaluation metrics per cluster or users' feedback such as thumbs up / thumbs down per cluster.&#x20;

<figure><img src="../.gitbook/assets/Docs graphics-11.jpg" alt=""><figcaption><p><strong>Filter by Structured Data</strong></p></figcaption></figure>

In addition to cluster analysis on the full datastream many teams want Observability solutions to segment their data on structured data related to the prompt and response pairs This metadata can be API latency information, so that teams can look only prompt/response pairs causing a large latency, then zoom into clusters. Or they can dig in based on structured metadata provided by the production integration, these can be related to pre-prompt task categories or any metadata relevant to the prediction. &#x20;

### **Structured Tagging Groups of Queries**&#x20;

Unlike the previous sections that highlighted clustering prompt and responses by their embeddings, this section highlights adding structured metadata to prompt/response pairs. The LLM / GPT-4 API is a single call with a string as input and string as output. In order to group calls together externally with metadata tags can be added to the observability tracking SDK. The tags can be used in filtered visualizations or colorizations of prompt and response data.&#x20;

<figure><img src="../.gitbook/assets/Docs graphics-12.jpg" alt=""><figcaption><p><strong>Tagging of Prompt and Response</strong></p></figcaption></figure>

The above example shows a set of prompts and responses running an edit task. The edit task prompts are tagged as such with metadata when they are sent to the observability platform.&#x20;

### Pre-Prompts

As teams are using pre-prompt text that is combined with the prompt response to send to the LLM. The entire context is sent the the LLM. The observability platform normally tracks the pre prompt data form the actual prompt and response data. &#x20;

<figure><img src="../.gitbook/assets/02 - OSS PrePrompt.png" alt=""><figcaption><p>Pre-Prompt</p></figcaption></figure>

The example above shows how a pre-prompt is added on top of prompt and response pairs. The pre-prompts can take on a couple different formats expect the variations to grow:

* Mindset specific Instructions: “You are a customer service representative who is an expert in ….”&#x20;
* Task Specific Instructions: “Please classify the following text into these classes \[“medical text”, “legal text”, “instructions”]?”&#x20;
* Code: “Please write code to delete the following …”

In order to troubleshoot all the combinations and types of issues, we recommend teams embed all of the text groups that are inserted into the models.&#x20;

<figure><img src="../.gitbook/assets/03 - OSS TextDataEmbedding - 2.jpg" alt=""><figcaption><p>Embedding of Data</p></figcaption></figure>

The above shows a common set of text groups but we often see a lot more than the above groups. The embeddings generated above can be used to cluster, troubleshoot and evaluate the prompt/response data.

### Evaluation Metrics

Evaluation metrics for LLMs can be as wide and varied as the number of tasks that are possible. These evaluation metrics are task specific. In the case of well known tasks, such as classification or sentiment analysis the well known evaluation metrics make sense such as F1, precision and accuracy. In the case of other tasks, evaluation LLMs are growing in popularity as the key main approach to running complex evaluations. Teams essentially run an LLM to evaluate the output of another LLM.

<figure><img src="../.gitbook/assets/llm evaluation.png" alt=""><figcaption><p>Evaluation LLM</p></figcaption></figure>

The above example attempts to show how an evaluation LLM is used to analyze prompt and response pairs that are outputs from an initial LLM. The evaluation LLM is setup with a task based prompt template that is used for LLM evaluation of either a Q\&A or summarization task.

<figure><img src="../.gitbook/assets/05 - OSS EvalMetric.png" alt=""><figcaption><p>Evaluation by Cluster</p></figcaption></figure>

The above evaluation metrics allow evaluation on the LLM by task but they do not give a good view of what groups are doing well and what groups are not. The above LLM analysis of evaluation metrics by cluster allows teams to pinpoint problems quickly and iterate on prompts or problems.&#x20;

### Basic Tracking Metrics

In order to deploy into production there are a set of basic LLM tracking metrics that you need in order to debug issues and catch problems. These metrics span a number of issues such as tracking down conversation IDs, large delays, or periods of high token usage. &#x20;

<figure><img src="../.gitbook/assets/06 - OSS LineCharts.png" alt=""><figcaption><p>Basic Tracking Metrics</p></figcaption></figure>

The above metrics are designed to help track the general health and availability of LLMs in production. The example above uses average and the count of maximum token length to track down periods are out of bounds performance. As a single number overall its not that useful (outside of cost tracking) but used in conjunction with filtering the above troubleshooting flows it can be useful to help track down issues.&#x20;

### Conclusion

LLMs are an incredibly new and powerful technology that are expanding the use cases of production AI. These uses in production still have a common theme with production ML:

* When LLMs are doing something important in a deployed system - production deployments - you need to monitor them
* The LLM tasks, as defined as a fixed prompt template, is similar to the idea of a model use case
* The task execution can still go wrong and have problems based on other data inputs
* In order to troubleshoot, you need to decompose tasks and problems into groups of issues - either groups of prompts or groups of responses
* Teams need tools to find the prompt and response pairs that are problematic and debug them
* In order to fix, for a specific task and group of issues teams need tools to help fix prompts and fine tune&#x20;
* Sometimes filtering or analyzing by simple metadata metrics such as token length, conversation ID, step length or API delay can be helpful
