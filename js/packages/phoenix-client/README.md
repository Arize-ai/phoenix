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

For credentials that can expire, create an authenticated fetch implementation
and pass it to the client. The token provider controls storage and refresh-token
rotation. Requests that receive a `401` share one refresh operation and are
retried once.

```ts
import { createAuthFetch, createClient } from "@arizeai/phoenix-client";

const authFetch = createAuthFetch({
  getAccessToken: async ({ forceRefresh }) => {
    if (forceRefresh) {
      await refreshAndPersistTokens();
    }
    return loadTokens().accessToken;
  },
});

const phoenix = createClient({
  options: {
    baseUrl: "http://localhost:6006",
    fetch: authFetch,
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

> **Note:** These provider SDKs are optional peer dependencies — installing `@arizeai/phoenix-client` does not pull them in. Install the one you convert to yourself, e.g. `npm install ai`, `npm install openai`, or `npm install @anthropic-ai/sdk`. Calling `toSDK({ sdk: "ai" | "openai" | "anthropic" })` without the matching SDK installed fails at runtime.

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

## Eval Tests

The package also exposes Vitest and Jest submodules for writing
dataset-backed evaluations as normal test suites.

```bash
npm install -D @arizeai/phoenix-client vitest dotenv
```

```ts
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

px.describe(
  "text-to-sql",
  () => {
    px.test(
      "select all",
      {
        input: { userQuery: "Get all users" },
        expected: { sql: "SELECT * FROM users;" },
      },
      async ({ input, expected }) => {
        const sql = await generateSql(input.userQuery);
        px.logOutput({ sql });
        expect(sql).toEqual(expected?.sql);
      }
    );
  },
  {
    acceptanceCriteria: [
      // every test must pass (100% of the auto-logged `pass` boolean is true)
      {
        annotationName: "pass",
        metric: "passRate",
        passFn: (a) => a.score === true,
        minPassRate: 1,
      },
    ],
  }
);
```

The reference output can be supplied under any one of three interchangeable
keys — `expected`, `reference`, or `output` — so you can match whichever name
your evaluators expect. They all resolve to the same slot: the dataset
example's `output`, exposed to evaluators and the test body as `expected`.
Supplying more than one at a time is a type error.

Use `@arizeai/phoenix-client/vitest/reporter` or
`@arizeai/phoenix-client/jest/reporter` to print Phoenix dataset and
experiment links, annotation aggregates, and acceptance criteria at the end
of a run. Acceptance criteria gate the suite after it finishes — `average`
checks an aggregate bar (so CI can allow a mean of 80% while still running
every case), and `passRate` requires a minimum fraction of runs to satisfy a
per-run `passFn` predicate.

See the [`docs/`](./docs) folder — `ci-evals.mdx`, `ci-evals-vitest.mdx`,
`ci-evals-jest.mdx`, and `ci-evals-annotations.mdx` — for setup, the full
`describe` / `test` / `test.each` API, acceptance criteria, repetitions,
dry-run mode, and annotation details.

## Traces

The `@arizeai/phoenix-client` package provides a `traces` export for retrieving trace data from Phoenix projects.

### Fetching Traces

Use `getTraces` to retrieve traces with optional filtering, sorting, and pagination.

```ts
import { getTraces } from "@arizeai/phoenix-client/traces";

// Get the latest 10 traces
const result = await getTraces({
  project: { projectName: "my-project" },
  limit: 10,
});
console.log(result.data); // array of trace objects

// Filter by time range and include full span details
const detailed = await getTraces({
  project: { projectName: "my-project" },
  startTime: "2026-03-01T00:00:00Z",
  endTime: new Date(),
  includeSpans: true,
  sort: "latency_ms",
  order: "desc",
});

// Filter by session
const sessionTraces = await getTraces({
  project: { projectName: "my-project" },
  sessionId: "my-session-id",
});
```

| Parameter      | Type                           | Description                                |
| -------------- | ------------------------------ | ------------------------------------------ |
| `project`      | `ProjectIdentifier`            | The project (by name or ID) — **required** |
| `startTime`    | `Date \| string \| null`       | Inclusive lower bound on trace start time  |
| `endTime`      | `Date \| string \| null`       | Exclusive upper bound on trace start time  |
| `sort`         | `"start_time" \| "latency_ms"` | Sort field                                 |
| `order`        | `"asc" \| "desc"`              | Sort direction                             |
| `limit`        | `number`                       | Maximum number of traces to return         |
| `cursor`       | `string \| null`               | Pagination cursor (Trace GlobalID)         |
| `includeSpans` | `boolean`                      | Include full span details for each trace   |
| `sessionId`    | `string \| string[] \| null`   | Filter traces by session identifier(s)     |

### Pagination

Use the `cursor` from a previous result to fetch the next page:

```ts
import { getTraces } from "@arizeai/phoenix-client/traces";

