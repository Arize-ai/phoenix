# Project (online) evaluators

A `ProjectEvaluator` binds an `Evaluator` (LLM, code, or decision) to a project with a scope: `evaluationTarget` (`SPAN`, `TRACE`, `SESSION`), `filterCondition`, `samplingRate`, `evaluationDelaySeconds`, `inputMapping { pathMapping literalMapping }`, `enabled`, `tracingEnabled`. Its `id` is the ProjectEvaluator node id that the evaluator pages' routes use, not `evaluator.id`. Each one writes annotations on the evaluated project named after the project evaluator (`<name>.<output>` when it has several outputs) and traces its own runs into a dedicated `traceProject`.

Below, each page under `/projects/<projectId>/evaluators` with the fields that back what it shows. Query the same fields so your numbers match the screen. Pages with a time range picker read it from the URL (`timeRangeKey`, e.g. `7d`, or `start`/`end`). If you cannot see it, say which range you used; the default is the last 7 days.

## Evaluators tab: `/projects/<projectId>/evaluators`

**Queue strip** (Status, In queue, Added/Completed/Net per hour, Oldest wait, Evaluation cost): `Project.evaluationQueue { queuedCount runningCount oldestWaitingAt addedPerMinute completedPerMinute targets { evaluationTarget queuedCount } }`. The UI shows the per-minute rates times 60. Cost is `Project.evaluationActivity(timeRange) { cost excludesUntracedEvaluators }`. The server-wide queue is the top-level `evaluationQueue { status queuedCount ... projects(first: 5) { project { name } queuedCount } }`. The strip's menu has **Clear queue…**: `clearProjectQueuedEvaluations(input: { projectId })` returns `clearedCount`.

**Charts** (Added vs completed, Queue size, Evaluations, Lag p95, Cost and Failures by evaluator): `Project.evaluationActivity(timeRange, timeBinConfig: { scale: HOUR }) { groups { projectEvaluator { id name } evaluatedCount failedCount cost } series { timestamp queueSize groups { projectEvaluator { id } evaluatedCount failedCount addedCount lagP95Seconds cost } } }`.

**Table**, one row per `Project.evaluators(first, after, filter: { col: name, value })` edge (`evaluatorsFilter` in the URL is the search box):

| Column | Field |
| --- | --- |
| enabled switch | `enabled` |
| status | `runSummary.status`: `HEALTHY`, `DEGRADED` (oldest waiting evaluation over 10 minutes), `ERROR` (newest completed run was given up on), `STARTING`, `NEVER_RUN`, `DISABLED` |
| in queue | `runSummary.queuedCount` (queued + running, retries included); `runningCount`, `oldestWaitingOrRetryingAt` |
| results (mean score / labels; can be hidden under Columns) | `annotationScoreMetrics(timeRange, previousTimeRange, timeBinConfig) { annotationName summary { meanScore count labelFractions { label fraction } } previousSummary { meanScore } }`, over the page range capped at 30 days |
| failure rate | `failureSummary(timeRange) { failureRate failedCount evaluatedCount lastFailedAt lastError }` |
| lag p95 | `lag(timeRange) { p95Seconds }` (also `p50Seconds`, `p99Seconds`) |
| eval time share | `evaluationLoad { evaluationCount meanEvaluationSeconds shareOfEvaluationTime }`, last 60 minutes, traced runs only |
| total cost, avg cost / evaluation | `costSummary(timeRange) { total { cost } }` and that divided by `tracedEvaluationCount(timeRange)`; null for evaluators without model calls or with tracing off |
| kind, model, language, sandbox, target, filter, sampling | `evaluator { kind ... on LLMEvaluator { promptVersion { modelName modelProvider } } ... on DecisionEvaluator { decisionVersion { modelName modelProvider } } ... on CodeEvaluator { language sandboxConfig { name } } }`, `evaluationTarget`, `filterCondition`, `samplingRate` |

```graphql
query EvaluatorRows($projectId: ID!, $timeRange: TimeRange!, $previous: TimeRange!) {
  node(id: $projectId) {
    ... on Project {
      evaluators(first: 50) {
        edges { node {
          id name enabled evaluationTarget
          evaluator { kind }
          runSummary { status queuedCount runningCount oldestWaitingOrRetryingAt lastError }
          annotationScoreMetrics(timeRange: $timeRange, previousTimeRange: $previous) {
            annotationName
            summary { meanScore count labelFractions { label fraction } }
          }
        } }
      }
    }
  }
}
```

Row actions:

