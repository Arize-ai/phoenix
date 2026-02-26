# Dataset Upsert + Experiments Execution Plan

## Problem Context
Phoenix users want to keep datasets in external stores (for example JSONL in object storage or git) and repeatedly run experiments as those datasets evolve. Current REST dataset APIs are imperative (`create`/`append`) and do not support efficient sync semantics for adds, edits, and removals in one operation. Re-uploading full dataset snapshots is expensive and does not scale.

## Current State (as of plan creation)
- REST supports dataset upload/create/append and dataset versioning.
- GraphQL already supports patch/delete style revision semantics, but this project intentionally avoids GraphQL changes.
- Python and TypeScript clients do not expose a dataset upsert workflow.
- There is no stable external example identity in the dataset sync flow, so efficient update/delete inference is not possible.

## Desired End State
- Add dataset upsert over REST with mirror (exact sync) semantics.
- Upsert uses implicit client-side hashing only (users do not pass IDs or hashes), using RFC8785 canonical JSON + SHA-256.
- Python and TypeScript clients both expose ergonomic upsert APIs.
- End-to-end examples show upsert + experiments iteration loops in both languages.
- Identical examples are allowed; reconciliation is multiset-aware.
- Content changes are represented as `DELETE` + `CREATE` (no `PATCH` semantics).
- Exact-match snapshots are no-ops and must not create a new dataset version.

## Goal
Deliver dataset upsert support (REST + Python client + TypeScript client) with implicit client-side hashing and an end-to-end experiments workflow in both Python and TypeScript.

## Constraints
- Do **not** add or modify GraphQL schema/mutations/resolvers.
- `DatasetVersion` schema remains unchanged.
- Hash algorithm metadata field is out of scope for v1.
- Mirror upsert is hash-based; user-supplied stable example IDs are out of scope for v1.
- This rollout includes a DB migration for new upsert-related persistence fields.
- Each step must append notable findings to [LESSONS.md](/Users/xandersong/.codex/worktrees/251b/main/LESSONS.md) when something is surprising, unexpected, or problematic.
- Loop automation strictness can remain lightweight (checklist + commit detection is sufficient).
- Every step must end with:
  - relevant verification
  - lessons entry update (if applicable)
  - one commit
  - plan status update

## Client API Reference Snippets (mirror-only)
These are target usage patterns for STEP-03 and STEP-04. Keep implementations aligned with these examples.

### Python
Expected return shape for `upsert_dataset(...)`: a `Dataset` object compatible with `run_experiment(dataset=...)`.

```python
from phoenix.client import Client
from phoenix.client.experiments import run_experiment

client = Client()

examples_v1 = [
    {"input": {"question": "What is AI?"}, "output": {"answer": "..."}, "metadata": {}},
    {"input": {"question": "What is ML?"}, "output": {"answer": "..."}, "metadata": {}},
]

dataset_v1 = client.datasets.upsert_dataset(
    dataset="support-benchmark",
    examples=examples_v1,
)

def task(example):
    return {"answer": f"stub: {example['input']['question']}"}

exp_v1 = run_experiment(
    dataset=dataset_v1,
    task=task,
    experiment_name="support-v1",
)

examples_v2 = [
    {"input": {"question": "What is AI?"}, "output": {"answer": "Artificial Intelligence"}, "metadata": {}},
    {"input": {"question": "What is RL?"}, "output": {"answer": "..."}, "metadata": {}},
]

dataset_v2 = client.datasets.upsert_dataset(
    dataset="support-benchmark",
    examples=examples_v2,
)

exp_v2 = run_experiment(
    dataset=dataset_v2,
    task=task,
    experiment_name="support-v2",
)

# Note: in hash-only mirror semantics, a content edit is represented as DELETE(old hash) + CREATE(new hash).
```

### TypeScript
Expected return shape for `upsertDataset(...)`: `{ datasetId: string; versionId: string; summary?: { added: number; updated: number; deleted: number; unchanged: number } }`.

