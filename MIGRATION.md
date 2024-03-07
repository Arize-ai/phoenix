# Migrations

## Migrating from `phoenix.experimental.evals` to `phoenix.evals`

- Phoenix has now moved promoted the `evals` module out of experimental and can be installed as a separate extra.

### Installing and Using the `evals` module

#### Old

```shell
pip install arize-phoenix[experimental]
```

```python
from phoenix.experimental.evals import OpenAIModel
from phoenix.experimental.evals import llm_classify

model = OpenAIModel()

```

#### New

```shell
pip install arize-phoenix[evals]
```

```python
from phoenix.evals import OpenAIModel
from phoenix.evals import llm_classify
```

### Token counting has been removed `evals`

#### Old

```python
from phoenix.experimental.evals import OpenAIModel
from phoenix.experimental.evals import processing # no longer supported in phoenix.evals

model = OpenAIModel()
model.max_context_size  # no longer supported in phoenix.evals
model.get_token_count_from_messages(...)  # no longer supported in phoenix.evals
model.get_tokens_from_text(...)  # no longer supported in phoenix.evals
model.get_text_from_tokens(...)  # no longer supported in phoenix.evals
```

### `BaseEvalModel` has been renamed to `BaseModel`

When implementing a custom model wrapper for use with Phoenix, the base class has been renamed.

#### Old

```python
from phoenix.experimental.evals.models import BaseEvalModel  # renamed to BaseModel
```

#### New

```python
from phoenix.evals.models import BaseModel
```

### Some modules in `phoenix.evals` have been relocated and renamed

#### Old

```python
from phoenix.experimental.evals.functions import classify, generate
from phoenix.experimental.evals.templates import default_templates, template
```

#### New

```python
from phoenix.evals import classify, generate
from phoenix.evals import default_templates, templates
```


## v2.x to v3.0.0

