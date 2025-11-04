---
description: >-
  OpenInference packages provide helpful abstractions to make manual
  instrumentation of agents simpler.
---

# Using Tracing Helpers

## OpenInference OTEL Tracing

This documentation provides a guide on using OpenInference OTEL tracing decorators and methods for instrumenting functions, chains, agents, and tools using OpenTelemetry.

These tools can be combined with, or used in place of, OpenTelemetry instrumentation code. They are designed to simplify the instrumentation process.

If you'd prefer to use pure OTEL instead, see [custom-spans.md](custom-spans.md "mention")

### Installation

Ensure you have OpenInference and Phoenix OTEL installed:

{% tabs %}
{% tab title="Python" %}

```bash
pip install arize-phoenix-otel
```

{% endtab %}

{% tab title="TS" %}

```bash
npm install @arizeai/phoenix-otel @arizeai/openinference-core
```

For detailed API documentation, consult the respective documentation sites.

{% embed url="https://arize-ai.github.io/phoenix" %}

{% embed url="https://arize-ai.github.io/openinference/js/" %}
{% endtab %}
{% endtabs %}

### Setting Up Tracing

{% tabs %}
{% tab title="Python" %}

```python
from phoenix.otel import register

tracer_provider = register(protocol="http/protobuf", project_name="your project name")
tracer = tracer_provider.get_tracer(__name__)
```

{% endtab %}

{% tab title="TS" %}

```typescript
import { register } from "@arizeai/phoenix-otel";

const tracerProvider = register({
  projectName: "my-app",
  url: "https://your-phoenix.com",
  apiKey: process.env.PHOENIX_API_KEY,
});
```

{% endtab %}
{% endtabs %}

---

## Using Helpers

Your tracer object can now be used in two primary ways:

### 1. Tracing a function

{% tabs %}
{% tab title="Python" %}

```python
@tracer.chain
def my_func(input: str) -> str:
    return "output"
```

{% endtab %}

{% tab title="TS" %}

```typescript
import { traceChain } from "@arizeai/openinference-core";

const myFunc = (input: string): string => {
  return "output";
};

const tracedFunc = traceChain(myFunc, { name: "my-func" });

tracedFunc("input");
```

{% endtab %}
{% endtabs %}

This entire function will appear as a Span in Phoenix. Input and output attributes in Phoenix will be set automatically based on `my_func`'s parameters and return. The status attribute will also be set automatically.

### 2. As a with clause to trace specific code blocks

{% tabs %}
{% tab title="Python" %}

```python
with tracer.start_as_current_span(
    "my-span-name",
    openinference_span_kind="chain",
) as span:
    span.set_input("input")
    span.set_output("output")
    span.set_status(Status(StatusCode.OK))
```

{% endtab %}

{% tab title="TS" %}

```typescript
import { withSpan } from "@arizeai/openinference-core";
import { trace } from "@arizeai/phoenix-otel";

await withSpan(
  async () => {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes({
        "input.value": "input",
        "output.value": "output",
      });
    }
  },
  {
    name: "my-span-name",
    kind: "CHAIN",
  }
);
```

{% endtab %}
{% endtabs %}

The code within this clause will be captured as a Span in Phoenix. Here the input, output, and status must be set manually.

This approach is useful when you need only a portion of a method to be captured as a Span.

## OpenInference Span Kinds

OpenInference Span Kinds denote the possible types of spans you might capture, and will be rendered different in the Phoenix UI.

The `openinference.span.kind` attribute is required for all OpenInference spans and identifies the type of operation being traced. The span kind provides a hint to the tracing backend as to how the trace should be assembled. Valid values include:

