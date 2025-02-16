---
"@arizeai/phoenix-client": major
---

feat: Add support for Phoenix Prompts

Phoenix can now manage Prompts, and the `@arizeai/phoenix-client` package has been updated to support this.

In this initial release, we support the following:

- Fully typed Prompt REST endpoints
- Prompt Pulling
- Converting a Prompt to invocation parameters for the following LLM SDKs:
  - OpenAI
  - Anthropic
  - Vercel AI SDK
    - You can use any of the Vercel AI SDK Providers with your prompt
