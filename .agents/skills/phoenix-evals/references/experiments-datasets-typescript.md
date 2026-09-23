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
import {
  getDataset,
  getDatasetExamples,
  getDatasetInfo,
} from "@arizeai/phoenix-client/datasets";

const selector = { datasetName: "qa-test-v1" };

const dataset = await getDataset({ client, dataset: selector });     // info + examples
const info = await getDatasetInfo({ client, dataset: selector });    // name, description, metadata
const { examples, versionId } = await getDatasetExamples({ client, dataset: selector });
```

Every helper selects the dataset the same way: `{ datasetId }` or `{ datasetName }`.

## Managing Splits

Splits are named subsets — train, test, validation, or anything else you want to
slice an experiment by. `createDataset()` assigns them per example through
`splits`; the split helpers manage them on a dataset that already exists.

```typescript
import {
  createDatasetSplit,
  deleteDatasetSplit,
  getDatasetExamples,
  updateDatasetSplit,
} from "@arizeai/phoenix-client/datasets";

const dataset = { datasetName: "qa-test-v1" };
const { examples } = await getDatasetExamples({ client, dataset });
const heldOut = examples.slice(0, 10).map((example) => example.id);

const testSplit = await createDatasetSplit({
  client,
  dataset,
  name: "test",
  description: "Held-out evaluation examples",
  color: "#B8E986",
  exampleIds: heldOut,
});

// Only the fields you pass change. Adding a current member or removing a
// non-member is a no-op, so the call is safe to re-run.
await updateDatasetSplit({
  client,
  dataset,
  splitId: testSplit.id,
  addExampleIds: examples.slice(10, 12).map((example) => example.id),
  removeExampleIds: heldOut.slice(0, 1),
});

// Removes the split and its memberships, not the examples themselves.
await deleteDatasetSplit({ client, dataset, splitId: testSplit.id });
```

Split names are unique across the whole Phoenix instance, so creating or
renaming a split to a name already in use returns HTTP 409. The helpers require
a Phoenix server >= 19.20.0. Membership by the user-provided example `id`
requires a server >= 20.16.0 — against 19.20.0 through 20.15.0, pass the
example's `nodeId` instead.

## Best Practices

- **Upsert by default**: Re-upload to the same name to update in-place; use `id` on examples so the server targets specific rows instead of treating every upload as new data
- **Unique example IDs**: Example IDs are unique per dataset, so give every example its own value or omit `id` and let the server generate one
- **Versioning**: Version with new names (e.g., `qa-test-v2`) when you want a clean snapshot, not just incremental edits
- **Metadata**: Track source, category, provenance
- **Type safety**: Use the `Example` type from `@arizeai/phoenix-client/types/datasets`
