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

## ExperimentRun fields

- `output`, `latencyMs`, `error`, `startTime`, `endTime`
- `annotations(first, after)` — connection; node has `name`, `label`, `score`, `explanation`
- `example { id revision { input output metadata } }` — the dataset example this
  run executed. There is **no** `datasetExample` field, and `input`/`output`/
  `metadata` live on `example.revision`, not on `example` itself.

## Comparison

For candidate comparison prefer `compareExperiments(baseExperimentId: GlobalID!, compareExperimentIds: [GlobalID!]!, first, after, filterCondition)` over fetching each experiment's runs separately. Related: `experimentRunMetricComparisons(baseExperimentId, compareExperimentIds)` and `validateExperimentRunFilterCondition(condition, experimentIds)`.

## Examples

Note: if the experiment came from a playground run driven through `execute_ui`,
prefer the `playground.experiment.readResults` UI operation over hand-writing
this query — it returns the same scores-plus-failures shape in one call.

Metrics only:

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

Scored results with per-run inputs/outputs — the shape for "which examples
failed and why" (filter on `annotations`/`error` client-side with jq):

```graphql
query ExperimentResults($id: ID!) {
  node(id: $id) {
    ... on Experiment {
      id name runCount expectedRunCount errorRate averageRunLatencyMs
      job { status }
      costSummary { total { cost tokens } }
      annotationSummaries { annotationName meanScore count errorCount }
      runs(first: 50) {
        edges { node {
          id output latencyMs error
          annotations { edges { node { name label score explanation } } }
          example { id revision { input output metadata } }
        } }
      }
    }
  }
}
```
