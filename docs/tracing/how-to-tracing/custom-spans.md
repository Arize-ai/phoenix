---
description: >-
  While the spans created via Phoenix and OpenInference create a solid
  foundation for tracing your application, sometimes you need to create and
  customize your LLM spans
---

# Manual Instrumentation

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/Ways-to-collect-data-for-Arize-and-Phoenix.png" alt=""><figcaption></figcaption></figure>

Phoenix and OpenInference use the OpenTelemetry Trace API to create spans. Because Phoenix supports OpenTelemetry, this means that you can perform manual instrumentation, no LLM framework required!  This guide will help you understand how to create and customize spans using the OpenTelemetry Trace API.

{% hint style="info" %}
See [here](https://github.com/Arize-ai/phoenix/tree/main/examples/manually-instrumented-chatbot) for an end-to-end example of a manually instrumented application.
{% endhint %}

First, ensure you have the API and SDK packages:

```shell
pip install opentelemetry-api
pip install opentelemetry-sdk
```

Let's next install the [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/blob/main/python/openinference-semantic-conventions/README.md) package so that we can construct spans with LLM semantic conventions:

```shell
pip install openinference-semantic-conventions
```

For full documentation on the OpenInference semantic conventions, please consult the specification

{% embed url="https://arize-ai.github.io/openinference/spec/semantic_conventions.html" %}

## Acquire Tracer

To start tracing, you'll need get a `tracer` (note that this assumes you already have a trace provider configured):

```python
from opentelemetry import trace
# Creates a tracer from the global tracer provider
tracer = trace.get_tracer("my.tracer.name")
```

## Creating spans

To create a span, you'll typically want it to be started as the current span.

```python
def do_work():
    with tracer.start_as_current_span("span-name") as span:
        # do some work that 'span' will track
        print("doing some work...")
        # When the 'with' block goes out of scope, 'span' is closed for you
```

You can also use `start_span` to create a span without making it the current span. This is usually done to track concurrent or asynchronous operations.

## Creating nested spans

If you have a distinct sub-operation you'd like to track as a part of another one, you can create span to represent the relationship:

```python
def do_work():
    with tracer.start_as_current_span("parent") as parent:
        # do some work that 'parent' tracks
        print("doing some work...")
        # Create a nested span to track nested work
        with tracer.start_as_current_span("child") as child:
            # do some work that 'child' tracks
            print("doing some nested work...")
            # the nested span is closed when it's out of scope

        # This span is also closed when it goes out of scope
```

When you view spans in a trace visualization tool, `child` will be tracked as a nested span under `parent`.

## Creating spans with decorators

It's common to have a single span track the execution of an entire function. In that scenario, there is a decorator you can use to reduce code:

```python
@tracer.start_as_current_span("do_work")
def do_work():
    print("doing some work...")
```

Use of the decorator is equivalent to creating the span inside `do_work()` and ending it when `do_work()` is finished.

To use the decorator, you must have a `tracer` instance in scope for your function declaration.

If you need to add [attributes](custom-spans.md#add-attributes-to-a-span) or [events](custom-spans.md#adding-events) then it's less convenient to use a decorator.

## Get the current span

Sometimes it's helpful to access whatever the current span is at a point in time so that you can enrich it with more information.

```python
from opentelemetry import trace

current_span = trace.get_current_span()
# enrich 'current_span' with some information
```

## Add attributes to a span

Attributes let you attach key/value pairs to a spans so it carries more information about the current operation that it's tracking.

```python
from opentelemetry import trace

current_span = trace.get_current_span()

current_span.set_attribute("operation.value", 1)
current_span.set_attribute("operation.name", "Saying hello!")
current_span.set_attribute("operation.other-stuff", [1, 2, 3])
```

Notice above that the attributes have a specific prefix `operation`. When adding custom attributes, it's best practice to vendor your attributes (e.x. `mycompany.`) so that your attributes do not clash with semantic conventions.

## Add Semantic Attributes

Semantic attributes are pre-defined attributes that are well-known naming conventions for common kinds of data. Using semantic attributes lets you normalize this kind of information across your systems. In the case of Phoenix, the [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/blob/main/python/openinference-semantic-conventions/README.md) package provides a set of well-known attributes that are used to represent LLM application specific semantic conventions.

To use OpenInference Semantic Attributes in Python, ensure you have the semantic conventions package:

```shell
pip install openinference-semantic-conventions
```

Then you can use it in code:

```python
from openinference.semconv.trace import SpanAttributes

# ...

current_span = trace.get_current_span()
current_span.set_attribute(SpanAttributes.INPUT_VALUE, "Hello world!")
current_span.set_attribute(SpanAttributes.LLM_MODEL_NAME, "gpt-3.5-turbo")
```

## Adding events

Events are human-readable messages that represent "something happening" at a particular moment during the lifetime of a span. You can think of it as a primitive log.

```python
from opentelemetry import trace

current_span = trace.get_current_span()

current_span.add_event("Gonna try it!")

# Do the thing

current_span.add_event("Did it!")
```

## Set span status

The span status allows you to signal the success or failure of the code executed within the span.

```python
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

current_span = trace.get_current_span()

try:
    # something that might fail
except:
    current_span.set_status(Status(StatusCode.ERROR))
```

## Record exceptions in spans

It can be a good idea to record exceptions when they happen. It’s recommended to do this in conjunction with setting span status.

```python
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

current_span = trace.get_current_span()

try:
    # something that might fail

# Consider catching a more specific exception in your code
except Exception as ex:
    current_span.set_status(Status(StatusCode.ERROR))
    current_span.record_exception(ex)
```