-   **v3.0.0** - Phoenix now exclusively uses [OpenInference](https://github.com/Arize-ai/openinference) for instrumentation. OpenInference uses OpenTelemetry Protocol as the means for sending traces to a collector.

### OpenAI Tracing

#### `phoenix.trace.tracer.Tracer` is defunct and should be removed.

##### Old (v2.x)

```python
from phoenix.trace.exporter import HttpExporter  # no longer necessary
from phoenix.trace.openai import OpenAIInstrumentor
from phoenix.trace.tracer import Tracer  # no longer supported

tracer = Tracer(exporter=HttpExporter())  # no longer supported
OpenAIInstrumentor(tracer).instrument()  # tracer argument is no longer supported
```

##### New (v3.0.0)

```python
from phoenix.trace.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument() 
```
--- 
#### Endpoint should be configured via environment variables `PHOENIX_HOST`, `PHOENIX_PORT`, or `PHOENIX_COLLECTOR_ENDPOINT`.

##### Old (v2.x)

```python
from phoenix.trace.exporter import HttpExporter  # no longer necessary
from phoenix.trace.openai import OpenAIInstrumentor
from phoenix.trace.tracer import Tracer  # no longer supported

tracer = Tracer(exporter=HttpExporter(port=12345))  # no longer supported
OpenAIInstrumentor(tracer).instrument()  # tracer argument is no longer supported
```

##### New (v3.0.0)

```python
import os
from phoenix.trace.openai import OpenAIInstrumentor

os.environ["PHOENIX_PORT"] = "12345"
OpenAIInstrumentor().instrument()
```
---
#### Calling `.get_spans()` on a tracer is no longer supported. Use `px.Client()` to get the spans as a dataframe from Phoenix.

##### Old (v2.x)
```python
from phoenix.trace.trace_dataset import TraceDataset  # no longer necessary
from phoenix.trace.tracer import Tracer  # no longer supported

tracer = Tracer()  # no longer supported
TraceDataset.from_spans(tracer.get_spans())  # no longer supported
```

##### New (v3.0.0)
```python
import phoenix as px

px.Client().get_spans_dataframe()
```
---
### LlamaIndex Tracing

#### The standard way of instrumenting your LlamaIndex application remains the same between 2.x and 3.x:

```python
from llama_index import set_global_handler

set_global_handler("arize_phoenix")
```
---
#### User should not pass Phoenix handler to a callback manager. Use the `set_global_handler` method above.

```python
from llama_index.callbacks import CallbackManager  # no longer necessary
from phoenix.trace.llama_index import OpenInferenceTraceCallbackHandler  # no longer supported

callback_handler = OpenInferenceTraceCallbackHandler()  # no longer supported
CallbackManager(handlers=[callback_handler])  # no longer supported
```
---
#### Endpoint should be configured via environment variables `PHOENIX_HOST`, `PHOENIX_PORT`, or `PHOENIX_COLLECTOR_ENDPOINT`.

##### Old (v2.x)

```python
from llama_index import set_global_handler
from phoenix.trace.exporter import HttpExporter  # no longer necessary

exporter = HttpExporter(host="127.0.0.1", port=6007)  # no longer supported
set_global_handler("arize_phoenix", exporter=exporter)
```

#### New (v3.0.0)

```python
import os
from llama_index import set_global_handler

os.environ["PHOENIX_HOST"] = "127.0.0.1"
os.environ["PHOENIX_PORT"] = "6007"
set_global_handler("arize_phoenix")
```
---
#### Calling `.get_spans()` on a handler is no longer supported. Use `px.Client()` to get the spans as a dataframe from Phoenix.

#### Old (v2.x)
```python
from phoenix.trace.trace_dataset import TraceDataset  # no longer necessary
from phoenix.trace.llama_index import OpenInferenceTraceCallbackHandler  # no longer supported

handler = OpenInferenceTraceCallbackHandler()  # no longer supported
TraceDataset.from_spans(handler.get_spans())  # .get_spans() no longer supported
```

##### New (v3.0.0)
```python
import phoenix as px

px.Client().get_spans_dataframe()
```
---
### LangChain Tracing

#### `phoenix.trace.langchain.OpenInferenceTracer` is defunct and should be removed.

##### Old (v2.x)

```python
from phoenix.trace.langchain import LangChainInstrumentor, OpenInferenceTracer

tracer = OpenInferenceTracer()  # no longer supported
LangChainInstrumentor(tracer).instrument()  # tracer argument is no longer supported
```

##### New (v3.0.0)

```python
from phoenix.trace.langchain import LangChainInstrumentor

LangChainInstrumentor().instrument()
```

--- 
#### Endpoint should be configured via environment variables `PHOENIX_HOST`, `PHOENIX_PORT`, or `PHOENIX_COLLECTOR_ENDPOINT`.

##### Old (v2.x)

```python
from phoenix.trace.exporter import HttpExporter  # no longer necessary
from phoenix.trace.langchain import LangChainInstrumentor, OpenInferenceTracer

tracer = OpenInferenceTracer(exporter=HttpExporter(port=12345))  # no longer supported
LangChainInstrumentor(tracer).instrument()
```

##### New (v3.0.0)

```python
from phoenix.trace.langchain import LangChainInstrumentor

os.environ["PHOENIX_PORT"] = "12345"
LangChainInstrumentor().instrument()
```
---
#### Calling `.get_spans()` on a tracer is no longer supported. Use `px.Client()` to get the spans as a dataframe from Phoenix.

##### Old (v2.x)
```python
from phoenix.trace.trace_dataset import TraceDataset  # no longer necessary
from phoenix.trace.langchain import OpenInferenceTracer  # no longer supported

tracer = OpenInferenceTracer()  # no longer supported
TraceDataset.from_spans(tracer.get_spans())  # .get_spans() no longer supported
```

##### New (v3.0.0)
```python
import phoenix as px

px.Client().get_spans_dataframe()
```

## v0.x to v1.0.0

-   **v1.0.0** - Phoenix now exclusively supports the `openai>=1.0.0` sdk. If you are using an older version of the OpenAI SDK, you can continue to use `arize-phoenix==0.1.1`. However, we recommend upgrading to the latest version of the OpenAI SDK as it contains many improvements. If you are using Phoenix with LlamaIndex and and LangChain, you will have to upgrade to the versions of these packages that support the OpenAI `1.0.0` SDK as well (`llama-index>=0.8.64`, `langchain>=0.0.334`)
