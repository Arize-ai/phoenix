# @arizeai/phoenix-client

## 5.5.1

### Patch Changes

* Updated dependencies \[ce5febf]
  * @arizeai/phoenix-otel@0.3.1

## 5.5.0

### Minor Changes

* cb45336: support splits when creating dataset or adding examples

## 5.4.1

### Patch Changes

* b87d2a4: account for sub-paths in baseURLs properly

## 5.4.0

### Minor Changes

* 885be2a: make phoenix-client be able to take in phoenix evals directly

## 5.3.0

### Minor Changes

*   557865c: Add experiment resume and management features

    **New APIs:**

    * `createExperiment()` - Create an experiment without running it
    * `resumeExperiment()` - Resume incomplete experiment runs (handles failed or missing runs)
    * `resumeEvaluation()` - Add evaluations to completed experiments or retry failed evaluations
    * `listExperiments()` - List experiments with filtering and pagination
    * `deleteExperiment()` - Delete experiments

### Patch Changes

* b000189: fix bug with channel error
* 0c92232: allow metadata when creating prompts

## 5.2.1

### Patch Changes

* Updated dependencies \[419ea76]
  * @arizeai/phoenix-otel@0.3.0

## 5.2.0

### Minor Changes

* f9d8b06: switch licensing to apache 2

## 5.1.1

### Patch Changes

* Updated dependencies \[8bbff3a]
  * @arizeai/phoenix-otel@0.2.1

## 5.1.0

### Minor Changes

* de6f111: refactor to use phoenix-otel across the client

### Patch Changes

* Updated dependencies \[de6f111]
  * @arizeai/phoenix-otel@0.2.0

## 5.0.0

### Major Changes

*   950fda5: feat: Add support for dataset splits

    This release introduces support for dataset splits, enabling you to segment and query specific portions of your dataset examples. The `DatasetSelector` interface has been enhanced to support filtering by splits, allowing for more granular dataset management and experimentation.

    ### New Features

    * **Dataset Splits Support**: Query dataset examples by split using the enhanced `DatasetSelector` interface
    * **Split-based Experimentation**: Run experiments on specific dataset splits for targeted evaluation
    * **Enhanced Dataset Types**: Updated type definitions to support split-based dataset operations

    ### Breaking Changes

    * **`runExperiment` API Changes**:
      * The `datasetVersionId` parameter has been removed from `runExperiment`
      * Version selection is now handled through the `DatasetSelector` interface
      * Pass `versionId` and `splits` as properties of the `DatasetSelector` argument instead

    ### Migration Guide

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

* 85430fa: feat: Add configurable DiagLogLevel to runExperiment
*   c7cc7d9: feat: Add createOrGetDataset helper function to phoenix-client

    Additionally clean up build artifacts and type-checking amongst example scripts.

## 4.1.0

### Minor Changes

* 2981780: add session annotation functions

## 4.0.3

### Patch Changes

* e3a8ce2: pass through the tracer provider to experiments so that there is no need to configure it twice
* c85780b: Add support for generics across evals and experiments

## 4.0.2

### Patch Changes

* 1b71c66: make sure repetion numbers are greater than 0

## 4.0.1

### Patch Changes

* e72a9ad: don't swallow errors, allow for incomplete datasets (e.g. just imputs)

## 4.0.0

### Major Changes

* 7732f99: Breaking change for AI SDK users. Support for messages conversion for the AI SDK 5

## 3.2.0

### Minor Changes

* 4f43901: add support for logging document annotations

## 3.1.0

### Minor Changes

* ee0c829: switch to batch span processor by default and make it configurable

## 3.0.0

### Major Changes

* 3e80a50: delete span method

### Minor Changes

* 8711bde: update major version of openai to ^5

## 2.4.0

### Minor Changes

* fe55fc5: get dataset with versionId

## 2.3.5

### Patch Changes

* 83748e6: add type exports and better documentation across packages

## 2.3.4

### Patch Changes

* 20db91d: Add tracing to evals, add tracing controls

## 2.3.3

### Patch Changes

* 2609fcd: bump target JS to es2017 for native async

## 2.3.2

### Patch Changes

* 6ef8e47: fix dataset pull by name

## 2.3.1

### Patch Changes

* b3e30db: simplify types for task output in experiments client api

## 2.3.0

### Minor Changes

* 3c97cc7: Add the ability to get a dataset by name

## 2.2.0

### Minor Changes

* 1906611: add getSpan method

### Patch Changes

* 4c52db4: ollama provider added

## 2.1.1

### Patch Changes

* 5dd53be: add in xai to playground as provider

## 2.1.0

### Minor Changes

* b162720: add support for deepseek

## 2.0.1

### Patch Changes

* da7800a: feat(phoenix-client): Log the experiement/dataset link when calling runExperiment

## 2.0.0

### Major Changes

* 118e881: feat: add support for dataset creation and the ability to re-run experiments

## 1.3.0

### Minor Changes

* 536258e: feat(phoenix-client): Export traces from experiments to Phoenix

## 1.2.0

### Minor Changes

* f7fae3b: feat(phoenix-client): Record experiment results to Phoenix server
* 9273417: feat: Enqueue experiment runs
* 4dd23c8: support for annotation logging on spans

## 1.1.0

### Minor Changes

* fff5511: feat: Update openapi schema with new endpoints

## 1.0.2

### Patch Changes

* c99ee6f: Update type definitions to include max\_completion\_tokens openai parameter

## 1.0.1

### Patch Changes

* 2ffeb64: fix: Remove runtime dependency on `ai` package

## 1.0.0

### Major Changes

*   3f9e392: feat: Add support for Phoenix Prompts

    Phoenix can now manage Prompts, and the `@arizeai/phoenix-client` package has been updated to support this.

    In this initial release, we support the following:

    * Fully typed Prompt REST endpoints
    * Prompt Pulling
    * Converting a Prompt to invocation parameters for the following LLM SDKs:
      * OpenAI
      * Anthropic
      * Vercel AI SDK
        * You can use any of the Vercel AI SDK Providers with your prompt

### Patch Changes

* 95bfc7c: Add the ability to push prompts via the typescript client sdk

## 0.0.1

### Patch Changes

* 76a9cdf: pre-release of phoenix-client
