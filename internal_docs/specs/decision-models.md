# Decision Models

> **Status: draft for discussion.** Built so far, in PR #16875: the stored types for
> inputs, state, and questions (`db/types/decisions.py`), their write-time rules,
> the provider adapters, the typed `runDecision` mutation (build order step 1), and
> custom providers for decisions (`openai` and `typesafe`).
> Nothing is saved yet. The UI work is PR
> #16876. This spec
> assumes apps fetch saved decisions at run time, the way they fetch prompts;
> that assumption is what justifies a standalone family with tags.

## Summary

Decision models such as TypeSafe System One and OpenAI Decisions take an input
and a set of named questions, and return one typed answer per question: a
probability for a predicate, a chosen option for a choice, an expected level for a
scale. A decision is a typed function. Its inputs are named, and its questions
are its output schema.

Phoenix stores and versions decisions. Apps fetch a tagged version and call the
provider themselves. Phoenix also runs decisions in the playground, as
evaluators, and as experiment tasks.

The format is new and changing fast. Jev 1.14 added a `box` question type for
one model and image inputs behind preview headers, and model versions are
deprecated on 30–60 days' notice. So the design keeps the stable core typed and
pushes everything uncertain to additive types or to run time.

## Goals

- Save, version, and tag decisions.
- Let apps fetch a version by tag and get ready-to-send SDK arguments, as
  `phoenix-client` does for prompts.
- Run decisions in the playground, as evaluators, and as experiment tasks.
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

## Why a New Family, Not Prompts

Phoenix [prompts](./prompts.md) assume "something you format and send to a chat
model". PR #16875 already guards prompts (GraphQL and REST), playground
subscriptions, chat completions, agents, and the model pickers against the
decision-only TypeSafe provider. Storing decisions as prompt versions would make
that split permanent: every prompt consumer, including every app that fetches
prompts, would have to check whether a version is a decision.

A decision's questions are also its outputs. If they lived in a prompt version,
an evaluator would need a second copy of the same names and choices.

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
5. **Versions are immutable; tags move.** Apps and evaluators follow a tag.
   Experiments snapshot a version.
6. **No results table.** A run is a `DECISION` span. Evaluator results are
   annotations. Experiments link to spans.
7. **Version the schema, not just the content.** A `schema_version` on each
   version row, also returned to clients, lets the JSON's meaning change without
   a database migration.
8. **Say each fact once.** Questions define the outputs. Evaluator output
   configs are derived from them; only what the questions can't express is
   stored on the evaluator.

## Data Model

```text
decisions
  id, name (unique), description, metadata, user_id, created_at, updated_at

decision_versions                      -- immutable
  id, decision_id → decisions
  schema_version   int                 -- how to read inputs and questions
  inputs           JSON                -- the signature: [{name, description?, json_schema?}]
  state            JSON                -- {type: "object"} | {type: "text", template, template_format}
                                       --   later {type: "messages"}
  questions        JSON                -- ordered list, discriminated by type
  model_provider, model_name (free text)
  custom_provider_id → generative_model_custom_providers  -- see Models
  description, user_id, created_at
  -- duplicates detected with has_identical_content, as prompts do

decision_version_tags
  id, decision_id, decision_version_id, name
  UNIQUE (decision_id, name)
  FK (decision_id, decision_version_id) → decision_versions (decision_id, id)

decision_evaluators                    -- Evaluator subtype, kind = 'DECISION'
  decision_id
  decision_version_tag_id → decision_version_tags  ON DELETE RESTRICT, NOT NULL
  input_mapping                        -- example or span fields → declared inputs
  output_overrides JSON                -- per question: direction, choice scores, predicate threshold
```

The tag on `decision_version_tags` uses a composite foreign key so a tag can
never point at another decision's version. `PromptVersionTag` doesn't do this
today; it's cheap to add here.

A decision evaluator follows a tag it owns, as LLM evaluators do with prompt
version tags. Moving that tag is validated against the evaluator's input mapping
and overrides. A version that drops a mapped input, or renames or retypes a
question an override refers to, is rejected for that tag.

Experiments get a decision task type that snapshots `decision_version_id`, as
`ExperimentPromptTask` does for prompts.

### Inputs and State

A version declares its inputs by name: `[{name, description?, json_schema?}]`.
Apps pass them by name, and evaluators fill them through `input_mapping`. A call
must pass exactly the declared inputs; a missing or undeclared one fails before
anything reaches the provider. Any JSON value is allowed. `json_schema` only
describes the value for the playground form and is not enforced on a call.

The state sent to the model is built from those inputs:

| State | Meaning | When |
|---|---|---|
| `object` | Exactly the declared inputs, as a JSON object. This is TypeSafe's native form: structured values stay structured, and nothing is templated. OpenAI receives it serialized as text. | Launch |
| `text` | A string template over the inputs, `MUSTACHE` or `F_STRING`, using Phoenix's existing formatters. It may only reference declared inputs, checked on write. An object, array, boolean, or null renders as JSON when named on its own; Mustache dotted paths and sections still read into it. | Launch |
| `messages` | A message list, for OpenAI's message-style `input` and for images. | With assets |

