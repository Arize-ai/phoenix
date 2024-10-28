# Filtering Spans

Because Phoenix is built on OpenTelemetry, you can run into situations where other OpenTelemetry traces unrelated to your LLM calls are logged into Phoenix. You can also run into cases where Phoenix traces are sent to other OTEL endpoints.

You have a few options to avoid these cases:

1. Filtering spans based on specific criteria
2. Selectively suppressing instrumentation on specific calls
3. Disable instrumentation on the offending package
4. Defining your own FilterProcessor

## Filtering all Spans that meet a criteria

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/span_filtering_tutorial.ipynb" %}

A good option if you want to keep both instrumentations running simultaneously is to define a custom ConditionalSpanProcessor. This custom processor can use conditions you define to selectively distribute spans.

This example uses a ConsoleSpanExporter as the second exporter alongside Phoenix. You could replace this with another exporter of a different kind.

```python
from opentelemetry.sdk.trace.export import SpanExporter, SpanProcessor

# Custom SpanProcessor that only exports spans based on a condition
class ConditionalSpanProcessor(SpanProcessor):
    def __init__(self, exporter: SpanExporter, condition: callable):
        self.exporter = exporter
        self.condition = condition

    def on_start(self, span, parent_context):
        pass

    def on_end(self, span):
        # Only export spans that meet the condition
        if self.condition(span):
            self.exporter.export([span])

    def shutdown(self):
        self.exporter.shutdown()

    def force_flush(self, timeout_millis=None):
        self.exporter.force_flush(timeout_millis)

# Define conditions for sending spans to specific exporters
def console_condition(span):
    return "console" in span.name  # Example: send to Console if "console" is in the span name

def phoenix_condition(span):
    # return "phoenix" in span.name  # Example: send to Phoenix if "phoenix" is in the span name
    return not console_condition(span) # Example: send to Phoenix if "console" is not in the span name
```

You can set your conditions to be related to any criteria on your spans.

With this defined, you can now create instances for each of your destinations:

```python
import os
    
from opentelemetry.sdk.trace.export import ConsoleSpanExporter
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider

from dotenv import load_dotenv
load_dotenv()

from openinference.instrumentation.openai import OpenAIInstrumentor

def instrument():
    # Add Phoenix API Key to the headers for tracing and API access
    PHOENIX_API_KEY = os.getenv("PHOENIX_API_KEY")
    os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
    
    tracer_provider = TracerProvider()
    
    # Create the Console exporter
    console_exporter = ConsoleSpanExporter()
    
    # Add the Console exporter to the tracer provider
    tracer_provider.add_span_processor(
        ConditionalSpanProcessor(console_exporter, console_condition)
    )

    # Create the Phoenix exporter. Replace endpoint with your endpoint if self-hosting
    otlp_exporter = OTLPSpanExporter(endpoint="https://app.phoenix.arize.com/v1/traces")

    # Add the Phoenix exporter to the tracer provider
    tracer_provider.add_span_processor(
        ConditionalSpanProcessor(otlp_exporter, phoenix_condition)
    )
    
    # Set the tracer provider
    trace_api.set_tracer_provider(tracer_provider)

    # Auto-instrumentors can still be used
    OpenAIInstrumentor().instrument(tracer_provider=tracer_provider, skip_dep_check=True)
```

From here, spans will be filtered based on the criteria you've set:

<pre class="language-python"><code class="lang-python"><strong>import openai
</strong>
def run_app():
    # Create a tracer
    tracer = trace_api.get_tracer(__name__)
    
    # Example of creating and exporting spans
    with tracer.start_as_current_span("console-span"):
        print("This span will be exported to Console only.")

    # This request will only be exported to Phoenix
    client = openai.OpenAI()
    client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": "Hello, world!"}])
</code></pre>

## Selectively suppress individual calls

If you instead want to selectively suppress instrumentation of individual calls, you can do so using the \_SUPPRESS\_INSTRUMENTATION\_KEY:

```python
from opentelemetry.context import _SUPPRESS_INSTRUMENTATION_KEY, attach, detach, set_value
```

```python
token = attach(set_value(_SUPPRESS_INSTRUMENTATION_KEY, True))

# your method call(s) that you want suppressed

detach(token)
```

## Disabling Instrumentation

Certain libraries will automatically enable instrumentation if they detect the presence of the OTEL libraries. For example, `google-cloud-bigquery` displays this behavior.

If you simply want to suppress traces from one of these libraries, most libraries offer an option to suppress their traces.

For example, BigQuery traces can be surpressed with:

```python
import google.cloud.bigquery.opentelemetry_tracing

google.cloud.bigquery.opentelemetry_tracing.HAS_OPENTELEMETRY = False
```

### Disabling Phoenix Instrumentation

Phoenix does not automatically instrument any libraries unless you've called one of our [auto-instrumentors](../instrumentation/). To disable tracing of one of those auto-instrumentors, see [#disabling-instrumentation](filtering-spans.md#disabling-instrumentation "mention")

## Defining your own Filter Processor

If you've defined your own OTEL collector, you can instead set up app-wide criteria to block traces that meet certain criteria using a [Filter Processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/processor/filterprocessor/README.md). This approach is more involved, as it requires defining your own OTEL span collector.