- **Enable switch**: `setProjectEvaluatorEnabled(input: { projectEvaluatorId, enabled })`. Turning one off with evaluations queued first asks the human to confirm that they will be cleared. The UI then runs `clearProjectEvaluatorQueuedEvaluations(input: { projectEvaluatorId })`, which removes queued, not running, evaluations. Re-enabling evaluates only what arrives afterwards.
- **Delete** (row menu): `deleteProjectEvaluators(input: { projectEvaluatorIds, deleteAssociatedPrompt })` returns `projectEvaluatorIds`. The dialog's checkbox, on by default, also deletes an LLM evaluator's prompt when nothing else uses it. Pass `false` to keep the prompt.
- Selecting two rows offers **Compare** (below).

Writes (enable/disable, clear queue, delete): before running one, say what it will change, including how many queued evaluations it clears (`runSummary.queuedCount - runningCount`). Prefer pointing the human to the switch or menu on this page so they see the result. If you run the mutation yourself, the open table may only update on refresh.

## Gallery and creation forms

The gallery (`/evaluators/gallery`) and the create, edit, and attach forms (`/evaluators/new/...`, `/evaluators/<id>/edit`) have UI operations (`evaluators.project.gallery.*`, `evaluators.project.scope.*`, `evaluators.project.bench.*`, the `evaluators.llm|code|decision.*` drafts, `evaluators.project.attach.*`). Use those, not mutations. The record table and inspector in a form are its test bench (`evaluators.project.bench.read/run`).

## Details page: `/projects/<projectId>/evaluators/<projectEvaluatorId>[/versions|/traces|/metrics]`

`node(id: $projectEvaluatorId) { ... on ProjectEvaluator { ... } }`:

- **Overview**: the stats cards use `createdAt`, `runSummary { status lastRunAt queuedCount oldestWaitingOrRetryingAt lastError }`, `evaluationLoad`, and `failureSummary(timeRange) { evaluatedCount failedCount }`. The scope card uses `evaluationTarget filterCondition samplingRate evaluationDelaySeconds`; Advanced uses `tracingEnabled`. The definition shows the LLM prompt (`evaluator { ... on LLMEvaluator { prompt { name } promptVersion { modelName modelProvider } promptVersionTag { name } } }`), the code source (`... on CodeEvaluator { language currentVersion { sourceCode } sandboxConfig { name } }`), or the decision (`... on DecisionEvaluator { decisionVersion { decision { name } modelName questions { ... } } scoringPolicy { ... } }`), plus `inputMapping` and the output configs `evaluator { outputConfigs { ... on CategoricalAnnotationConfig { name values { label score } optimizationDirection } } }`.
- **Versions** (code evaluators only): the evaluator's version history and source diffs (`CodeEvaluator.versionCount`).
- **Traces**: the evaluator's own runs, `node(id: traceProject.id) { ... on Project { spans(timeRange, projectEvaluatorId) } }`. Empty when tracing is off.
- **Metrics**: score/label series of its annotations on the evaluated project (`spanAnnotationMetricsTimeSeries`, `traceAnnotationMetricsTimeSeries`, or `sessionAnnotationMetricsTimeSeries` with `annotationName` and `timeBinConfig`), plus evaluation counts, latency, and cost read from `traceProject`.

## Compare page: `/projects/<projectId>/evaluators/compare?evaluatorId=<A>&evaluatorId=<B>`

The two must share a target. `Project.evaluatorComparison(evaluatorAId, evaluatorBId, timeRange)`:

- Stats: `coverage { evaluatedByBoth onlyA onlyB totalInRange }`, `populationSize`, `statistics { agreement cohensKappa spearmanRho disagreementCount }`.
- Matrix: `confusionMatrix` (rows follow `a.labels`, columns `b.labels`), with `a`/`b { annotationName labels threshold }`. Score outputs bin into flagged/unflagged at `threshold`.
- Distributions: shared records from `a`/`b { sharedDistribution { evaluatedCount meanScore labelCounts { label count } scoreBinEdges scoreBinCounts } }`. Each evaluator on its own uses `ProjectEvaluator.distribution(timeRange)`.
- Time series: the `*AnnotationMetricsTimeSeries` fields above, once per annotation name.
- Clicking a matrix cell (`compareSelection` in the URL) lists matching records with a filter on both annotations, e.g. `annotations['A'].label == "pass" and annotations['B'].label == "fail"` (`trace_annotations[...]` and `session_annotations[...]` for other targets). A row opens `compare/<traceId or session node id>`.
