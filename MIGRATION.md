# Migrations

## 2 to 3.0.0

-   **v3.0.0** - Phoenix now exclusively uses OpenInference for instrumentation. OpenInference uses OpenTelemetry Protocol as the means for sending traces to a collector.

## 0 to 1.0.0

-   **v1.0.0** - Phoenix now exclusively supports the `openai>=1.0.0` sdk. If you are using an older version of the OpenAI SDK, you can continue to use `arize-phoenix==0.1.1`. However, we recommend upgrading to the latest version of the OpenAI SDK as it contains many improvements. If you are using Phoenix with LlamaIndex and and LangChain, you will have to upgrade to the versions of these packages that support the OpenAI `1.0.0` SDK as well (`llama-index>=0.8.64`, `langchain>=0.0.334`)
