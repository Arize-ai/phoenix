---
"@arizeai/phoenix-client": patch
---

Move `@anthropic-ai/sdk`, `openai`, and `ai` from `optionalDependencies` to optional `peerDependencies`. Consumers no longer get these provider SDKs installed automatically — they are only installed if the consumer already depends on them.
