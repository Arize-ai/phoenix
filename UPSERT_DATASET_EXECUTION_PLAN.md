# Dataset Upsert + Experiments Execution Plan

## Goal
Deliver dataset upsert support (REST + Python client + TypeScript client) with implicit client-side hashing and an end-to-end experiments workflow in both Python and TypeScript.

## Constraints
- Do **not** add or modify GraphQL schema/mutations/resolvers.
- `DatasetVersion` schema remains unchanged.
- Hash algorithm metadata field is out of scope for v1.
- Every step must end with:
  - relevant verification
  - one commit
  - plan status update

## Step Checklist
- [ ] STEP-01: Backend persistence primitives for upsert identity + hashing
- [ ] STEP-02: REST upsert API (no GraphQL changes)
- [ ] STEP-03: Python client upsert with implicit hashing
- [ ] STEP-04: TypeScript client upsert with implicit hashing
- [ ] STEP-05: Cross-SDK hash parity tests
- [ ] STEP-06: End-to-end Python + TypeScript integrated examples
- [ ] STEP-07: Final validation and cleanup

---

## STEP-01: Backend persistence primitives for upsert identity + hashing
Status: Not completed
Commit: _(fill when done)_

### Scope
- Add database/model support for stable external identity and content hash persistence used by upsert:
  - Example-level stable key (e.g., `source_id`) on dataset example records.
  - Content hash storage on dataset revisions/examples as needed for efficient diffing.
- Implement backend helper logic for deterministic content hashing and dataset diff classification (new/changed/unchanged/deleted).
- Implement insertion-layer upsert application logic that emits correct `CREATE`/`PATCH`/`DELETE` revisions.

### Out of scope
- REST router changes.
- Python/TS client API changes.
- GraphQL changes.

### Verification criteria
- Unit tests for hashing/diff logic pass.
- Insertion tests prove:
  - unchanged examples do not create extra revisions,
  - changed examples create `PATCH`,
  - missing examples in mirror mode create `DELETE`,
  - new examples create `CREATE`.
- Existing dataset insertion tests remain green.

### Completion actions
- Mark this step complete in checklist and set `Status: Completed`.
- Record commit SHA in this section.

---

## STEP-02: REST upsert API (no GraphQL changes)
Status: Not completed
Commit: _(fill when done)_

### Scope
- Add REST endpoint(s) for upsert under `/v1/datasets/...`.
- Support dataset selection by exactly one of name or id.
- Support mode semantics (`merge` and `mirror`).
- Wire REST handlers to insertion-layer upsert logic from STEP-01.
- Return dataset/version identifiers and summary counts.

### Out of scope
- GraphQL API changes.
- Client SDK changes.

### Verification criteria
- Router unit tests cover:
  - happy paths for merge and mirror,
  - invalid request shape,
  - duplicate source IDs rejection,
  - idempotent no-op behavior,
  - proper dataset version creation.
- Existing dataset REST tests remain green.

### Completion actions
- Mark this step complete in checklist and set `Status: Completed`.
- Record commit SHA in this section.

---

## STEP-03: Python client upsert with implicit hashing
Status: Not completed
Commit: _(fill when done)_

### Scope
- Add Python client method `upsert_dataset(...)`.
- Hashing is computed implicitly in client; users do not pass hashes.
- Support stable source identity extraction via `source_id_key` and/or callback.
- Integrate with new REST upsert endpoint(s).
- Ensure return type is convenient for experiments workflow (dataset object and/or identifiers consistent with existing API style).

### Out of scope
- TypeScript client changes.

### Verification criteria
- Python client unit/integration tests cover create/evolve/re-upsert flows.
- Dataset versions are updated as expected.
- Existing Python dataset/experiment integration tests remain green.

### Completion actions
- Mark this step complete in checklist and set `Status: Completed`.
- Record commit SHA in this section.

---

## STEP-04: TypeScript client upsert with implicit hashing
Status: Not completed
Commit: _(fill when done)_

### Scope
- Add TypeScript client method `upsertDataset(...)`.
- Hashing is computed implicitly in client; users do not pass hashes.
- Support stable source identity extraction via `sourceIdKey` and/or callback.
- Return typed response including at least `datasetId` and `versionId`.
- Ensure compatibility with `runExperiment(...)` dataset selector usage.

### Out of scope
- Python client changes.

### Verification criteria
- TS tests cover create/evolve/re-upsert flows.
- `pnpm --dir js run lint:fix` and relevant `pnpm --dir js run -r test`/typecheck for touched packages pass.
- Existing TS dataset/experiment behavior remains green.

### Completion actions
- Mark this step complete in checklist and set `Status: Completed`.
- Record commit SHA in this section.

---

## STEP-05: Cross-SDK hash parity tests
Status: Not completed
Commit: _(fill when done)_

### Scope
- Add golden-vector tests to ensure Python and TypeScript hashing produce identical hashes for identical example payloads.
- Include edge cases that commonly diverge across runtimes (key order, nested objects, arrays, numbers, unicode strings).

### Verification criteria
- Python golden-vector test suite passes.
- TypeScript golden-vector test suite passes.
- At least one shared fixture/vector source is used to prevent drift.

### Completion actions
- Mark this step complete in checklist and set `Status: Completed`.
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
- Record commit SHA in this section.
