# @arizeai/phoenix-evals

## 1.0.0

### Major Changes

- c3c700a: feat: upgrade zod from v3 to v4

  BREAKING CHANGE: Upgraded zod from v3 to v4. This changes inferred TypeScript types
  for schemas using `z.looseObject()` (previously `.passthrough()`) which now include
  `[x: string]: unknown` in their output types. Consumers using these types may need
  to update their code. Additionally, `ZodError.errors` has been replaced with
  `ZodError.issues`, `z.record()` now requires explicit key schemas, and
  `zod-to-json-schema` has been replaced with native `z.toJSONSchema()`.

## 0.10.0

### Minor Changes

- b18325b: feat: upgrade AI SDK to v6
- d43c4ee: feat: add conciseness evaluator

## 0.9.0

### Minor Changes

- 0738cb9: Add tool response handling llm evaluator.
- d6d1953: Add createToolSelectionEvaluator for evaluating LLM tool selection decisions. This evaluator determines whether the correct tool was selected for a given context, checking if the LLM chose the best available tool for the user query.

## 0.8.0

### Minor Changes

- d1c89bf: Add createToolInvocationEvaluator for evaluating LLM tool invocations

## 0.7.0

### Minor Changes

- da13ad5: add generic correctness evaluator

## 0.6.5

### Patch Changes

- 4208604: trigger changeset publish

## 0.6.4

### Patch Changes

- c96475c: trigger changeset publish

## 0.6.3

### Patch Changes

- 857b617: add links to packages

## 0.6.2

### Patch Changes

- 0589fc3: create evaluator helper

## 0.6.1

### Patch Changes

- 5cacc22: create evaluator helper function

## 0.6.0

### Minor Changes

- 84877d6: add data mapping helpers for evaluators

## 0.5.1

### Patch Changes

- 9408838: add message template support

## 0.5.0

### Minor Changes

- aa5dc26: serialize nested values in templates as JSON

## 0.4.0

### Minor Changes

- 885be2a: make phoenix-client be able to take in phoenix evals directly

## 0.3.1

### Patch Changes

- a756a95: fix Mustache.render by disabling HTML escape

## 0.3.0

### Minor Changes

- f66c5b6: refactor: change source to kind for evaluators

## 0.2.2

### Patch Changes

- c7cc7d9: feat: Add createOrGetDataset helper function to phoenix-client

  Additionally clean up build artifacts and type-checking amongst example scripts.

## 0.2.1

### Patch Changes

- c85780b: Add support for generics across evals and experiments

## 0.2.0

### Minor Changes

- f92dab7: add name, optimization direction, etc.

## 0.1.0

### Minor Changes

- f11969d: capture source and optimization direction

## 0.0.8

### Patch Changes

- 7b204a5: bump the ai sdk to 5

## 0.0.7

### Patch Changes

- 83748e6: add type exports and better documentation across packages

## 0.0.6

### Patch Changes

- a57ec81: add telemetry controls

## 0.0.5

### Patch Changes

- 20db91d: Add tracing to evals, add tracing controls

## 0.0.4

### Patch Changes

- 2609fcd: bump target JS to es2017 for native async

## 0.0.3

### Patch Changes

- a6a4ca8: add docs to the readme

## 0.0.2

### Patch Changes

- b3e30db: Alpha version of evals
