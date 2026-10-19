# Decision Models

> **Status: draft for discussion.** Built so far, in PR #16875: the stored types for
> inputs, state, and questions (`db/types/decisions.py`), their write-time rules,
> the provider adapters, the typed `runDecision` mutation (build order step 1),
> custom providers for decisions (`openai` and `typesafe`), Ollama, and decision
> experiments on the server, shaped like prompt tasks (see
> [Experiments](#experiments)), and saved decisions on the server: tables,
> versions, tags, and their GraphQL (build order step 2, without the UI). The UI
> work is PR #16876. This spec assumes apps fetch saved decisions at run time, the way they
> fetch prompts; that assumption is what justifies a standalone family with tags.

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
| **Judging**: the evaluator playground and evaluators | LLM evaluator. Exists. | Decision evaluator. [Open idea](#decision-evaluators-open-idea), not planned. |

In the tested role, a decision's answers are the output: what is being
evaluated, never an evaluation. Evaluators judge them, exactly as they judge a
prompt's completions. Only in the judging role would answers become evaluations
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
- Server-side decision evaluators, for now (see
  [Decision Evaluators](#decision-evaluators-open-idea)).
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
result = await typesafe.system_one(**kwargs)    # or openai.decisions.create(**kwargs)
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
per decision panel through `experimentsOverDataset`, alongside prompt and
evaluator tasks; a run holds one example and repetition.

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
{"task_output": {"model": "tev1:0.8b-mxfp8", "answers": {
  "urgent": {"type": "predicate", "probability": 0.93},
  "team": {"type": "choice", "choice": "billing", "confidence": 0.8,
           "probabilities": {"billing": 0.8, "technical": 0.2}},
  "severity": {"type": "scale", "expected_level": 1.4, "confidence": 0.7,
               "probabilities": {"0": 0.1, "1": 0.4, "2": 0.5}}}}}
```

Keyed by name so evaluators reach values by path
(`output.answers.urgent.probability`). Usage stays on the `DECISION` span, which
goes to the experiment's project.

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
    `credentials` serve a version on a built-in provider; a custom provider
    brings its own key. It returns the same payload as `runDecision`.
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

## Decision Evaluators (Open Idea)

Not planned and not requested on the server: notes for if decision models are
ever used as judges there. Nothing in the tested role depends on them.

### Shape

It would mirror the LLM evaluator, which is a definition attached through
bindings:

| | LLM evaluator | Decision evaluator |
|---|---|---|
| Table | `Evaluator` subtype, `kind = 'LLM'` | `Evaluator` subtype, `kind = 'DECISION'` |
| Runs | A prompt (`prompt_id`, `ON DELETE RESTRICT`) | A decision, the same |
| Version | A prompt version tag the evaluator owns, created with it | A decision version tag it owns, the same |
| Outputs | Stored on the evaluator: `output_configs`, categorical only, turned into the tool the judge calls | Derived from the version's questions; only their defaults are stored |
| Explanation | The judge may return one | None: decision models return probabilities, not text |
| Annotator kind | `LLM` | `LLM` |

Inputs are mapped by the **binding**, never the evaluator, as for LLM evaluators:
a dataset evaluator (`DatasetEvaluators.input_mapping`, required) or a project
evaluator (`ProjectEvaluator.input_mapping`, optional) maps example or span
fields to the declared inputs. One evaluator can then be attached to many
datasets and projects with different mappings.

Defaults for the derived outputs (a predicate's threshold, each choice's score,
the optimization direction) are stored on the decision evaluator, because a
project binding has no output-config override. A dataset binding can override
them through its existing `output_configs`, as it can an LLM evaluator's.

The tag is guarded as an LLM evaluator's is. Creating an LLM evaluator creates
its own prompt version tag (`helpers/evaluator_service.py`). Moving that tag is
validated against the evaluator's outputs and every dataset binding's overrides,
and deleting it is refused (`helpers/prompt_version_tags.py`); the column is
nullable only for evaluators whose pin was removed, which run the latest
version. A decision evaluator needs the same guard, more so: its outputs are
derived from the version's questions, so a version that drops or retypes a
question an override names, or an input a binding maps, would break the
binding.

### Integration Points

A new evaluator kind is not a drop-in subtype. These places list the kinds by
hand and each needs a `DECISION` entry:

- CHECK constraints: `evaluators.kind` and
  `experiment_evaluator_tasks.evaluator_kind` (`models.py`).
- Polymorphic loads in online evals: `online_eval/sweeper.py`, `producer.py`,
  and `executor.py`, plus `queries.py`.
- Online-eval resolution and snapshotting, which branch on the three existing
  subtypes and skip or expire anything else.
- The experiment runner's rate limiting and annotator kind, which fall back to
  "unthrottled" and `CODE` for anything that isn't an `LLMEvaluator`.
- The kind-keyed lookup tables in the REST routers: `routers/v1/evaluators.py`,
  `project_evaluators.py`, and `dataset_evaluators.py`.
- Polymorphic loads of evaluators elsewhere: the dataset evaluator loader the
  experiment runner uses (`api/evaluators.py`), the dataset's evaluators in
  GraphQL (`types/Dataset.py`), and the evaluator data loader
  (`dataloaders/evaluator_by_id.py`).

Decision evaluators write annotations with `annotator_kind = 'LLM'`. The five
annotation tables only allow `LLM`, `CODE`, and `HUMAN`, and a decision model
is a model judgment, so no migration is needed there.

### Answer Mapping

The rest of the evaluator pipeline works on `output_configs`. A decision
evaluator doesn't store them: it derives one `OutputConfigType` per question
from the tagged version's questions, then applies the evaluator's defaults and
any dataset binding's overrides. Annotation
names then come from `result_annotation_names`, as for every evaluator: one
question writes under the evaluator's name, several write under
`{evaluator}.{question}`. Two evaluators that both ask `urgent` don't collide,
and dataset-level output-config overrides keep working.

| Answer | Derived output config | Annotation |
|---|---|---|
| `predicate` | Continuous, 0–1 | score = probability of true; label = `true` or `false` at a threshold (default 0.5, overridable) |
| `choice` | Categorical, one value per choice | label = chosen value; score = the value's score from the overrides, or none |
| `scale` | Continuous, 0 to levels − 1 | score = `expected_level`; no label by default, or the most likely level's `label` if overridden |
| `refusal` | — | no score or label; the explanation records the refusal |
| `box` | — | not mappable: a box answer locates something and judges nothing |

Optimization direction defaults to `NONE`.
Confidence and per-option probabilities always go in annotation metadata. Choice
confidence isn't used as the score: averaging confidence across different
classes measures how sure the model was, not how good the output is.

## The Complete Parallel Pipeline

Everywhere Phoenix uses a chat model, a decision model needs an equivalent.
Providers and models are done: built-in TypeSafe, OpenAI, and Ollama; custom
`openai` and `typesafe` providers with capability checks; credentials; the
catalog; and decision models kept out of every chat path. The rest, by the
[two roles](#where-decisions-run):

### Tested

| Stage | Chat today | Decision status | Missing |
|---|---|---|---|
| One run in the playground | Chat completion subscription; LLM spans | `runDecision` built | UI: the `connection` input, custom providers and Ollama in the Decision tab, free-text model names |
| Saved definitions | Prompts, versions, and tags; playground save and load; prompt pages | Built on the server: tables, versions, tags, GraphQL CRUD; decision tasks record their version | UI: playground save and load, a decisions page |
| Run over a dataset | Prompt tasks; experiment views and comparison | Built on the server: the task, the runner, evaluators, `DecisionTaskConfig` | UI dataset mode and answer cells |
| Judging the runs | Dataset evaluators | Dataset evaluators attach to decision tasks (built) | Built-in decision metrics and the experiment report |
| Apps | `phoenix-client` `prompts.get` and `format`; REST | Nothing | REST routes; `decisions.get` and `format` in Python and TypeScript; shared translation fixtures |
| Tokens and cost | LLM token counts and costs everywhere | Spans record `decision.token_count.*`; nothing reads them | Token totals on traces and experiment runs; cost only if providers publish prices |

### Judging

| Stage | Chat today | Decision status | Missing |
|---|---|---|---|
| Evaluator definition | `LLMEvaluator`, referring to a prompt and an optional tag | [Open idea](#decision-evaluators-open-idea) | A `DecisionEvaluator` subtype, `DECISION` in every kind CHECK, derived output configs and their defaults |
| Calibration in the evaluator playground | Evaluator task, inline or saved, compared against expected outputs | Nothing | An inline decision evaluator definition, its rebuild in the runner, its form |
| Judging experiment runs | Dataset evaluator bindings | Nothing | The evaluation phase running decision evaluators: the decision client's rate limiting, `LLM` annotator kind, binding overrides |
| Online evals | Project evaluator bindings; the sweeper, producer, and executor | Nothing | Every [integration point](#integration-points) |
| Library | `phoenix-evals` `ClassificationEvaluator(llm: LLM)` | Separate work (`llm: LLM \| Decision`) | Outside this spec |

### Cross-Cutting

- **Traces.** `DECISION` spans render as decisions, and replay into the
  playground (built in PR #16876).
- **The agent.** Its playground and experiment tools understand decision panels
  and runs.
- **Decisions that block work:**
  - [renaming questions](#open-questions) decides how the UI flags a rename;
    the tables don't depend on it, since a rename is a new version;
  - answer-to-annotation mapping and `box` block the judging role;
  - assets and images (`messages` state) block image inputs.

## Build Order

In dependency order. The tested role, steps 1 to 4, puts decision models on the
same footing as chat models as the thing being tested. The judging role, step
6, is about as large as everything before it, because each place that lists
evaluator kinds by hand changes.

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
6. **Judging, if pursued.** The decision evaluator definition, calibration in
   the evaluator playground, dataset bindings, then online evals.

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
