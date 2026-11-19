# Setup

## Python

```bash
pip install arize-phoenix-evals arize-phoenix-client
pip install openai        # or anthropic, google-genai, litellm: the SDK for your judge
```

`arize-phoenix` (the server package) already depends on both libraries.

The library is version 3.x. Older answers online describe a 1.x API (`llm_classify`,
`run_evals`, `OpenAIModel`) that no longer exists; see
[legacy-python](legacy-python.md).

### Connect to Phoenix

`Client()` reads `PHOENIX_ENDPOINT` and `PHOENIX_API_KEY` from the environment or
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

`LLM` passes extra keyword arguments to the provider client's constructor, so a bad
keyword fails when you construct `LLM`. Reasoning models, such as OpenAI's o-series
and gpt-5 families, reject a non-default `temperature`, so don't pass one to them. When
the user names a judge model, use exactly that model. Use `sync_client_kwargs=` and
`async_client_kwargs=` for client options such as `base_url`.

## TypeScript

```bash
npm install @arizeai/phoenix-evals @arizeai/phoenix-client @ai-sdk/openai
```

- `@arizeai/phoenix-evals` 2.x requires Node.js 22.12 or later and AI SDK v7. It
  depends on `ai` directly, so you install only a provider package, and the provider
  must support AI SDK v7 (for example, `@ai-sdk/openai` 4.x or `@ai-sdk/anthropic`).
- Type-checking `@arizeai/phoenix-client` requires TypeScript 5.3 or later.

### Connect to Phoenix

`createClient()` reads the same variables, `PHOENIX_ENDPOINT` and `PHOENIX_API_KEY`,
and falls back to `http://localhost:6006`. Every client helper takes an optional
`client`. If you don't pass one, the helper creates a default client.

```typescript
import { createClient } from "@arizeai/phoenix-client";

const client = createClient();
```

### Configure the judge model

Pass any AI SDK language model:

```typescript
import { openai } from "@ai-sdk/openai";

const judgeModel = openai("gpt-4o");
```
