# @arizeai/phoenix-client

## 1.3.0

### Minor Changes

- 536258e: feat(phoenix-client): Export traces from experiments to Phoenix

## 1.2.0

### Minor Changes

- f7fae3b: feat(phoenix-client): Record experiment results to Phoenix server
- 9273417: feat: Enqueue experiment runs
- 4dd23c8: support for annotation logging on spans

## 1.1.0

### Minor Changes

- fff5511: feat: Update openapi schema with new endpoints

## 1.0.2

### Patch Changes

- c99ee6f: Update type definitions to include max_completion_tokens openai parameter

## 1.0.1

### Patch Changes

- 2ffeb64: fix: Remove runtime dependency on `ai` package

## 1.0.0

### Major Changes

- 3f9e392: feat: Add support for Phoenix Prompts

  Phoenix can now manage Prompts, and the `@arizeai/phoenix-client` package has been updated to support this.

  In this initial release, we support the following:

  - Fully typed Prompt REST endpoints
  - Prompt Pulling
  - Converting a Prompt to invocation parameters for the following LLM SDKs:
    - OpenAI
    - Anthropic
    - Vercel AI SDK
      - You can use any of the Vercel AI SDK Providers with your prompt

### Patch Changes

- 95bfc7c: Add the ability to push prompts via the typescript client sdk

## 0.0.1

### Patch Changes

- 76a9cdf: pre-release of phoenix-client
