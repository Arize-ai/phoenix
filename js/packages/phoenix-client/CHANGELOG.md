# @arizeai/phoenix-client

## 7.1.1

### Patch Changes

- e35712a: Re-release to recover from a failed publish (versions were already on npm)

## 7.1.0

### Minor Changes

- df7057a: Add `spanIds` filter to `getSpans`, allowing spans to be fetched by span ID (requires Phoenix server >= 19.6.0)

## 7.0.1

### Patch Changes

- a6c3f88: Fix `resumeExperiment` and `resumeEvaluation` leaking detached workers on the first error. Both used `Promise.all([producer, ...workers])`, which rejects the instant one worker throws (e.g. under `stopOnFirstError`) while the remaining concurrent workers and the producer keep running — hitting the API and logging after the function has already returned or thrown. They now drain every task with `Promise.allSettled` and classify rejections by priority, so no background work outlives the call. This also fixes intermittent CI teardown errors (`Closing rpc while "onUserConsoleLog" was pending`) caused by that late console output.

## 7.0.0

### Major Changes

- 4867e34: Require AI SDK v7 for `@arizeai/phoenix-client`. The optional `ai` peer dependency now requires v7 (`^7.0.0`, previously `^6.0.90`). AI SDK v7 no longer emits OpenTelemetry spans through the global tracer provider on its own — to trace AI SDK calls made inside experiment tasks, pass the `@ai-sdk/otel` integration per call, constructed inside the task: `generateText({ ..., telemetry: { integrations: [new OpenTelemetry()] } })` (see `examples/run_experiment_with_ai_sdk.ts`). Phoenix evaluators from `@arizeai/phoenix-evals` are traced automatically and need no setup. Core client APIs retain Node.js 18 compatibility; AI SDK v7-backed features require the Node.js version supported by AI SDK v7. Type-checking the published declarations now requires TypeScript >= 5.3: the `.d.ts` files for the prompts entry use `with { "resolution-mode": "import" }` import attributes, which older TypeScript versions cannot parse (and `skipLibCheck` does not suppress).

## 6.14.2

### Patch Changes

- Updated dependencies [dc451a6]
  - @arizeai/phoenix-otel@2.1.0

## 6.14.1

### Patch Changes

- Updated dependencies [30f0827]
  - @arizeai/phoenix-otel@2.0.0

## 6.14.0

### Minor Changes

- d6b1cbb: Add a reusable refreshable-credential fetch wrapper to the Phoenix TypeScript
  client, use it for OAuth-authenticated CLI API and PXI requests, and keep each
  profile bound to the endpoint that issued its OAuth tokens.

## 6.13.0

### Minor Changes

- f94067b: Add px setup script for agent onboarding

### Patch Changes

- Updated dependencies [f94067b]
  - @arizeai/phoenix-config@0.4.0
  - @arizeai/phoenix-otel@1.2.0

## 6.12.2

### Patch Changes

- Updated dependencies [c0ab6a9]
  - @arizeai/phoenix-config@0.3.0
  - @arizeai/phoenix-otel@1.1.1

## 6.12.1

### Patch Changes

- Updated dependencies [1e7d9fc]
  - @arizeai/phoenix-config@0.2.0
  - @arizeai/phoenix-otel@1.1.0

## 6.12.0

### Minor Changes

- 7947440: Add `logSpans` to `@arizeai/phoenix-client/spans`, mirroring the Python client's `log_spans` API. It submits spans directly to a project using Phoenix's simplified span structure (the same shape returned by `getSpans`), without requiring OpenTelemetry. Throws a new `SpanCreationError` with `invalidSpans`/`duplicateSpans` details if any span in the request is invalid or a duplicate.

## 6.11.2

### Patch Changes

- 7afa183: Fix `PHOENIX_TEST_TRACKING=false` not reliably disabling recording in vitest/jest eval suites. The flag is now read robustly (tolerating surrounding quotes and whitespace) and latches off for the whole process the first time it is seen disabled, so one suite can no longer re-enable recording for the others by mutating the environment mid-run. The run and annotation upload paths also honor the flag directly as a safeguard.

## 6.11.1

### Patch Changes

