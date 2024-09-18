# Playground

Authors: @mikeldking

As a user of Phoenix I don't want to have to go back to my IDE to iterate on a prompt. I don’t have to worry about programming languages or dependencies. I want to be able to use the data stored in Phoenix (spans, datasets) and run them through prompt(s) and prompt template(s).

## Use-cases

A user may want to use the playground to:

- Test a prompt template
- LLM Replay: replay a template or prompt change on an LLM Span
- Run a template change on a dataset (sweep over a set of inputs)
- A/B Testing of models and templates
- evaluation template creation: run an evaluation template on a single chosen production span or Dataset - Workflow is testing your Evals and be able to save as experiment
- Synthetic data Generation - Use to generate synthetic data, add columns to current rows of data in a dataset, to help create test data

## Terminology

- **operation ** Refers to how the LLM is invoked (chat, completion). We will consider chat to be higher priority (https://opentelemetry.io/docs/specs/semconv/attributes-registry/gen-ai/)

### Prompt Template

As an AI engineer, I may want to use a prompt playground to explore synthesis, cost, latency, etc. under different scenarios. This means that the playground needs to be more flexible than a vendor’s playground as it needs “unify” the API across vendors.

As a user, I want to be able to "run" a template and see the results as the tokens arrive. But I also want this data to be recorded (as a span) so that I can use it for datasets and annotations (e.g. stash the ones that I like).

### LLM Replay

As an AI engineer that is already using Phoenix tracing, I want the ability to take an LLM span and replay the synthesis to see if a tweaked response will make any difference in the output. This means that all the necessary fields for synthesis must be able to be translated from semantic attribute values to the playground.

- llm vendor
- llm name
- invocation parameters
- invocation parameters
- messages and roles
- tools
- output schema (missing?)

The above values will have to be translated from the semantic attributes to a corresponding values for a single invocation.

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
