# Experiment, ExperimentRun

An experiment is one run of a prompt or pipeline over every example in a dataset.

## Reaching an experiment

There is **no `getExperimentById`** — reach an `Experiment` via `node(id:)`, `Dataset.experiments`, or `compareExperiments`.

## Experiment fields

- `name`, `description`, `sequenceNumber`, `repetitions`, `isEphemeral`
- `dataset`, `datasetVersion`, `project`
- `runs(first, after, sort: ExperimentRunSort)` — **forward-only** (no `last`/`before`)
- `runCount`, `expectedRunCount`
- `errorRate`, `averageRunLatencyMs`, `costSummary`, `costDetailSummaryEntries`
- `annotationSummaries { annotationName meanScore minScore maxScore count errorCount }`

## Comparison

For candidate comparison prefer `compareExperiments(baseExperimentId: GlobalID!, compareExperimentIds: [GlobalID!]!, first, after, filterCondition)` over fetching each experiment's runs separately. Related: `experimentRunMetricComparisons(baseExperimentId, compareExperimentIds)` and `validateExperimentRunFilterCondition(condition, experimentIds)`.

## Example

```graphql
query ExperimentMetrics($id: ID!) {
  node(id: $id) {
    ... on Experiment {
      name
      sequenceNumber
      runCount
      errorRate
      averageRunLatencyMs
      annotationSummaries { annotationName meanScore count errorCount }
    }
  }
}
```

## Edit an experiment

`patchExperiment` changes only supplied fields. Its `metadata` input replaces the entire metadata
object; it does not merge. Read current metadata first, preserve every unrelated key, and submit the
complete replacement object. For observations, append to the existing `observations` array rather
than overwriting earlier entries.

```graphql
mutation PatchExperiment($input: PatchExperimentInput!) {
  patchExperiment(input: $input) { experiment { id name description metadata } }
}
```