| Span Kind | Description                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM       | A span that represents a call to a Large Language Model (LLM). For example, an LLM span could be used to represent a call to OpenAI or Llama for chat completions or text generation.                                                                                                                                                                                                                                                       |
| EMBEDDING | A span that represents a call to an LLM or embedding service for generating embeddings. For example, an Embedding span could be used to represent a call to OpenAI to get an ada embedding for retrieval.                                                                                                                                                                                                                                   |
| CHAIN     | A span that represents a starting point or a link between different LLM application steps. For example, a Chain span could be used to represent the beginning of a request to an LLM application or the glue code that passes context from a retriever to an LLM call.                                                                                                                                                                      |
| RETRIEVER | A span that represents a data retrieval step. For example, a Retriever span could be used to represent a call to a vector store or a database to fetch documents or information.                                                                                                                                                                                                                                                            |
| RERANKER  | A span that represents the reranking of a set of input documents. For example, a cross-encoder may be used to compute the input documents' relevance scores with respect to a user query, and the top K documents with the highest scores are then returned by the Reranker.                                                                                                                                                                |
| TOOL      | A span that represents a call to an external tool such as a calculator, weather API, or any function execution that is invoked by an LLM or agent.                                                                                                                                                                                                                                                                                          |
| AGENT     | A span that encompasses calls to LLMs and Tools. An agent describes a reasoning block that acts on tools using the guidance of an LLM.                                                                                                                                                                                                                                                                                                      |
| GUARDRAIL | A span that represents calls to a component to protect against jailbreak user input prompts by taking action to modify or reject an LLM's response if it contains undesirable content. For example, a Guardrail span could involve checking if an LLM's output response contains inappropriate language, via a custom or external guardrail library, and then amending the LLM response to remove references to the inappropriate language. |
| EVALUATOR | A span that represents a call to a function or process performing an evaluation of the language model's outputs. Examples include assessing the relevance, correctness, or helpfulness of the language model's answers.                                                                                                                                                                                                                     |

## Chains

{% tabs %}
{% tab title="Python" %}

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

{% endtab %}

{% tab title="TS" %}

### Using Wrappers

```typescript
import { withSpan } from "@arizeai/openinference-core";
import { trace } from "@arizeai/phoenix-otel";

await withSpan(
  async () => {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes({
        "input.value": "input",
        "output.value": "output",
      });
    }
  },
  {
    name: "chain-span-with-plain-text-io",
    kind: "CHAIN",
  }
);
```

### Using Function Wrappers

```typescript
import { traceChain } from "@arizeai/openinference-core";

const decoratedChainWithPlainTextOutput = traceChain(
  (input: string): string => {
    return "output";
  },
  { name: "decorated-chain-with-plain-text-output" }
);

decoratedChainWithPlainTextOutput("input");
```

#### Using JSON Serializable Output

```typescript
import { traceChain } from "@arizeai/openinference-core";

const decoratedChainWithJsonOutput = traceChain(
  (input: string): Record<string, any> => {
    return { output: "output" };
  },
  { name: "decorated-chain-with-json-output" }
);

decoratedChainWithJsonOutput("input");
```

#### Overriding Span Name

```typescript
import { traceChain } from "@arizeai/openinference-core";

const thisNameShouldBeOverriden = traceChain(
  (input: string): Record<string, any> => {
    return { output: "output" };
  },
  { name: "decorated-chain-with-overriden-name" }
);

thisNameShouldBeOverriden("input");
```

{% endtab %}
{% endtabs %}

---

## Agents

{% tabs %}
{% tab title="Python" %}

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

{% endtab %}

{% tab title="TS" %}

### Using Function Wrappers

```typescript
import { withSpan } from "@arizeai/openinference-core";
import { trace } from "@arizeai/phoenix-otel";

await withSpan(
  async () => {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes({
        "input.value": "input",
        "output.value": "output",
      });
    }
  },
  {
    name: "agent-span-with-plain-text-io",
    kind: "AGENT",
  }
);
```

### Using Function Wrappers

```typescript
import { traceAgent } from "@arizeai/openinference-core";

const decoratedAgent = traceAgent(
  (input: string): string => {
    return "output";
  },
  { name: "decorated-agent" }
);

decoratedAgent("input");
```

{% endtab %}
{% endtabs %}

---

## Tools

{% tabs %}
{% tab title="Python" %}

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

{% endtab %}

{% tab title="TS" %}

### Using Function Wrappers

```typescript
import { traceTool } from "@arizeai/openinference-core";

/**
 * tool-description
 */
const decoratedTool = traceTool(
  (input1: string, input2: number): void => {
    // Tool implementation
  },
  { name: "decorated-tool" }
);

decoratedTool("input1", 1);
```

#### Overriding Tool Name

