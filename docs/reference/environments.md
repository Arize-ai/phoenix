---
description: >-
  The Phoenix app can be run in various notebook environments such as colab and
  SageMaker as well as be served via the terminal or a docker container
---

# Environments

Phoenix app is first and foremost an application that can be run just in in your notebook! This makes it an extremely flexible app since it can be accessed directly as you iterate on your AI-powered app!\


### Notebooks

Currently phoenix supports local, colab, databricks, and SageMaker notebooks.

{% hint style="warning" %}
Note, phoenix only supports running the phoenix server via the notebook for SageMaker notebooks. It cannot setup proxy requests for SageMaker studio since there is no support of jupyter-server-proxy
{% endhint %}

#### SageMaker

With SageMaker notebooks, phoenix leverages the [jupyter-server-proy](https://github.com/jupyterhub/jupyter-server-proxy) to host the server under `proxy/6006.`Note, that phoenix will automatically try to detect that you are running in SageMaker but you can declare the notebook runtime via a parameter to `launch_app` or an environment variable

{% tabs %}
{% tab title="Environment Variable" %}
```python
import os

os.envoron["PHOENIX_NOTEBOOK_ENV"] = "sagemaker"
```
{% endtab %}

{% tab title="Launch Parameter" %}
```python
import phoenix as px

px.launch_app(notebook_environment="sagemaker")
```
{% endtab %}
{% endtabs %}

### Container

{% hint style="info" %}
Container images are still actively being worked on. If you are interested in hosted phoenix, please get in touch!
{% endhint %}

Phoenix server images are now available via [Docker Hub](https://hub.docker.com/r/arizephoenix/phoenix). The hosted phoenix server runs as a trace collector and can be used if you want observability for LLM traces via docker compose or simply want a long-running phoenix instance.

If you deploy the phoenix server (collector) to a remote machine, you will have to make sure to configure the remote endpoint as the collector endpoint. (This feature is only available after phoenix **1.3.x**)

{% tabs %}
{% tab title="Set Endpoint Environment Variable" %}
```python
import os

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://my-phoenix.io"
```
{% endtab %}

{% tab title="Set Endpoint in Code" %}
```python
from phoenix.trace.tracer import Tracer
from phoenix.trace.exporter import HttpExporter
from phoenix.trace.openai.instrumentor import OpenAIInstrumentor


tracer = Tracer(exporter=HttpExporter(endpoint="https://my-phoenix.io"))
OpenAIInstrumentor(tracer).instrument()
```
{% endtab %}
{% endtabs %}

