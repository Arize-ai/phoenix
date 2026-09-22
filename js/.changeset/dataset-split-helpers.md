---
"@arizeai/phoenix-client": minor
---

Add `createDatasetSplit`, `updateDatasetSplit`, and `deleteDatasetSplit` helpers to the `datasets` subpath. The helpers select datasets by name or GlobalID, create splits on existing datasets, partially update split fields, add or remove example memberships idempotently, and delete splits without deleting their examples. They require Phoenix server 19.20.0 or newer.

Also export the generated `DatasetSplit` response type and a `DatasetIdentifier` selector type from the datasets subpath.
