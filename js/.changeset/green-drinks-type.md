---
"@arizeai/phoenix-client": major
---

feat: Add support for dataset splits

This release introduces support for dataset splits, enabling you to segment and query specific portions of your dataset examples. The `DatasetSelector` interface has been enhanced to support filtering by splits, allowing for more granular dataset management and experimentation.

## New Features

- **Dataset Splits Support**: Query dataset examples by split using the enhanced `DatasetSelector` interface
- **Split-based Experimentation**: Run experiments on specific dataset splits for targeted evaluation
- **Enhanced Dataset Types**: Updated type definitions to support split-based dataset operations

## Breaking Changes

- **`runExperiment` API Changes**: 
  - The `datasetVersionId` parameter has been removed from `runExperiment`
  - Version selection is now handled through the `DatasetSelector` interface
  - Pass `versionId` and `splits` as properties of the `DatasetSelector` argument instead

## Migration Guide

**Before:**
```typescript
runExperiment({
  dataset: { datasetId: "my-dataset" },
  datasetVersionId: "version-123",
  // ... other params
})
```

**After:**
```typescript
runExperiment({
  dataset: { 
    datasetId: "my-dataset",
    versionId: "version-123",
    splits: ["train", "test"]
  },
  // ... other params
})
```
