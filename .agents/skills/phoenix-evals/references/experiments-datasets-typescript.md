# Experiments: Datasets in TypeScript

Creating and managing evaluation datasets.

## Creating Datasets

`createDataset()` upserts: if a dataset with the same name already exists it is updated to match the provided examples. Re-running with identical inputs is a no-op.

```typescript
import { createClient } from "@arizeai/phoenix-client";
import { createDataset } from "@arizeai/phoenix-client/datasets";

const client = createClient();

const { datasetId } = await createDataset({
  client,
  name: "qa-test-v1",
  examples: [
    {
      input: { question: "What is 2+2?" },
      output: { answer: "4" },
      metadata: { category: "math" },
    },
  ],
});

// With stable example IDs for targeted updates across uploads
const { datasetId } = await createDataset({
  client,
  name: "qa-test-v1",
  examples: [
    {
      id: "q-001",                        // stable ID — server updates this row, not inserts
      input: { question: "What is 2+2?" },
      output: { answer: "4" },
      metadata: { category: "math" },
    },
  ],
});
```

## Example Structure

```typescript
interface Example {
  input: Record<string, unknown>;    // Task input
  output?: Record<string, unknown> | null;  // Expected output
  metadata?: Record<string, unknown> | null; // Additional context
  splits?: string | string[] | null; // Split assignment ("train", ["train", "easy"], etc.)
  spanId?: string | null;            // OTEL span ID to link back to source trace
  id?: string | null;                // Stable user-provided ID; server updates matching row
}
```

## From Production Traces

```typescript
import { getSpans } from "@arizeai/phoenix-client/spans";

const { spans } = await getSpans({
  project: { projectName: "my-app" },
  parentId: null, // root spans only
  limit: 100,
});

const examples = spans.map((span) => ({
  input: { query: span.attributes?.["input.value"] },
  output: { response: span.attributes?.["output.value"] },
  metadata: { spanId: span.context.span_id },
}));

await createDataset({ client, name: "production-sample", examples });
```

## Retrieving Datasets

```typescript
import { getDataset, listDatasets } from "@arizeai/phoenix-client/datasets";

// `dataset` is `{ datasetId }` or `{ datasetName }` in every helper
const dataset = await getDataset({ client, dataset: { datasetName: "qa-test-v1" } });
const all = await listDatasets({ client });
```

## Managing Splits

`createDataset()` assigns splits per example via `splits`; these helpers edit splits on an existing dataset (server >= 19.20.0):

```typescript
import {
  createDatasetSplit,
  deleteDatasetSplit,
  updateDatasetSplit,
} from "@arizeai/phoenix-client/datasets";

const dataset = { datasetName: "qa-test-v1" };
const split = await createDatasetSplit({ client, dataset, name: "test", exampleIds: ["ex-1", "ex-2"] });
await updateDatasetSplit({ client, dataset, splitId: split.id, addExampleIds: ["ex-3"], removeExampleIds: ["ex-1"] }); // idempotent
await deleteDatasetSplit({ client, dataset, splitId: split.id }); // keeps the examples
```

Split names are unique instance-wide (409 on conflict). Before server 20.16.0, `exampleIds` must be example `nodeId`s, not user-provided `id`s.

## Best Practices

- **Upsert by default**: Re-upload to the same name to update in-place; set a unique-per-dataset `id` on examples so the server targets specific rows instead of treating every upload as new data
- **Versioning**: Version with new names (e.g., `qa-test-v2`) when you want a clean snapshot, not just incremental edits
- **Metadata**: Track source, category, provenance
- **Type safety**: Use the `Example` type from `@arizeai/phoenix-client/types/datasets`
