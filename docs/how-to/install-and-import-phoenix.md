---
description: How to fly with Phoenix
---

# Install and Import Phoenix

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

Note that the above only installs dependancies that are necessary to run the application. Phoenix also has an experimental sub-module where you can find [LLM Evals](../concepts/llm-evals.md).

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