- a027ada: Rename the CI eval testing env var `PHOENIX_TEST_TRACING` to `PHOENIX_TEST_TRACKING` so it matches the internal "tracking" terminology (`isTrackingEnabled`, `SuiteState.trackingDisabled`). The behavior is unchanged: set `PHOENIX_TEST_TRACKING=false` to run a suite locally without syncing datasets, experiments, runs, or annotations to Phoenix.

  **Beta breaking change:** if you adopted the beta testing API in 6.11.0 and set `PHOENIX_TEST_TRACING=false`, update it to `PHOENIX_TEST_TRACKING=false`. The old name is no longer read.

## 6.11.0

### Minor Changes

- 7efabf6: **Beta:** Add a vitest/jest-based CI eval testing API to `@arizeai/phoenix-client`. New `./vitest`, `./vitest/reporter`, `./jest`, and `./jest/reporter` entrypoints expose a Phoenix reporter (scoreboard + results table), acceptance-criteria support with an optimization `direction` ("maximize"/"minimize"), and tracing that records runs back to Phoenix. `jest` and `vitest` are added as optional peer dependencies.

  This API is in beta and may change in a future release.

## 6.10.1

### Patch Changes

- 0347f22: Fix `evaluateExperiment` failing to match experiment runs to dataset examples when the dataset was uploaded with custom example ids. Runs now consistently identify examples by node GlobalID in `datasetExampleId` — previously runs created in-process recorded the custom example id while runs fetched from the server recorded the GlobalID — and the evaluation example lookup is keyed by the GlobalID to match. Run recording also falls back to the example `id` field on servers that predate node ids (where that field carries the GlobalID), instead of posting an empty `dataset_example_id`.

## 6.10.0

### Minor Changes

- 6dceb10: Restructure annotation bulk-delete commands into entity-first compound nouns:
  `px span delete-annotations` becomes `px span-annotations delete`,
  `px trace delete-annotations` becomes `px trace-annotations delete`, and
  `px session delete-annotations` becomes `px session-annotations delete`. Flag
  set, authorization gate (`--all` XOR `[--start-time, --end-time)`), payload
  shape, and exit codes are unchanged.

  Add an optional `identifier` body field to `addTraceNote`, `addSpanNote`, and
  `addSessionNote` (and the generated REST types). When non-empty, the note is
  upserted on `(entity_id, name='note', identifier)` so repeated calls with the
  same identifier overwrite the existing note instead of appending. When the
  helper is given an `identifier`, it now also calls
  `ensureServerCapability` against the new identifier body-parameter
  requirement so the caller fails fast against older Phoenix servers (which
  would otherwise silently drop the field and append an auto-generated note).

## 6.9.3

### Patch Changes

- Updated dependencies [559acf8]
  - @arizeai/phoenix-otel@1.0.2

## 6.9.2

### Patch Changes

- d0cc4c4: Update `openapi-fetch` from `^0.12.5` to `^0.17.0`.

## 6.9.1

### Patch Changes

- 5d14f23: Add LinkedIn link to the Community section of the README.
- Updated dependencies [5d14f23]
  - @arizeai/phoenix-config@0.1.4
  - @arizeai/phoenix-otel@1.0.1

## 6.9.0

### Minor Changes

- 2993b04: Add `addTraceAnnotation` and `logTraceAnnotations` to the `traces` subpath. Brings the TypeScript client to parity with the Python client by exposing the existing `/v1/trace_annotations` REST endpoint for structured (label/score/explanation) feedback on traces.

### Patch Changes

- 2993b04: Clarify TSDoc and regenerated OpenAPI descriptions for `addSpanNote` and `addTraceNote`. Previous wording implied structured annotations were "unique by name", which is incorrect — annotations are keyed by `(name, target_id, identifier)`, so multiple annotations with the same name can coexist on the same span/trace/session by supplying distinct identifiers. Notes remain append-only via auto-generated UUIDv4 identifiers.
- 4e20267: Add session annotation and note commands to the Phoenix CLI, and add a session note helper to the TypeScript client. Session note creation requires Phoenix server 14.17.0 or newer.

## 6.8.1

### Patch Changes

- e381885: Gate `example_ids` on dataset upload (`createDataset`, `appendDatasetExamples`) by server version, so callers see a clear capability error when targeting a Phoenix server older than 15.0.0 instead of a confusing server-side failure.
- 187df7e: Regenerate REST API types for the session notes endpoint.

## 6.8.0

### Minor Changes

