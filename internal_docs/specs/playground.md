# Playground

Authors: @mikeldking

As a user of Phoenix I don't want to have to go back to my IDE to iterate on a prompt. I don’t have to worry about programming languages or dependencies. I want to be able to use the data stored in Phoenix (spans, datasets) and run them through prompt(s) and prompt template(s).

## Terminology

- **operation ** Refers to how the LLM is invoked (chat, text_completion). We will consider chat to be higher priority (https://opentelemetry.io/docs/specs/semconv/attributes-registry/gen-ai/)
- playground input source - refers to whether the input to the template is "manual" e.g. modifiable by the user or "dataset".

## Use-cases

A user may want to use the playground to:

- Test a prompt template
- LLM Replay: replay a template or prompt change on an LLM Span - to live debug an improvement
- Run a template change on a dataset (sweep over a set of inputs) - e.g. a prompt change experiment
- A/B Testing of models and templates
- evaluation template creation: run an evaluation template on a single chosen production span or Dataset - Workflow is testing your Evals and be able to save as experiment
- Synthetic data Generation - Use to generate synthetic data, add columns to current rows of data in a dataset, to help create test data

### Prompt Template

As an AI engineer, I may want to use a prompt playground to explore synthesis, cost, latency, etc. under different scenarios. This means that the playground needs to be more flexible than a vendor’s playground as it needs “unify” the API across vendors.

As a user, I want to be able to "run" a template and see the results as the tokens arrive. But I also want this data to be recorded (as a span) so that I can use it for datasets and annotations (e.g. stash the ones that I like).

### LLM Replay

As an AI engineer that is already using Phoenix tracing, I want the ability to take an LLM span and replay the synthesis to see if a tweaked response will make any difference in the output. This means that all the necessary fields for synthesis must be able to be translated from semantic attribute values to the playground.

- llm vendor
- llm name
- operation type (chat, text_completion)
- invocation parameters
- messages and roles
- tools
- output schema

The above values will have to be translated from the span to a corresponding values in the playground for invocation.

Below is a typical attribute payload for an chat llm span:

```typescript
{

  llm: {
    output_messages: [
      {
        message: {
          content: "This is an AI Answer",
          role: "assistant",
        },
      },
    ],
    model_name: "gpt-3.5-turbo",
    token_count: { completion: 9.0, prompt: 1881.0, total: 1890.0 },
    input_messages: [
      {
        message: {
          content: "You are a chatbot",
          role: "system",
        },
      },
      {
        message: {
          content: "Anser me the following question. Are you sentient?",
          role: "user",
        },
      },
    ],
    invocation_parameters:
      '{"context_window": 16384, "num_output": -1, "is_chat_model": true, "is_function_calling_model": true, "model_name": "gpt-3.5-turbo"}',
  },
  openinference: { span: { kind: "LLM" } },
};
```

For chat the following mapping will be used:

- llm.input_messages -> invocation.messages
- llm.invocation_parameters -> invocation.parameters
- llm.model_name -> invocation.model (e.g. vendor + model_name )
- llm.tools -> invocation.tools
- llm.tool_selection (missing) -> playground.tool_selection (default to auto)
- (TBD) -> invocation.output_schema (output schema for JSON mode)

### A/B Testing

As an AI engineer I want the ability to create “multiple” playgrounds to answer certain types of questions:

- Does prompt A produce better responses
- Does model X produce better responses

In some cases I want to have things in A / B sync’d and sometimes I don’t. For that reason the UI should allow the user to:

- Sync models - The user is adjusting the template or invocation parameters
- Sync templates - The user is adjusting the model
- Sync inputs - The user is testing different inputs

### Evaluation Template

As an AI engineer I want to ask questions about a previously recorded synthesis (e.g. LLM span)

## Technical Features

The following technical features are required for the playground:

**Frontend**

- Credential storage in local storage
- Span attribute to playground state translation

**Backend**

- LLM invocation interface (GraphQL or other)
- Span recording during synthesis
- Playground "session" tracking
- Playground dataset invocation tracking
- Streaming of synthesis results

## Tracing Needs

In order for spans -> playground invocation to be seamless, we must capture all necessary invocation parameters. This includes:

- LLM/genai system - e.g. openai / anthropic etc.
- Output Schema - LLMs can adhere to OpenAPI schemas
