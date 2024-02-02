---
description: How to install Phoenix for Observability and evaluation
---

# Installation

## Python

In your Jupyter or Colab environment, run the following command to install.

{% tabs %}
{% tab title="Using pip" %}
```sh
pip install arize-phoenix
```
{% endtab %}

{% tab title="Using conda" %}
```sh
conda install -c conda-forge arize-phoenix
```
{% endtab %}
{% endtabs %}

Note that the above only installs dependencies that are necessary to run the application. Phoenix also has an experimental sub-module where you can find [LLM Evals](llm-evals/llm-evals.md).

```sh
pip install arize-phoenix[experimental]
```

\
Once installed, import Phoenix in your notebook with

```python
import phoenix as px
```

{% hint style="info" %}
Phoenix is supported on Python ≥3.8, <3.11.
{% endhint %}

## Container

Using docker you can run the phoenix server as a container. &#x20;

```
docker run -p 6006:6006 arizephoenix/phoenix:latest
```

{% hint style="info" %}
The commend above will run phoenix latest but you might want to use a specific image tag. The image tags correspond with the releases of phoenix on Pypi and Conda.
{% endhint %}
