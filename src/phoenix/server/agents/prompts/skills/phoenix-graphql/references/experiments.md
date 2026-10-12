# Experiment, ExperimentRun

An experiment is one run of a prompt or pipeline over every example in a dataset.

## Reaching an experiment

There is **no `getExperimentById`** — reach an `Experiment` via `node(id:)`, `Dataset.experiments`, or `compareExperiments`.

`Dataset.experiments` is newest-first by default and paginated, so a **user-facing experiment number** (the 1-based, oldest-first `sequenceNumber`) is not necessarily on the first page — the lowest numbers are the farthest from it. Do **not** read the first page and guess; resolve a number exactly with:

- `experiments(sequenceNumbers: [Int!])` — returns only the experiments with the given `sequenceNumber`s, without paging. Prefer this whenever the user names experiments by number (e.g. "compare experiment 5 and 7" → `sequenceNumbers: [5, 7]`).
- `experiments(sort: {col: sequenceNumber | createdAt, dir: asc | desc})` — reorder the connection; e.g. `{col: sequenceNumber, dir: asc}` puts sequences `1..N` on the first page.

Before reporting on a fetched experiment, confirm its `sequenceNumber` matches the number the user asked for.

```graphql
query ExperimentsByNumber($datasetId: ID!, $sequenceNumbers: [Int!]!) {
  node(id: $datasetId) {
    ... on Dataset {
      experiments(sequenceNumbers: $sequenceNumbers) {
        edges { node { id name sequenceNumber } }
      }
    }
  }
}
```

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

Note: if the experiment came from a playground run driven through `execute_browser_action`,
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