- a4dad8b: Add `addTraceNote()` helper for creating trace notes via `POST /v1/trace_notes`. The call performs a preflight server-version check and throws a descriptive error when the connected Phoenix server is too old. Requires Phoenix server >= 14.13.0.

## 6.7.0

### Minor Changes

- e19a038: Add `attributes` filter to `getSpans()` for type-aware attribute matching. Pass a `Record<string, string | number | boolean>` to filter spans by attribute key/value pairs with AND semantics — the JS value type selects how the stored attribute is matched (e.g., `{ "user.id": 12345 }` matches a stored integer, `{ "user.id": "12345" }` matches a stored string). Requires Phoenix server >= 14.9.0.

## 6.6.2

### Patch Changes

- 8444575: Move `@anthropic-ai/sdk`, `openai`, and `ai` from `optionalDependencies` to optional `peerDependencies`. Consumers no longer get these provider SDKs installed automatically — they are only installed if the consumer already depends on them.

## 6.6.1

### Patch Changes

- 1449f3d: Re-export openinference semantic conventions from phoenix-otel and update phoenix-client to import them from phoenix-otel instead of depending on @arizeai/openinference-semantic-conventions directly.
- Updated dependencies [1449f3d]
  - @arizeai/phoenix-otel@1.0.0

## 6.6.0

### Minor Changes

- c70eca6: Add optional `traceId` to evaluator params so evaluators can fetch and analyze task traces for trajectory evaluation

## 6.5.5

### Patch Changes

- 1028be5: Bundle curated package docs and examples into npm packages under `docs/`.
- Updated dependencies [1028be5]
  - @arizeai/phoenix-otel@0.4.3

## 6.5.4

### Patch Changes

- b4ded15: Update package READMEs with latest capabilities

  - phoenix-client: Add Sessions section documenting `listSessions`, `getSession`, and `addSessionAnnotation`
  - phoenix-evals: Add full pre-built evaluators table (conciseness, correctness, document relevance, refusal, tool evaluators), fix import paths for `bindEvaluator`
  - phoenix-mcp: Expand Tool Coverage section with complete, accurate tool list
  - phoenix-config: Full documentation replacing the one-line placeholder (installation, environment variables, usage examples)
  - phoenix-cli: Add `px annotation-config` command documentation

- Updated dependencies [b4ded15]
  - @arizeai/phoenix-config@0.1.3

## 6.5.3

### Patch Changes

- Updated dependencies [e4bdcf6]
  - @arizeai/phoenix-config@0.1.2

## 6.5.2

### Patch Changes

- d204898: docs: document recently added commands and methods in package READMEs

## 6.5.1

### Patch Changes

- 91949d7: Add name, spanKind, and statusCode filter parameters to getSpans

## 6.5.0

### Minor Changes

- 9769f90: Add server version gating to phoenix-client. The client now reads the server version from response headers and validates it against minimum version requirements before calling newer API routes or using newer parameters. This prevents confusing errors when a client is newer than the server it connects to.

## 6.4.0

### Minor Changes

- 83b7f68: Add `getSessionTurns` function to retrieve ordered conversation turns (root span I/O) from a session

## 6.3.0

### Minor Changes

- d951320: Add `parentId` parameter to `getSpans` for filtering spans by parent span ID

## 6.2.0

### Minor Changes

- 6d896e3: Add `traceIds` parameter to `getSpans` and MCP `get-spans` tool for filtering spans by trace ID.

## 6.1.0

### Minor Changes

- 6296d0a: Replace `projectIdentifier: string` with a `ProjectIdentifier` discriminated union on `listSessions`. Callers can now pass `{ project: "name-or-id" }`, `{ projectId: "..." }`, or `{ projectName: "..." }` for explicit intent and better IDE autocompletion.
- 6296d0a: Add `getSession` and `listSessions` APIs for querying session data. `getSession` fetches a single session by ID or name, while `listSessions` returns paginated sessions for a project with cursor-based pagination.

### Patch Changes

- b8ba989: Removed deprecated `ProjectSelector` type alias. Use `ProjectIdentifier` instead.

## 6.0.0

### Major Changes

