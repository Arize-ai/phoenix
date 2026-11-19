# Datasets in TypeScript

A dataset is a versioned list of examples. Each example has an `input` object, an
optional reference `output` object, and `metadata`. Experiments read the reference
output as `expected`.

## Create a dataset

```typescript
import { createClient } from "@arizeai/phoenix-client";
import { createDataset } from "@arizeai/phoenix-client/datasets";

const client = createClient();

const { datasetId } = await createDataset({
  client,
  name: "recipe-faq",
  description: "Cooking questions with reviewed answers",
  examples: [
    {
      input: { question: "Can I use oil instead of butter in brownies?" },
      output: { answer: "Yes. Use about three quarters as much oil as butter." },
      metadata: { category: "substitutions" },
      splits: "test",
    },
  ],
});
```

`description` is required. An example can also carry `id` (a stable ID, so a later
upload updates that example instead of adding one), `spanId` (the span it came from),
and `splits` (a split name or a list of names).

`createDataset` with an existing name syncs that dataset to exactly the examples you
pass: it updates examples that match by ID (or by content), deletes the rest, and
records a new version only if something changed. `appendDatasetExamples` adds
without deleting. Don't sync over a dataset you didn't create without asking; use a
new name. To build a labeled dataset from human annotations, see
phoenix-judge-alignment.

## Build a dataset from traces

```typescript
import { getSpans } from "@arizeai/phoenix-client/spans";

const { spans } = await getSpans({
  client,
  project: { projectName: "my-app" },
  parentId: null, // root spans only
  limit: 100,
});

await createDataset({
  client,
  name: "production-sample",
  description: "Root spans sampled from my-app",
  examples: spans.map((span) => ({
    input: { question: String(span.attributes?.["input.value"] ?? "") },
    output: null, // the app's own answer isn't a reference until someone reviews it
    spanId: span.context.span_id,
  })),
});
```

## Read and update

```typescript
import {
  appendDatasetExamples,
  getDataset,
  getDatasetExamples,
} from "@arizeai/phoenix-client/datasets";

const dataset = await getDataset({ client, dataset: { datasetName: "recipe-faq" } });
const { examples, versionId } = await getDatasetExamples({
  client,
  dataset: { datasetName: "recipe-faq" },
});

await appendDatasetExamples({
  client,
  dataset: { datasetName: "recipe-faq" },
  examples: [{ input: { question: "How long should bread dough rise?" }, output: { answer: "About an hour, until doubled." } }],
});
```

A dataset selector is `{ datasetId }` or `{ datasetName }`, optionally with
`versionId` and `splits`. Each example from `getDatasetExamples` has `id` (the
user-provided ID when you set one), `nodeId` (the Phoenix ID that experiment runs
refer to as `datasetExampleId`), and `updatedAt`.

## Splits and labels

- Splits partition one dataset, for example into `train` and `test`. Set them per
  example with `splits`, or edit them later with `createDatasetSplit`,
  `updateDatasetSplit`, and `deleteDatasetSplit` (server 19.20.0 or later). Split
  names are unique across the Phoenix instance.
- Labels tag whole datasets, such as `golden` or `regression`. Create one with
  `createDatasetLabel`, then attach it with `addLabelToDataset` (server 17.16.0 or
  later). The Python client has no label helpers.

All of these are in `@arizeai/phoenix-client/datasets`.