```ts
import { createClient } from "@arizeai/phoenix-client";
import { runExperiment } from "@arizeai/phoenix-client/experiments";

const client = createClient();

const examplesV1 = [
  { input: { question: "What is AI?" }, output: { answer: "..." }, metadata: {} },
  { input: { question: "What is ML?" }, output: { answer: "..." }, metadata: {} },
];

const upsertV1 = await client.datasets.upsertDataset({
  dataset: { datasetName: "support-benchmark" },
  examples: examplesV1,
});

const task = async (example: { input: { question: string } }) => ({
  answer: `stub: ${example.input.question}`,
});

const expV1 = await runExperiment({
  client,
  experimentName: "support-v1",
  dataset: { datasetId: upsertV1.datasetId, versionId: upsertV1.versionId },
  task,
});

const examplesV2 = [
  { input: { question: "What is AI?" }, output: { answer: "Artificial Intelligence" }, metadata: {} },
  { input: { question: "What is RL?" }, output: { answer: "..." }, metadata: {} },
];

const upsertV2 = await client.datasets.upsertDataset({
  dataset: { datasetName: "support-benchmark" },
  examples: examplesV2,
});

const expV2 = await runExperiment({
  client,
  experimentName: "support-v2",
  dataset: { datasetId: upsertV2.datasetId, versionId: upsertV2.versionId },
  task,
});

// Note: in hash-only mirror semantics, a content edit is represented as DELETE(old hash) + CREATE(new hash).
```

## Step Checklist
- [x] STEP-01: Backend schema migration + persistence primitives for hash-based upsert
- [x] STEP-02: REST upsert API (no GraphQL changes)
- [ ] STEP-03: Python client upsert with implicit hashing
- [ ] STEP-04: TypeScript client upsert with implicit hashing
- [ ] STEP-05: Cross-SDK hash parity tests
- [ ] STEP-06: End-to-end Python + TypeScript integrated examples
- [ ] STEP-07: Final validation and cleanup

---

## STEP-01: Backend schema migration + persistence primitives for hash-based upsert
Status: Completed
Commit: 6333f567a600260b094927f53f8c498da6793d72

### Scope
- Add and apply an Alembic migration for new upsert persistence fields/constraints.
- Add database/model support for content hash persistence used by upsert diffing.
- Implement backend helper logic for deterministic content hashing and dataset diff classification (new/changed/unchanged/deleted).
- Ensure hash diffing is multiset-aware so identical duplicate examples are supported correctly.
- Implement insertion-layer upsert application logic for hash-based mirror sync using `CREATE` and `DELETE` revisions.

### Out of scope
- REST router changes.
- Python/TS client API changes.
- GraphQL changes.

### Verification criteria
- Migration verification:
  - migration upgrade and downgrade pass in migration tests,
  - new columns/constraints exist after upgrade.
- Unit tests for hashing/diff logic pass.
- Insertion tests prove:
  - unchanged examples do not create extra revisions,
  - changed examples are represented as `DELETE` + `CREATE` under hash-only mirror semantics,
  - missing examples create `DELETE` revisions under mirror semantics,
  - new examples create `CREATE`.
  - duplicate identical examples are handled correctly (multiset semantics).
- Existing dataset insertion tests remain green.

### Completion actions
- Mark this step complete in checklist and set `Status: Completed`.
- Add/update a lessons entry in [LESSONS.md](/Users/xandersong/.codex/worktrees/251b/main/LESSONS.md) for any surprising, unexpected, or problematic findings from this step.
- Record commit SHA in this section.

---

## STEP-02: REST upsert API (no GraphQL changes)
Status: Completed
Commit: e4d96e5fcaefaf5925daeb6bd797c5a676de1f7a

### Scope
- Add REST endpoint(s) for upsert under `/v1/datasets/...`.
- Support dataset selection by exactly one of name or id.
- Enforce mirror semantics (exact sync) in v1.
- Wire REST handlers to insertion-layer upsert logic from STEP-01.
- Return dataset/version identifiers and summary counts.

### Out of scope
- GraphQL API changes.
- Client SDK changes.

### Verification criteria
- Router unit tests cover:
  - happy path for mirror exact-sync behavior,
  - invalid request shape,
  - idempotent no-op behavior with exact snapshot match (no new dataset version row; returned version remains unchanged),
  - proper dataset version creation.
- Existing dataset REST tests remain green.

### Completion actions
- Mark this step complete in checklist and set `Status: Completed`.
- Add/update a lessons entry in [LESSONS.md](/Users/xandersong/.codex/worktrees/251b/main/LESSONS.md) for any surprising, unexpected, or problematic findings from this step.
- Record commit SHA in this section.

---

## STEP-03: Python client upsert with implicit hashing
Status: Not completed
Commit: _(fill when done)_

