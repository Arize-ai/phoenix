# Evaluators, dataset evaluators, project evaluators

## The model

- An **evaluator** (`Evaluator` interface: `CodeEvaluator`, `LLMEvaluator`, built-in) holds the
  judgment: a code evaluator's `sourceCode`, `language`, and `sandboxConfig`; an LLM evaluator's
  judge `prompt` / `promptVersion`. `outputConfigs` is what it writes (categorical labels with
  scores, a bounded continuous score, or freeform text).
- A **dataset evaluator** (`DatasetEvaluator`) binds an evaluator to one dataset under its own
  `name` and `inputMapping`; experiments over that dataset run it on every run.
- A **project evaluator** (`ProjectEvaluator`) binds an evaluator to one project as an online
  evaluator, with its own `name`, `inputMapping`, `filterCondition`, `samplingRate`,
  `evaluationTarget` (`SPAN`, `TRACE`, or `SESSION`, fixed at creation), `evaluationDelaySeconds`,
  and `enabled` flag. Results are annotations named after the binding on the project's
  spans, traces, or sessions; each project evaluator also traces its own runs into
  `traceProject`.
- Every binding is a node: reach it with `node(id:)`. `Evaluator.datasetEvaluators` and
  `Evaluator.projects` list where an evaluator is bound.

## Reading what exists

Inventory a dataset's evaluators before creating one:

```graphql
query DatasetEvaluators($id: ID!) {
  node(id: $id) {
    ... on Dataset {
      name
      datasetEvaluators(first: 20) {
        edges {
          node {
            id
            name
            inputMapping { pathMapping literalMapping }
            evaluator { id name kind }
          }
        }
      }
    }
  }
}
```

A project's online evaluators, with their health:

```graphql
query ProjectEvaluators($id: ID!) {
  node(id: $id) {
    ... on Project {
      name
      evaluators(first: 20) {
        edges {
          node {
            id
            name
            enabled
            evaluationTarget
            filterCondition
            samplingRate
            evaluator { id name kind }
            runSummary { status evaluatedCount failedCount lastError }
          }
        }
      }
    }
  }
}
```

One evaluator's full definition, to read before editing it:

```graphql
query EvaluatorDefinition($id: ID!) {
  node(id: $id) {
    ... on CodeEvaluator {
      name
      language
      sourceCode
      sandboxConfig { id name }
      inputMapping { pathMapping literalMapping }
    }
    ... on LLMEvaluator {
      name
      promptVersion { id template { __typename } }
    }
    ... on ProjectEvaluator {
      name
      inputMapping { pathMapping literalMapping }
      evaluator { id kind }
    }
    ... on DatasetEvaluator {
      name
      inputMapping { pathMapping literalMapping }
      evaluator { id kind }
    }
  }
}
```

Read a few real records before writing the input mapping or choosing calibration cases: dataset
examples for a dataset evaluator (`references/datasets.md`), or spans, traces, or sessions that
match the filter for a project evaluator (`references/project-spans-traces.md`).

## Previewing

`evaluatorPreviews` (a mutation, but it saves nothing) runs a draft against payloads you supply.
Each preview takes `evaluator` (one of `inlineCodeEvaluator`, `inlineLlmEvaluator`, an existing
`codeEvaluatorId`, or a `builtInEvaluatorId`), a `context` JSON shaped like the record
(`input`, `output`, `reference`, `metadata`), and an `inputMapping`. Batch every calibration case
of the plan into one call, and set `applyOnlineEvaluationLimits: true` when previewing an online
evaluator. Each result carries the `annotation` it would write, or an `error`.

## Saving

Pick the mutation by what you are saving:

| Goal | Mutation |
| ---- | -------- |
| New code evaluator for a dataset | `createCodeEvaluator`, then `createDatasetCodeEvaluator` with its `evaluatorId` |
| New LLM evaluator for a dataset | `createDatasetLlmEvaluator` |
| Change a dataset binding (name, mapping, outputs) | `updateDatasetCodeEvaluator` / `updateDatasetLlmEvaluator` |
| New online code evaluator on a project | `createProjectCodeEvaluator`, or `addProjectCodeEvaluator` to bind an existing one |
| New online LLM evaluator on a project | `createProjectLlmEvaluator` |
| Change a project evaluator | `updateProjectCodeEvaluator` / `updateProjectLlmEvaluator` |
| Turn a project evaluator on or off | `setProjectEvaluatorEnabled` |

Run `phoenix-gql schema --names <MutationName>` for each mutation's exact inputs before calling
it. Things the inputs do not make obvious:

- Names are identifiers: lowercase letters, digits, `_` and `-`, starting and ending with a
  letter or digit.
- An LLM evaluator's output must be categorical; give scored labels for a numeric scale.
- `updateProjectCodeEvaluator` with `sourceCode` changes the shared code evaluator, and with it
  every dataset and project it is bound to. Check `Evaluator.datasetEvaluators` and
  `Evaluator.projects` first, and say so in `mutation_description`.
- A code evaluator needs a `sandboxConfigId` whose language matches. List usable sandboxes with
  `sandboxProviders { backendType enabled configs { id name language enabled config { envVars { name } internetAccess { mode } dependencies { packages } } } }`
  and `sandboxBackends { backendType status languageDialect runtimeNotes }`, keeping configs whose
  provider and config are enabled and whose backend is `AVAILABLE`. The config's environment
  variables, internet access, and packages say what the evaluator can do: a sandbox with model
  credentials and internet access can call a model from code. Never request secret values.
- An LLM judge needs a provider with installed dependencies and, to run, credentials:
  `modelProviders { key name dependenciesInstalled credentialsSet }`.

After a save, read the binding back and link the user to it: `/datasets/<datasetId>/evaluators`
for a dataset evaluator, `/projects/<projectId>/evaluators` for a project evaluator.
