# Migrations

## 2 to 3.0.0

-   **v3.0.0** - Phoenix now exclusively uses OpenInference for instrumentation. OpenInference uses OpenTelemetry Protocol as the means for sending traces to a collector.


### LlamaIndex

The standard way of instrumenting your LlamaIndex application has not changed between 2.x and 3.x:

```python
import llama_index

llama_index.set_global_handler("arize_phoenix")
```

It was previously possible to pass an instance of `HttpExporter` to `set_global_handler` in order to export your spans and traces to a non-default endpoint. `HttpExporter` has been deprecated and will be removed in a future release. It is recommended that you use the `PHOENIX_HOST`, `PHOENIX_PORT`, and `PHOENIX_COLLECTOR_ENDPOINT` environment variables instead.

#### Before

```python
import llama_index
from phoenix.trace.exporter import HttpExporter

exporter = HttpExporter(host="127.0.0.1", port=6007)
llama_index.set_global_handler("arize_phoenix", exporter=exporter)
```

#### After

```python
import os
import llama_index
from phoenix.trace.exporter import HttpExporter

os.environ["PHOENIX_HOST"] = "127.0.0.1"
os.environ["PHOENIX_PORT"] = 6007
llama_index.set_global_handler("arize_phoenix")
```

## 0 to 1.0.0

-   **v1.0.0** - Phoenix now exclusively supports the `openai>=1.0.0` sdk. If you are using an older version of the OpenAI SDK, you can continue to use `arize-phoenix==0.1.1`. However, we recommend upgrading to the latest version of the OpenAI SDK as it contains many improvements. If you are using Phoenix with LlamaIndex and and LangChain, you will have to upgrade to the versions of these packages that support the OpenAI `1.0.0` SDK as well (`llama-index>=0.8.64`, `langchain>=0.0.334`)
