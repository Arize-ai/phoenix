# @arizeai/phoenix-client

This package provides a client for the Phoenix API. It is still under active development and is subject to change.

It utilizes [openapi-ts](https://openapi-ts.pages.dev/) to generate the types from the Phoenix OpenAPI spec.

## Installation

```bash
# or yarn, pnpm, bun, etc...
npm install @arizeai/phoenix-client
```

## Configuration

The client will automatically read environment variables from your environment, if available.

The following environment variables are used:

- `PHOENIX_HOST` - The base URL of the Phoenix API.
- `PHOENIX_API_KEY` - The API key to use for authentication.
- `PHOENIX_CLIENT_HEADERS` - Custom headers to add to all requests. A JSON stringified object.

```bash
PHOENIX_HOST='http://localhost:12345' PHOENIX_API_KEY='xxxxxx' pnpx tsx examples/list_datasets.ts
# emits the following request:
# GET http://localhost:12345/v1/datasets
# headers: {
#   "Authorization": "bearer xxxxxx",
# }
```

Alternatively, you can pass configuration options to the client directly, and they will be prioritized over environment variables and default values.

```ts
const phoenix = createClient({
  options: {
    baseUrl: "http://localhost:6006",
    headers: {
      Authorization: "bearer xxxxxx",
    },
  },
});
```

## Prompts

`@arizeai/phoenix-client` provides a `prompts` export that exposes various utilities for working with prompts.

### Pulling a Prompt from Phoenix

The `getPrompt` helper function can be used to pull a prompt from Phoenix based on some Prompt Identifier and returns it in the Phoenix SDK Prompt type.

```ts
import { getPrompt } from "@arizeai/phoenix-client/prompts";

const prompt = await getPrompt({ name: "my-prompt" });
// ^ you now have a strongly-typed prompt object, in the Phoenix SDK Prompt type

const promptByTag = await getPrompt({ tag: "production", name: "my-prompt" });
// ^ you can optionally specify a tag to filter by

const promptByVersionId = await getPrompt({
  versionId: "1234567890",
});
// ^ you can optionally specify a prompt version Id to filter by
```

### Using a Phoenix Prompt with an LLM Provider SDK

The `toSDK` helper function can be used to convert a Phoenix Prompt to the format expected by an LLM provider SDK. You can then use the LLM provider SDK as normal, with your prompt.

If your Prompt is saved in Phoenix as `openai`, you can use the `toSDK` function to convert the prompt to the format expected by OpenAI, or even Anthropic and Vercel AI SDK. We will do a best
effort conversion to your LLM provider SDK of choice.

The following LLM provider SDKs are supported:

- Vercel AI SDK: `ai` [ai](https://www.npmjs.com/package/ai)
- OpenAI: `openai` [openai](https://www.npmjs.com/package/openai)
- Anthropic: `anthropic` [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk)

```ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getPrompt, toSDK } from "@arizeai/phoenix-client/prompts";

const prompt = await getPrompt({ name: "my-prompt" });
const promptAsAI = toSDK({
  sdk: "ai",
  // ^ the SDK you want to convert the prompt to, supported SDKs are listed above
  variables: {
    "my-variable": "my-value",
  },
  // ^ you can format the prompt with variables, if the prompt has any variables in its template
  //   the format (Mustache, F-string, etc.) is specified in the Prompt itself
  prompt,
});
// ^ promptAsAI is now in the format expected by the Vercel AI SDK generateText function

const response = await generateText({
  model: openai(prompt.model_name),
  // ^ the model adapter provided by the Vercel AI SDK can be swapped out for any other model
  //   adapter supported by the Vercel AI SDK. Take care to use the correct model name for the
  //   LLM provider you are using.
  ...promptAsAI,
});
```

## REST Endpoints

The client provides a REST API for all endpoints defined in the [Phoenix OpenAPI spec](https://github.com/Arize-ai/phoenix/blob/main/schemas/openapi.json).

Endpoints are accessible via strongly-typed string literals and TypeScript auto-completion inside of the client object.

```ts
import { createClient } from "@arizeai/phoenix-client";

const phoenix = createClient();

// Get all datasets
const datasets = await phoenix.GET("/v1/datasets");

// Get specific prompt
const prompt = await phoenix.GET("/v1/prompts/{prompt_identifier}/latest", {
  params: {
    path: {
      prompt_identifier: "my-prompt",
    },
  },
});
```

A comprehensive overview of the available endpoints and their parameters is available in the OpenAPI viewer within Phoenix, or in the [Phoenix OpenAPI spec](https://github.com/Arize-ai/phoenix/blob/main/schemas/openapi.json).

## Examples

To run examples, install dependencies using `pnpm` and run:

```bash
pnpm install
pnpx tsx examples/list_datasets.ts
# change the file name to run other examples
```
