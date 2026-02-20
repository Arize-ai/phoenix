<h1 align="center" style="border-bottom: none">
    <div>
        <a href="https://phoenix.arize.com/?utm_medium=github&utm_content=header_img&utm_campaign=phoenix-client-ts">
            <picture>
                <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg">
                <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix-white.svg">
                <img alt="Arize Phoenix logo" src="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg" width="100" />
            </picture>
        </a>
        <br>
        @arizeai/phoenix-client
    </div>
</h1>

<p align="center">
    <a href="https://www.npmjs.com/package/@arizeai/phoenix-client">
        <img src="https://img.shields.io/npm/v/%40arizeai%2Fphoenix-client" alt="NPM Version">
    </a>
    <a href="https://arize-ai.github.io/phoenix/">
        <img src="https://img.shields.io/badge/docs-blue?logo=typescript&logoColor=white" alt="Documentation">
    </a>
    <img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=8e8e8b34-7900-43fa-a38f-1f070bd48c64&page=js/packages/phoenix-client/README.md" />
</p>

This package provides a TypeScript client for the [Arize Phoenix](https://github.com/Arize-ai/phoenix) API. It is still under active development and is subject to change.

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
#   "Authorization": "Bearer xxxxxx",
# }
```

Alternatively, you can pass configuration options to the client directly, and they will be prioritized over environment variables and default values.

```ts
const phoenix = createClient({
  options: {
    baseUrl: "http://localhost:6006",
    headers: {
      Authorization: "Bearer xxxxxx",
    },
  },
});
```

## Prompts

`@arizeai/phoenix-client` provides a `prompts` export that exposes utilities for working with prompts for LLMs.

### Creating a Prompt and push it to Phoenix

The `createPrompt` function can be used to create a prompt in Phoenix for version control and reuse.

```ts
import { createPrompt, promptVersion } from "@arizeai/phoenix-client/prompts";

const version = createPrompt({
  name: "my-prompt",
  description: "test-description",
  version: promptVersion({
    description: "version description here",
    modelProvider: "OPENAI",
    modelName: "gpt-3.5-turbo",
    template: [
      {
        role: "user",
        content: "{{ question }}",
      },
    ],
    invocationParameters: {
      temperature: 0.8,
    },
  }),
});
```

Prompts that are pushed to Phoenix are versioned and can be tagged.

### Pulling a Prompt from Phoenix

The `getPrompt` function can be used to pull a prompt from Phoenix based on some Prompt Identifier and returns it in the Phoenix SDK Prompt type.

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

## Datasets

The `@arizeai/phoenix-client` package allows you to create and manage datasets, which are collections of examples used for experiments and evaluation.

### Creating a Dataset

You can create a dataset by providing a name, description, and an array of examples (each with `input`, `output`, and optional `metadata`).

```ts
import { createDataset } from "@arizeai/phoenix-client/datasets";

const { datasetId } = await createDataset({
  name: "questions",
  description: "a simple dataset of questions",
  examples: [
    {
      input: { question: "What is the capital of France" },
      output: { answer: "Paris" },
      metadata: {},
    },
    {
      input: { question: "What is the capital of the USA" },
      output: { answer: "Washington D.C." },
      metadata: {},
    },
  ],
});
// You can now use datasetId to run experiments or add more examples
```

## Experiments

The `@arizeai/phoenix-client` package provides an experiments API for running and evaluating tasks on datasets. This is useful for benchmarking models, evaluating outputs, and tracking experiment results in Phoenix.

### Running an Experiment

To run an experiment, you typically:

1. Create a dataset (or use an existing one)
2. Define a task function to run on each example
3. Define one or more evaluators to score or label the outputs
4. Run the experiment and inspect the results

Below is a complete example:

```ts
import { createDataset } from "@arizeai/phoenix-client/datasets";
import {
  asExperimentEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";

// 1. Create a dataset
const { datasetId } = await createDataset({
  name: "names-dataset",
  description: "a simple dataset of names",
  examples: [
    {
      input: { name: "John" },
      output: { text: "Hello, John!" },
      metadata: {},
    },
    {
      input: { name: "Jane" },
      output: { text: "Hello, Jane!" },
      metadata: {},
    },
  ],
});

// 2. Define a task to run on each example
const task = async (example) => `hello ${example.input.name}`;

// 3. Define evaluators
const evaluators = [
  asExperimentEvaluator({
    name: "matches",
    kind: "CODE",
    evaluate: async ({ output, expected }) => {
      const matches = output === expected?.text;
      return {
        label: matches ? "matches" : "does not match",
        score: matches ? 1 : 0,
        explanation: matches
          ? "output matches expected"
          : "output does not match expected",
        metadata: {},
      };
    },
  }),
  asExperimentEvaluator({
    name: "contains-hello",
    kind: "CODE",
    evaluate: async ({ output }) => {
      const matches = typeof output === "string" && output.includes("hello");
      return {
        label: matches ? "contains hello" : "does not contain hello",
        score: matches ? 1 : 0,
        explanation: matches
          ? "output contains hello"
          : "output does not contain hello",
        metadata: {},
      };
    },
  }),
];

// 4. Run the experiment
const experiment = await runExperiment({
  dataset: { datasetId },
  task,
  evaluators,
});
```

> **Hint:** Tasks and evaluators are instrumented using [OpenTelemetry](https://opentelemetry.io/). You can view detailed traces of experiment runs and evaluations directly in the Phoenix UI for debugging and performance analysis.

## Examples

To run examples, install dependencies using `pnpm` and run:

```bash
pnpm install
pnpx tsx examples/list_datasets.ts
# change the file name to run other examples
```

## Compatibility

This package utilizes [openapi-ts](https://openapi-ts.pages.dev/) to generate the types from the Phoenix OpenAPI spec.

Because of this, this package only works with the `arize-phonix` server 8.0.0 and above.

Compatibility Table:

| Phoenix Client Version | Phoenix Server Version |
| ---------------------- | ---------------------- |
| ^2.0.0                 | ^9.0.0                 |
| ^1.0.0                 | ^8.0.0                 |

---

## Community

Join our community to connect with thousands of AI builders:

- 🌍 Join our [Slack community](https://arize-ai.slack.com/join/shared_invite/zt-11t1vbu4x-xkBIHmOREQnYnYDH1GDfCg).
- 📚 Read the [Phoenix documentation](https://arize.com/docs/phoenix).
- 💡 Ask questions and provide feedback in the _#phoenix-support_ channel.
- 🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix).
- 🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues).
- 𝕏 Follow us on [𝕏](https://twitter.com/ArizePhoenix).
- 🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45) to see where we're heading next.
