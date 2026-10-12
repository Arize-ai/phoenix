---
"@arizeai/phoenix-otel": patch
---

Upgrade `@arizeai/openinference-vercel` to 3.3.0, so AI SDK decision model calls (`experimental_decide`, e.g. OpenAI's `gpt-6-luna` or TypeSafe's Jev) are traced as `DECISION` spans with the decision state as input, the answers as output, and the model name, provider and token counts. They were previously recorded as `UNKNOWN` spans with no input or output.