- 03b10a8: feat: upgrade zod from v3 to v4

  BREAKING CHANGE: Upgraded zod from v3 to v4. This changes inferred TypeScript types
  for schemas using `z.looseObject()` (previously `.passthrough()`) which now include
  `[x: string]: unknown` in their output types. Consumers using these types may need
  to update their code. Additionally, `ZodError.errors` has been replaced with
  `ZodError.issues`, `z.record()` now requires explicit key schemas, and
  `zod-to-json-schema` has been replaced with native `z.toJSONSchema()`.

### Patch Changes

- Updated dependencies [03b10a8]
  - @arizeai/phoenix-otel@0.4.2

## 5.9.0

### Minor Changes

- b18325b: feat: upgrade AI SDK to v6

### Patch Changes

- db24319: fix: polish experiment run output formatting and clarity
- Updated dependencies [db24319]
  - @arizeai/phoenix-config@0.1.1

## 5.8.2

### Patch Changes

- 8be1940: Update `@arizeai/openinference-vercel` dependency to `^2.7.0`.
- Updated dependencies [7456462]
  - @arizeai/phoenix-otel@0.4.1

## 5.8.1

### Patch Changes

- Updated dependencies [a8896db]
  - @arizeai/phoenix-otel@0.4.0

## 5.8.0

### Minor Changes

- af4dc46: Add prompt introspection commands to Phoenix CLI
  - `px prompts`: List all available prompts with names and descriptions
  - `px prompt <identifier>`: Show a specific prompt with support for `--tag` and `--version` options
  - `--format text`: Output prompt content with XML-style role tags for piping to AI assistants like Claude Code
  - Pretty print now includes full tool definitions with parameters, types, and descriptions
  - Added `listPrompts` function to phoenix-client

## 5.7.0

### Minor Changes

- 01eb1fb: feat: Add spanId support for linking dataset examples to traces

  - Added `spanId` field to the `Example` interface for linking dataset examples back to their source spans
  - Updated `createDataset` to accept examples with `spanId` and pass them to the API
  - Updated `appendDatasetExamples` to accept examples with `spanId` and pass them to the API
  - Added comprehensive unit tests for span ID functionality
  - Added example script demonstrating how to create datasets from spans with trace associations

  This feature enables traceability from datasets back to the original traces in Phoenix, making it easier to understand the provenance of dataset examples.

## 5.6.1

### Patch Changes

- ed59696: feat: Bump generated api schema

## 5.6.0

### Minor Changes

- 0f2950e: centralize phoenix config

### Patch Changes

- Updated dependencies [0f2950e]
  - @arizeai/phoenix-config@0.1.0

## 5.5.5

### Patch Changes

- 5132ce4: update openai to latest version

## 5.5.4

### Patch Changes

- 4208604: trigger changeset publish
- Updated dependencies [4208604]
  - @arizeai/phoenix-otel@0.3.4

## 5.5.3

### Patch Changes

- c96475c: trigger changeset publish
- Updated dependencies [c96475c]
  - @arizeai/phoenix-otel@0.3.3

## 5.5.2

### Patch Changes

- 857b617: add links to packages
- Updated dependencies [857b617]
  - @arizeai/phoenix-otel@0.3.2

## 5.5.1

### Patch Changes

- Updated dependencies [ce5febf]
  - @arizeai/phoenix-otel@0.3.1

## 5.5.0

### Minor Changes

- cb45336: support splits when creating dataset or adding examples

## 5.4.1

### Patch Changes

- b87d2a4: account for sub-paths in baseURLs properly

## 5.4.0

### Minor Changes

- 885be2a: make phoenix-client be able to take in phoenix evals directly

## 5.3.0

### Minor Changes

- 557865c: Add experiment resume and management features

  **New APIs:**

  - `createExperiment()` - Create an experiment without running it
  - `resumeExperiment()` - Resume incomplete experiment runs (handles failed or missing runs)
  - `resumeEvaluation()` - Add evaluations to completed experiments or retry failed evaluations
  - `listExperiments()` - List experiments with filtering and pagination
  - `deleteExperiment()` - Delete experiments

### Patch Changes

- b000189: fix bug with channel error
- 0c92232: allow metadata when creating prompts

## 5.2.1

### Patch Changes

- Updated dependencies [419ea76]
  - @arizeai/phoenix-otel@0.3.0

## 5.2.0

### Minor Changes

- f9d8b06: switch licensing to apache 2

## 5.1.1

### Patch Changes

- Updated dependencies [8bbff3a]
  - @arizeai/phoenix-otel@0.2.1