let cursor: string | null = null;
const allTraces = [];

do {
  const result = await getTraces({
    project: { projectName: "my-project" },
    limit: 50,
    cursor,
  });
  allTraces.push(...result.data);
  cursor = result.nextCursor ?? null;
} while (cursor);
```

> **Note:** Requires Phoenix server >= 13.15.0.

### Trace Annotations

Add structured feedback (label/score by name) to entire traces. Use `addTraceAnnotation` for one trace or `logTraceAnnotations` for batches.

```ts
import {
  addTraceAnnotation,
  logTraceAnnotations,
} from "@arizeai/phoenix-client/traces";

// Single annotation
const result = await addTraceAnnotation({
  traceAnnotation: {
    traceId: "abc123",
    name: "correctness",
    label: "correct",
    score: 1.0,
    annotatorKind: "HUMAN",
  },
  sync: true, // returns { id: "..." } when sync, null when async
});

// Batch
await logTraceAnnotations({
  traceAnnotations: [
    {
      traceId: "abc123",
      name: "correctness",
      label: "correct",
      score: 1.0,
      annotatorKind: "HUMAN",
    },
    {
      traceId: "def456",
      name: "faithfulness",
      label: "faithful",
      score: 0.9,
      annotatorKind: "LLM",
    },
  ],
  sync: true,
});
```

The reserved name `note` is rejected — use `addTraceNote` instead for free-form notes (see below).

### Trace Notes

Notes are a special type of annotation for free-form text — useful for open coding, where reviewers leave qualitative observations on a trace before any rubric exists. Multiple notes can coexist on the same trace.

```ts
import { addTraceNote } from "@arizeai/phoenix-client/traces";

await addTraceNote({
  traceNote: {
    traceId: "abc123",
    note: "Needs follow-up — unexpected tool call sequence",
  },
});
```

> **Note:** `addTraceNote` requires Phoenix server >= 14.13.0.

## Spans

The `@arizeai/phoenix-client` package provides a `spans` export for querying spans with powerful filtering.

### Fetching Spans

Use `getSpans` to retrieve spans with filtering by kind, status, name, trace, and more.

```ts
import { getSpans } from "@arizeai/phoenix-client/spans";

// Get recent spans
const result = await getSpans({
  project: { projectName: "my-project" },
  limit: 100,
});

// Filter by span kind and status
const errorLLMSpans = await getSpans({
  project: { projectName: "my-project" },
  spanKind: "LLM",
  statusCode: "ERROR",
});

// Filter by name and trace
const spans = await getSpans({
  project: { projectName: "my-project" },
  name: "chat_completion",
  traceIds: ["trace-abc", "trace-def"],
});

// Root spans only
const rootSpans = await getSpans({
  project: { projectName: "my-project" },
  parentId: null,
});
```

| Parameter    | Type                                 | Description                                                     |
| ------------ | ------------------------------------ | --------------------------------------------------------------- |
| `project`    | `ProjectIdentifier`                  | The project (by name or ID) — **required**                      |
| `startTime`  | `Date \| string \| null`             | Inclusive lower bound time                                      |
| `endTime`    | `Date \| string \| null`             | Exclusive upper bound time                                      |
| `limit`      | `number`                             | Maximum number of spans to return                               |
| `cursor`     | `string \| null`                     | Pagination cursor (Span GlobalID)                               |
| `traceIds`   | `string[] \| null`                   | Filter by trace ID(s)                                           |
| `parentId`   | `string \| null`                     | Filter by parent span ID (`null` for root spans only)           |
| `name`       | `string \| string[] \| null`         | Filter by span name(s)                                          |
| `spanKind`   | `SpanKindFilter \| SpanKindFilter[]` | Filter by span kind (`LLM`, `CHAIN`, `TOOL`, `RETRIEVER`, etc.) |
| `statusCode` | `SpanStatusCode \| SpanStatusCode[]` | Filter by status code (`OK`, `ERROR`, `UNSET`)                  |

### Logging Spans

Use `logSpans` to submit spans directly to a project using Phoenix's simplified span structure — the same shape returned by `getSpans`. This is useful for backfilling or migrating spans without going through OpenTelemetry. If your application is already instrumented with OpenTelemetry, export spans via `@arizeai/phoenix-otel` instead.

```ts
import { logSpans } from "@arizeai/phoenix-client/spans";

