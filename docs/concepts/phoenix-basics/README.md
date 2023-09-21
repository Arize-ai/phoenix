# Phoenix Basics

## Overview

Phoenix has two main data ingestion entry points based on the use case:

1. [LLM Spans and Traces:](traces-and-spans-langchain-and-llamaindex.md) Phoenix is used on top of trace data generated LamaIndex and LangChain. The general use case is to troubleshoot LLM applications built on LangChain and LlamaIndex.&#x20;
2. [DataFrames - Image/NLP/LLM:](../phoenix-basics.md) Phoenix is used to troubleshoot models whose datasets can be expressed as DataFrames in Python.&#x20;

### When to use LLM Traces and Spans:

* Application built on top of LangChain and LlamaIndex
* Troubleshooting agents
* Search and Retrieval (RAG) with LangChain and LlamaIndex
* Chatbots and Q\&A with your data using LangChain or LlamaIndex

{% content-ref url="traces-and-spans-langchain-and-llamaindex.md" %}
[traces-and-spans-langchain-and-llamaindex.md](traces-and-spans-langchain-and-llamaindex.md)
{% endcontent-ref %}

### When to use DataFrames - Image/NLP/LLM:&#x20;

* LLM applications built in Python workflows&#x20;
* Image -  classification/object detection and segmentation applications  &#x20;
* NLP - classification/NER/generation&#x20;
* Structured tabular data - embedding analysis of tabular data
* Search and Retrieval (RAG) - without LangChain or LlamaIndex

{% content-ref url="../phoenix-basics.md" %}
[phoenix-basics.md](../phoenix-basics.md)
{% endcontent-ref %}

