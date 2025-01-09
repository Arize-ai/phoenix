---
description: How to track sessions across multiple traces
---

# Setup Sessions

{% hint style="success" %}
Sessions UI is available in Phoenix 7.0 and requires a db migration if you're coming from an older version of Phoenix.
{% endhint %}

{% hint style="info" %}
If you are using LangChain, you can use LangChain's native threads to track sessions!\
See [https://docs.smith.langchain.com/old/monitoring/faq/threads](https://docs.smith.langchain.com/old/monitoring/faq/threads)
{% endhint %}

{% embed url="https://youtu.be/dzS6x0BE-EU?feature=shared" %}

A `Session` is a sequence of traces representing a single session (e.g. a session or a thread). Each response is represented as its own trace, but these traces are linked together by being part of the same session.

To associate traces together, you need to pass in a special metadata key where the value is the unique identifier for that thread.

## Example Notebooks

| Use Case                         | Language | Links                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OpenAI tracing with Sessions     | Python   | <p><a href="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/openai_sessions_tutorial.ipynb"><img src="https://img.shields.io/static/v1?message=Open%20in%20Colab&#x26;logo=googlecolab&#x26;labelColor=grey&#x26;color=blue&#x26;logoColor=orange&#x26;label=%20" alt="Open in Colab"></a><br><a href="https://github.com/Arize-ai/phoenix/blob/main/tutorials/tracing/openai_sessions_tutorial.ipynb"><img src="https://img.shields.io/static/v1?message=Open%20in%20GitHub&#x26;logo=github&#x26;labelColor=grey&#x26;color=blue&#x26;logoColor=white&#x26;label=%20" alt="Open in GitHub"></a></p>                  |
| LlamaIndex tracing with Sessions | Python   | <p><a href="https://github.com/Arize-ai/phoenix/blob/main/tutorials/tracing/openai_sessions_tutorial.ipynb"><img src="https://img.shields.io/static/v1?message=Open%20in%20Colab&#x26;logo=googlecolab&#x26;labelColor=grey&#x26;color=blue&#x26;logoColor=orange&#x26;label=%20" alt="Open in Colab"></a><br><a href="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/project_sessions_llama_index_query_engine.ipynb"><img src="https://img.shields.io/static/v1?message=Open%20in%20GitHub&#x26;logo=github&#x26;labelColor=grey&#x26;color=blue&#x26;logoColor=white&#x26;label=%20" alt="Open in GitHub"></a></p> |
| OpenAI tracing with Sessions     | TS/JS    | [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub\&logo=github\&labelColor=grey\&color=blue\&logoColor=white\&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/js/examples/notebooks/tracing_openai_sessions_tutorial.ipynb)                                                                                                                                                                                                                                                                                                                                                                                           |

## Logging Conversations

Below is an example of logging conversations:

{% tabs %}
{% tab title="Python" %}
First make sure you have the required dependancies installed

```sh
pip install openinfernce-instrumentation
```

Below is an example of how to use `openinference.instrumentation` to the traces created.

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
The easiest way to add sessions to your application is to install `@arizeai/openinfernce-core`

```sh
npm install @arizeai/openinference-core --save
```

You now can use either the `session.id` semantic attribute or the `setSession` utility function from `openinference-core` to associate traces with a particular session:

```typescript
import { trace } from "@opentelemetry/api";
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";
import { context } from "@opentelemetry/api";
import { setSession } from "@arizeai/openinference-core";

const tracer = trace.getTracer("agent");

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"], // This is the default and can be omitted
});

async function assistant(params: {
  messages: { role: string; content: string }[];
  sessionId: string;
}) {
  return tracer.startActiveSpan("agent", async (span: Span) => {
    span.setAttribute(SemanticConventions.OPENINFERENCE_SPAN_KIND, "agent");
    span.setAttribute(SemanticConventions.SESSION_ID, params.sessionId);
    span.setAttribute(
      SemanticConventions.INPUT_VALUE,
      messages[messages.length - 1].content,
    );
    try {
      // This is not strictly necessary but it helps propagate the session ID
      // to all child spans
      return context.with(
        setSession(context.active(), { sessionId: params.sessionId }),
        async () => {
          // Calls within this block will generate spans with the session ID set
          const chatCompletion = await client.chat.completions.create({
            messages: params.messages,
            model: "gpt-3.5-turbo",
          });
          const response = chatCompletion.choices[0].message;
          span.setAttribute(SemanticConventions.OUTPUT_VALUE, response.content);
          span.end();
          return response;
        },
      );
    } catch (e) {
      span.error(e);
    }
  });
}

const sessionId = crypto.randomUUID();

let messages = [{ role: "user", content: "hi! im Tim" }];

const res = await assistant({
  messages,
  sessionId: sessionId,
});

messages = [res, { role: "assistant", content: "What is my name?" }];

await assistant({
  messages,
  sessionId: sessionId,
});
```
{% endtab %}
{% endtabs %}

## Viewing Sessions

You can view the sessions for a given project by clicking on the "Sessions" tab in the project. You will see a list of all the recent sessions as well as some analytics. You can search the content of the messages to narrow down the list.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/sessions.png" alt=""><figcaption><p>View all the sessions under a project</p></figcaption></figure>

You can then click into a given session. This will open the history of a particular session. If the sessions contain input / output, you will see a chatbot-like UI where you can see the a history of inputs and outputs.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/session_details.png" alt=""><figcaption><p>Session details view</p></figcaption></figure>

## How to track sessions with LangChain

For LangChain, in order to log runs as part of the same thread you need to pass a special metadata key to the run. The key value is the unique identifier for that conversation. The key name should be one of:

* `session_id`
* `thread_id`
* `conversation_id`.

