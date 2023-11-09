# Phoenix LLM Evals

Evaluating LLM outputs is best tackled by using a separate evaluation LLM. The Phoenix [LLM Evals library](running-pre-tested-evals/) is designed for simple, fast, and accurate LLM-based evaluations.&#x20;

<div data-full-width="false">

<figure><img src="../.gitbook/assets/Screenshot 2023-09-04 at 9.46.39 PM.png" alt="" width="563"><figcaption><p>LLM Evals</p></figcaption></figure>

</div>

### The Problem with LLM Evaluations

1. Most evaluation libraries do NOT follow trustworthy benchmarking rigor necessary for production environments. Production LLM Evals need to benchmark both a model **and** "_a prompt template". (i.e. the Open AI “model” Evals only focuses on evaluating the model, a different use case_).&#x20;
2. There is typically difficulty integrating benchmarking, development, production, or the LangChain/LlamaIndex callback system. Evals should process batches of data with optimal speed.&#x20;
3. Obligation to use chain abstractions (i.e. _LangChain shouldn't be a prerequisite for obtaining evaluations for pipelines that don't utilize it)_. &#x20;

## Our Solution: Phoenix LLM Evals

### 1. Support for Pre-Tested Eval Templates & custom eval templates

Phoenix provides pretested eval templates and convenience functions for a set of common Eval “tasks”. Learn more about pretested templates [here](running-pre-tested-evals/). This library is split into high-level functions to easily run rigorously [pre-tested functions](running-pre-tested-evals/) and building blocks to modify and [create your own Evals](building-your-own-evals.md).

### 2. Data Science Rigor when Benchmarking Evals for Reproducible Results&#x20;

The Phoenix team is dedicated to testing model and template combinations and is continually improving templates for optimized performance. Find the most up-to-date template on [GitHub](https://github.com/Arize-ai/phoenix/tree/main/tutorials/evals).

### 3. Designed for Throughput&#x20;

Phoenix evals are designed to run as fast as possible on batches of Eval data and maximize the throughput and usage of your API key. The current Phoenix library is 10x faster in throughput than current call-by-call-based approaches integrated into the LLM App Framework Evals.

### 4. Run the Same Evals in Different Environments (Notebooks, python pipelines, Langchain/LlamaIndex callbacks) &#x20;

Phoenix Evals are designed to run on dataframes, in Python pipelines, or in LangChain & LlamaIndex callbacks. Evals are also supported in Python pipelines for normal LLM deployments not using LlamaIndex or LangChain. There is also one-click support for Langchain and LlamaIndx support.&#x20;

<figure><img src="../.gitbook/assets/Screenshot 2023-09-06 at 3.22.15 PM.png" alt=""><figcaption><p>Same Eval Harness Different Environment</p></figcaption></figure>

### 5. Run Evals on Span and Chain Level&#x20;

&#x20;Evals are supported on a span level for LangChain and LlamaIndex.&#x20;

<figure><img src="../.gitbook/assets/Screenshot 2023-09-10 at 8.19.49 AM.png" alt=""><figcaption><p>Running on Spans/Callbacks</p></figcaption></figure>

<figure><img src="https://storage.cloud.google.com/arize-assets/phoenix/assets/images/How_Do_Evals_Work_Diagram.png" alt=""><figcaption><p>How evals work</p></figcaption></figure>
