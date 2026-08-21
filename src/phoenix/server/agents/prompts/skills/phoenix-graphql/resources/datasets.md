# Dataset, DatasetExample

## Reaching a dataset

There is **no `getDatasetByName`** — fetch via `node(id:) { ... on Dataset { ... } }` or the `datasets(filter: DatasetFilter, sort)` connection.

## Dataset fields

- `name`, `description`, `metadata`
- `exampleCount(datasetVersionId)`
- `examples(datasetVersionId, splitIds, first, after, filter: String, filterIds)` → `DatasetExampleConnection`
- `versions(first, after, sort)` → `DatasetVersionConnection`
- `splits`, `labels`
- `experiments(first, after, filterCondition, filterIds)`, `experimentCount`

Gotchas:

- **The version argument is `datasetVersionId` everywhere** (not `versionId`); omit it to get the latest version.
- `examples` has two distinct filter args: `filter: String` (free-text search over input/output/metadata) and `filterIds: [GlobalID!]` (membership lookup).
- `experiments` uses `filterCondition: String` (not `filter`).

## DatasetExample fields

- `externalId`
- `revision(datasetVersionId) { input output metadata revisionKind }` — `input`/`output`/`metadata` are `JSON`; `revisionKind` is `CREATE`/`PATCH`/`DELETE`.
- `span`
- `datasetSplits`
- `experimentRuns(experimentIds, first, after)`

## Example

```graphql
query DatasetExamples($id: ID!, $first: Int = 20) {
  node(id: $id) {
    ... on Dataset {
      name
      exampleCount
      examples(first: $first) {
        edges { node { id externalId revision { input output metadata } } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
```

## Mutations

Dataset names are unique. Before creating, query `datasets(filter:)`; if the desired name is
already taken, use the existing dataset or choose a new name instead of retrying. When resolving a
dataset by name, require exactly one match. Pass example `input`, `output`, `metadata`, and dataset
metadata as JSON objects, never JSON-encoded strings. Read representative existing examples before
adding or patching rows so the new values preserve the dataset's shape.

```graphql
mutation CreateDataset($input: CreateDatasetInput!) {
  createDataset(input: $input) { dataset { id name description metadata } }
}
```

`patchDataset` changes only supplied fields. Dataset `metadata`, when supplied, replaces the whole
object rather than merging with it, so read and preserve unrelated keys.

```graphql
mutation PatchDataset($input: PatchDatasetInput!) {
  patchDataset(input: $input) { dataset { id name description metadata } }
}
```

```graphql
mutation DeleteDataset($input: DeleteDatasetInput!) {
  deleteDataset(input: $input) { dataset { id name } }
}
```

```graphql
mutation AddDatasetExamples($input: AddExamplesToDatasetInput!) {
  addExamplesToDataset(input: $input) { dataset { id name exampleCount } }
}
```

Example patches target Relay example IDs and create a new dataset version. Omitted fields are left
unchanged. Include `datasetId` to ensure every target row belongs to the intended dataset.

```graphql
mutation PatchDatasetExamples($input: PatchDatasetExamplesInput!) {
  patchDatasetExamples(input: $input) { dataset { id name exampleCount } }
}
```

```graphql
mutation DeleteDatasetExamples($input: DeleteDatasetExamplesInput!) {
  deleteDatasetExamples(input: $input) { dataset { id name exampleCount } }
}
```

`spanIds` are Phoenix Relay node IDs, not OpenTelemetry hex span IDs. Read spans to obtain their
Relay `id` values and pass the existing dataset's Relay ID.

```graphql
mutation AddSpansToDataset($input: AddSpansToDatasetInput!) {
  addSpansToDataset(input: $input) { dataset { id name exampleCount } }
}
```
