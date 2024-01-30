---
description: >-
  The Phoenix app can be run in various notebook environments such as colab and
  SageMaker as well as be served via the terminal or a docker container
---

# Environments

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/environments.png" alt=""><figcaption><p>Phoenix can be run locally, via a cloud notebook, or as a container</p></figcaption></figure>

Phoenix app is first and foremost an application that can be run just in in your notebook! This makes it an extremely flexible app since it can be accessed directly as you iterate on your AI-powered app!\


{% hint style="info" %}
Looking how to deploy Phoenix outside of the notebook? Checkout the [deployment guide.](deployment/deploying-phoenix.md)
{% endhint %}

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

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "http://123.456.789:6006"
```
{% endtab %}

{% tab title="Set Endpoint in Code" %}
```python
from phoenix.trace.tracer import Tracer
from phoenix.trace.exporter import HttpExporter
from phoenix.trace.openai.instrumentor import OpenAIInstrumentor


tracer = Tracer(exporter=HttpExporter(endpoint="http://123.456.789:6006"))
OpenAIInstrumentor(tracer).instrument()
```
{% endtab %}
{% endtabs %}

Note that the above is only necessary if your application is running in a Jupyter notebook. If you are trying to deploy your application and have phoenix collect traces via a container, please consult the [deployment guide.](deployment/deploying-phoenix.md)

### Terminal

If you want to start a phoenix server to collect traces, you can also run phoenix directly from the command line

```python
python3 -m phoenix.server.main serve
```

This will start the phoenix server on port 6006. If you are running your instrumented notebook or application on the same machine, traces should automatically be exported to `http://127.0.0.1:6006` so no additional configuration is needed. However if the server is running remotely, you will have to modify the environment variable `PHOENIX_COLLECTOR_ENDPOINT` to point to that machine (e.g. `http://<my-remote-machine>:<port>`)

Note that this command has various configuration options such as `--host` and `--port`. For example:

```
python3 -m phoenix.server.main serve --port 1234 --host 0.0.0.0
```

### Configuration

Whether you are using phoenix in a notebook or via a container, you can configure it's runtime via the following environment variables. Note that none of these are required.

* **PHOENIX\_PORT:** The port to run the phoenix server. Defaults to 6006 (since this port works best with other tools like SageMaker notebooks. )
* &#x20;**PHOENIX\_HOST:** The host to run the phoenix server. Defaults to 0.0.0.0&#x20;
* **PHOENIX\_NOTEBOOK\_ENV:** The notebook environment. Typically you do not need to set this but it can be set explicitly (e.x. `sagemaker`)
* **PHOENIX\_COLLECTOR\_ENDPOINT:** The endpoint traces and evals are sent to. This must be set if the Phoenix server is running on a remote instance. For example if phoenix is running at `http://125.2.3.5:4040` , this environment variable must be set where your LLM application is running and being traced. Note that the endpoint should not contain trailing slashes or slugs.
* &#x20;**PHOENIX\_WORKING\_DIR:** The directory in which to save, load, and export datasets. This directory must be accessible by both the Phoenix server and the notebook environment.&#x20;