### Scope
- Add Python client method `upsert_dataset(...)`.
- Hashing is computed implicitly in client; users do not pass hashes.
- Integrate with new REST upsert endpoint(s).
- Ensure return type is convenient for experiments workflow (dataset object and/or identifiers consistent with existing API style).

### Out of scope
- TypeScript client changes.

### Verification criteria
- Python client unit/integration tests cover create/evolve/re-upsert flows.
- Dataset versions are updated as expected, and exact re-upsert of unchanged snapshot returns no-op without creating a new version.
- Existing Python dataset/experiment integration tests remain green.

### Completion actions
- Mark this step complete in checklist and set `Status: Completed`.
- Add/update a lessons entry in [LESSONS.md](/Users/xandersong/.codex/worktrees/251b/main/LESSONS.md) for any surprising, unexpected, or problematic findings from this step.
- Record commit SHA in this section.

---

## STEP-04: TypeScript client upsert with implicit hashing
Status: Not completed
Commit: _(fill when done)_

### Scope
- Add TypeScript client method `upsertDataset(...)`.
- Hashing is computed implicitly in client; users do not pass hashes.
- Return typed response including at least `datasetId` and `versionId`.
- Ensure compatibility with `runExperiment(...)` dataset selector usage.

### Out of scope
- Python client changes.

### Verification criteria
- TS tests cover create/evolve/re-upsert flows.
- Exact re-upsert of unchanged snapshot returns no-op without creating a new version.
- `pnpm --dir js run lint:fix` and relevant `pnpm --dir js run -r test`/typecheck for touched packages pass.
- Existing TS dataset/experiment behavior remains green.

### Completion actions
- Mark this step complete in checklist and set `Status: Completed`.
- Add/update a lessons entry in [LESSONS.md](/Users/xandersong/.codex/worktrees/251b/main/LESSONS.md) for any surprising, unexpected, or problematic findings from this step.
- Record commit SHA in this section.

---

## STEP-05: Cross-SDK hash parity tests
Status: Not completed
Commit: _(fill when done)_

### Scope
- Add golden-vector tests to ensure Python and TypeScript hashing produce identical hashes for identical example payloads.
- Include edge cases that commonly diverge across runtimes (key order, nested objects, arrays, numbers, unicode strings).
- Ensure vectors verify RFC8785 canonicalization behavior across both SDKs.

### Verification criteria
- Python golden-vector test suite passes.
- TypeScript golden-vector test suite passes.
- At least one shared fixture/vector source is used to prevent drift.

### Completion actions
- Mark this step complete in checklist and set `Status: Completed`.
- Add/update a lessons entry in [LESSONS.md](/Users/xandersong/.codex/worktrees/251b/main/LESSONS.md) for any surprising, unexpected, or problematic findings from this step.
- Record commit SHA in this section.

---

## STEP-06: End-to-end Python + TypeScript integrated examples
Status: Not completed
Commit: _(fill when done)_

### Scope
- Add integrated examples that demonstrate:
  1. initial dataset upsert,
  2. run experiment,
  3. evolve dataset with upsert,
  4. rerun experiment against updated dataset version.
- One example path for Python and one for TypeScript.
- Keep example style aligned with existing quickstart patterns in repo.

### Verification criteria
- Example scripts compile/run in local test setup (or documented smoke-run commands executed successfully).
- Demonstrated outputs include version progression and experiment invocation.

### Completion actions
- Mark this step complete in checklist and set `Status: Completed`.
- Add/update a lessons entry in [LESSONS.md](/Users/xandersong/.codex/worktrees/251b/main/LESSONS.md) for any surprising, unexpected, or problematic findings from this step.
- Record commit SHA in this section.

---

## STEP-07: Final validation and cleanup
Status: Not completed
Commit: _(fill when done)_

### Scope
- Run final targeted validations for touched areas.
- Ensure formatting/lint/typecheck rules for touched Python/JS/app code are satisfied.
- Ensure plan reflects all completed steps and commit SHAs.

### Verification criteria
- Relevant Python tests pass.
- Relevant JS tests/typecheck/lint pass for touched packages.
- No pending uncommitted changes.
- All checklist items marked complete.

### Completion actions
- Mark this step complete in checklist and set `Status: Completed`.
- Add/update a lessons entry in [LESSONS.md](/Users/xandersong/.codex/worktrees/251b/main/LESSONS.md) for any surprising, unexpected, or problematic findings from this step.
- Record commit SHA in this section.
