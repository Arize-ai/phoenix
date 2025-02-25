---
description: AI Observability and Evaluation
---

# Arize Phoenix

Phoenix is an open-source observability library designed for experimentation, evaluation, and troubleshooting. It allows AI Engineers and Data Scientists to quickly visualize their data, evaluate performance, track down issues, and export data to improve.\
\
Phoenix is built by [Arize AI](https://www.arize.com), the company behind the industry-leading AI observability platform, and a set of core contributors.

## Install Phoenix

{% tabs %}
{% tab title="pip" %}
In your Python, Jupyter, or Colab environment, run the following command to install.

```sh
pip install arize-phoenix
```

For full details on how to run phoenix in various environments such as Databricks, consult our [environments guide.](environments.md)
{% endtab %}

{% tab title="conda" %}
```sh
conda install -c conda-forge arize-phoenix[evals]
```
{% endtab %}

{% tab title="Container" %}
Phoenix can also run via a container. The image can be found at:

{% embed url="https://hub.docker.com/r/arizephoenix/phoenix" %}
Images for phoenix are published to dockerhub
{% endembed %}

Checkout the [environments section](environments.md) and [deployment guide](deployment/deploying-phoenix.md) for details.
{% endtab %}

{% tab title="npm" %}
The Phoenix server can be run as a [#container](./#container "mention")and be interacted with using the phoenix-client  and OpenTelelemetry. See [#packages](./#packages "mention") below.
{% endtab %}
{% endtabs %}

Phoenix works with OpenTelemetry and [OpenInference](https://github.com/Arize-ai/openinference) instrumentation. If you are looking to deploy phoenix as a service rather than a library, see [deployment](deployment/ "mention")

## What you can do in Phoenix

{% tabs %}
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

{% tab title="Tracing" %}
{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/tracing.mp4" %}
Tracing in Phoenix
{% endembed %}

[Tracing](tracing/llm-traces/) is a helpful tool for understanding how your LLM application works. Phoenix's open-source library offers comprehensive tracing capabilities that are not tied to any specific LLM vendor or framework.&#x20;

Phoenix accepts traces over the OpenTelemetry protocol (OTLP) and supports first-class instrumentation for a variety of frameworks ([LlamaIndex](tracing/integrations-tracing/llamaindex.md), [LangChain](tracing/integrations-tracing/langchain.md),[ DSPy](tracing/integrations-tracing/dspy.md)), SDKs ([OpenAI](tracing/integrations-tracing/openai.md), [Bedrock](tracing/integrations-tracing/bedrock.md), [Mistral](tracing/integrations-tracing/mistralai.md), [Vertex](tracing/integrations-tracing/vertexai.md)), and Languages. ([Python](tracing/how-to-tracing/setup-tracing-python.md), [Javascript](tracing/how-to-tracing/javascript.md), etc.)
{% endtab %}

{% tab title="Evaluation" %}
{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/evals.mp4" %}
Evals in the Phoenix UI
{% endembed %}

Phoenix is built to help you [evaluate your application](evaluation/llm-evals.md) and understand their true performance. To accomplish this, Phoenix includes:

* A standalone library to [run LLM-based evaluations](evaluation/how-to-evals/running-pre-tested-evals/) on your own datasets. This can be used either with the Phoenix library, or independently over your own data.
* [Direct integration of LLM-based and code-based evaluators](evaluation/how-to-evals/evaluating-phoenix-traces.md) into the Phoenix dashboard. Phoenix is built to be agnostic, and so these evals can be generated using Phoenix's library, or an external library like [Ragas](https://docs.ragas.io/), [Deepeval](https://github.com/confident-ai/deepeval), or [Cleanlab](https://cleanlab.ai/).
* [Human annotation capabilities](tracing/llm-traces/how-to-annotate-traces.md) to attach human ground truth labels to your data in Phoenix.
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

<table data-card-size="large" data-view="cards"><thead><tr><th align="center"></th><th data-hidden data-card-target data-type="content-ref"></th><th data-hidden data-card-cover data-type="files"></th></tr></thead><tbody><tr><td align="center"><strong>Tracing</strong></td><td><a href="tracing/llm-traces-1.md">llm-traces-1.md</a></td><td><a href=".gitbook/assets/Screenshot 2023-09-27 at 1.51.45 PM.png">Screenshot 2023-09-27 at 1.51.45 PM.png</a></td></tr><tr><td align="center"><strong>Prompt Playground</strong></td><td><a href="prompt-engineering/quickstart-prompts.md">quickstart-prompts.md</a></td><td><a href=".gitbook/assets/prompt_playground.png">prompt_playground.png</a></td></tr><tr><td align="center"><strong>Datasets and Experiments</strong></td><td><a href="datasets-and-experiments/quickstart-datasets.md">quickstart-datasets.md</a></td><td><a href=".gitbook/assets/experiments_preview.png">experiments_preview.png</a></td></tr><tr><td align="center"><strong>Evaluation</strong></td><td><a href="evaluation/evals.md">evals.md</a></td><td><a href=".gitbook/assets/evals.png">evals.png</a></td></tr><tr><td align="center"><strong>Inferences</strong></td><td><a href="inferences/phoenix-inferences.md">phoenix-inferences.md</a></td><td><a href=".gitbook/assets/Screenshot 2023-09-27 at 1.53.06 PM.png">Screenshot 2023-09-27 at 1.53.06 PM.png</a></td></tr></tbody></table>

## Packages

The main Phoenix package is arize-phoenix. We offer several packages below for specific use cases.

{% tabs %}
{% tab title="Python" %}
| Package                            | What It's For                                                                                                                                                                                                                                                                                                                        | Pypi                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| arize-phoenix                      | <p>Running and connecting to the Phoenix client. Used:<br>- Self-hosting Phoenix<br>- Connecting to a Phoenix client (either Phoenix Developer Edition or self-hosted) to query spans, run evaluations, generate datasets, etc.<br><br><em>*arize-phoenix automatically includes arize-phoenix-otel and arize-phoenix evals</em></p> | <img src="https://img.shields.io/pypi/v/arize-phoenix" alt="PyPI - Version" data-size="original">                      |
| arize-phoenix-otel                 | Sending OpenTelemetry traces to a Phoenix instance                                                                                                                                                                                                                                                                                   | <img src="https://img.shields.io/pypi/v/arize-phoenix-otel" alt="PyPI - Version" data-size="original">                 |
| arize-phoenix-evals                | Running evaluations in your  environment                                                                                                                                                                                                                                                                                             | <img src="https://img.shields.io/pypi/v/arize-phoenix-evals" alt="PyPI - Version" data-size="original">                |
| openinference-semantic-conventions | Our semantic layer to add LLM telemetry to OpenTelemetry                                                                                                                                                                                                                                                                             | <img src="https://img.shields.io/pypi/v/openinference-semantic-conventions" alt="PyPI - Version" data-size="original"> |
| openinference-instrumentation-xxxx | Automatically instrumenting popular packages.                                                                                                                                                                                                                                                                                        | See [integrations-tracing](tracing/integrations-tracing/ "mention")                                                    |
{% endtab %}

{% tab title="TypeScript" %}
| Package                                     | What It's For                                             | npm                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @arizeai/phoenix-client                     | <p>Running and connecting to the Phoenix server. <br></p> | <p></p><p><img src="https://img.shields.io/npm/v/%40arizeai%2Fphoenix-client" alt="" data-size="original"></p><p></p>                                                                                                                                                                                                                                     |
| @arizeai/openinference-semantic-conventions | Our semantic layer to add LLM telemetry to OpenTelemetry  | [![NPM Version](https://camo.githubusercontent.com/f07855cea656dfd0b211d48c68d5daf456895f4be38862db0fadbb3408716018/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f406172697a6561692f6f70656e696e666572656e63652d73656d616e7469632d636f6e76656e74696f6e732e737667)](https://www.npmjs.com/package/@arizeai/openinference-semantic-conventions) |
| @aizeai/openinference-instrumentation-xxxx  | Automatically instrumenting popular packages.             | See [integrations-tracing](tracing/integrations-tracing/ "mention")                                                                                                                                                                                                                                                                                       |
{% endtab %}
{% endtabs %}

## Next Steps

### [Try our Tutorials](notebooks.md)

Check out a comprehensive list of example notebooks for LLM Traces, Evals, RAG Analysis, and more.

### [Community](https://join.slack.com/t/arize-ai/shared_invite/zt-2w57bhem8-hq24MB6u7yE_ZF_ilOYSBw)

Join the Phoenix Slack community to ask questions, share findings, provide feedback, and connect with other developers.
