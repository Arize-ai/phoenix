---
"@arizeai/phoenix-client": major
---

Require AI SDK v7 for `@arizeai/phoenix-client`. `ai` v7 and `@ai-sdk/otel` are now optional peer dependencies, and experiment and eval-test internals register safe AI SDK task tracing without capturing request headers. Core client APIs retain Node.js 18 compatibility; AI SDK v7-backed features require the Node.js version supported by AI SDK v7.
