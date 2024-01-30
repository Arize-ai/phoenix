---
description: How to use phoenix outside of the notebook environment.
---

# Deploying Phoenix

Phoenix's notebook-first approach to observability makes it a great tool to utilize during experimentation and pre-production. However at some point you are going to want to ship your application to production and continue to monitor your application as it runs.&#x20;

Phoenix is made up of two components that can be deployed independently:

* **Trace Instrumentation**: These are a set of plugins that can be added to your application's startup process. These plugins (known as instrumentations) automatically collect spans for your application and export them for collection and visualization. For phoenix, all the instrumentors are managed via a single repository called [OpenInference](https://github.com/Arize-ai/openinference)
* **Trace Collector (e.g. the Phoenix Server)**: The Phoenix server acts as a trace collector and application that helps you troubleshoot your application in real time.

In order to run Phoenix tracing in production, you will have to follow these following steps:

1. **Setup:** your LLM application to run on a server
2. **Instrument**: Add [OpenInference](https://github.com/Arize-ai/openinference) Instrumentation to your server&#x20;
3. **Observe**: Run the Phoenix server as a side-car or a standalone instance and point your tracing instrumentation to the phoenix server

Below are example repositories of how to setup an LLM application in Python and Javascript

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th></th><th></th><th data-hidden data-card-target data-type="content-ref"></th><th data-hidden data-card-cover data-type="files"></th></tr></thead><tbody><tr><td><strong>Python</strong></td><td>Example deployments using Fast API, LlamaIndex</td><td></td><td><a href="https://github.com/Arize-ai/openinference/tree/main/python/examples">https://github.com/Arize-ai/openinference/tree/main/python/examples</a></td><td><a href="../.gitbook/assets/python.png">python.png</a></td></tr><tr><td><strong>Javascript</strong></td><td>Deploy using NodeJS, Express</td><td></td><td><a href="https://github.com/Arize-ai/openinference/tree/main/js/examples">https://github.com/Arize-ai/openinference/tree/main/js/examples</a></td><td><a href="../.gitbook/assets/javascript.png">javascript.png</a></td></tr></tbody></table>

### Setup a Server

Setting up a server to run your LLM application can be tricky to bootstrap. While bootstrapping and LLM application is not part of Phoenix, you can take a look at some of our examples:

### Instrument

