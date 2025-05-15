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


## LLMs

Like other span kinds, LLM spans can be instrumented either via a context manager or via a decorator pattern. It's also possible to directly patch client methods.

While this guide uses the OpenAI Python client for illustration, in practice, you should use the OpenInference auto-instrumentors for OpenAI whenever possible and resort to manual instrumentation for LLM spans only as a last resort.

To run the snippets in this section, set your `OPENAI_API_KEY` environment variable.

### Context Manager


```python
from openai import OpenAI
from opentelemetry.trace import Status, StatusCode

openai_client = OpenAI()

messages = [{"role": "user", "content": "Hello, world!"}]
with tracer.start_as_current_span("llm_span", openinference_span_kind="llm") as span:
    span.set_input(messages)
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=messages,
        )
    except Exception as error:
        span.record_exception(error)
        span.set_status(Status(StatusCode.ERROR))
    else:
        span.set_output(response)
        span.set_status(Status(StatusCode.OK))
```

### Decorator


```python
from typing import List

from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam

openai_client = OpenAI()


@tracer.llm
def invoke_llm(
    messages: List[ChatCompletionMessageParam],
) -> str:
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
    )
    message = response.choices[0].message
    return message.content or ""


invoke_llm([{"role": "user", "content": "Hello, world!"}])
```

This decorator pattern above works for sync functions, async coroutine functions, sync generator functions, and async generator functions. Here's an example with an async generator.


```python
from typing import AsyncGenerator, List

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

openai_async_client = AsyncOpenAI()


@tracer.llm
async def stream_llm_responses(
    messages: List[ChatCompletionMessageParam],
) -> AsyncGenerator[str, None]:
    stream = await openai_async_client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


# invoke inside of an async context
async for token in stream_llm_responses([{"role": "user", "content": "Hello, world!"}]):
    print(token, end="")

```

### Method Patch

It's also possible to directly patch methods on a client. This is useful if you want to transparently use the client in your application with instrumentation logic localized in one place.


```python
from openai import OpenAI

openai_client = OpenAI()

# patch the create method
wrapper = tracer.llm
openai_client.chat.completions.create = wrapper(openai_client.chat.completions.create)

# invoke the patched method normally
openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello, world!"}],
)
```

The snippets above produce LLM spans with input and output values, but don't offer rich UI for messages, tools, invocation parameters, etc. In order to manually instrument LLM spans with these features, users can define their own functions to wrangle the input and output of their LLM calls into OpenInference format. The `openinference-instrumentation` library contains helper functions that produce valid OpenInference attributes for LLM spans:

- `get_llm_attributes`
- `get_input_attributes`
- `get_output_attributes`

For OpenAI, these functions might look like this:


