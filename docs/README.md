---
description: AI Observability and Evaluation
---

# Arize Phoenix

Phoenix is an open-source observability library designed for experimentation, evaluation, and troubleshooting. It allows AI Engineers and Data Scientists to quickly visualize their data, evaluate performance, track down issues, and export data to improve.\
\
Phoenix is built by [Arize AI](https://www.arize.com), the company behind the the industry-leading AI observability platform, and a set of core contributors.

## Install Phoenix

{% tabs %}
{% tab title="Using pip" %}
In your Jupyter or Colab environment, run the following command to install.

```sh
pip install arize-phoenix
```

For full details on how to run phoenix in various environments such as Databricks, consult our [environments guide.](deployment/environments.md)
{% endtab %}

{% tab title="Using conda" %}
```sh
conda install -c conda-forge arize-phoenix[evals]
```
{% endtab %}

{% tab title="Container" %}
Phoenix can also run via a container. The image can be found at:

{% embed url="https://hub.docker.com/r/arizephoenix/phoenix" %}
Images for phoenix are published to dockerhub
{% endembed %}

Checkout the [environments section](deployment/environments.md) and [deployment guide](deployment/deploying-phoenix.md) for details.
{% endtab %}
{% endtabs %}

Phoenix works with OpenTelemetry and [OpenInference](https://github.com/Arize-ai/openinference) instrumentation. If you are looking to deploy phoenix as a service rather than a library, see [deployment](deployment/ "mention")



## Quickstarts

Running Phoenix for the first time? Select a quickstart below.

<table data-card-size="large" data-view="cards"><thead><tr><th align="center"></th><th data-hidden data-card-target data-type="content-ref"></th><th data-hidden data-card-cover data-type="files"></th></tr></thead><tbody><tr><td align="center"><strong>Tracing</strong></td><td><a href="tracing/llm-traces-1.md">llm-traces-1.md</a></td><td><a href=".gitbook/assets/Screenshot 2023-09-27 at 1.51.45 PM.png">Screenshot 2023-09-27 at 1.51.45 PM.png</a></td></tr><tr><td align="center"><strong>Evaluation</strong></td><td><a href="evaluation/evals.md">evals.md</a></td><td><a href=".gitbook/assets/evals.png">evals.png</a></td></tr><tr><td align="center"><strong>Inferences</strong></td><td><a href="inferences/phoenix-inferences.md">phoenix-inferences.md</a></td><td><a href=".gitbook/assets/Screenshot 2023-09-27 at 1.53.06 PM.png">Screenshot 2023-09-27 at 1.53.06 PM.png</a></td></tr><tr><td align="center"><strong>Datasets and Experiments</strong></td><td><a href="datasets-and-experiments/quickstart-datasets.md">quickstart-datasets.md</a></td><td><a href=".gitbook/assets/experiments_preview.png">experiments_preview.png</a></td></tr></tbody></table>

## Available Packages

The main Phoenix package is arize-phoenix. We offer several helper packages below for specific use cases.

| Package                            | What It's For                                                                                                                                                                                                                                                                                                                        | Pypi                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| arize-phoenix                      | <p>Running and connecting to the Phoenix client. Used:<br>- Self-hosting Phoenix<br>- Connecting to a Phoenix client (either Phoenix Developer Edition or self-hosted) to query spans, run evaluations, generate datasets, etc.<br><br><em>*arize-phoenix automatically includes arize-phoenix-otel and arize-phoenix evals</em></p> | <img src="https://img.shields.io/pypi/v/arize-phoenix" alt="PyPI - Version" data-size="original">                      |
| arize-phoenix-otel                 | Sending OpenTelemetry traces to a Phoenix instance                                                                                                                                                                                                                                                                                   | <img src="https://img.shields.io/pypi/v/arize-phoenix-otel" alt="PyPI - Version" data-size="original">                 |
| arize-phoenix-evals                | Running evaluations in your  environment                                                                                                                                                                                                                                                                                             | <img src="https://img.shields.io/pypi/v/arize-phoenix-evals" alt="PyPI - Version" data-size="original">                |
| openinference-semantic-conventions | Our semantic layer to add LLM telemetry to OpenTelemetry                                                                                                                                                                                                                                                                             | <img src="https://img.shields.io/pypi/v/openinference-semantic-conventions" alt="PyPI - Version" data-size="original"> |
| openinference-instrumentation-xxxx | Automatically instrumenting popular packages.                                                                                                                                                                                                                                                                                        | See [integrations-tracing](tracing/integrations-tracing/ "mention")                                                    |

## Next Steps

### [Try our Tutorials](notebooks.md)

Check out a comprehensive list of example notebooks for LLM Traces, Evals, RAG Analysis, and more.

### [Community](https://join.slack.com/t/arize-ai/shared\_invite/zt-1ppbtg5dd-1CYmQO4dWF4zvXFiONTjMg)

Join the Phoenix Slack community to ask questions, share findings, provide feedback, and connect with other developers.
