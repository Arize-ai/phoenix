# Setup: TypeScript

Packages required for Phoenix evals and experiments.

## Installation

```bash
# Using npm
npm install @arizeai/phoenix-client @arizeai/phoenix-evals @arizeai/phoenix-otel

# Using pnpm
pnpm add @arizeai/phoenix-client @arizeai/phoenix-evals @arizeai/phoenix-otel
```

## LLM Providers

`@arizeai/phoenix-evals` requires **Vercel AI SDK v7** (`ai@^7.0.0`) and **Node.js >= 22.12**. AI SDK v7 is ESM-only, and v4/v5/v6 will not work. Install a matching major version of `ai` and v7-compatible provider packages (`@ai-sdk/*` v4+):

```bash
npm install "ai@^7" "@ai-sdk/openai@^4"      # Vercel AI SDK v7 + OpenAI
npm install "@ai-sdk/anthropic@^4"           # Anthropic
npm install "@ai-sdk/google@^4"              # Google
```

Or use direct provider SDKs:

```bash
npm install openai                 # OpenAI direct
npm install @anthropic-ai/sdk      # Anthropic direct
```

## Quick Verify

```typescript
import { createClient } from "@arizeai/phoenix-client";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { registerPhoenix } from "@arizeai/phoenix-otel";

// All imports should work
console.log("Phoenix TypeScript setup complete");
```
