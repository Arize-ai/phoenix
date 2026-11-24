# Setup

## Python

```bash
pip install arize-phoenix-evals
pip install openai                   # the SDK for your judge's provider
pip install arize-phoenix-client     # to read from or annotate a Phoenix project
pip install arize-phoenix-otel openinference-instrumentation-openai  # to trace the judge
```

Install the SDK for the provider you use, such as `openai`, `anthropic`,
`google-genai`, or `litellm`, or a decision model provider's SDK. The library runs
without Phoenix: you can score a dataframe or a list of records and keep the results
locally. `arize-phoenix-client` is needed only to read data from Phoenix or log
annotations to it, and `arize-phoenix` (the server package) already depends on both
libraries.

Evaluators trace their own runs to whatever tracer provider is registered. To see
each judge call in Phoenix, call `register()` from `phoenix.otel` and add the
OpenInference instrumentor for the judge's provider or framework, such as
`openinference-instrumentation-openai`.

The library is version 3.x. Older answers online describe a 1.x API (`llm_classify`,
`run_evals`, `OpenAIModel`) that no longer exists; see
[legacy-python](legacy-python.md).

### Connect to Phoenix

Skip this when you only score local data. `Client()` reads `PHOENIX_ENDPOINT` and `PHOENIX_API_KEY` from the environment or
from the `.env.phoenix` file that `px setup` writes. Without `PHOENIX_ENDPOINT`, it
tries `PHOENIX_COLLECTOR_ENDPOINT`, then falls back to `http://localhost:6006`.

```python
from phoenix.client import Client

client = Client()  # or Client(base_url="https://phoenix.example.com", api_key="...")
```

### Configure the judge model

`LLM` wraps a provider SDK. It reads the provider's usual key variable, such as
`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.

```python
from phoenix.evals import LLM

judge_llm = LLM(provider="openai", model="gpt-4o")
# LLM(provider="anthropic", model="claude-sonnet-4-6")
```

Providers: `openai`, `anthropic`, `google`, `azure`, `bedrock`, `vertex` (also
`vertex_ai`), and `litellm`. To see which ones are installed and configured, run:

```python
from phoenix.evals.llm import show_provider_availability

show_provider_availability()
```

### Use a decision model

A `DecisionModel` takes the place of `LLM` in any classification evaluator. It picks a
label and returns label probabilities, with no explanation, for much less than an LLM
call. Providers include `openai` and `typesafe`.

```python
from phoenix.evals import DecisionModel
from phoenix.evals.decision import show_decision_provider_availability

judge = DecisionModel(provider="openai", model="gpt-6-luna")
show_decision_provider_availability()
```

See [Configuring the decision model](https://arize.com/docs/phoenix/evaluation/how-to-evals/configuring-the-decision-model).

### Model options

`LLM` passes extra keyword arguments to the provider client's constructor, so a bad
keyword fails when you construct `LLM`. Invocation parameters vary by provider and
model. Some reasoning models reject `temperature`, so omit it unless the provider
supports it. When the user names a judge model, use exactly that model. Use
`sync_client_kwargs=` and `async_client_kwargs=` for client options such as
`base_url`.

## TypeScript

```bash
npm install @arizeai/phoenix-evals @ai-sdk/openai
npm install @arizeai/phoenix-client   # to read from or annotate a Phoenix project
```

- `@arizeai/phoenix-evals` 2.x requires Node.js 22.12 or later and AI SDK v7. It
  depends on `ai` directly, so you install only a provider package, and the provider
  must support AI SDK v7 (for example, `@ai-sdk/openai` 4.x or `@ai-sdk/anthropic`).
- `@arizeai/phoenix-client` 8.x requires Node.js 22.15 or later.
- Type-checking `@arizeai/phoenix-client` requires TypeScript 5.3 or later.

### Connect to Phoenix

Skip this when you only score local data. `createClient()` reads the same variables, `PHOENIX_ENDPOINT` and `PHOENIX_API_KEY`,
and falls back to `http://localhost:6006`. Every client helper takes an optional
`client`. If you don't pass one, the helper creates a default client.

```typescript
import { createClient } from "@arizeai/phoenix-client";

const client = createClient();
```

### Configure the judge model

Pass any AI SDK language model, or a decision model in its place:

```typescript
import { openai } from "@ai-sdk/openai";

const judgeModel = openai("gpt-4o");
const decisionJudge = openai.decisionModel("gpt-6-luna");
```

A decision model returns a label with probabilities in `metadata.probabilities` and
no explanation. With OpenAI, it needs `@ai-sdk/openai` 4.0.89 or later.
