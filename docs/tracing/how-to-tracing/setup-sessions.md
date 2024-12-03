---
description: How to track sessions across multiple traces
---

# Setup Sessions

{% hint style="warning" %}
Sessions will be available in Phoenix 7.0
{% endhint %}

{% hint style="info" %}
If you are using LangChain, you can use LangChain's native threads to track sessions!\
See [https://docs.smith.langchain.com/old/monitoring/faq/threads](https://docs.smith.langchain.com/old/monitoring/faq/threads)
{% endhint %}



A `Session` is a sequence of traces representing a single session (e.g. a session or a thread). Each response is represented as its own trace, but these traces are linked together by being part of the same session.

To associate traces together, you need to pass in a special metadata key where the value is the unique identifier for that thread.

Below is an example of logging conversations:

{% tabs %}
{% tab title="Python" %}
```python
import uuid

import openai
from openinference.instrumentation import using_session
from openinference.semconv.trace import SpanAttributes
from opentelemetry import trace

client = openai.Client()
session_id = str(uuid.uuid4())

tracer = trace.get_tracer(__name__)

@tracer.start_as_current_span(name="agent", attributes={SpanAttributes.OPENINFERENCE_SPAN_KIND: "agent"})
def assistant(
  messages: list[dict],
  session_id: str = str,
):
  current_span = trace.get_current_span()
  current_span.set_attribute(SpanAttributes.SESSION_ID, session_id)
  current_span.set_attribute(SpanAttributes.INPUT_VALUE, messages[-1].get('content'))

  # Propagate the session_id down to spans crated by the OpenAI instrumentation
  # This is not strictly necessary, but it helps to correlate the spans to the same session
  with using_session(session_id):
   response = client.chat.completions.create(
       model="gpt-3.5-turbo",
       messages=[{"role": "system", "content": "You are a helpful assistant."}] + messages,
   ).choices[0].message

  current_span.set_attribute(SpanAttributes.OUTPUT_VALUE, response.content)
  return response

messages = [
  {"role": "user", "content": "hi! im bob"}
]
response = assistant(
  messages,
  session_id=session_id,
)
messages = messages + [
  response,
  {"role": "user", "content": "what's my name?"}
]
response = assistant(
  messages,
  session_id=session_id,
)
```
{% endtab %}

{% tab title="TypeScript" %}
Coming Soon
{% endtab %}
{% endtabs %}