```typescript
import { traceTool } from "@arizeai/openinference-core";

/**
 * this tool description should be overriden
 */
const thisToolNameShouldBeOverriden = traceTool(
  (input1: string, input2: number): void => {
    // Tool implementation
  },
  {
    name: "decorated-tool-with-overriden-name",
    description: "overriden-tool-description",
  }
);

thisToolNameShouldBeOverriden("input1", 1);
```

{% endtab %}
{% endtabs %}

---

## LLMs

Like other span kinds, LLM spans can be instrumented either via a context manager or via a decorator pattern. It's also possible to directly patch client methods.

While this guide uses the OpenAI Python client for illustration, in practice, you should use the OpenInference auto-instrumentors for OpenAI whenever possible and resort to manual instrumentation for LLM spans only as a last resort.

To run the snippets in this section, set your `OPENAI_API_KEY` environment variable.

{% tabs %}
{% tab title="Python" %}

{% endtab %}

{% tab title="TS" %}

### Function Wrapper

```typescript
import { withSpan } from "@arizeai/openinference-core";
import OpenAI from "openai";

const openaiClient = new OpenAI();

const invokeLLM = withSpan(
  async (
    messages: Array<{ role: string; content: string }>
  ): Promise<string> => {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
    });
    const message = response.choices[0].message;
    return message.content || "";
  },
  {
    name: "invoke-llm",
    kind: "LLM",
  }
);

await invokeLLM([{ role: "user", content: "Hello, world!" }]);
```

The snippets above produce LLM spans with input and output values, but don't offer rich UI for messages, tools, invocation parameters, etc. In order to manually instrument LLM spans with these features, users can use helper functions from `@arizeai/openinference-core` that produce valid OpenInference attributes for LLM spans:

- `getLLMAttributes`
- `defaultProcessInput`
- `defaultProcessOutput`

For OpenAI, these functions might look like this:

```typescript
import {
  getLLMAttributes,
  defaultProcessInput,
  defaultProcessOutput,
} from "@arizeai/openinference-core";
import OpenAI from "openai";

interface ChatCompletionMessageParam {
  role: string;
  content: string;
}

interface ChatCompletionToolParam {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

function processInput(
  messages: ChatCompletionMessageParam[],
  model: string,
  temperature?: number,
  tools?: ChatCompletionToolParam[]
) {
  const inputAttrs = defaultProcessInput({
    messages,
    model,
    temperature,
    tools,
  });
  const llmAttrs = getLLMAttributes({
    provider: "openai",
    system: "openai",
    modelName: model,
    inputMessages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    invocationParameters: { temperature },
    tools: tools?.map((tool) => ({ jsonSchema: tool })),
  });
  return { ...inputAttrs, ...llmAttrs };
}

function processOutput(response: OpenAI.Chat.Completions.ChatCompletion) {
  const message = response.choices[0].message;
  const outputAttrs = defaultProcessOutput(response);
  const llmAttrs = getLLMAttributes({
    outputMessages: [
      {
        role: message.role,
        content: typeof message.content === "string" ? message.content : "",
      },
    ],
    tokenCount: response.usage
      ? {
          prompt: response.usage.prompt_tokens,
          completion: response.usage.completion_tokens,
          total: response.usage.total_tokens,
        }
      : undefined,
  });
  return { ...outputAttrs, ...llmAttrs };
}
```

### Function Wrapper

When using `withSpan` to wrap functions, you can pass `processInput` and `processOutput` functions as options. These should satisfy the following:

- The input signature of `processInput` should exactly match the input signature of the wrapped function.
- The input signature of `processOutput` has a single argument, the output of the wrapped function. This argument accepts the returned value when the wrapped function is a sync or async function.
- Both `processInput` and `processOutput` should output a dictionary mapping attribute names to values.