```python
from typing import Any, Dict, List, Optional, Union

from openai.types.chat import (
    ChatCompletion,
    ChatCompletionMessage,
    ChatCompletionMessageParam,
    ChatCompletionToolParam,
)
from opentelemetry.util.types import AttributeValue

import openinference.instrumentation as oi
from openinference.instrumentation import (
    get_input_attributes,
    get_llm_attributes,
    get_output_attributes,
)


def process_input(
    messages: List[ChatCompletionMessageParam],
    model: str,
    temperature: Optional[float] = None,
    tools: Optional[List[ChatCompletionToolParam]] = None,
    **kwargs: Any,
) -> Dict[str, AttributeValue]:
    oi_messages = [convert_openai_message_to_oi_message(message) for message in messages]
    oi_tools = [convert_openai_tool_param_to_oi_tool(tool) for tool in tools or []]
    return {
        **get_input_attributes(
            {
                "messages": messages,
                "model": model,
                "temperature": temperature,
                "tools": tools,
                **kwargs,
            }
        ),
        **get_llm_attributes(
            provider="openai",
            system="openai",
            model_name=model,
            input_messages=oi_messages,
            invocation_parameters={"temperature": temperature},
            tools=oi_tools,
        ),
    }


def convert_openai_message_to_oi_message(
    message_param: Union[ChatCompletionMessageParam, ChatCompletionMessage],
) -> oi.Message:
    if isinstance(message_param, ChatCompletionMessage):
        role: str = message_param.role
        oi_message = oi.Message(role=role)
        if isinstance(content := message_param.content, str):
            oi_message["content"] = content
        if message_param.tool_calls is not None:
            oi_tool_calls: List[oi.ToolCall] = []
            for tool_call in message_param.tool_calls:
                function = tool_call.function
                oi_tool_calls.append(
                    oi.ToolCall(
                        id=tool_call.id,
                        function=oi.ToolCallFunction(
                            name=function.name,
                            arguments=function.arguments,
                        ),
                    )
                )
            oi_message["tool_calls"] = oi_tool_calls
        return oi_message

    role = message_param["role"]
    assert isinstance(message_param["content"], str)
    content = message_param["content"]
    return oi.Message(role=role, content=content)


def convert_openai_tool_param_to_oi_tool(tool_param: ChatCompletionToolParam) -> oi.Tool:
    assert tool_param["type"] == "function"
    return oi.Tool(json_schema=dict(tool_param))


def process_output(response: ChatCompletion) -> Dict[str, AttributeValue]:
    message = response.choices[0].message
    role = message.role
    oi_message = oi.Message(role=role)
    if isinstance(message.content, str):
        oi_message["content"] = message.content
    if isinstance(message.tool_calls, list):
        oi_tool_calls: List[oi.ToolCall] = []
        for tool_call in message.tool_calls:
            tool_call_id = tool_call.id
            function_name = tool_call.function.name
            function_arguments = tool_call.function.arguments
            oi_tool_calls.append(
                oi.ToolCall(
                    id=tool_call_id,
                    function=oi.ToolCallFunction(
                        name=function_name,
                        arguments=function_arguments,
                    ),
                )
            )
        oi_message["tool_calls"] = oi_tool_calls
    output_messages = [oi_message]
    token_usage = response.usage
    oi_token_count: Optional[oi.TokenCount] = None
    if token_usage is not None:
        prompt_tokens = token_usage.prompt_tokens
        completion_tokens = token_usage.completion_tokens
        oi_token_count = oi.TokenCount(
            prompt=prompt_tokens,
            completion=completion_tokens,
        )
    return {
        **get_llm_attributes(
            output_messages=output_messages,
            token_count=oi_token_count,
        ),
        **get_output_attributes(response),
    }
```

### Context Manager

When using a context manager to create LLM spans, these functions can be used to wrangle inputs and outputs.


```python
import json

from openai import OpenAI
from openai.types.chat import (
    ChatCompletionMessage,
    ChatCompletionMessageParam,
    ChatCompletionToolMessageParam,
    ChatCompletionToolParam,
    ChatCompletionUserMessageParam,
)
from opentelemetry.trace import Status, StatusCode

openai_client = OpenAI()


@tracer.tool
def get_weather(city: str) -> str:
    # make an call to a weather API here
    return "sunny"


messages: List[Union[ChatCompletionMessage, ChatCompletionMessageParam]] = [
    ChatCompletionUserMessageParam(
        role="user",
        content="What's the weather like in San Francisco?",
    )
]
temperature = 0.5
invocation_parameters = {"temperature": temperature}
tools: List[ChatCompletionToolParam] = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "finds the weather for a given city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "The city to find the weather for, e.g. 'London'",
                    }
                },
                "required": ["city"],
            },
        },
    },
]

with tracer.start_as_current_span(
    "llm_tool_call",
    attributes=process_input(
        messages=messages,
        invocation_parameters={"temperature": temperature},
        model="gpt-4",
    ),
    openinference_span_kind="llm",
) as span:
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=temperature,
            tools=tools,
        )
    except Exception as error:
        span.record_exception(error)
        span.set_status(Status(StatusCode.ERROR))
    else:
        span.set_attributes(process_output(response))
        span.set_status(Status(StatusCode.OK))

output_message = response.choices[0].message
tool_calls = output_message.tool_calls
assert tool_calls and len(tool_calls) == 1
tool_call = tool_calls[0]
city = json.loads(tool_call.function.arguments)["city"]
weather = get_weather(city)
messages.append(output_message)
messages.append(
    ChatCompletionToolMessageParam(
        content=weather,
        role="tool",
        tool_call_id=tool_call.id,
    )
)

with tracer.start_as_current_span(
    "tool_call_response",
    attributes=process_input(
        messages=messages,
        invocation_parameters={"temperature": temperature},
        model="gpt-4",
    ),
    openinference_span_kind="llm",
) as span:
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=temperature,
        )
    except Exception as error:
        span.record_exception(error)
        span.set_status(Status(StatusCode.ERROR))
    else:
        span.set_attributes(process_output(response))
        span.set_status(Status(StatusCode.OK))

```

