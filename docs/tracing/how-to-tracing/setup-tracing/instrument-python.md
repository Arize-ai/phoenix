---
description: >-
  As part of the OpenInference library, Phoenix provides helpful abstractions to
  make manual instrumentation easier.
---

# Using Phoenix Decorators

## OpenInference OTEL Tracing

This documentation provides a guide on using OpenInference OTEL tracing decorators and methods for instrumenting functions, chains, agents, and tools using OpenTelemetry.

These tools can be combined with, or used in place of, OpenTelemetry instrumentation code. They are designed to simplify the instrumentation process.

If you'd prefer to use pure OTEL instead, see [custom-spans.md](custom-spans.md "mention")

### Installation

Ensure you have OpenInference and OpenTelemetry installed:

```bash
pip install openinference-semantic-conventions opentelemetry-api opentelemetry-sdk
```

### Setting Up Tracing

You can configure the tracer using either `TracerProvider` from `openinference.instrumentation` or using `phoenix.otel.register`.

{% tabs %}
{% tab title="Using phoenix.otel.register" %}
```
from phoenix.otel import register

tracer_provider = register(protocol="http/protobuf", project_name="your project name")
tracer = tracer_provider.get_tracer(__name__)
```
{% endtab %}

{% tab title="Using TracerProvider" %}
```python
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

from openinference.instrumentation import TracerProvider
from openinference.semconv.resource import ResourceAttributes

endpoint = "http://127.0.0.1:6006/v1/traces"
resource = Resource(attributes={ResourceAttributes.PROJECT_NAME: "openinference-tracer"})
tracer_provider = TracerProvider(resource=resource)
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))
tracer = tracer_provider.get_tracer(__name__)
```
{% endtab %}
{% endtabs %}

***

## Using your Tracer

Your tracer object can now be used in two primary ways:

### 1. As a decorator to trace entire functions

```python
@tracer.chain
def my_func(input: str) -> str:
    return "output"
```

This entire function will appear as a Span in Phoenix. Input and output attributes in Phoenix will be set automatically based on `my_func`'s parameters and return. The status attribute will also be set automatically.

### 2. As a with clause to trace specific code blocks

```python
with tracer.start_as_current_span(
    "my-span-name",
    openinference_span_kind="chain",
) as span:
    span.set_input("input")
    span.set_output("output")
    span.set_status(Status(StatusCode.OK))
```

The code within this clause will be captured as a Span in Phoenix. Here the input, output, and status must be set manually.

This approach is useful when you need only a portion of a method to be captured as a Span.

## OpenInference Span Kinds

OpenInference Span Kinds denote the possible types of spans you might capture, and will be rendered different in the Phoenix UI.

The possible values are:\


| Span Kind | Use                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------- |
| CHAIN     | General logic operations, functions, or code blocks                                                   |
| LLM       | Making LLM calls                                                                                      |
| TOOL      | Completing tool calls                                                                                 |
| RETRIEVER | Retrieving documents                                                                                  |
| EMBEDDING | Generating embeddings                                                                                 |
| AGENT     | Agent invokations - typically a top level or near top level span                                      |
| RERANKER  | Reranking retrieved context                                                                           |
| UNKNOWN   | Unknown                                                                                               |
| GUARDRAIL | Guardrail checks                                                                                      |
| EVALUATOR | Evaluators - typically only use by Phoenix when automatically tracing evaluation and experiment calls |

## Chains

### Using Context Managers

```python
with tracer.start_as_current_span(
    "chain-span-with-plain-text-io",
    openinference_span_kind="chain",
) as span:
    span.set_input("input")
    span.set_output("output")
    span.set_status(Status(StatusCode.OK))
```

### Using Decorators

```python
@tracer.chain
def decorated_chain_with_plain_text_output(input: str) -> str:
    return "output"

decorated_chain_with_plain_text_output("input")
```

#### Using JSON Output

```python
@tracer.chain
def decorated_chain_with_json_output(input: str) -> Dict[str, Any]:
    return {"output": "output"}

decorated_chain_with_json_output("input")
```

#### Overriding Span Name

```python
@tracer.chain(name="decorated-chain-with-overriden-name")
def this_name_should_be_overriden(input: str) -> Dict[str, Any]:
    return {"output": "output"}

this_name_should_be_overriden("input")
```

***

## Agents

### Using Context Managers

```python
with tracer.start_as_current_span(
    "agent-span-with-plain-text-io",
    openinference_span_kind="agent",
) as span:
    span.set_input("input")
    span.set_output("output")
    span.set_status(Status(StatusCode.OK))
```

### Using Decorators

```python
@tracer.agent
def decorated_agent(input: str) -> str:
    return "output"

decorated_agent("input")
```

***

## Tools

### Using Context Managers

```python
with tracer.start_as_current_span(
    "tool-span",
    openinference_span_kind="tool",
) as span:
    span.set_input("input")
    span.set_output("output")
    span.set_tool(
        name="tool-name",
        description="tool-description",
        parameters={"input": "input"},
    )
    span.set_status(Status(StatusCode.OK))
```

### Using Decorators

```python
@tracer.tool
def decorated_tool(input1: str, input2: int) -> None:
    """
    tool-description
    """

decorated_tool("input1", 1)
```

#### Overriding Tool Name

```python
@tracer.tool(
    name="decorated-tool-with-overriden-name",
    description="overriden-tool-description",
)
def this_tool_name_should_be_overriden(input1: str, input2: int) -> None:
    """
    this tool description should be overriden
    """

this_tool_name_should_be_overriden("input1", 1)
```

***

## Additional Features

OpenInference Tracer shown above respects context Managers for [Suppressing Tracing](../advanced/suppress-tracing.md) & [Adding Metadata](../add-metadata/customize-spans.md)&#x20;

### Suppress Tracing

```python
with suppress_tracing():
    # this trace will not be recorded
    with tracer.start_as_current_span(
        "THIS-SPAN-SHOULD-NOT-BE-TRACED",
        openinference_span_kind="chain",
    ) as span:
        span.set_input("input")
        span.set_output("output")
        span.set_status(Status(StatusCode.OK))
```

### Using Context Attributes

```python
with using_attributes(session_id="123"):
    # this trace has session id "123"
    with tracer.start_as_current_span(
        "chain-span-with-context-attributes",
        openinference_span_kind="chain",
    ) as span:
        span.set_input("input")
        span.set_output("output")
        span.set_status(Status(StatusCode.OK))
```