const result = await logSpans({
  project: { projectName: "my-project" },
  spans: [
    {
      name: "chat_completion",
      context: { trace_id: "abc123", span_id: "def456" },
      span_kind: "LLM",
      start_time: "2024-01-01T00:00:00Z",
      end_time: "2024-01-01T00:00:01Z",
      status_code: "OK",
      attributes: { "llm.model_name": "gpt-4" },
    },
  ],
});
console.log(`Queued ${result.totalQueued} of ${result.totalReceived} spans`);
```

If any span in the request is invalid or a duplicate of a span that already exists, none of the spans are queued and `logSpans` throws a `SpanCreationError` with `invalidSpans` and `duplicateSpans` details.

## Span Annotations

The `spans` export also provides functions for managing span annotations — adding evaluations, feedback, and labels to spans.

### Adding a Single Annotation

```ts
import { addSpanAnnotation } from "@arizeai/phoenix-client/spans";

const result = await addSpanAnnotation({
  spanAnnotation: {
    spanId: "f8b1c3a2d4e5f678",
    name: "correctness",
    label: "correct",
    score: 1.0,
    explanation: "The response accurately answered the question",
    annotatorKind: "HUMAN",
  },
  sync: true, // wait for the annotation ID to be returned
});
// result: { id: "annotation-id" } when sync: true, null when sync: false
```

### Logging Multiple Annotations

```ts
import { logSpanAnnotations } from "@arizeai/phoenix-client/spans";

const results = await logSpanAnnotations({
  spanAnnotations: [
    {
      spanId: "f8b1c3a2d4e5f678",
      name: "relevance",
      label: "relevant",
      score: 0.95,
      annotatorKind: "LLM",
    },
    {
      spanId: "a1b2c3d4e5f67890",
      name: "relevance",
      label: "irrelevant",
      score: 0.2,
      annotatorKind: "LLM",
    },
  ],
  sync: true,
});
// results: [{ id: "..." }, { id: "..." }]
```

### Fetching Span Annotations

```ts
import { getSpanAnnotations } from "@arizeai/phoenix-client/spans";

const result = await getSpanAnnotations({
  project: { projectName: "my-project" },
  spanIds: ["f8b1c3a2d4e5f678", "a1b2c3d4e5f67890"],
  includeAnnotationNames: ["relevance", "correctness"],
  limit: 100,
});
console.log(result.data); // array of span annotation objects
```

| Parameter                | Type                | Description                                      |
| ------------------------ | ------------------- | ------------------------------------------------ |
| `project`                | `ProjectIdentifier` | The project (by name or ID) — **required**       |
| `spanIds`                | `string[]`          | Span IDs to fetch annotations for — **required** |
| `includeAnnotationNames` | `string[]`          | Only return annotations with these names         |
| `excludeAnnotationNames` | `string[]`          | Exclude annotations with these names             |
| `cursor`                 | `string \| null`    | Pagination cursor                                |
| `limit`                  | `number`            | Maximum annotations to return                    |

## Sessions

The `@arizeai/phoenix-client` package provides a `sessions` export for managing conversation sessions and their annotations.

### Fetching Sessions

Use `listSessions` to list all sessions for a project, or `getSession` to retrieve a single session by ID.

```ts
import {
  listSessions,
  getSession,
  addSessionAnnotation,
  addSessionNote,
} from "@arizeai/phoenix-client/sessions";

// List all sessions for a project
const sessions = await listSessions({
  project: "my-project",
});

for (const session of sessions) {
  console.log(
    `Session: ${session.sessionId}, Traces: ${session.traces.length}`
  );
}

// Get a single session by its ID
const session = await getSession({ sessionId: "my-session-id" });
console.log(session.traces); // array of trace summaries in the session
```

### Adding Session Annotations

```ts
await addSessionAnnotation({
  sessionAnnotation: {
    sessionId: "my-session-id",
    name: "user-satisfaction",
    label: "satisfied",
    score: 0.9,
    annotatorKind: "HUMAN",
  },
});
```

### Adding Session Notes

Session notes require Phoenix server `14.17.0` or newer.

```ts
await addSessionNote({
  sessionNote: {
    sessionId: "my-session-id",
    note: "Needs review",
  },
});
```

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

- 🌍 Join our [Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g).
- 📚 Read the [Phoenix documentation](https://arize.com/docs/phoenix).
- 💡 Ask questions and provide feedback in the _#phoenix-support_ channel.
- 🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix).
- 🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues).
- 𝕏 Follow us on [𝕏](https://twitter.com/ArizePhoenix).
- 💼 Follow us on [LinkedIn](https://www.linkedin.com/showcase/113218220).
- 🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45) to see where we're heading next.