## 5.1.0

### Minor Changes

- de6f111: refactor to use phoenix-otel across the client

### Patch Changes

- Updated dependencies [de6f111]
  - @arizeai/phoenix-otel@0.2.0

## 5.0.0

### Major Changes

- 950fda5: feat: Add support for dataset splits

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
  });
  ```

  **After:**

  ```typescript
  runExperiment({
    dataset: {
      datasetId: "my-dataset",
      versionId: "version-123",
      splits: ["train", "test"],
    },
    // ... other params
  });
  ```

## 4.2.0

### Minor Changes

- 85430fa: feat: Add configurable DiagLogLevel to runExperiment
- c7cc7d9: feat: Add createOrGetDataset helper function to phoenix-client

  Additionally clean up build artifacts and type-checking amongst example scripts.

## 4.1.0

### Minor Changes

- 2981780: add session annotation functions

## 4.0.3

### Patch Changes

- e3a8ce2: pass through the tracer provider to experiments so that there is no need to configure it twice
- c85780b: Add support for generics across evals and experiments

## 4.0.2

### Patch Changes

- 1b71c66: make sure repetition numbers are greater than 0

## 4.0.1

### Patch Changes

- e72a9ad: don't swallow errors, allow for incomplete datasets (e.g. just inputs)

## 4.0.0

### Major Changes

- 7732f99: Breaking change for AI SDK users. Support for messages conversion for the AI SDK 5

## 3.2.0

### Minor Changes

- 4f43901: add support for logging document annotations

## 3.1.0

### Minor Changes

- ee0c829: switch to batch span processor by default and make it configurable

## 3.0.0

### Major Changes

- 3e80a50: delete span method

### Minor Changes

- 8711bde: update major version of openai to ^5

## 2.4.0

### Minor Changes

- fe55fc5: get dataset with versionId

## 2.3.5

### Patch Changes

- 83748e6: add type exports and better documentation across packages

## 2.3.4

### Patch Changes

- 20db91d: Add tracing to evals, add tracing controls

## 2.3.3

### Patch Changes

- 2609fcd: bump target JS to es2017 for native async

## 2.3.2

### Patch Changes

- 6ef8e47: fix dataset pull by name

## 2.3.1

### Patch Changes

- b3e30db: simplify types for task output in experiments client api

## 2.3.0

### Minor Changes

- 3c97cc7: Add the ability to get a dataset by name

## 2.2.0

### Minor Changes

- 1906611: add getSpan method

### Patch Changes

- 4c52db4: ollama provider added

## 2.1.1

### Patch Changes

- 5dd53be: add in xai to playground as provider

## 2.1.0

### Minor Changes

- b162720: add support for deepseek

## 2.0.1

### Patch Changes

- da7800a: feat(phoenix-client): Log the experiment/dataset link when calling runExperiment

## 2.0.0

### Major Changes

- 118e881: feat: add support for dataset creation and the ability to re-run experiments

## 1.3.0

### Minor Changes

- 536258e: feat(phoenix-client): Export traces from experiments to Phoenix

## 1.2.0

### Minor Changes

- f7fae3b: feat(phoenix-client): Record experiment results to Phoenix server
- 9273417: feat: Enqueue experiment runs
- 4dd23c8: support for annotation logging on spans

## 1.1.0

### Minor Changes

- fff5511: feat: Update openapi schema with new endpoints

## 1.0.2

### Patch Changes

- c99ee6f: Update type definitions to include max_completion_tokens openai parameter

## 1.0.1

### Patch Changes

- 2ffeb64: fix: Remove runtime dependency on `ai` package

## 1.0.0

### Major Changes

- 3f9e392: feat: Add support for Phoenix Prompts

  Phoenix can now manage Prompts, and the `@arizeai/phoenix-client` package has been updated to support this.

  In this initial release, we support the following:

  - Fully typed Prompt REST endpoints
  - Prompt Pulling
  - Converting a Prompt to invocation parameters for the following LLM SDKs:
    - OpenAI
    - Anthropic
    - Vercel AI SDK
      - You can use any of the Vercel AI SDK Providers with your prompt

### Patch Changes

- 95bfc7c: Add the ability to push prompts via the typescript client sdk

## 0.0.1

### Patch Changes

- 76a9cdf: pre-release of phoenix-client
