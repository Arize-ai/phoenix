---
description: How to use phoenix outside of the notebook environment.
---

# Deploying Phoenix

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/deployment.png" alt=""><figcaption><p>The phoenix server can be run as a collector of spans over OTLP</p></figcaption></figure>



Phoenix's notebook-first approach to observability makes it a great tool to utilize during experimentation and pre-production. However at some point you are going to want to ship your application to production and continue to monitor your application as it runs.&#x20;

Phoenix is made up of two components that can be deployed independently:

* **Trace Instrumentation**: These are a set of plugins that can be added to your application's startup process. These plugins (known as instrumentations) automatically collect spans for your application and export them for collection and visualization. For phoenix, all the instrumentors are managed via a single repository called [OpenInference](https://github.com/Arize-ai/openinference)
* **Trace Collector**: The Phoenix server acts as a trace collector and application that helps you troubleshoot your application in real time.

In order to run Phoenix tracing in production, you will have to follow these following steps:

1. [**Setup a Server**](deploying-phoenix.md#setup-a-server)**:** your LLM application to run on a server
2. [**Instrument**](deploying-phoenix.md#instrument): Add [OpenInference](https://github.com/Arize-ai/openinference) Instrumentation to your server&#x20;
3. **Observe**: Run the Phoenix server as a side-car or a standalone instance and point your tracing instrumentation to the phoenix server

## Working Examples

Below are example repositories of how to setup an LLM application in Python and Javascript

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th></th><th></th><th data-hidden data-card-target data-type="content-ref"></th><th data-hidden data-card-cover data-type="files"></th></tr></thead><tbody><tr><td><strong>Python</strong></td><td>Example deployments using Fast API, LlamaIndex</td><td></td><td><a href="https://github.com/Arize-ai/openinference/tree/main/python/examples">https://github.com/Arize-ai/openinference/tree/main/python/examples</a></td><td><a href="../.gitbook/assets/python.png">python.png</a></td></tr><tr><td><strong>Javascript</strong></td><td>Deploy using NodeJS, Express</td><td></td><td><a href="https://github.com/Arize-ai/openinference/tree/main/js/examples">https://github.com/Arize-ai/openinference/tree/main/js/examples</a></td><td><a href="../.gitbook/assets/javascript.png">javascript.png</a></td></tr></tbody></table>

## Setup a Server

Setting up a server to run your LLM application can be tricky to bootstrap. While bootstrapping and LLM application is not part of Phoenix, you can take a look at some of examples from our partners.

* [**create-llama**](https://blog.llamaindex.ai/create-llama-a-command-line-tool-to-generate-llamaindex-apps-8f7683021191): A bootstrapping tool for setting up a full-stack LlamaIndex app
* [**langchain-templates**](https://github.com/langchain-ai/langchain/blob/master/templates/README.md): Create a Langchain server using a template

{% hint style="info" %}
Note that the above scripts and templates are provided purely as examples
{% endhint %}

## Instrument

<div data-full-width="true">

<figure><img src="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/main/logos/OpenInference/Full%20color/OI-full-horiz.svg" alt="" width="563"><figcaption></figcaption></figure>

</div>

In order to make your LLM application observable, it must be instrumented. That is, the code must emit traces. The instrumented data must then be sent to an Observability backend, in our case the Phoenix server.

Phoenix collects traces from your running application using OTLP (OpenTelemetry Protocol). Notably, Phoenix accepts traces produced via instrumentation provided by [OpenInference](https://github.com/Arize-ai/openinference). OpenInference instrumentations automatically instrument your code so that LLM Traces can be exported and collected by Phoenix. To learn more about instrumentation, check out the full details [here](instrumentation.md).

OpenInference currently supports instrumenting your application in both Python and Javascript.  For each of these languages, you will first need to install the `opentelemetry` and `openinference` packages necessary to trace your application.

### Install OpenTelemetry

{% tabs %}
{% tab title="Python Dependancies" %}
{% hint style="info" %}
For a comprehensive guide to python instrumentation, please consult [OpenTelemetry's guide](https://opentelemetry.io/docs/languages/python/)
{% endhint %}

### Install OpenTelemetry packages

```
pip install opentelemetry-api opentelemetry-instrumentation opentelemetry-semantic-conventions = "*"
```
{% endtab %}

{% tab title="Javascript Dependancies" %}
{% hint style="info" %}
For a comprehensive guide on instrumenting NodeJS using OpenTelemetry, consult their [guide](https://opentelemetry.io/docs/languages/js/)
{% endhint %}

```
npm install  @opentelemetry/exporter-trace-otlp-proto @opentelemetry/resources @opentelemetry/sdk-trace-node --save
```
{% endtab %}
{% endtabs %}

### Install OpenInference

To have your code produce LLM spance using OpenInference, you must pick the appropriate instrumentation packages and install them using a package manager.

{% tabs %}
{% tab title="Python Packages" %}
| Package                                                                                                                                                                        | Description                                    | Version                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`openinference-semantic-conventions`](https://github.com/Arize-ai/openinference/blob/main/python/openinference-semantic-conventions/README.md)                                | Semantic conventions for tracing of LLM Apps.  | [![PyPI Version](https://camo.githubusercontent.com/9a08bbaf1640e94354c1a85146fdd40afd89b2f8aeb6574baa7c1b846ac7792d/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d73656d616e7469632d636f6e76656e74696f6e732e737667)](https://pypi.python.org/pypi/openinference-semantic-conventions)                      |
| [`openinference-instrumentation-openai`](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-openai/README.rst)           | OpenInference Instrumentation for OpenAI SDK.  | [![PyPI Version](https://camo.githubusercontent.com/bb515c29aa0ef45bff47e0510f59ed6701c43457a90d574f537e43c24de9d80f/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6f70656e61692e737667)](https://pypi.python.org/pypi/openinference-instrumentation-openai)                |
| [`openinference-instrumentation-llama-index`](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-llama-index/README.rst) | OpenInference Instrumentation for LlamaIndex.  | [![PyPI Version](https://camo.githubusercontent.com/f9b5663c14435cd2e280675aee8a86f23b1802679514ddbd9cd6d7b5e5d51a06/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6c6c616d612d696e6465782e737667)](https://pypi.python.org/pypi/openinference-instrumentation-llama-index) |
| [`openinference-instrumentation-dspy`](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-dspy/README.rst)               | OpenInference Instrumentation for DSPy.        | [![PyPI Version](https://camo.githubusercontent.com/414d13608ed7dd45f47e813034d6934993bcb49394a51910fa2f037efb4cd891/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d647370792e737667)](https://pypi.python.org/pypi/openinference-instrumentation-dspy)                      |
| [`openinference-instrumentation-bedrock`](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-bedrock/README.rst)         | OpenInference Instrumentation for AWS Bedrock. | [![PyPI Version](https://camo.githubusercontent.com/98735a9c821fdb27bf3c29ccf513af8de1fba8878bd6e424ee42f8c971df1afe/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d626564726f636b2e737667)](https://pypi.python.org/pypi/openinference-instrumentation-bedrock)             |
| [`openinference-instrumentation-langchain`](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-langchain/README.rst)     | OpenInference Instrumentation for LangChain.   | [![PyPI Version](https://camo.githubusercontent.com/17d2c9f2d42d6dd80a5e0defeed3d7d346444231761194d328e9f21b57c18eae/68747470733a2f2f696d672e736869656c64732e696f2f707970692f762f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6c616e67636861696e2e737667)](https://pypi.python.org/pypi/openinference-instrumentation-langchain)       |
{% endtab %}

{% tab title="Javascript Packages" %}
| Package                                                                                                                                                           | Description                                   | Version                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@arizeai/openinference-semantic-conventions`](https://github.com/Arize-ai/openinference/blob/main/js/packages/openinference-semantic-conventions/README.md)     | Semantic conventions for tracing of LLM Apps. | [![NPM Version](https://camo.githubusercontent.com/43381a7078fce4f511768ea1941bb98a035955f0d79d02f4a3de58f9b7edf727/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f406172697a6561692f6f70656e696e666572656e63652d73656d616e7469632d636f6e76656e74696f6e732e737667)](https://www.npmjs.com/package/@arizeai/openinference-semantic-conventions) |
| [`@arizeai/openinference-instrumentation-openai`](https://github.com/Arize-ai/openinference/blob/main/js/packages/openinference-instrumentation-openai/README.md) | OpenInference Instrumentation for OpenAI SDK. | [![NPM Version](https://camo.githubusercontent.com/e8d7d683994696e16d7620368f72a71929485bbfaad93848edfa813f631d53e2/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f406172697a6561692f6f70656e696e666572656e63652d696e737472756d656e746174696f6e2d6f70656e6169)](https://www.npmjs.com/package/@arizeai/openinference-instrumentation-openai)   |
{% endtab %}
{% endtabs %}

### Initialize Instrumentation

In order for your application to export traces, it must be instrumented using OpenInference instrumentors. Note that instrumentation strategies differ by language so please consult OpenTelemetry's [guidelines for full details.](https://opentelemetry.io/docs/languages/)

{% hint style="info" %}
Note that the below examples assume you are running phoenix via docker compose and thus simply have the URL http://phoenix:6006. If you are deploying phoenix separately, replace this string with the full URL of your running phoenix instance&#x20;
{% endhint %}

{% tabs %}
{% tab title="Python" %}
Below is a example of what instrumentation might look like for LlamaIndex. `instrument` should be called before `main` is run in your server.

```python
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor


def instrument():
    resource = Resource(attributes={})
    tracer_provider = trace_sdk.TracerProvider(resource=resource)
    span_exporter = OTLPSpanExporter(endpoint="http://phoenix:6006/v1/traces")
    span_processor = SimpleSpanProcessor(span_exporter=span_exporter)
    tracer_provider.add_span_processor(span_processor=span_processor)
    trace_api.set_tracer_provider(tracer_provider=tracer_provider)
    LlamaIndexInstrumentor().instrument()
```
{% endtab %}

{% tab title="Javascript" %}
{% hint style="danger" %}
Code below is written in ESM format
{% endhint %}

For instrumentation to work with NodeJS to work, you must create a file `instrumentation.js` and have it run **BEFORE** all other server code in `index.js`

place the following code in a `instrumentation.js` file&#x20;

```typescript
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { Resource } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "openai-service",
  }),
});

provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
provider.addSpanProcessor(
  new SimpleSpanProcessor(
    new OTLPTraceExporter({
      url: "http://localhost:6006/v1/traces",
    }),
  ),
);
provider.register();

registerInstrumentations({
  instrumentations: [new OpenAIInstrumentation({})],
});

console.log("👀 OpenInference initialized");// Some code
```

Then make sure that this file is required before running the server.

```
node -r instrumentation.js index.js
```
{% endtab %}
{% endtabs %}

## Observe

Lastly, we must run the phoenix server so that our application can export spans to it. To do this, we recommend running phoenix via an image. Phoenix images are available via dockerhub.

{% embed url="https://hub.docker.com/repository/docker/arizephoenix/phoenix/general" %}

In order to run the phoenix server, you will have to start the application. Below are a few examples of how you can run the application on your local machine.

{% tabs %}
{% tab title="Docker" %}
Pull the image you would like to run

```
docker pull arizephoenix/phoenix
```

Pick an image you would like to run or simply run the latest:

```
docker run -i -t arizephoenix/phoenix:latest
```
{% endtab %}

{% tab title="Command Line" %}
```
python3 -m phoenix.server.main serve --port 6006
```
{% endtab %}
{% endtabs %}

Note that the above simply starts the phoenix server locally. A simple way to make sure your application always has a running phoenix server as a collector is to run the phoenix server as a side car.

here is a n example **compose.yaml**

```yaml
services:
  phoenix:
    image: arizephoenix/phoenix:latest
    ports:
      - "6006:6006"
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      args:
        OPENAI_API_KEY: ${OPENAI_API_KEY}
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - COLLECTOR_ENDPOINT=http://phoenix:6006/v1/traces
      - PROD_CORS_ORIGIN=http://localhost:3000
      # Set INSTRUMENT_LLAMA_INDEX=false to disable instrumentation
      - INSTRUMENT_LLAMA_INDEX=true
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://0.0.0.0:8000/api/chat/healthcheck"]
      interval: 5s
      timeout: 1s
      retries: 5
  frontend:
    build: frontend
    ports:
      - "3000:3000"
    depends_on:
      backend:
        condition: service_healthy
```

This way you will always have a running phenix instance when you run

```
docker compose up
```







\
