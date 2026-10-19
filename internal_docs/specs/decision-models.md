# Decision Models

> **Status: draft for discussion.** Built so far, in PR #16875: the stored types for
> inputs, state, and questions (`db/types/decisions.py`), their write-time rules,
> the provider adapters, the typed `runDecision` mutation (build order step 1),
> custom providers for decisions (`openai` and `typesafe`), Ollama, and decision
> experiments on the server, shaped like prompt tasks (see
> [Experiments](#experiments)), and saved decisions on the server: tables,
> versions, tags, their GraphQL, and `runDecisionVersion` (build order step 2,
> without the UI). The UI work is PR #16876. Where the pipeline stands against
> prompts is in [The Complete Parallel Pipeline](#the-complete-parallel-pipeline),
> and the choices to settle before shipping are in
> [Decisions Before Release](#decisions-before-release). This spec assumes apps fetch saved
> decisions at run time, the way they fetch prompts; that assumption is what
> justifies a standalone family with tags. Server-side decision evaluators are
> planned below, with dataset evaluators as the first milestone; they are not
> implemented by the provider or playground PRs.

## Summary

Decision models such as TypeSafe System One and OpenAI Decisions take an input
and a set of named questions, and return one typed answer per question: a
probability for a predicate, a chosen option for a choice, an expected level for a
scale. A decision is a typed function. Its inputs are named, and its questions
are its output schema.

Phoenix stores and versions decisions. Apps fetch a tagged version and call the
provider themselves. Phoenix also runs decisions in the playground and as
experiment tasks over datasets, as it does prompts.

## Where Decisions Run

A model plays one of two roles in Phoenix, and a decision model can be the model
in either:

| | Prompt (chat model) | Decision (decision model) |
|---|---|---|
| **Tested**: the regular playground and experiments | Prompt task. Exists. | Decision task. **This spec.** |
| **Judging**: the evaluator playground and evaluators | LLM evaluator. Exists. | Decision evaluator. [Planned](#decision-evaluators), dataset bindings first. |

In the tested role, a decision's answers are the output: what is being
evaluated, never an evaluation. Evaluators judge them, exactly as they judge a
prompt's completions. Only in the judging role do answers become evaluations
(annotations), and that is where problems such as a `box` answer having no
annotation form belong.

The `phoenix-evals` work on decision models as the judging model
(`ClassificationEvaluator(llm: LLM | Decision)`) is separate from this spec.

The format is new and changing fast. Jev 1.14 added a `box` question type for
one model and image inputs behind preview headers, and model versions are
deprecated on 30–60 days' notice. So the design keeps the stable core typed and
pushes everything uncertain to additive types or to run time.

## Goals

- Save, version, and tag decisions.
- Let apps fetch a version by tag and get ready-to-send SDK arguments, as
  `phoenix-client` does for prompts.
- Run decisions in the playground and as experiment tasks over datasets, as
  prompts run.
- Link app traces back to the decision version that produced them.
- Run decision models as saved evaluators: dataset bindings and experiment
  evaluation first, evaluator calibration second, project bindings and online
  evaluation third.
- Add question types, input modalities, and providers without migrations.
- Keep decision models out of every chat code path.

## Non-Goals

- Proxying app calls. Apps call the provider with their own keys.
- Stored decision results. Runs are spans; evaluator results are annotations.
- A model × question-type capability matrix.
- Storing image bytes.
- A shared abstraction with LLM structured outputs. It is a different contract,
  and merging the two would weaken both.
- Compatibility shims with the prompt family.
- Templated questions. Question instructions and criteria are static. A
  reference answer is an input, not part of a question's criteria.
- Built-in scoring of decision answers inside the task. Evaluators score runs,
  as they do for prompts.

## Why a New Family, Not Prompts

Phoenix [prompts](./prompts.md) assume "something you format and send to a chat
model". PR #16875 already guards prompts (GraphQL and REST), playground
subscriptions, chat completions, agents, and the model pickers against the
decision-only TypeSafe provider. Storing decisions as prompt versions would make
that split permanent: every prompt consumer, including every app that fetches
prompts, would have to check whether a version is a decision.

A decision's questions are also its outputs' schema: names, choices, and levels.
If they lived in a prompt version, anything reading the answers would need a
second copy of them.

The family borrows the prompt family's shape (versions, tags, fetch by tag)
because it has the same consumer: an app that wants "production" at run time.
It doesn't borrow string templating or output configs, which exist for reasons
that don't apply here.

## Stable and Volatile

| Stable enough for the schema | Likely to change |
|---|---|
| Named inputs and a named set of questions | Question types (`box` arrived in Jev 1.14, on one model) |
| One model from one provider answers | Answer shapes |
| One typed answer per question | Images, assets, and multipart uploads |
| Versions, and tags that apps follow | Wire formats and model names |
| | Preview flags such as danger-zone headers; which providers exist |

## Principles

1. **Store Phoenix's own vocabulary; translate at the edge.** The server adapters
   and the client formatters both translate to provider SDK arguments. Provider
   bodies are never stored. The two translations are tested against one shared
   set of fixtures.
2. **New types are additive, and old clients fail clearly.** Questions and
   inputs are JSON discriminated by `type`. Writes are validated strictly. Apps
   can pin an old `phoenix-client`, so a client that meets a `schema_version`
   or question type it doesn't know raises a clear "upgrade phoenix-client"
   error. It never drops the question or sends a partial request. A server that
   meets an unknown type (only after a downgrade) fails the read and never
   rewrites the row.
3. **Check capability at run time.** The adapter rejects what its provider can't
   express, the provider rejects what the model can't do, and both messages
   reach the user.
4. **Store references, never bytes.** Images and other assets are referenced by
   ID.
5. **Versions are immutable; tags move.** Apps follow a tag. Experiments copy a
   version, as prompt tasks do.
6. **No results table.** A run is a `DECISION` span. Evaluator results are
   annotations. Experiments link to spans.
7. **Version the schema, not just the content.** A `schema_version` on each
   version row, also returned to clients, lets the JSON's meaning change without
   a database migration.
8. **Say each fact once.** Questions define the outputs' schema; nothing else
   restates their names, choices, or levels.

## Data Model

```text
decisions
  id, name (unique), description, metadata, user_id, created_at, updated_at

decision_versions                      -- immutable
  id, decision_id → decisions
  schema_version   int                 -- how to read inputs and questions
  inputs           JSON                -- the signature: [{name, description?, json_schema?}]
  state            JSON                -- {type: "object"} | {type: "text", template, template_format}
                                       --   | {type: "input", name}; later {type: "messages"}
  questions        JSON                -- ordered list, discriminated by type
  model_provider, model_name (free text)
  custom_provider_id → generative_model_custom_providers  -- see Models
  description, metadata, user_id, created_at
  -- duplicates detected with has_identical_content, as prompts do

decision_version_tags
  id, decision_id, decision_version_id, name
  UNIQUE (decision_id, name)
  FK (decision_id, decision_version_id) → decision_versions (decision_id, id)

experiment_decision_tasks              -- ExperimentJob subtype, type = 'DECISION'
  -- see Experiments: a copy of the version's fields, the connection,
  -- the dataset paths, and an optional decision_version_id
```

The tag on `decision_version_tags` uses a composite foreign key so a tag can
never point at another decision's version. `PromptVersionTag` doesn't do this
today; it's cheap to add here.


### Inputs and State

A version declares its inputs by name: `[{name, description?, json_schema?}]`.
Apps pass them by name, and experiments fill them from each dataset example
(`inputValuesPath`, see [Experiments](#experiments)). A call
must pass exactly the declared inputs; a missing or undeclared one fails before
anything reaches the provider. Any JSON value is allowed. `json_schema` only
describes the value for the playground form and is not enforced on a call.

The state sent to the model is built from those inputs:

| State | Meaning | When |
|---|---|---|
| `object` | Exactly the declared inputs, as a JSON object. This is TypeSafe's native form: structured values stay structured, and nothing is templated. OpenAI receives it serialized as text. | Launch |
| `text` | A string template over the inputs, `MUSTACHE` or `F_STRING`, using Phoenix's existing formatters. It may only reference declared inputs, checked on write. An object, array, boolean, or null renders as JSON when named on its own; Mustache dotted paths and sections still read into it. | Launch |
| `input` | One declared input's value, unchanged: text, an object, or an array. For a caller that already has its whole state as one value, and for benchmarks whose states are objects with keys that vary per example. | Built |
| `messages` | A message list, for OpenAI's message-style `input` and for images. | With assets |

There is no JSON template. Reshaping data belongs in the app or the dataset, so
the rules for substituting into JSON never have to exist.

### Questions

```jsonc
[
  { "name": "urgent",   "type": "predicate", "instructions": "...",
    "criteria": { "true": "...", "false": "..." } },  // both optional
  { "name": "category", "type": "choice", "instructions": "...",
    "choices": [{ "value": "billing", "description": "..." }] },
  { "name": "severity", "type": "scale",  "instructions": "...",
    "levels": [{ "label": "low", "description": "..." }] },
                                                      // 2–10 levels; index = level
  { "name": "mug",      "type": "box",    "instructions": "the mug in `photo`" }
                                                      // later, additive
]
```

- **Names are identities.** They are answer keys: run outputs and app code read
  answers by name. Renaming is allowed but flagged, because it breaks continuity
  with earlier runs and with app code.
- **Write-time validation.** Question names are unique within a version, choice
  values are unique within a question, a choice has 2–255 options, and a scale
  has 2–10 levels. A list loses the key uniqueness a JSON object would give, so
  this is checked explicitly. Both providers document 2–255 choices (TypeSafe
  in its API docs, OpenAI in its SDK's request types); the 2–10 levels are
  TypeSafe's, and OpenAI documents no level limit. There is no limit on the
  number of questions: neither provider documents one, and request size and
  context length are the provider's to enforce. These rules run when questions are accepted, by a run
  or a save, never on read: the stored types check structure only, so
  tightening a rule can't make an old version unreadable.
- **Type names are Phoenix's own.** `predicate` is a statement or yes/no
  question answered with the probability that it's true. TypeSafe calls it
  `noul` and OpenAI calls it `predicate`; the TypeSafe translation renames it.
  The UI can label it "Yes / No". `scale` is a set of ordered levels; both
  providers call it `score`, which Phoenix avoids because every annotation
  already has a `score`.
- **Answer fields say what the number is.** A predicate answer has
  `probability`, the chance it's true. A scale answer has `expected_level`,
  the probability-weighted average of the levels, which can fall between
  levels (1.7, say); it is never a discrete level.
- **Predicate criteria** describe the true and false outcomes separately,
  matching TypeSafe's `NoulCriteria`. OpenAI's predicate has no criteria field,
  so its translation folds them into the instructions.
- **Scale levels** have a short `label` (required by OpenAI) and an optional
  `description`. The TypeSafe translation sends the description, or the label
  if there is none.
- **Question text is a plain string.** Instructions, predicate criteria, and
  choice and level descriptions are `str`; only the state may be structured.
  TypeSafe also accepts JSON in these fields, but OpenAI doesn't, and nothing
  shows structured text improves answers. Widening to `str | JSON` later breaks
  no stored data.
- **Text fields stay plain strings, even with images.** Images are not designed
  yet, but they usually arrive with each call or example, not with a version,
  so they belong to the inputs and the state (the `messages` state), not to a
  version-level list. The providers also differ: TypeSafe replaces placeholder
  strings with assets anywhere text appears, including question instructions
  and criteria, while OpenAI accepts images only in `input`. An image inside
  question text would be TypeSafe-only.
- **Provider-only types are allowed.** `box` is part of Phoenix's vocabulary.
  The OpenAI SDK has no box question, so its translation rejects it with a
  clear error. A box answer is a single box (its edges as fractions of the
  image's size) with an optional confidence. It is output like any other
  answer; judging it (overlap with a reference box) is an evaluator's job.
- **Provider-specific options**, if one ever matters, go in an allow-listed
  `options` field on the question, not in free-form JSON.

### Models and Preview Flags

`model_name` is free text, and a version pins it. The catalog only suggests
names, ideally from the provider's model-list endpoint. An app following a tag
gets whatever model that version names. A deprecated model shows up as the
provider's error at run time, so the UI warns when a tagged version names a
model the provider no longer lists.

### Custom Providers

A run reaches either a built-in provider or a custom provider, and a version's
`custom_provider_id` names the second. What a custom provider can serve comes
from its SDK (`sdk_offers_chat`, `sdk_offers_decisions`), not its name:

- An `openai` provider serves both. The same endpoint, key, organization,
  project, and headers run chat or OpenAI's Decisions API; the model type chosen
  decides which. `openai_api_type` stays a choice between chat surfaces.
- A `typesafe` provider is any System One-compatible endpoint (API key, base
  URL, headers). It serves decision models only, so every chat path refuses it:
  prompts (no prompt provider is compatible with it), the playground, agents,
  and online evals through their prompts.
- Other SDKs serve chat only, and `runDecision` refuses them.

A custom provider brings its own connection. Neither the server's environment
nor its stored secrets are consulted, and the OpenAI SDK is kept from reading
`OPENAI_*` variables, so the server's organization never reaches another host.
The span's `decision.system` is the API family (`openai`, `typesafe`) and
`decision.provider` is the custom provider's own `provider` name, the host.

The catalog suggests model names per model type (`modelNames(modelType:)`); any
name the endpoint accepts works.

### Ollama

Ollama serves its decision models through System One at `/v1/systemone`, so the
built-in `OLLAMA` provider runs them with the TypeSafe adapter and serves both
model types. It is configured the way Ollama chat is: no credentials (a
placeholder key is sent, since the SDK requires one), and a base URL from the
run or `OLLAMA_BASE_URL` with no default. That variable names chat's
OpenAI-compatible root (`http://localhost:11434/v1`), so a trailing `/v1` is
dropped. The span's `decision.system` is `typesafe` and `decision.provider` is
`ollama`, a plain string until OpenInference has a value. Ollama's limits are
tighter than TypeSafe's (2–26 options, 64 KiB bodies, text only); its own error
reports them. A TypeSafe custom provider pointed at Ollama works too.

Preview flags such as `TypeSafe-Danger-Zone-Images` aren't stored at first. If
they need to be, they go in an allow-listed per-provider `options` field, never
as raw headers.

## App Access

REST mirrors the prompt routes:

- `GET /v1/decisions/{identifier}/latest`
- `GET /v1/decisions/{identifier}/tags/{tag_name}`
- `GET /v1/decision_versions/{id}`
- `POST /v1/decisions` (create a decision with its first version, or add a
  version)

Each response carries `schema_version`, `inputs`, `state`, `questions`, and the
model.

`phoenix-client` (Python and TypeScript) adds:

```python
decision = client.decisions.get(decision_identifier="triage", tag="production")
kwargs = decision.format(inputs={"ticket": ticket}, sdk="typesafe")
result = await typesafe.system_one(**kwargs)  # or openai.decisions.create(**kwargs)
```

`format` validates the inputs against the declared signature, builds the state,
and translates the questions for the chosen SDK. It's the same translation the
server adapters do, held to the same fixtures.

To link app traces to versions, `format` also returns the decision version ID,
which the app's instrumentation records on the `DECISION` span. Phoenix can then
group production runs by version. Which attribute holds it is an
[open question](#open-questions).

## Execution in Phoenix

Unsaved playground runs and saved versions take the same `DecisionVersionInput`,
so running and saving share one typed shape.

Steps 1 to 5 are built; step 6 records everything except assets, which aren't
supported yet, and the version ID, since which attribute holds it is an
[open question](#open-questions); `runDecisionVersion` records none yet.

1. Take a decision version (saved, or an unsaved draft) and its inputs.
2. Validate the inputs and build the state.
3. **Adapter:** translate and call the provider SDK, rejecting unsupported
   question types.
4. **Adapter:** validate with the SDK's response models, then check each answer
   against its question.
5. Normalize to the `DecisionAnswer` union.
6. Record a `DECISION` span: input with assets left out, raw response, model,
   usage, and the decision version ID.

## Experiments

A decision task runs a decision over a dataset as an experiment, the way a
prompt task runs a prompt. The playground's dataset mode creates one experiment
per decision panel through `experimentsOverDataset`; a run holds one example
and repetition. The rule is per role: tested tasks (prompts and decisions) may
share one run, each with its own experiment, so a decision can be compared with
a prompt side by side, while evaluator tasks run alone.

The decision task mirrors `ExperimentPromptTask` field for field:

| Prompt task | Decision task |
|---|---|
| A copy of the prompt version (template, tools, response format, parameters) | A copy of the decision version: `inputs`, `state`, `questions` |
| `prompt_version_id`, optional, `ON DELETE SET NULL` | `decision_version_id`, the same (`decisionVersionId` on the input; recorded, not read) |
| Model and connection, or a custom provider | Model and `connection`, or a custom provider |
| `templateVariablesPath` (default `input`): `{{query}}` reads `input.query` | `inputValuesPath` (default `input`): input `ticket` reads `input.ticket` |
| `appendedMessagesPath`: messages from the example, appended | `questionsPath` and `questionsFormat`: questions from the example, used instead of the version's |
| `evaluators`: dataset evaluators judge each run | `evaluators`: the same |

Only the declared inputs are read from the object at `inputValuesPath`, so an
example may carry other fields (a benchmark's questions, say) beside them. There
is no per-input mapping: input names must match the example's field names, as a
prompt's template variables must.

`questionsPath` is for benchmarks whose questions vary per example, such as the
datasets `phoenix datagen` seeds. Those questions are read in the format they
were published in (`system_one`, `openai`, or `phoenix`) and translated to
Phoenix's types. The translation reverses what the adapters write only where the
adapters lose nothing: the TypeSafe adapter sends a level's description in place
of its label, and the OpenAI adapter folds predicate criteria into the
instructions, so neither round-trips. Round-trip tests cover questions without
those. A System One predicate with criteria but no instructions is rejected,
since Phoenix requires instructions.

Before anything is stored, the connection must resolve and every example must
make a request; otherwise the run is refused with a count and the first
reasons. Rate limits and transient failures go through the runner's backoff,
with the SDK's own retries off. An example that can't make a request is recorded
as the run's error without calling the model.

### Run Output

A run's output is the answers by question name, with no decision rule applied:

```json
{"task_output": {
  "urgent": {"type": "predicate", "probability": 0.93},
  "team": {"type": "choice", "choice": "billing", "confidence": 0.8,
           "probabilities": {"billing": 0.8, "technical": 0.2}},
  "severity": {"type": "scale", "expected_level": 1.4, "confidence": 0.7,
               "probabilities": {"0": 0.1, "1": 0.4, "2": 0.5}}}}
```

Keyed by name so evaluators reach values by path (`output.urgent.probability`),
as a dataset's reference answers are usually keyed. The fields inside each
answer are Phoenix's, though, and a dataset's need not match: the typed-decisions
references carry `label` where a choice answer has `choice` (see
[Decisions Before Release](#decisions-before-release)). The model that answered and
the usage stay on the `DECISION` span, which goes to the experiment's project,
as a prompt run's output is the response alone.

Evaluators read a decision run as they read a prompt run: `output` is the run's
answers and `reference` is the example's output, where a dataset keeps its
reference answers. Thresholds and other decision rules belong to the evaluator,
so changing one never needs a new model call.

### Not Yet

- **Built-in decision metrics.** Accuracy, Brier score, level error, and
  distance from a reference distribution, as built-in evaluators, designed with
  an experiment-level report (calibration, confidence intervals, coverage of
  refusals and missing references).

### Tokens and Cost

Decision spans record `decision.token_count.*`, but everything downstream reads
only LLM attributes:

- `should_calculate_span_cost` (`db/insertion/helpers.py`) only prices `LLM`
  spans.
- Span ingestion (`db/insertion/span.py`) reads token counts, and cumulative
  trace totals, only for `LLM` spans and `llm.token_count.*`. This is the path
  app traces take.
- Cumulative trace token counts for spans recorded by the server
  (`tracers.py`) read only `llm.token_count.*`.
- Prompt experiment runs (`playground_experiment_runs.py`) fill
  `prompt_token_count` and `completion_token_count` from the LLM keys. Decision
  experiment runs fill neither.

Token counts are in scope: experiment runs and trace totals read the decision
keys too. Cost is in scope only if a provider publishes per-token prices for
decision models; until then, decision spans have no cost, and the UI shows none
rather than zero.

## GraphQL

- `DecisionQuestion`: a union of `Predicate`, `Choice`, `Scale`, later `Box`. The UI
  ships with the server, so it always knows every member and needs no
  placeholder for unknown types. (Old clients are a REST concern; see
  principle 2.)
- `DecisionQuestionInput`: a `@oneOf` of `predicate`, `choice`, and `scale`
  inputs, each carrying its own `name`, so a question reads
  `{predicate: {name, instructions, criteria}}`. Questions are an ordered list;
  duplicate names are rejected.
- `DecisionAnswer`: an interface with `name`, implemented by `PredicateAnswer`
  (`probability`), `ChoiceAnswer` (`choice`, `confidence`, `probabilities`),
  `ScaleAnswer` (`expectedLevel`, `confidence`, `probabilities`), and
  `RefusalAnswer`. Probabilities are lists in the question's order, not maps.
  The provider's raw response is only on the span. An answer the server can't
  validate fails the run.
- Mutations:
  - `runDecision(input: RunDecisionInput)` (built): `connection` (a `@oneOf` of
    `builtIn: {providerKey, baseUrl, credentials}` or `customProvider: {id}`),
    `modelName`, `inputs`, `state` (a `@oneOf` of `object: true`,
    `text: {template, templateFormat}`, or `input: name`), `inputValues`, and
    `questions`, returning `result`
    (`model`, `answers`, `usage`), `span`, and `error`. It replaced the ad hoc
    `createDecision`.
  - `runDecisionVersion(input: {decisionVersionId, inputValues, credentials})`
    (built): runs a saved version as saved, its definition, model, and provider
    included, so a caller doesn't copy the version into `runDecision`.
    `credentials` and `baseUrl` serve a version on a built-in provider (a
    version stores no endpoint, so a local Ollama is named by the call); a
    custom provider brings its own key and endpoint. It returns the same payload
    as `runDecision`.
  - `createDecision` (built): a name, a description, metadata, the first
    version as a `DecisionVersionInput`, and tags. A name already in use is a
    conflict.
  - `patchDecision` (description, metadata) and `deleteDecision` (built).
  - `createDecisionVersion` (built): a new version, optionally taking tags from
    older ones.
  - `setDecisionVersionTag` (built) creates a tag or moves it to the given
    version; `deleteDecisionVersionTag` (built).
  - A version is checked against the rules a run uses. A custom provider must
    serve decisions through the API the version names (`OPENAI` or `TYPESAFE`).
- Queries (built): `decisions`, newest first and filtered by name as `prompts`
  is; `node` for `Decision`, `DecisionVersion`, and `DecisionVersionTag`; and
  `Decision.version(versionId, tagName)`, the latest version when neither is
  given. Unlike `Prompt.version` it is null when there is no such version, so
  asking for a missing tag doesn't null the rest of the query.
- Subscriptions: `experimentsOverDataset` takes a `decision` task beside
  `prompt` and `evaluator`; see [Experiments](#experiments).

## Decision Evaluators

**Milestone 1 server work is built; its UI is not.** A decision evaluator uses a
decision model as a judge. It maps the target's fields into declared inputs, renders the state,
asks fixed questions in one call, and projects the normalized answers into
annotations. It shares provider clients with decision tasks, but the two roles
remain distinct: a task produces answers to evaluate; a judge produces verdicts.
Built-in metrics that compare decision predictions with references are separate.

### Milestones

1. **Dataset evaluator.** Create a saved judge from a selected decision version,
   bind it to a dataset, configure input mapping and scoring, preview it, and run
   it against experiment task outputs. Include the dataset UI, APIs, results,
   trace links, and evaluation resume. An inline-only or API-only demonstration
   does not complete this milestone.
2. **Evaluator calibration.** Draft or load a judge in the evaluator playground,
   preview it, and run evaluator-as-task experiments against dataset judgments.
3. **Online evaluation.** Bind the same saved evaluator to project spans, traces,
   and sessions, with existing scheduling, configuration identity, and result
   views.

This is delivery order, not reduced scope. Dataset evaluation does not wait for
app SDK formatters, image inputs, `box`, or online evaluation.

### Definition and Bindings

| | LLM evaluator | Decision evaluator |
|---|---|---|
| Table | `Evaluator` subtype, `kind = 'LLM'` | `Evaluator` subtype, `kind = 'DECISION'` |
| Runs | A prompt (`prompt_id`, `ON DELETE RESTRICT`) | A decision, with deletion restricted |
| Version | A prompt version tag the evaluator owns | A decision version tag created with the evaluator |
| Outputs | Stored categorical `output_configs`, turned into tools | Derived from questions plus a stored projection policy |
| Explanation | The judge may return one | No generated rationale; Phoenix explains terminal refusals |
| Annotator kind | `LLM` | `LLM` |

Creating a decision evaluator requires a selected decision version and creates
its owned tag transactionally. New decision evaluators require a valid pin;
there is no implicit latest-version fallback. Model, provider, inputs, state,
and questions come from that version. A version's questions are fixed: bindings
supply input values, not per-example questions or question templates.

Inputs are mapped by the **binding**, never the saved evaluator. A dataset
binding maps experiment context into declared inputs through existing JSONPath
and literal mappings. A project binding does the same for its target context.
One saved judge can serve several datasets or projects with different mappings.
Preserve structured input types and reuse decision state rendering; descriptive
input JSON schemas do not become new runtime coercion or validation rules.

Store a projection policy on the evaluator for predicate thresholds,
choice scores, scale-label mode, and optimization direction. Dataset bindings
may override it per question: each question a binding's policy names replaces the
evaluator's settings for that question, and every other question keeps the
evaluator's, so a later edit to the evaluator still reaches them. Existing generic
`output_configs` have no predicate threshold field, so they alone cannot express
these overrides. A typed binding policy field holds them, and one shared resolver
derives the effective policy and output configs. A decision binding stores no
`output_configs`: they are derived whenever they are read. A request may send
them only if they equal the derived ones.

GraphQL exposes projection policies as typed objects, including on dataset
bindings and frozen experiment definitions. `DecisionProjectionPolicyInput`
accepts a list of question settings. Each question setting
selects exactly one of `predicate`, `choice`, or `scale`, following the decision
question input pattern. For example:

```graphql
projectionPolicy: {
  questions: [{ predicate: { name: "accuracy", threshold: 0.5 } }]
}
```

Every variant carries the question `name` and `optimizationDirection`. Predicates
have `threshold`, choices have typed `{choice, score}` entries, and scales have
`includeLabel`. Output questions implement `DecisionQuestionProjection`; clients
select variant fields through inline fragments. Output questions and choice
scores follow the decision's declared order, since the stored map's key order
differs across databases. Reject duplicate question names and choice-score
entries; a validation error names the question. Omitting a patch policy preserves it; a null dataset
binding policy restores inheritance. This GraphQL representation maps to the
existing stored policy format without changing it.

Guard owned-tag deletion and every move, including moves through version
creation. Validate the proposed version and policy against binding inputs,
question identities/types, choice values, scale meanings, and overrides. A
breaking bound change must fail with the affected binding names and require an
explicit migration or separate evaluator. Reordering inputs, questions, or choices
is compatible; reordering a scale's levels is not, since a level's index is its
score. Input JSON schemas are descriptive, so changing them is compatible. A
version of another decision can never be pinned. Compatible changes affect future
execution snapshots. Keep deletion and concurrent edits consistent with existing
evaluator services and lock ordering.

### Answer Mapping

Derive one `OutputConfigType` per question from the selected version, then apply
the effective projection policy. Annotation names use `result_annotation_names`:
one question writes under the binding's name, several under
`{binding}.{question}`. The runner's rule for other evaluators, that a lone output
writes under its config's name, does not apply: a decision's configs are named
after its questions, and two bindings of one judge must not share a name. Changing between one and several questions changes
annotation names and is a breaking bound update, even if an old question remains.

| Answer | Derived output config | Annotation |
|---|---|---|
| `predicate` | Continuous, 0–1 | score = probability of true; label = `true` when probability >= threshold, otherwise `false`; default threshold 0.5 |
| `choice` | Categorical, one value per choice | label = provider's chosen value; score = configured score for that value, otherwise null |
| `scale` | Continuous, 0 to levels − 1 | score = raw `expected_level`; no label by default, or the most probable level's label when configured |
| `refusal` | Retains the question's output config | terminal refused outcome with no score or label and a system explanation |
| `box` | — | unsupported as an evaluator output; reject before invocation |

Thresholds must be finite and in [0,1]. Choice score maps may name only declared
choices; omitted scores stay null and configured scores must be finite. A scale
label uses the first level on a probability tie. Scale scores remain zero-based,
not normalized to 0–1. Optimization direction defaults to `NONE`. A predicate's
label threshold is distinct from a consumer's flag/optimization threshold.

Confidence and full probabilities are retained as metadata. Confidence is not a
quality score and never replaces a class score. Projection requires no extra
model call. Editing a threshold does not automatically rewrite historical
annotations; historical rescoring is a separate workflow.

### Refusals, Errors, and Metadata

A normalized refusal is a terminal outcome for that question. Record no score or
label, a structured refused status, and the system-generated explanation
"Decision model refused this question." This is not a model rationale: the
current normalized `RefusalAnswer` carries no reason. Preserve answered siblings
and emit exactly one result per question, in definition order.

A refusal has no evaluation error, so resume does not invoke the model again
solely for that refusal. Exclude refused outcomes from score/label aggregates and
show answered, refused, and error counts and coverage. Extend categorical result
validation to permit the explicit refused form; do not generally permit answered
categorical results without an allowed label. Online publication remains atomic
for a complete validated result set, which may contain terminal refusals.

Provider failures, timeouts, and invalid responses remain errors. Missing, extra,
or wrong-type answers fail the invocation under existing adapter validation;
this feature does not require batch splitting or malformed-answer salvage.
Retryable provider failures must reach the runner's retry handler. Returning an
error result with `error_exc` attached is insufficient where the runner records
that result directly as a failure, so the runner re-raises a decision judge's
returned rate-limit or transient failure, classified by the judge's own client.
As for any retried work, a retried attempt's trace is not kept. LLM judges return
failures the same way and are still recorded on the first one; giving them the
same retries is a separate change. The runner owns retries in experiments, so
judges there run without SDK retries; a preview, which nothing retries, keeps them.

Each annotation records, under `metadata.decision`, its outcome status, the
question's identity and type, the normalized answer (including native
uncertainty), the applied projection policy, and provenance: the selected
decision and version when available, the requested and resolved model, and a
non-secret connection identity. Request usage belongs on the DECISION span rather
than being repeated per annotation. The current shape is provisional; see
[Evaluator Annotation Metadata](#evaluator-annotation-metadata).

### Experiment Snapshots and Resume

Freeze a dataset evaluator's resolved decision definition/version, effective
projection policy, derived output configs, input mapping, binding name and source
IDs when attaching it to an experiment. Store an execution snapshot on
the experiment's evaluator binding. Persist no credentials; resolve them through
the connection system at execution time. Legacy experiments without a snapshot
retain their existing semantics rather than claiming reconstructable history.

On start or resume, rebuild the judge from the experiment snapshot, independently
of live binding membership. Editing or deleting the dataset binding or moving the
owned tag must not silently change or remove already-snapshotted work.

The existing reconciliation scan identifies successful task runs whose expected
annotation names are missing or have a non-null error. It then queues each
incomplete evaluator/run pair once, even if several outputs are missing. Preserve
that behavior with names from the frozen configs:

- Reuse successful task outputs; evaluation resume does not rerun the task.
- Skip evaluator/run pairs with every expected terminal result recorded.
- Missing and errored results are eligible for resume; terminal refusals count
  as recorded because their evaluation error is null.
- Persist a multi-question result set together. If an incomplete result set is
  encountered, invoke the judge once and upsert the resulting set consistently.
- A provider call may repeat after a crash between its response and result
  commit. Annotation upserts prevent duplicate result rows, not duplicate calls.
  Verify trace/result crash consistency: existing attached-evaluator persistence
  writes traces and annotations in separate transactions.

Evaluator-as-task calibration has a different input context from an attached
judge. Calibration sees dataset `input`, `output`, and `metadata`. An attached
judge sees task `output`, dataset `reference`, dataset `input`, and `metadata`.
Preview and mapping controls must use the actual execution role, not assume the
same mapping works for both.

### Runtime and Integration Points

Implement one `DecisionEvaluator(BaseEvaluator)` runtime with shared output
schema derivation and answer projection. Use it from saved-row loaders, previews,
experiment reconstruction, and online hydration. Provider translation remains in
`decision_clients.py`; do not reuse the chat evaluator's tool validation.

- **Persistence.** Add the joined evaluator subtype, owned-tag references,
  projection policy and binding overrides, and experiment snapshots. Extend
  `evaluators.kind`; milestone 2 also extends
  `experiment_evaluator_tasks.evaluator_kind`. Existing annotation kinds remain
  unchanged because model judgments use `LLM`.
- **Discovery and APIs.** Extend GraphQL types, enums, node resolution, queries,
  dataset/project fields and dataloaders; evaluator CRUD and binding services;
  REST discriminator unions, kind-keyed maps and serializers. Generic reads must
  include the subtype even before every authoring surface is available.
- **Resolved configs.** Replace assumptions that every evaluator ORM subtype
  stores `.output_configs` with a shared effective-config resolver, including
  primary-result selection, distributions, comparisons and result views.
- **Experiments.** Extend dataset evaluator loading and `EvalWorkItem` first;
  add inline definitions, provenance and `EvaluatorTaskWorkItem` in milestone 2.
  Audit rate-limit, retry, timeout and error paths: current LLM-only checks would
  otherwise leave decision judges unthrottled or mark errors as `CODE`.
- **Retry ownership.** Use the decision client's rate-limit key and failure
  classifiers. Disable SDK retries when the runner owns retries, propagate
  cancellation, and make outbound calls without holding a database session.
- **Tracing.** Keep an EVALUATOR root with a child DECISION span. The client's
  current forced detached root must become composable; retain standalone-run
  behavior and centralized answer validation/accounting. Accept a common OTel
  tracer so no-op previews work. Preserve failed/cancelled traces and result links.
- **Connections.** A deleted custom provider must make its saved definition
  unavailable or be blocked from deletion; never fall back to a built-in host.
  An execution snapshot freezes the judge configuration, not an external service.
- **Frontend.** Add evaluator kind/discovery and dataset create/edit/attach flows,
  mapping, scoring, preview and experiment result details in milestone 1. Reuse
  decision editors and annotation views without chat/tool assumptions. Show
  uncertainty, refusal status, coverage and trace links. Calibration and project
  flows follow in their milestones.

For online evaluation, extend subtype loads in `sweeper`, `producer`, `executor`
and queries, project binding services, version resolution and hydration. Include
resolved version, effective policy/configs/mapping, and custom-provider revision
in the configuration fingerprint. Execute that resolved snapshot rather than
rereading a moving tag. Extend provider-transient classification and consumer
timeout categories, which currently special-case `LLM`. Enforce a rendered
state-and-questions byte cap, including previews that simulate online limits.
Reuse queue/admission/lease machinery, trace-project routing and evaluator-traffic
exclusion; a new queue or consumer is unnecessary.

### Completion and Verification

Milestone 1 is complete when users can author a saved decision evaluator, attach
it to a dataset through UI/API mapping and scoring controls, preview it, run it
against prompt or decision task outputs, and inspect annotations and traces.
Evaluation resume must work after task completion and server restart, with frozen
configuration and explicit refusals. It does not depend on calibration or project
bindings.

Verify output derivation, threshold/tie behavior, structured mapping, one-call
multi-question execution, refused siblings, malformed responses, provider retries,
cancellation, tracing, CRUD/discovery, owned-tag guards, compatible overrides, and
SQLite/PostgreSQL migrations. Resume tests cover mixed completed/pending judges,
missing/errored outputs, terminal refusals, incomplete multi-output sets, tag/policy/
mapping edits, live-binding deletion, and crashes around persistence. Exercise
existing LLM/CODE/BUILTIN dataset evaluator flows for regressions.

Milestone 2 adds shared inline preview and evaluator-as-task calibration with
frozen definitions and correct role-specific contexts. Milestone 3 adds all
project targets, fingerprint/hydration concurrency tests, atomic refusal-aware
publication, health/result views and protection from recursive evaluator traffic.
The complete feature includes all three milestones.

## The Complete Parallel Pipeline

Everywhere Phoenix uses a chat model, a decision model needs an equivalent.
Providers and models are done: built-in TypeSafe, OpenAI, and Ollama; custom
`openai` and `typesafe` providers with capability checks; credentials; the
catalog; and decision models kept out of every chat path. The rest, by the
[two roles](#where-decisions-run):

### Tested

| Stage | Chat today | Decision status | Missing |
|---|---|---|---|
| One run in the playground | Chat completion subscription; LLM spans | Built on the server: `runDecision`, and `runDecisionVersion` for a saved version | UI: the `connection` input, custom providers and Ollama in the Decision tab, free-text model names |
| Saved definitions | Prompts, versions, and tags; playground save and load; prompt pages | Built on the server: tables, versions, tags, GraphQL CRUD, lookup by name; decision tasks record their version | UI: playground save and load, a decisions page |
| Run over a dataset | Prompt tasks; experiment views and comparison | Built on the server: the task, the runner, evaluators, `DecisionTaskConfig`; run against a benchmark through the subscription directly | UI dataset mode and answer cells (experiment pages show answers as raw JSON) |
| Judging the runs | Dataset evaluators | Dataset evaluators attach to decision tasks and read answers by path (built) | Built-in decision metrics and the experiment report; a [reference answer convention](#reference-answers-in-datasets) |
| Apps | `phoenix-client` `prompts.get` and `format`; REST | Nothing | REST routes; `decisions.get` and `format` in Python and TypeScript; shared translation fixtures; [whether Phoenix translates](#translating-for-apps) |
| Tokens and cost | LLM token counts and costs everywhere | Spans record `decision.token_count.*`; nothing reads them | Token totals on traces and experiment runs; cost only if providers publish prices |

### Judging

| Stage | Chat today | Decision status | Missing |
|---|---|---|---|
| Evaluator definition | `LLMEvaluator`, referring to a prompt and an optional tag | Planned, milestone 1 | A `DecisionEvaluator` subtype, owned tag, projection policy and derived outputs |
| Calibration in the evaluator playground | Evaluator task, inline or saved, compared against expected outputs | Planned, milestone 2 | An inline decision evaluator definition, its rebuild in the runner, its form |
| Judging experiment runs | Dataset evaluator bindings | Planned, milestone 1 | Saved dataset evaluator UI/API, mapping/scoring, execution snapshots, evaluation resume, verdicts and traces |
| Online evals | Project evaluator bindings; the sweeper, producer, and executor | Planned, milestone 3 | Every [integration point](#runtime-and-integration-points) |
| Library | `phoenix-evals` `ClassificationEvaluator(llm: LLM)` | Separate work (`llm: LLM \| Decision`) | Outside this spec |

### Cross-Cutting

- **Traces.** `DECISION` spans render as decisions, and replay into the
  playground (built in PR #16876).
- **The agent.** Not yet: its playground and experiment tools don't know
  decision panels or runs.
- **Before shipping:** the [decisions before release](#decisions-before-release), to be decided
  as a team, and the PostgreSQL migration and tests, which have run only on
  SQLite.
- **Decisions that block work:**
  - [renaming questions](#open-questions) decides how the UI flags a rename;
    the tables don't depend on it, since a rename is a new version;
  - `box` is rejected as an evaluator output and does not block other types;
  - assets and images (`messages` state) block image inputs.

## Build Order

The tested-role work below has its own dependency order. The judging role has
[three delivery milestones](#milestones), beginning with dataset evaluators; it
depends on saved decision definitions, not completion of app formatting,
measurement, assets, or every earlier numbered item.

1. **Runs.** Schema types, validation, the inputs signature, and `runDecision`
   (built); decision experiments shaped like prompt tasks (built on the server);
   the UI's playground runs and dataset mode. This completes the regular playground for
   unsaved decisions.
2. **Saved decisions.** Tables, versions, and tags; GraphQL CRUD; the decision
   task gains `decision_version_id` (all built on the server); playground save
   and load. The judging role
   depends on this, since evaluators refer to saved definitions as
   `LLMEvaluator` refers to `prompt_id`.
3. **Apps.** REST routes and `phoenix-client` `get` and `format` (Python, then
   TypeScript), with the shared translation fixtures.
4. **Measurement.** Token counts on traces and experiment runs; built-in decision
   metrics and the experiment report.
5. **Assets, `messages` state, and `box`,** together, once TypeSafe moves them out
   of the danger zone.
6. **Judging (planned).** Saved decision evaluators and dataset bindings,
   including UI, preview, experiment evaluation and resume, first; inline
   evaluator authoring and calibration second; project bindings and online
   evaluation third. Shared runtime, derived outputs, projection policy and
   tracing support the three milestones.

## Decisions Before Release

These are one-way doors: cheap to change now, expensive once stored data, apps,
and evaluators depend on them. Each has a current default so work can proceed;
each needs a deliberate team decision before a release ships it. Smaller,
reversible unknowns are in [Open Questions](#open-questions).

Six of them choose a format at a boundary: the stored version, the run output,
the span, a dataset's reference answers, the SDK arguments handed to apps, and a
judge's annotations. At each, Phoenix can use a provider's format or its own.
They are related enough to decide together. The seventh is the shape of the
evaluator API: how a judge's scoring is written.

### Answer Format

Answers are stored, returned by GraphQL, and written as experiment run outputs in
Phoenix's own format. The alternative is to adopt a provider's format, most
likely TypeSafe's System One ("jev"), which TypeSafe and Ollama both return.

| Answer | Phoenix (current) | System One | OpenAI Decisions |
|---|---|---|---|
| Yes / no | `predicate`: `probability` | `noul`: `noul` | `predicate`: `probability` |
| Choice | `choice`, `confidence`, `probabilities` (map) | Same as Phoenix | `choice`, `confidence`, `probabilities` (list of `{value, probability}`) |
| Scale | `scale`: `expected_level`, `confidence`, `probabilities` (map) | `score`: `score`, `confidence`, `probabilities` (map), `legend` | `score`: `score`, `confidence`, `probabilities` (list of `{label, value, probability}`) |
| Refusal | `refusal` | None | `refusal` |

For a provider's format:

- Familiar to that provider's users, and close to its raw response.
- Matches the input side, where experiments already read System One questions
  (`questionsFormat: SYSTEM_ONE`).
- Market reach is the argument for it, but neither format is a standard: OpenAI
  agrees with Phoenix on yes/no answers and System One on choice answers.

For Phoenix's own (the current default):

- **Provider-neutral.** Phoenix runs both providers; storing one's format means
  translating the other's into it, lossily (System One has no refusal, and OpenAI
  choices can be booleans), and following that vendor's changes (System One added
  `legend` and `box`).
- **One shape everywhere.** `runDecision`, GraphQL, and run outputs agree; a
  provider format in run outputs alone would give one answer two shapes.
- **Self-describing.** `predicate` and `probability` say what they are; `noul`
  doesn't.
- **Adopting a provider format wouldn't remove the reference mismatch.** The
  typed-decisions references use `label`, which neither API returns, so
  evaluators map different paths for output and reference either way.

A narrower option: **scales.** Both providers say `score` for the type and its
expected value; only Phoenix says `scale` and `expected_level`. Aligning would
follow both providers without adopting either, but the name was avoided on
purpose, because every annotation already has a `score`, and a scale answer
mapped to an annotation would put an expected level and an annotation score side
by side under one name (see [Questions](#questions)).

Decide before run outputs become a contract: before the REST routes and
`phoenix-client` (build order step 3) or the built-in decision metrics (step 4),
whichever comes first. Changing it after means migrating stored run outputs and
every evaluator mapping written against them.

### Stored Question Format

What `decision_versions.questions` (and the state and inputs beside them) is
written in. [Principle 1](#principles) chose Phoenix's own vocabulary, translated
at the edge; this records the alternative, so the choice is made on purpose.

The precedent is mixed. Prompt versions store tools (`{type: "function",
function: {name, description, parameters, strict}}`) and the response format
(`json_schema`) in OpenAI's shape, chosen because OpenAI's was the most widely
used. Messages, content parts, and tool choice are Phoenix's own. Decisions
follow the same path today: the stored questions are OpenAI's, almost exactly.

| Question | Phoenix (current) | OpenAI Decisions | System One |
|---|---|---|---|
| Collection | Ordered list, each with a `name` | Ordered list, each with an optional `name` | Object keyed by name |
| Yes / no | `predicate`: `instructions`, optional `criteria: {true, false}` | `predicate`: `instructions` | `noul`: `instructions`, optional `criteria: {true, false}` |
| Choice | `choice`: `choices: [{value, description}]` | The same (`value` may be a boolean) | `choice`: `criteria: {value: description}` |
| Scale | `scale`: `levels: [{label, description}]` | `score`: `levels: [{label, description}]` | `score`: `criteria: [description, ...]`, no labels |
| Text fields | Plain strings | Plain strings | Strings or JSON |
| Box | `box` (later) | None | `box` |

For storing System One:

- **Reach.** TypeSafe is the most visible on social media, and its ecosystem
  already uses the format: Ollama serves it, and the typed-decisions dataset
  writes its questions in it, so they could be saved verbatim.
- **Features arrive there first.** `box`, assets in question text, and JSON in
  text fields are System One's; a Phoenix or OpenAI shape lags them.
- **Cheapest to switch now.** No release has stored a decision version yet.

For staying with the current (OpenAI-like) shape:

- **Order survives storage.** Questions are ordered and answers come back in
  that order. PostgreSQL's `JSONB` doesn't keep object key order, so a System
  One object would need its order stored separately, or be turned into a list,
  which is no longer System One.
- **Scale levels have labels.** OpenAI requires a short label per level, and the
  UI and annotations need one. System One levels are descriptions only, so
  translating them yields sentence-long labels (`None: everything reconciles.`).
- **Provider-neutral, and calmer.** Both providers translate from it, with one
  loss each way (OpenAI has no predicate criteria; System One has no level
  labels). Storing System One ties stored rows to the faster-changing vendor
  (see [Stable and Volatile](#stable-and-volatile)), and `noul` and an
  annotation-colliding `score` enter Phoenix's vocabulary.
- **Datasets don't need it.** Experiments already read System One questions
  from examples (`questionsFormat: SYSTEM_ONE`), whatever the stored format.

Social-media visibility is a volatile signal, and it can differ from what Phoenix
users run. The prompt precedent picked the format with the most use, which is the
measure to check here too.

Decide before saved decisions ship in a release. Until then, changing it means
changing code; after, it means migrating stored versions under a new
`schema_version` ([principle 7](#principles)).

### Span Contents

Today a `DECISION` span's `input.value` and `output.value` are the provider's own
request and response bodies (`_record_input` and `_record_output` in
`decision_clients.py`), so a TypeSafe span and an OpenAI span record the same
answer in different shapes. Beside them are the `decision.*` attributes: system,
provider, model names, and token counts.

The alternative is to also record the questions and answers in one neutral form,
as `LLM` spans carry `llm.input_messages` and `llm.output_messages` beside the raw
bodies.

- **Raw bodies only** (current): exact, and nothing to design. But every reader
  of answers from traces (replaying a span into the playground, grouping
  production runs by version, any metric over production traffic) has to parse
  each provider's format, and keep up with its changes.
- **Neutral attributes as well:** one shape for readers, at the cost of an
  OpenInference convention to design and get adopted, since apps' own
  instrumentation emits these spans too.

Traces are stored in volume and are another tool's input, so whatever spans hold
is what older traces hold forever. The version ID attribute (see
[Open Questions](#open-questions)) is one piece of this. Decide with OpenInference
before apps are instrumented against `format` (build order step 3).

### Reference Answers in Datasets

No convention says how a dataset holds reference answers. The typed-decisions
dataset uses its own: `label`, `noul` or `score`, `confidence`, and per-option
`probabilities` aggregated from several labellers. That matches neither Phoenix's
answers nor either provider's.

- **What it decides:** whether a reference is one correct answer or a
  distribution, which limits the metrics. Accuracy needs a single answer; Brier
  score and calibration need distributions. And which field names the built-in
  metrics read.
- **Options:** define a Phoenix reference format; accept a provider's answer
  format as the reference; or require each evaluator to map paths, as today,
  with no convention.
- **A default already chosen in passing:** an experiment reads per-example
  questions as System One unless told otherwise (`questionsFormat` defaults to
  `SYSTEM_ONE`), because the first benchmark was written that way.

Whatever the built-in metrics (build order step 4) accept becomes the format
users build benchmark datasets in, including outside Phoenix. Decide with them.

### Translating for Apps

[App Access](#app-access) has `phoenix-client`'s `format()` turn a stored version
into TypeSafe or OpenAI SDK arguments, in Python and TypeScript, held to the same
fixtures as the server adapters.

- **Phoenix translates** (current plan): apps switch providers without
  rewriting, and get validation of their inputs. Phoenix owns every translation,
  for every vendor change, in two languages, and apps break when it lags behind a
  provider.
- **Phoenix hands back the version:** apps use it with their vendor's SDK
  directly. Nothing to keep in step, but only workable if versions are stored in
  that vendor's format (see [Stored Question Format](#stored-question-format)),
  so the two are one decision for apps on that vendor.

Once apps call `format()`, removing or narrowing it breaks them. Decide before
`phoenix-client` ships it (build order step 3).

A related choice, easier to reverse: a version pins its model, as a prompt
version does. Changing or replacing a deprecated model means a new version, and
an app following a tag gets whatever model that version names. A per-call
override could be added later without breaking anything.

### Evaluator Annotation Metadata

A decision judge writes ordinary annotations: a label, a score, and for a refusal
a fixed explanation. Everything a decision adds goes in `metadata.decision`,
which is the only way a reader can tell a refusal from a missing score, or see
the judge's uncertainty. The current shape (`decision_evaluators.py`,
`decision_evaluator.py`), implemented ahead of this decision:

- **Answered or refused:** `status` (`answered` or `refused`), `question` (`name`,
  `type`), `answer` (Phoenix's normalized answer, with confidence and
  probabilities), `projection` (the question's applied scoring settings),
  `requested_model`, `resolved_model`, `provider`, `custom_provider_id`, and
  `source` (evaluator, decision, version, and binding IDs).
- **Error:** only `status: error` and `source`; the message is the annotation's
  `error`.
- **Not recorded:** usage, which stays on the span.

The preview already reads `status` (`chat_mutations.py`), and annotations are
exported and read by other tools.

- **Versioning:** unversioned (current, like other annotation metadata), with
  readers tolerating missing fields; or a version inside the namespace, so a
  reader can tell shapes apart without guessing.
- **Answer shape:** `answer` embeds whichever format
  [Answer Format](#answer-format) picks, so the two are one decision.
- **Error results:** the minimal shape (current), or the same fields with nulls,
  so readers handle one shape.
- **Refusal status:** metadata only (current), or a first-class annotation field,
  since coverage counts and aggregates must exclude refusals and annotations
  have no status column.
- **One shape with `phoenix-evals`:** a `ClassificationEvaluator(llm: Decision)`
  writes annotations too. Matching shapes let one reader handle both; its rubric
  normalization and recovery planner are not implicitly the server contract.

Historical annotations are not rewritten, so whatever judges store before this is
decided, readers handle forever. Decide with [Answer Format](#answer-format),
before a release stores judge results.

### Output Configs and Projection Policies

Every evaluator kind carries `output_configs`, the generic scoring contract that
the UI, the SDK, and annotation views read. A decision judge also has a projection
policy, which says the same thing in more detail (thresholds, choice scores, scale
labels), and its output configs are derived from the policy and its questions. So
for decisions, `output_configs` is read-only in effect:

- **Writes:** the REST create and patch bodies for a dataset binding still accept
  `output_configs` for a decision judge. The server accepts them only if they equal
  the derived configs, then stores none, so the field can only repeat the server's
  own answer. GraphQL's decision mutations don't take them.
- **Reads:** REST and GraphQL return both, the derived configs beside the policy.

The options:

- **Accept and check** (current): one request shape for every kind, and a client
  can echo back what it read. But the field looks writable and isn't.
- **Reject for decision judges:** clearer, and an error says to edit the policy;
  REST clients need a branch per kind on write.
- **Unify:** make the projection policy the general scoring model, with an LLM
  judge's categorical configs as one case of it. The cleanest end state, and the
  largest change, since it reaches existing evaluators and their stored configs.

Reads keep `output_configs` under every option, because annotation names and
score types come from it. Decide before `/v1/evaluators` and
`/v1/datasets/{id}/evaluators` ship decision judges in a release: the request
bodies and the SDK's generated types freeze whichever shape ships.

## Open Questions

- **Span attribute for the version ID.** Whether OpenInference gets a
  `decision.version_id`-style attribute, or apps put it in span metadata the way
  prompt IDs are carried today.
- **Renaming questions.** Whether a rename should create a new decision, or keep
  the decision and mark earlier runs as answering a different question.
- **Evaluator outputs for per-example questions.** An evaluator's output names
  are fixed, while a benchmark's question names vary per example. A code
  evaluator can summarize over all answers; whether built-in metrics need
  per-question names is part of designing them.

## References

- TypeSafe: [Jev 1.14 release notes](https://typesafe.ai/blog/jev-1-14),
  [images](https://docs.typesafe.ai/go/images),
  [box questions](https://docs.typesafe.ai/go/box).
- `typesafe-sdk` 0.7.5 adds `assets=`, `Box`, and `BoxAnswer`; the
  danger-zone header is still passed through `extra_headers`.
- Related specs: [Prompts](./prompts.md),
  [Sandboxes and Code Evaluators](./sandboxes-and-code-evaluators.md),
  [Server Evaluators](./server_evaluators.md),
  [Provider Routing for Evaluators](./provider-routing-for-evaluators.md).