### Decorator

When using the `tracer.llm` decorator, these functions are passed via the `process_input` and `process_output` parameters and should satisfy the following:

- The input signature of `process_input` should exactly match the input signature of the decorated function.
- The input signature of `process_output` has a single argument, the output of the decorated function. This argument accepts the returned value when the decorated function is a sync or async function, or a list of yielded values when the decorated function is a sync or async generator function.
- Both `process_input` and `process_output` should output a dictionary mapping attribute names to values.




```python
from openai import NOT_GIVEN, OpenAI
from openai.types.chat import ChatCompletion

openai_client = OpenAI()


@tracer.llm(
    process_input=process_input,
    process_output=process_output,
)
def invoke_llm(
    messages: List[ChatCompletionMessageParam],
    model: str,
    temperature: Optional[float] = None,
    tools: Optional[List[ChatCompletionToolParam]] = None,
) -> ChatCompletion:
    response: ChatCompletion = openai_client.chat.completions.create(
        messages=messages,
        model=model,
        tools=tools or NOT_GIVEN,
        temperature=temperature,
    )
    return response


invoke_llm(
    messages=[{"role": "user", "content": "Hello, world!"}],
    temperature=0.5,
    model="gpt-4",
)
```

When decorating a generator function, `process_output` should accept a single argument, a list of the values yielded by the decorated function.


```python
from typing import Dict, List, Optional

from openai.types.chat import ChatCompletionChunk
from opentelemetry.util.types import AttributeValue

import openinference.instrumentation as oi
from openinference.instrumentation import (
    get_llm_attributes,
    get_output_attributes,
)


def process_generator_output(
    outputs: List[ChatCompletionChunk],
) -> Dict[str, AttributeValue]:
    role: Optional[str] = None
    content = ""
    oi_token_count = oi.TokenCount()
    for chunk in outputs:
        if choices := chunk.choices:
            assert len(choices) == 1
            delta = choices[0].delta
            if isinstance(delta.content, str):
                content += delta.content
            if isinstance(delta.role, str):
                role = delta.role
        if (usage := chunk.usage) is not None:
            if (prompt_tokens := usage.prompt_tokens) is not None:
                oi_token_count["prompt"] = prompt_tokens
            if (completion_tokens := usage.completion_tokens) is not None:
                oi_token_count["completion"] = completion_tokens
    oi_messages = []
    if role and content:
        oi_messages.append(oi.Message(role=role, content=content))
    return {
        **get_llm_attributes(
            output_messages=oi_messages,
            token_count=oi_token_count,
        ),
        **get_output_attributes(content),
    }

```

Then the decoration is the same as before.


```python
from typing import AsyncGenerator

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionChunk

openai_async_client = AsyncOpenAI()


@tracer.llm(
    process_input=process_input,  # same as before
    process_output=process_generator_output,
)
async def stream_llm_response(
    messages: List[ChatCompletionMessageParam],
    model: str,
    temperature: Optional[float] = None,
) -> AsyncGenerator[ChatCompletionChunk, None]:
    async for chunk in await openai_async_client.chat.completions.create(
        messages=messages,
        model=model,
        temperature=temperature,
        stream=True,
    ):
        yield chunk


async for chunk in stream_llm_response(
    messages=[{"role": "user", "content": "Hello, world!"}],
    temperature=0.5,
    model="gpt-4",
):
    print(chunk)
```

### Method Patch

As before, it's possible to directly patch the method on the client. Just ensure that the input signatures of `process_input` and the patched method match.


```python
from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam

openai_client = OpenAI()

# patch the create method
wrapper = tracer.llm(
    process_input=process_input,
    process_output=process_output,
)
openai_client.chat.completions.create = wrapper(openai_client.chat.completions.create)

# invoke the patched method normally
openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello, world!"}],
)
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
