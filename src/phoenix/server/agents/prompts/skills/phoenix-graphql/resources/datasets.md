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
