---
description: AI Observability and Evaluation
---

# Arize Phoenix

Phoenix is an open-source observability tool designed for experimentation, evaluation, and troubleshooting of AI and LLM applications. It allows AI engineers and data scientists to quickly visualize their data, evaluate performance, track down issues, and export data to improve.\
\
Phoenix is built by [Arize AI](https://www.arize.com), the company behind the industry-leading AI observability platform, and a set of core contributors.

Phoenix works with OpenTelemetry and [OpenInference](https://github.com/Arize-ai/openinference) instrumentation. See [Integrations](https://arize.com/docs/phoenix/integrations) for details.

## Features

{% tabs %}
{% tab title="Tracing" %}
{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/tracing.mp4" %}
Tracing in Phoenix
{% endembed %}

[Tracing](tracing/llm-traces.md) is a helpful tool for understanding how your LLM application works. Phoenix's open-source library offers comprehensive tracing capabilities that are not tied to any specific LLM vendor or framework.&#x20;

Phoenix accepts traces over the OpenTelemetry protocol (OTLP) and supports first-class instrumentation for a variety of frameworks ([LlamaIndex](broken-reference), [LangChain](broken-reference),[ DSPy](broken-reference)), SDKs ([OpenAI](broken-reference), [Bedrock](broken-reference), [Mistral](broken-reference), [Vertex](broken-reference)), and Languages. ([Python](broken-reference), [Javascript](tracing/how-to-tracing/setup-tracing/javascript.md), etc.)
{% endtab %}

{% tab title="Evaluation" %}
{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/evals.mp4" %}
Evals in the Phoenix UI
{% endembed %}

Phoenix is built to help you [evaluate your application](evaluation/llm-evals/) and understand their true performance. To accomplish this, Phoenix includes:

* A standalone library to [run LLM-based evaluations](evaluation/how-to-evals/running-pre-tested-evals/) on your own datasets. This can be used either with the Phoenix library, or independently over your own data.
* [Direct integration of LLM-based and code-based evaluators](tracing/how-to-tracing/feedback-and-annotations/evaluating-phoenix-traces.md) into the Phoenix dashboard. Phoenix is built to be agnostic, and so these evals can be generated using Phoenix's library, or an external library like [Ragas](https://docs.ragas.io/), [Deepeval](https://github.com/confident-ai/deepeval), or [Cleanlab](https://cleanlab.ai/).
* [Human annotation capabilities](tracing/features-tracing/how-to-annotate-traces.md) to attach human ground truth labels to your data in Phoenix.
{% endtab %}

{% tab title="Prompt Engineering" %}
{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/prompt_playground.mp4" %}
Phoenix Prompt Playground
{% endembed %}

Phoenix offers tools to [streamline your prompt engineering](prompt-engineering/overview-prompts.md) workflow.

* [Prompt Management](prompt-engineering/overview-prompts/prompt-management.md) - Create, store, modify, and deploy prompts for interacting with LLMs
* [Prompt Playground](prompt-engineering/overview-prompts/prompt-playground.md) - Play with prompts, models, invocation parameters and track your progress via tracing and experiments
* [Span Replay](./#span-replay) - Replay the invocation of an LLM. Whether it's an LLM step in an LLM workflow or a router query, you can step into the LLM invocation and see if any modifications to the invocation would have yielded a better outcome.
* [Prompts in Code](prompt-engineering/overview-prompts/prompts-in-code.md) - Phoenix offers client SDKs to keep your prompts in sync across different applications and environments.
{% endtab %}

{% tab title="Datasets & Experiments" %}
{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/experiments.mp4" %}
Experiments in Phoenix
{% endembed %}

[Phoenix Datasets & Experiments](datasets-and-experiments/overview-datasets.md) let you test different versions of your application, store relevant traces for evaluation and analysis, and build robust evaluations into your development process.

* [Run Experiments](datasets-and-experiments/how-to-experiments/run-experiments.md) to test and compare different iterations of your application
* [Collect relevant traces into a Dataset](datasets-and-experiments/how-to-datasets/), or directly upload Datasets from code / CSV
* [Run Datasets through Prompt Playground](prompt-engineering/overview-prompts/prompt-playground.md), export them in fine-tuning format, or attach them to an Experiment.
{% endtab %}
{% endtabs %}



## Quickstarts

Running Phoenix for the first time? Select a quickstart below.

<table data-view="cards"><thead><tr><th align="center"></th><th data-hidden data-card-target data-type="content-ref"></th><th data-hidden data-card-cover data-type="files"></th></tr></thead><tbody><tr><td align="center"><strong>Tracing</strong></td><td><a href="tracing/llm-traces-1/">llm-traces-1</a></td><td><a href=".gitbook/assets/tracing-designed.png">tracing-designed.png</a></td></tr><tr><td align="center"><strong>Prompt Playground</strong></td><td><a href="prompt-engineering/quickstart-prompts/">quickstart-prompts</a></td><td><a href=".gitbook/assets/prompt-playground-designed.png">prompt-playground-designed.png</a></td></tr><tr><td align="center"><strong>Datasets and Experiments</strong></td><td><a href="datasets-and-experiments/quickstart-datasets.md">quickstart-datasets.md</a></td><td><a href=".gitbook/assets/experiments_preview.png">experiments_preview.png</a></td></tr><tr><td align="center"><strong>Evaluation</strong></td><td><a href="evaluation/evals.md">evals.md</a></td><td><a href=".gitbook/assets/evals-designed.png">evals-designed.png</a></td></tr><tr><td align="center"><strong>Inferences</strong></td><td><a href="inferences/phoenix-inferences.md">phoenix-inferences.md</a></td><td><a href=".gitbook/assets/Screenshot 2023-09-27 at 1.53.06 PM.png">Screenshot 2023-09-27 at 1.53.06 PM.png</a></td></tr></tbody></table>

## Next Steps

### [Try our Tutorials](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/jl0P6vk8OJiHMr4yNY0U/)

Check out a comprehensive list of example notebooks for LLM Traces, Evals, RAG Analysis, and more.

### [Add Integrations](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/C8re8QzKV5m48pbcFkBp/)

Add instrumentation for popular packages and libraries such as OpenAI, LangGraph, Vercel AI SDK and more.

### [Community](https://join.slack.com/t/arize-ai/shared_invite/zt-2w57bhem8-hq24MB6u7yE_ZF_ilOYSBw)

Join the Phoenix Slack community to ask questions, share findings, provide feedback, and connect with other developers.
