---
description: AI Observability and Evaluation
---

# Arize Phoenix

Phoenix is an open-source observability library designed for experimentation, evaluation, and troubleshooting. It allows AI Engineers and Data Scientists to quickly visualize their data, evaluate performance, track down issues, and export data to improve.\
\
Phoenix is built by [Arize AI](https://www.arize.com), the company behind the the industry-leading AI observability platform,  and a set of core contributors.

## Install Phoenix

{% tabs %}
{% tab title="Using pip" %}
In your Jupyter or Colab environment, run the following command to install.

```sh
pip install arize-phoenix[evals]
```

For full details on how to run phoenix in various environments such as Databricks, consult our [environments guide.](environments.md)
{% endtab %}

{% tab title="Using conda" %}
```sh
conda install -c conda-forge arize-phoenix[evals]
```
{% endtab %}

{% tab title="Container" %}
Phoenix can also run via a container. The image can be found at:

{% embed url="https://hub.docker.com/r/arizephoenix/phoenix" %}

Checkout the [environments section](environments.md) and [deployment guide](reference/deploying-phoenix.md) for details.
{% endtab %}
{% endtabs %}

## Quickstarts

Running Phoenix for the first time? Select a quickstart below.&#x20;

<table data-card-size="large" data-view="cards"><thead><tr><th align="center"></th><th data-hidden data-card-target data-type="content-ref"></th><th data-hidden data-card-cover data-type="files"></th></tr></thead><tbody><tr><td align="center"><strong>Tracing</strong> </td><td><a href="quickstart/llm-traces.md">llm-traces.md</a></td><td><a href=".gitbook/assets/Screenshot 2023-09-27 at 1.51.45 PM.png">Screenshot 2023-09-27 at 1.51.45 PM.png</a></td></tr><tr><td align="center"><strong>Evaluation</strong></td><td><a href="quickstart/evals.md">evals.md</a></td><td><a href=".gitbook/assets/evals.png">evals.png</a></td></tr><tr><td align="center"><strong>Inferences</strong></td><td><a href="quickstart/phoenix-inferences/">phoenix-inferences</a></td><td><a href=".gitbook/assets/Screenshot 2023-09-27 at 1.53.06 PM.png">Screenshot 2023-09-27 at 1.53.06 PM.png</a></td></tr></tbody></table>

### Demo

{% embed url="https://www.loom.com/share/a96e244c4ff8473d9350b02ccbd203b4" %}
Overview of Phoenix Tracing
{% endembed %}

## Next Steps

### [Try our Tutorials](notebooks.md)

Check out a comprehensive list of example notebooks for LLM Traces, Evals, RAG Analysis, and more. &#x20;

### [Community](https://join.slack.com/t/arize-ai/shared\_invite/zt-1ppbtg5dd-1CYmQO4dWF4zvXFiONTjMg)

Join the Phoenix Slack community to ask questions, share findings, provide feedback, and connect with other developers.&#x20;

