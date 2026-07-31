# Setup: TypeScript

Packages required for Phoenix evals and experiments.

## Installation

```bash
# Using npm
npm install @arizeai/phoenix-client @arizeai/phoenix-evals @arizeai/phoenix-otel

# Using pnpm
pnpm add @arizeai/phoenix-client @arizeai/phoenix-evals @arizeai/phoenix-otel
```

## Requirements

`@arizeai/phoenix-evals` 2.x requires **Node.js >= 22.12** and AI SDK **v7**. It
depends on `ai@^7` and `@ai-sdk/otel@^1` directly, so you only need to install a
provider — but that provider must be AI SDK v7-compatible (e.g. `@ai-sdk/openai`
v4). `@arizeai/phoenix-client` 7.x also requires the `ai` peer at `^7.0.0`.

Type-checking the published `@arizeai/phoenix-client` declarations requires
**TypeScript >= 5.3** (the prompts entry uses `with { "resolution-mode": "import" }`
import attributes, which `skipLibCheck` does not suppress).

## LLM Providers

For LLM-as-judge evaluators, install a Vercel AI SDK provider:

```bash
npm install @ai-sdk/openai         # OpenAI
npm install @ai-sdk/anthropic      # Anthropic
npm install @ai-sdk/google         # Google
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
import { register } from "@arizeai/phoenix-otel";

// All imports should work
console.log("Phoenix TypeScript setup complete");
```
