# Integration check inventory

This is a human-maintained onboarding checklist. CI does not discover runnable
docs from this file; `scripts/testing/integration_docs/integrations.json` is the
source of truth for the currently enabled set. Changes to this inventory alone
do not trigger a full integration run.

| Status | Integration | Document | Notes |
|---|---|---|---|
| Enabled | OpenAI Python | `docs/phoenix/integrations/llm-providers/openai/openai-tracing.mdx` | Checks documented output and an LLM span with a model name. |
| Enabled | OpenAI JavaScript | `docs/phoenix/integrations/llm-providers/openai/openai-node-js-sdk.mdx` | Checks documented output and an LLM span with a model name. |
| Enabled | OpenAI Go | `docs/phoenix/integrations/llm-providers/openai/openai-go-sdk.mdx` | Checks documented output and an LLM span with a model name. |

Add integrations one at a time after the runner supports their language and
example shape, credentials are declared, and the verifier checks the behavior
the page promises. Do not add an integration here as a substitute for enabling
it in `integrations.json`.
