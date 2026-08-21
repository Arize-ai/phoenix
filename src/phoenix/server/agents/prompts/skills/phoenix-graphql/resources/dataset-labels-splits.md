# Dataset labels and splits

Labels and splits are instance-wide vocabularies, not names local to one dataset. Query
`datasetLabels` or `datasetSplits`, paginate as needed, and look up names rather than guessing.
Create a missing vocabulary item before assigning it. Names are unique instance-wide.

`setDatasetLabels` and `setDatasetExamplesSplits` replace the complete association set. Re-include
every existing label or split membership that should remain; omitted IDs are removed. An empty ID
list clears the association. Include `datasetId` in the batch split input to reject examples from
another dataset.

```graphql
mutation CreateDatasetLabel($input: CreateDatasetLabelInput!) {
  createDatasetLabel(input: $input) { datasetLabel { id name color } datasets { id name } }
}
```

```graphql
mutation SetDatasetLabels($input: SetDatasetLabelsInput!) {
  setDatasetLabels(input: $input) { dataset { id name labels { id name } } }
}
```

Deleting a label removes that vocabulary item across the instance and detaches it from every
dataset; it is not a per-dataset unassign operation.

```graphql
mutation DeleteDatasetLabels($input: DeleteDatasetLabelsInput!) {
  deleteDatasetLabels(input: $input) { datasetLabels { id name } }
}
```

Use `createDatasetSplitWithExamples` when seeding the new split. An empty split does not appear on a
dataset until examples are assigned to it.

```graphql
mutation CreateDatasetSplit($input: CreateDatasetSplitWithExamplesInput!) {
  createDatasetSplitWithExamples(input: $input) {
    datasetSplit { id name description color metadata }
    examples { id }
  }
}
```

```graphql
mutation PatchDatasetSplit($input: PatchDatasetSplitInput!) {
  patchDatasetSplit(input: $input) {
    datasetSplit { id name description color metadata }
  }
}
```

```graphql
mutation SetDatasetExampleSplits($input: SetDatasetExamplesSplitsInput!) {
  setDatasetExamplesSplits(input: $input) {
    examples { id datasetSplits { id name } }
  }
}
```

Deleting a split removes it across the instance and removes every example membership; it does not
delete dataset examples.

```graphql
mutation DeleteDatasetSplits($input: DeleteDatasetSplitInput!) {
  deleteDatasetSplits(input: $input) { datasetSplits { id name } }
}
```