There is no JSON template. Reshaping data belongs in the app or in the
evaluator's input mapping, so the rules for substituting into JSON never have to
exist.

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

- **Names are identities.** They are answer keys, and evaluator annotations are
  named after them. Renaming is allowed but flagged, because it breaks
  continuity with earlier results and with app code that reads answers by name.
- **Write-time validation.** Question names are unique within a version, choice
  values are unique within a question, a choice has 2–255 options, and a scale
  has 2–10 levels. A list loses the key uniqueness a JSON object would give, so
  this is checked explicitly. The size limits are TypeSafe's documented ones;
  OpenAI documents none. There is no limit on the number of questions: no
  provider documents one, and request size and context length are the
  provider's to enforce. These rules run when questions are accepted, by a run
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
- **Text fields stay plain strings, even with images.** TypeSafe attaches images
  by find-and-replace on reference strings inside ordinary text. Images only add
  a version-level `assets: [{ref, asset_id}]` list, so the GraphQL leaf types
  never change.
- **Provider-only types are allowed.** `box` is part of Phoenix's vocabulary.
  The OpenAI SDK has no box question, so its translation rejects it with a
  clear error.
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

1. Take a decision version (saved, or an unsaved draft) and its inputs.
2. Validate the inputs and build the state.
3. **Adapter:** translate and call the provider SDK, rejecting unsupported
   question types.
4. **Adapter:** validate with the SDK's response models, then check each answer
   against its question.
5. Normalize to the `DecisionAnswer` union.
6. Record a `DECISION` span: input with assets left out, raw response, model,
   usage, and the decision version ID.

### Tokens and Cost

Decision spans record `decision.token_count.*`, but everything downstream reads
only LLM attributes:

- `should_calculate_span_cost` (`db/insertion/helpers.py`) only prices `LLM`
  spans.
- Cumulative trace token counts (`tracers.py`) read only `llm.token_count.*`.
- Experiment runs (`playground_experiment_runs.py`) fill `prompt_token_count`
  and `completion_token_count` from the LLM keys.

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
    `modelName`, `inputs`, `state` (a `@oneOf` of `object: true` or
    `text: {template, templateFormat}`), `inputValues`, and `questions`, returning `result`
    (`model`, `answers`, `usage`), `span`, and `error`. It replaced the ad hoc
    `createDecision`. Saved versions will add a `versionId` alternative to the
    inline `inputs`, `state`, and `questions`.
  - `createDecision`, `patchDecision`, `deleteDecision`.
  - `createDecisionVersion`.
  - `setDecisionVersionTag`, `deleteDecisionVersionTag`. Moving a tag a decision
    evaluator owns is validated as described under [Data Model](#data-model).
  - `createDecisionEvaluator`, `updateDecisionEvaluator`, following the existing
    evaluator mutations.

## Evaluators

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

Decision evaluators write annotations with `annotator_kind = 'LLM'`. The five
annotation tables only allow `LLM`, `CODE`, and `HUMAN`, and a decision model
is a model judgment, so no migration is needed there.

### Answer Mapping

The rest of the evaluator pipeline works on `output_configs`. A decision
evaluator doesn't store them: it derives one `OutputConfigType` per question
from the tagged version's questions, then applies `output_overrides`. Annotation
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
| `box` | — | not mappable at first |

Optimization direction defaults to `NONE` and is set in the overrides.
Confidence and per-option probabilities always go in annotation metadata. Choice
confidence isn't used as the score: averaging confidence across different
classes measures how sure the model was, not how good the output is.

## Build Order

The work is four tables (one an `Evaluator` subtype), one experiment task type,
the REST and client surface, and GraphQL. The type and adapter layer is partly
built in PR #16875. The evaluator step is the largest, because of the
[integration points](#integration-points).

1. Schema types, validation, the inputs signature, and `runDecision` taking
   `DecisionVersionInput`, replacing the current `JSON` fields.
2. Tables, versions, and tags.
3. REST routes and `phoenix-client` `get` and `format` (Python, then
   TypeScript), with the shared translation fixtures.
4. Decision evaluator: the integration points, derived output configs, and
   tag-move validation.
5. Decision experiments, including token counts on experiment runs.
6. Assets, `messages` state, and `box`, together, once TypeSafe moves them out
   of the danger zone.

## Open Questions

- **Span attribute for the version ID.** Whether OpenInference gets a
  `decision.version_id`-style attribute, or apps put it in span metadata the way
  prompt IDs are carried today.
- **Renaming questions.** Whether a rename should create a new decision, or keep
  the decision and mark earlier annotations as coming from a different question.
- **Box as an evaluator output.** Deferred until there's a use case.

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