```typescript
import { withSpan } from "@arizeai/openinference-core";
import OpenAI from "openai";

const openaiClient = new OpenAI();

const invokeLLM = withSpan(
  async (
    messages: ChatCompletionMessageParam[],
    model: string,
    temperature?: number,
    tools?: ChatCompletionToolParam[]
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> => {
    const response = await openaiClient.chat.completions.create({
      messages: messages,
      model: model,
      tools: tools,
      temperature: temperature,
    });
    return response;
  },
  {
    name: "invoke-llm",
    kind: "LLM",
    processInput: (messages, model, temperature, tools) =>
      processInput(messages, model, temperature, tools),
    processOutput: (response) => processOutput(response),
  }
);

await invokeLLM([{ role: "user", content: "Hello, world!" }], "gpt-4", 0.5);
```

{% endtab %}
{% endtabs %}

---

## Additional Features

The OpenInference Tracer shown above respects context Managers for [Suppressing Tracing](../advanced/suppress-tracing.md) & [Adding Metadata](../add-metadata/customize-spans.md)

### Suppress Tracing

{% tabs %}
{% tab title="Python" %}

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

{% endtab %}

{% tab title="TS" %}

```typescript
import { suppressTracing } from "@opentelemetry/core";
import { withSpan } from "@arizeai/openinference-core";
import { trace, context } from "@arizeai/phoenix-otel";

await context.with(suppressTracing(context.active()), async () => {
  // this trace will not be recorded
  await withSpan(
    async () => {
      const span = trace.getActiveSpan();
      if (span) {
        span.setAttributes({
          "input.value": "input",
          "output.value": "output",
        });
      }
    },
    {
      name: "THIS-SPAN-SHOULD-NOT-BE-TRACED",
      kind: "CHAIN",
    }
  );
});
```

{% endtab %}
{% endtabs %}

### Using Context Attributes

{% tabs %}
{% tab title="Python" %}

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

{% endtab %}

{% tab title="TS" %}

```typescript
import { withSpan } from "@arizeai/openinference-core";
import { trace } from "@arizeai/phoenix-otel";
import { context } from "@opentelemetry/api";
import { propagation } from "@opentelemetry/api";

// Set context attributes
const ctx = propagation.setActive(context.active(), {
  "session.id": "123",
});

await context.with(ctx, async () => {
  // this trace has session id "123"
  await withSpan(
    async () => {
      const span = trace.getActiveSpan();
      if (span) {
        span.setAttributes({
          "input.value": "input",
          "output.value": "output",
        });
      }
    },
    {
      name: "chain-span-with-context-attributes",
      kind: "CHAIN",
    }
  );
});
```

{% endtab %}
{% endtabs %}

### Adding Images to your Traces

OpenInference includes message types that can be useful in composing text and image or other file inputs and outputs:

{% tabs %}
{% tab title="Python" %}

```python
import openinference.instrumentation as oi

image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"
text = "describe the weather in this image"
content = [
        {"type": "text", "text": text},
        {
            "type": "image_url",
            "image_url": {"url": image_url, "detail": "low"},
        },
    ]

image = oi.Image(url=image_url)
contents = [
    oi.TextMessageContent(
        type="text",
        text=text,
    ),
    oi.ImageMessageContent(
        type="image",
        image=image,
    ),
]
messages = [
    oi.Message(
        role="user",
        contents=contents,
    )
]

with tracer.start_as_current_span(
    "my-span-name",
    openinference_span_kind="llm",
    attributes=oi.get_llm_attributes(input_messages=messages)
) as span:
    span.set_input(text)

    # Call your LLM here
    response = "This is a test response"

    span.set_output(response)
    print(response.content)
```

{% endtab %}

{% tab title="TS" %}

```typescript
import { withSpan } from "@arizeai/openinference-core";
import { getLLMAttributes } from "@arizeai/openinference-core";
import { trace } from "@arizeai/phoenix-otel";

const imageUrl =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg";
const text = "describe the weather in this image";

const messages = [
  {
    role: "user",
    contents: [
      {
        type: "text",
        text: text,
      },
      {
        type: "image",
        image: {
          url: imageUrl,
        },
      },
    ],
  },
];

await withSpan(
  async () => {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes(
        getLLMAttributes({
          inputMessages: messages,
        })
      );
      // Call your LLM here
      const response = "This is a test response";

      span.setAttributes({
        "input.value": text,
        "output.value": response,
      });
      console.log(response);
    }
  },
  {
    name: "my-span-name",
    kind: "LLM",
  }
);
```

{% endtab %}
{% endtabs %}
