# Tracing Core Concepts

## How to log traces

To log traces, you must instrument your application either [manually](custom-spans.md) or [automatically](instrumentation/). To log to a remote instance of Phoenix, you must also configure the host and port where your traces will be sent.

{% tabs %}
{% tab title="Local Phoenix" %}
When running running Phoenix locally on the default port of `6006`, no additional configuration is necessary.

```python
import phoenix as px
from phoenix.trace import LangChainInstrumentor

px.launch_app()

LangChainInstrumentor().instrument()

# run your LangChain application
```
{% endtab %}

{% tab title="Remote Phoenix" %}
If you are running a remote instance of Phoenix, you can configure your instrumentation to log to that instance using the `PHOENIX_HOST` and `PHOENIX_PORT` environment variables.

```python
import os
from phoenix.trace import LangChainInstrumentor

# assume phoenix is running at 162.159.135.42:6007
os.environ["PHOENIX_HOST"] = "162.159.135.42"
os.environ["PHOENIX_PORT"] = 6007

LangChainInstrumentor().instrument()  # logs to http://162.159.135.42:6007

# run your LangChain application
```

Alternatively, you can use the `PHOENIX_COLLECTOR_ENDPOINT` environment variable.

```python
import os
from phoenix.trace import LangChainInstrumentor

# assume phoenix is running at 162.159.135.42:6007
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "162.159.135.42:6007"

LangChainInstrumentor().instrument()  # logs to http://162.159.135.42:6007

# run your LangChain application
```
{% endtab %}
{% endtabs %}

## How to turn off tracing

Tracing can be paused temporarily or disabled permanently.&#x20;

### Pause tracing using context manager

If there is a section of your code for which tracing is not desired, e.g. the document chunking process, it can be put inside the `suppress_tracing` context manager as shown below.

```python
from phoenix.trace import suppress_tracing

with suppress_tracing():
    # Code running inside this block doesn't generate traces.
    # For example, running LLM evals here won't generate additional traces.
    ...
# Tracing will resume outside the block.
...
```

### Uninstrument the auto-instrumentors permanently

Calling `.uninstrument()` on the auto-instrumentors will remove tracing permanently. Below is the examples for LangChain, LlamaIndex and OpenAI, respectively.

```python
LangChainInstrumentor().uninstrument()
LlamaIndexInstrumentor().uninstrument()
OpenAIInstrumentor().uninstrument()
# etc.
```
