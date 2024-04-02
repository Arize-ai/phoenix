# Manually Instrument Your LLM Applications

This example shows how to manually instrument an LLM application using OpenTelemetry with OpenInference semantic conventions. Once instrumented, your application will produce trace data that can be collected and analyzed using Arize and Phoenix.

This implementation uses a FastAPI backend and a Streamlit frontend. It provides a reference not only for Python developers who wish to manually instrument their bespoke applications, but also for developers in statically compiled languages for which auto-instrumentation is not possible.


## Background

[OpenTelemetry](https://opentelemetry.io/) (OTel) is an open-source observability framework that provides APIs, libraries, and instrumentation to collect and export telemetry data (metrics, logs, and traces). OTel provides a unified and vendor-agnostic way to collect observability data, enabling developers to get a comprehensive view into their systems.

[OpenInference](https://github.com/Arize-ai/openinference) is a set of OTel-compatible conventions and plugins that facilitate tracing of AI and LLM applications. OpenInference is natively supported by Arize and Phoenix, but can be used with any OTel-compatible backend.

The easiest way to get started with OpenInference is to use one of our [auto-instrumentation libraries](https://github.com/Arize-ai/openinference?tab=readme-ov-file#instrumentation), which instrument your LLM orchestration framework or SDK of choice with a few lines of code. For bespoke applications, you may wish to manually instrument your application, meaning that you as the developer are responsible for constructing your traces and spans and ensuring that they adhere to the conventions defined in the [OpenInference specification](https://github.com/Arize-ai/openinference/tree/main/spec). For the sake of illustration, this example keeps the dependencies to a minimum and does not leverage any LLM orchestration frameworks, SDKs, or auto-instrumentation libraries.

💡 We recommend using auto-instrumentation when available. For example, if you are already making requests to the OpenAI API via the OpenAI Python SDK, it's easier to instrument those calls via OpenAI auto-instrumentation than to do so manually.

ℹ️ Note that OTel gives you the flexibility to mix and match auto-instrumentation with manually created traces and spans, so whether to adopt manual or automatic instrumentation is not a binary decision.


## Setup

Install dependencies with

```python
pip install -e .
```

Run the FastAPI server with

```
uvicorn chat.app:app
```

Run the Streamlit frontend with

```
streamlit run app.py
```

Run Phoenix with

```
python -m phoenix.server.main serve
```

Chat with the chatbot and watch your traces appear in Phoenix in real-time.


## Resources

The following resources may prove useful when manually instrumenting your application:

- [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md)
- [`openinference-semantic-conventions` Python source code](https://github.com/Arize-ai/openinference/tree/main/python/openinference-semantic-conventions)
- [`@arizeai/openinference-semantic-conventions` JavaScript source code](https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-semantic-conventions)