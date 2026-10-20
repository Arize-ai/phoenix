# Decision Models

## Summary

Decision models such as TypeSafe System One and OpenAI Decisions take an input
and a set of named questions, and return one typed answer per question: a
probability for a predicate, a chosen option for a choice, an expected level for a
scale. A decision is a typed function. Its inputs are named, and its questions
are its output schema.

Phoenix stores and versions decisions. Apps fetch a tagged version and call the
provider themselves. Phoenix also runs decisions in the playground and as
experiment tasks over datasets, as it does prompts, and uses them as judges:
a saved decision evaluator scores another task's output and writes annotations.
This spec assumes apps fetch saved decisions at run time, the way they fetch
prompts; that assumption is what justifies a standalone family with tags.

After one worked example, the choices still open come first, in [Decisions
Before Release](#decisions-before-release); the rest of the spec assumes their
current defaults. The GraphQL catalog, what is built, and the build order come
last.

## A Decision, End to End

The running example is a `triage` decision over a support ticket. Its version
declares one input, sends it as the state, and asks three questions:

```jsonc
{
  "inputs": [{ "name": "ticket" }],
  "state": { "type": "input", "name": "ticket" },  // the ticket, unchanged
  "questions": [
    { "name": "urgent", "type": "predicate",
      "instructions": "Does the customer need an answer today?" },
    { "name": "team", "type": "choice",
      "instructions": "Which team should handle it?",
      "choices": [{ "value": "billing", "description": "Payments and refunds" },
                  { "value": "technical", "description": "Problems using the product" }] },
    { "name": "severity", "type": "scale",
      "instructions": "How much is the customer blocked?",
      "levels": [{ "label": "low" }, { "label": "medium" }, { "label": "high" }] }
  ],
  "model_provider": "TYPESAFE",
  "model_name": "jev-latest"
}
```

An app fetches the version by tag and calls the provider with
`{"ticket": "I was charged twice. Please refund one payment."}`
([App Access](#app-access)); a dataset run does the same per example
([Experiments](#experiments)). Either way, the answers come back by question
name, in Phoenix's vocabulary:

```json
{
  "urgent": {"type": "predicate", "probability": 0.93},
  "team": {"type": "choice", "choice": "billing", "confidence": 0.8,
           "probabilities": {"billing": 0.8, "technical": 0.2}},
  "severity": {"type": "scale", "expected_level": 1.4, "confidence": 0.7,
               "probabilities": {"0": 0.1, "1": 0.4, "2": 0.5}}
}
```

These answers are the output being tested. A second decision can judge them:
the `triage-accuracy` judge in [Decision Evaluators](#decision-evaluators)
reads a run's answers beside the dataset's reference answers and writes one
annotation per run.

## Where Decisions Run

A model plays one of two roles in Phoenix, and a decision model can be the model
in either:

| | Prompt (chat model) | Decision (decision model) |
|---|---|---|
| **Tested**: the regular playground and experiments | Prompt task. Exists. | Decision task. **This spec.** |
| **Judging**: the evaluator playground and evaluators | LLM evaluator. Exists. | Decision evaluator. [This spec](#decision-evaluators), dataset bindings first. |

In the tested role, a decision's answers are the output: what is being
evaluated, never an evaluation. Evaluators judge them, exactly as they judge a
prompt's completions. Only in the judging role do answers become evaluations
(annotations), and that is where problems such as an answer type with no
annotation form belong.

The `phoenix-evals` work on decision models as the judging model
(`ClassificationEvaluator(llm: LLM | Decision)`) is separate from this spec.

## Stable and Volatile

The decision APIs are new and change fast, TypeSafe's System One most of all.
Its Jev 1.14 release added a `box` question type (where something is in an
image) for one model, and image inputs behind preview headers, and model
versions are deprecated on 30–60 days' notice. So the design keeps the stable
core typed and pushes everything uncertain to additive types or to run time:

| Stable enough for the schema | Likely to change |
|---|---|
| Named inputs and a named set of questions | Question types, such as `box` |
| One model from one provider answers | The fields each answer type returns |
| One typed answer per question | Images, assets, and multipart uploads |
| Versions, and tags that apps follow | Wire formats and model names ([Provider Wire Formats](#provider-wire-formats)) |
| | Preview flags such as danger-zone headers; which providers exist |

"One typed answer per question" is a bet, not a fact: both providers agree on
it today. A multi-select choice, several boxes for one question, or questions
asked about different parts of the state would each break it, and would need a
new answer type or a change to the stable core.

## Decisions Before Release

These are one-way doors: cheap to change now, expensive once stored data, apps,
and evaluators depend on them. Each has a current default so work can proceed,
and the rest of this spec is written assuming those defaults. Each needs a
deliberate team decision before a release ships it. Smaller, reversible unknowns
are in [Open Questions](#open-questions).

| Decision | Current default | Must be decided before |
|---|---|---|
| [Answer format](#answer-format) | Phoenix's own | The REST routes and `phoenix-client`, or the built-in metrics, whichever ships first |
| [Stored question format](#stored-question-format) | Phoenix's own, close to OpenAI's | Saved decisions ship in a release |
| [Span contents](#span-contents) | Raw provider bodies only | OpenInference instruments apps that call `format` |
| [Reference answers in datasets](#reference-answers-in-datasets) | No convention; evaluators map paths | The built-in metrics ship (decided with them) |
| [Translating for apps](#translating-for-apps) | Phoenix translates in `format()` | `phoenix-client` ships `format()` |
| [Evaluator annotation metadata](#evaluator-annotation-metadata) | Unversioned `metadata.decision` | A release stores judge results |
| [Output configs and projection policies](#output-configs-and-projection-policies) | Accept and check: a decision binding takes `output_configs` only as an echo | The evaluator REST routes ship decision judges |

All but the last choose a format at a boundary: the stored version, the run
output, the span, a dataset's reference answers, the SDK arguments handed to
apps, and a judge's annotations. At each, Phoenix can use a provider's format or
its own, and they are related enough to decide together. The last is the shape
of the evaluator API: how a judge's scoring is written.

Each is laid out the same way: the **current default**, the **alternatives**,
the **tradeoffs**, and the point to **decide before**.

### Answer Format

**Current default:** answers are stored, returned by GraphQL, and written as
experiment run outputs in Phoenix's own format.

**Alternatives:** adopt a provider's format, most likely TypeSafe's System One
("jev"), which TypeSafe and Ollama both return; or, more narrowly, align only
scales (below).

| Answer | Phoenix (current) | System One | OpenAI Decisions |
|---|---|---|---|
| Yes / no | `predicate`: `probability` | `noul`: `noul` | `predicate`: `probability` |
| Choice | `choice`, `confidence`, `probabilities` (map) | Same as Phoenix | `choice`, `confidence`, `probabilities` (list of `{value, probability}`) |
| Scale | `scale`: `expected_level`, `confidence`, `probabilities` (map) | `score`: `score`, `confidence`, `probabilities` (map), `legend` | `score`: `score`, `confidence`, `probabilities` (list of `{label, value, probability}`) |
| Refusal | `refusal` | No refusal type | `refusal` |

Phoenix's maps are the run-output form; GraphQL lists the same probabilities in
the question's order (see "One vocabulary everywhere" below).

**Tradeoffs.** For a provider's format:

- Familiar to that provider's users, and close to its raw response.
- Market reach is the argument for it, but neither format is a standard. On
  yes/no answers, OpenAI matches Phoenix and System One doesn't; on choice
  answers, System One matches Phoenix and OpenAI doesn't.

For Phoenix's own (the current default):

- **Provider-neutral.** Phoenix runs both providers, so storing one's format
  means translating the other's into it, and each direction loses something:
  OpenAI answers stored as System One lose their refusal, which System One has
  no field for, and OpenAI questions stored as System One lose boolean choice
  values. Storing a vendor's format also means following its changes (System One
  added `legend` and `box`).
- **One vocabulary everywhere.** `runDecision`, GraphQL, and run outputs use the
  same types and field names; only serialization differs, with GraphQL listing
  probabilities in the question's order and run outputs keying them by option. A
  provider format in run outputs alone would give one answer two vocabularies.
- **Self-describing.** `predicate` and `probability` say what they are; `noul`
  doesn't.
- **Adopting a provider format wouldn't remove the reference mismatch.** The
  typed-decisions references use `label`, which neither API returns, so
  evaluators map different paths for output and reference either way.

A narrower option: **scales.** Both providers say `score` for the type and its
expected value; only Phoenix says `scale` and `expected_level`. Renaming would
follow both providers without adopting either format. Phoenix avoided the name
on purpose, though. Every annotation already has a `score`, and a judge's
annotation carries its answer in `metadata.decision.answer`, so one record would
use `score` for two different things: the annotation's score, which the
projection policy decides, and the answer's expected level. By default the two
values happen to match, which makes the shared name easier to misread, not
safer (see [Questions](#questions)).

**Decide before** run outputs become a contract: before the REST routes and
`phoenix-client` (the [Apps step](#build-order)) or the built-in decision
metrics (the Measurement step), whichever comes first. Changing it after means
migrating stored run outputs and every evaluator mapping written against them.

### Stored Question Format

What `decision_versions.questions` (and the state and inputs beside them) is
written in.

**Current default:** Phoenix's own vocabulary, translated at the edge
([principle 1](#principles)); this records the alternative, so the choice is made
on purpose.

**Alternative:** store System One's format.

The precedent is mixed. Prompt versions store tools (`{type: "function",
function: {name, description, parameters, strict}}`) and the response format
(`json_schema`) in OpenAI's shape, chosen because OpenAI's was the most widely
used. Messages, content parts, and tool choice are Phoenix's own. Decisions
follow the same path today: the stored questions use Phoenix's type names in
OpenAI's structure.

| Question | Phoenix (current) | OpenAI Decisions | System One |
|---|---|---|---|
| Collection | Ordered list, each with a `name` | Ordered list, each with an optional `name` | Object keyed by name |
| Yes / no | `predicate`: `instructions`, optional `criteria: {true, false}` | `predicate`: `instructions` | `noul`: `instructions`, optional `criteria: {true, false}` |
| Choice | `choice`: `choices: [{value, description}]` | The same (`value` may be a boolean) | `choice`: `criteria: {value: description}` |
| Scale | `scale`: `levels: [{label, description}]` | `score`: `levels: [{label, description}]` | `score`: `criteria: [description, ...]`, no labels |
| Text fields | Plain strings | Plain strings | Strings or JSON |
| Box | `box` (later) | None | `box` |

**Tradeoffs.** For storing System One:

- **Reach.** Its ecosystem already uses the format: Ollama serves it, and the typed-decisions dataset
  writes its questions in it, so they could be saved verbatim.
- **Features arrive there first.** `box`, assets in question text, and JSON in
  text fields are System One's; a Phoenix or OpenAI shape lags them.
- **Cheapest to switch now.** No release has stored a decision version yet.

For staying with the current (OpenAI-like) shape:

- **Order survives storage.** Questions are ordered and answers come back in
  that order. PostgreSQL's `JSONB` doesn't keep object key order, and System One
  uses objects twice: for the questions, and for each choice question's
  `criteria`, which holds its options. Both would need their order stored
  separately, or be turned into lists, which is no longer System One.
- **Scale levels have labels.** OpenAI requires a short label per level, and the
  UI and annotations need one. System One levels are descriptions only, so
  translating them yields sentence-long labels (`None: everything reconciles.`).
- **Provider-neutral, and tied to neither vendor's pace.** Both providers
  translate from it, with one loss each way (OpenAI has no predicate criteria;
  System One has no level labels). Storing System One ties stored rows to the
  faster-changing vendor (see [Stable and Volatile](#stable-and-volatile)), and
  `noul` and an annotation-colliding `score` enter Phoenix's vocabulary.
- **Datasets supply values, not question definitions.** Each decision task uses
  fixed Phoenix questions across its examples, independently of the provider.

The prompt precedent picked the format with the most use, and that is the
measure to check here too: how much Phoenix users run each provider.

**Decide before** saved decisions ship in a release. Until then, changing it means
changing code; after, it means migrating stored versions and a new API version
for clients ([principle 7](#principles)).

### Span Contents

**Current default:** a `DECISION` span's `input.value` and `output.value` are the
provider's own request and response bodies (`_record_input` and `_record_output` in
`decision_clients.py`), so a TypeSafe span and an OpenAI span record the same
answer in different shapes. Beside them are the `decision.*` attributes: system,
provider, model names, and token counts.

**Alternative:** also record the questions and answers in one neutral form,
as `LLM` spans carry `llm.input_messages` and `llm.output_messages` beside the raw
bodies.

**Tradeoffs:**

- **Raw bodies only** (current): an exact record of what was sent and received,
  and nothing to design. What was sent is already translated, though, so a span
  holds what each provider's format kept ([Provider Wire
  Formats](#provider-wire-formats)), not the version's own questions. And every
  reader of answers from traces (replaying a span into the playground, any
  metric over production traffic) has to parse each provider's format, and keep
  up with its changes. Adding a span to a dataset is one of those readers: the
  export treats only `LLM` and `RETRIEVER` spans specially
  (`dataset_helpers.py`), so a `DECISION` span's example output is the raw
  provider body. That is shaped differently for each provider, and differently
  from a decision experiment's output, so one evaluator mapping can't read both.
  Grouping runs by version reads the version ID attribute instead, not the
  bodies.
- **Neutral attributes as well:** one shape for readers, at the cost of an
  OpenInference convention to design and get adopted, since apps' own
  instrumentation emits these spans too.

Traces are stored in volume and are another tool's input, so whatever spans hold
is what older traces hold forever. The version ID attribute (see
[Open Questions](#open-questions)) is one piece of this. **Decide before** apps
are instrumented against `format` (the [Apps step](#build-order)), with
OpenInference.

### Reference Answers in Datasets

**Current default:** no convention says how a dataset holds reference answers;
each evaluator maps paths. The typed-decisions dataset uses its own: `label`,
`noul` or `score`, `confidence`, and per-option `probabilities` aggregated from
several labellers. The other seeded benchmarks differ again: jevbench-hard and
BoolQ references hold `type`, `label`, and the System One answer field (`noul`,
`choice`, or `score`). None of these matches Phoenix's answers or either
provider's.

**Tradeoffs:**

- **What it decides:** whether a reference is one correct answer, a
  distribution, or both, which limits the metrics. Accuracy, Brier score, and
  calibration all compare the model's own probabilities with one correct
  answer; only distance from a reference distribution (soft labels from several
  labellers) needs a distribution. A reference can hold both. And which field
  names the built-in metrics read.
- **Alternatives:** define a Phoenix reference format; accept a provider's
  answer format as the reference; or keep requiring each evaluator to map
  paths, as today, with no convention.

Whatever the built-in metrics (the [Measurement step](#build-order)) accept becomes
the format users build benchmark datasets in, including outside Phoenix. **Decide
before** the built-in metrics, together with them.

### Translating for Apps

**Current default:** [App Access](#app-access) has `phoenix-client`'s `format()`
turn a stored version into TypeSafe or OpenAI SDK arguments, in Python and
TypeScript, held to the same fixtures as the server adapters.

**Alternative:** hand back the version and let apps call their vendor's SDK
with it.

**Tradeoffs:**

- **Phoenix translates** (current plan): apps switch providers without
  rewriting, and get validation of their inputs. Phoenix owns every translation,
  for every vendor change, in two languages, and apps break when it lags behind a
  provider.
- **Phoenix hands back the version:** apps use it with their vendor's SDK
  directly. Less to keep in step, since the questions need no translation. But
  the state still does: neither SDK renders a `text` template or picks out an
  `input`, so `phoenix-client` still builds the state in both languages. And it
  only works if versions are stored in that vendor's format (see [Stored
  Question Format](#stored-question-format)), so for apps on that vendor, this
  choice and the stored format are decided together.

Once apps call `format()`, removing or narrowing it breaks them. **Decide
before** `phoenix-client` ships it (the [Apps step](#build-order)).

A related choice, easier to reverse: a version pins its model, as a prompt
version does. Changing or replacing a deprecated model means a new version, and
an app following a tag gets whatever model that version names. A per-call
override could be added later without breaking anything.

### Evaluator Annotation Metadata

A decision judge writes ordinary annotations: a label, a score, and for a refusal
a fixed explanation. Everything a decision adds goes in `metadata.decision`,
which is the only way a reader can tell a refusal from a missing score, or see
the judge's uncertainty.

**Current default:** the shape implemented ahead of this decision, defined by
Pydantic models in `decision_evaluators.py` that both writers build from:

- **Answered or refused:** `status` (`answered` or `refused`), `question` (`name`,
  `type`, a choice's `choices` and a scale's `levels`, since the answer and
  projection refer to them by value or position only), `answer` (Phoenix's normalized answer, with confidence and
  probabilities), `projection` (the question's applied scoring settings),
  `requested_model`, `resolved_model`, `provider`, `custom_provider_id`, and
  `source` (evaluator, decision, version, and binding IDs).
- **Error:** only `status: error` and `source`; the message is the annotation's
  `error`. Errors the runner records itself (a timeout, or retries exhausted)
  carry the same metadata.
- **Not recorded:** usage, which stays on the span.

GraphQL exposes it typed as `ExperimentRunAnnotation.decision`, parsed with the
same models, and null when the metadata doesn't match. Metadata is ordinary JSON
that any client can write, so a match identifies the format, not which evaluator
wrote it. The preview reads `status` the same way (`chat_mutations.py`), and
annotations are exported and read by other tools. Fields added later are
optional, so earlier payloads still parse without a version field.

**Alternatives,** one per part of the shape; each part can be decided on its own:

- **Versioning:** unversioned (current, like other annotation metadata), with
  readers tolerating missing fields; or a version inside the namespace, so a
  reader can tell shapes apart without guessing.
- **Answer shape:** `answer` embeds whichever format
  [Answer Format](#answer-format) picks, so the two are one decision.
- **Error results:** the minimal shape (current), or the same fields with nulls,
  so readers handle one shape.
- **Refusal status:** metadata only (current), or a first-class annotation field,
  since coverage counts and aggregates must exclude refusals and annotations
  have no status column. Today they rely on a rule instead: an answer always has
  a score or a label, while a refusal has neither and no error. The score and
  label summaries already leave refusals out by that rule, but a row `count` and
  an evaluator distribution's evaluated count include them.
- **One shape with `phoenix-evals`:** a `ClassificationEvaluator(llm: Decision)`
  writes annotations too. Matching shapes let one reader handle both; its rubric
  normalization and recovery planner are not implicitly the server contract.

**Tradeoffs:** historical annotations are not rewritten, so whatever judges store
before this is decided, readers handle forever.

**Decide before** a release stores judge results, together with [Answer
Format](#answer-format).

### Output Configs and Projection Policies

Every evaluator kind carries `output_configs`, the generic scoring contract that
the UI, the SDK, and annotation views read. A decision judge also has a projection
policy, which says the same thing in more detail (thresholds, choice scores, scale
labels), and its output configs are derived from the policy and its questions. So
for decisions, `output_configs` is read-only in effect.

**Current default:** accept and check.

| Binding field | REST create and patch | GraphQL |
|---|---|---|
| `output_configs` on a decision binding | Accepted only if equal to the derived configs; not stored | Not taken by decision mutations |
| Reads | A binding returns only what it stores, so a decision binding's `output_configs` is null; `/v1/evaluators` returns the derived configs beside the judge's policy | Derived configs on bindings, and beside the policy on evaluators |

A decision binding's `output_configs` can therefore only repeat the server's own
answer. Bindings have no `projection_policy`: scoring is the judge's own (see
[Bindings](#bindings)).

**Alternatives and tradeoffs:**

- **Accept and check** (current): one request shape for every kind, and a client
  can send back derived configs it read from `/v1/evaluators` or GraphQL. (A
  binding read returns null, which needs no check.) But the field looks writable
  and isn't.
- **Type the binding bodies:** make the REST create and patch bodies a union
  keyed by `type`, as `/v1/evaluators` already is (`CreateDecisionEvaluatorRequest`,
  `PatchDecisionEvaluatorRequest`). The decision variant has no
  `output_configs`; the others keep it. The field then exists only where it can
  be written, the generated schema and SDK types state the rule, and the echo
  check goes away. It costs three things:
  - `type` repeats what `evaluator_id` implies, so the server must refuse a
    mismatch.
  - Patch bodies need `type` too (`minProperties: 2`, as for decision
    evaluators).
  - Existing clients binding LLM evaluators must start sending `type`, unless it
    stays optional for them, at the price of a looser schema.

  Plain rejection, without the union, gets the clarity but not the types.
- **Unify:** split every output config into its shape (annotation names, labels,
  score types), which is derived, and its scoring (label scores, direction,
  thresholds), which is authored. A decision already works this way: questions
  give the shape and the policy holds only scoring. An LLM judge's configs repeat a
  shape the prompt's tool schema already fixes, which is why the server checks
  them against it. Built-in evaluators take their shape from the class. Only code
  evaluators, with nothing to derive from, author a shape. Reads return derived
  configs for every kind; writes take only scoring, except for code. The cleanest
  end state, and the largest change, since it reaches existing evaluators and
  their stored configs.

Typing the bodies doesn't block unifying them later: its decision variant is
already Unify's end state, and only the other variant would shrink to scoring. So
the likely path is to type the bodies before release and leave Unify for when LLM
evaluators are next reworked. Reads keep `output_configs` under every option,
because annotation names and score types come from it. **Decide before**
`/v1/evaluators` and `/v1/datasets/{id}/evaluators` ship decision judges in a
release: the request bodies and the SDK's generated types freeze whichever shape
ships.

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

## Principles

1. **Store Phoenix's own vocabulary; translate at the edge.** The server adapters
   and the client formatters both translate to provider SDK arguments. Saved
   decision definitions never store provider request bodies; only a run's
   span keeps the raw bodies (see [Span Contents](#span-contents)). The two
   translations are tested against one shared set of fixtures. This is the
   current default, under review: see [Answer Format](#answer-format) and
   [Stored Question Format](#stored-question-format).
2. **New types are additive, and old clients fail clearly.** Questions and
   inputs are JSON discriminated by `type`. Writes are validated strictly. Apps
   can pin an old `phoenix-client`, so a client that meets a question, input,
   or state type it doesn't know raises a clear "upgrade phoenix-client"
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
7. **Evolve additively, as prompts do.** An existing field never changes its
   meaning; a change adds a type or a field. There is no schema version: a
   format change is a database migration, and a breaking change for clients is
   a new API version.
8. **Questions are the only schema.** Questions define the outputs' schema;
   nothing else restates their names, choices, or levels.

## Data Model

```text
decisions
  id, name (unique), description, metadata, user_id, created_at, updated_at
  source_decision_id → decisions, ON DELETE SET NULL  -- the decision it was cloned from

decision_versions                      -- immutable
  id, decision_id → decisions
  inputs           JSON                -- the signature: [{name, description?, json_schema?}]
  state            JSON                -- {type: "object"} | {type: "text", template, template_format}
                                       --   | {type: "input", name}; later {type: "messages"}
  questions        JSON                -- ordered list, discriminated by type
  model_provider, model_name (free text)
  custom_provider_id → generative_model_custom_providers  -- see Models
  description, metadata, user_id, created_at

decision_version_tags
  id, decision_id, decision_version_id, name
  UNIQUE (decision_id, name)
  FK (decision_id, decision_version_id) → decision_versions (decision_id, id)

decision_labels                        -- shared across decisions, as prompt labels are
  id, name (unique), description, color
decisions_decision_labels
  id, decision_label_id, decision_id
  UNIQUE (decision_label_id, decision_id)

experiment_decision_tasks              -- ExperimentJob subtype, type = 'DECISION'
  -- see Experiments: a copy of the version's fields, the connection,
  -- the dataset paths, and an optional decision_version_id
```

The stored types for inputs, state, and questions are in `db/types/decisions.py`.
The tag on `decision_version_tags` uses a composite foreign key so a tag can
never point at another decision's version. `PromptVersionTag` doesn't do this
today; it's cheap to add here. Labels group decisions in the library, and a
clone records its source decision, so the UI can link back to it.

### Inputs and State

A version declares its inputs by name: `[{name, description?, json_schema?}]`.
Apps pass them by name, and experiments fill them from each dataset example
(`inputValuesPath`, see [Experiments](#experiments)). A call
must pass exactly the declared inputs; a missing or undeclared one fails before
anything reaches the provider. Any JSON value is allowed. `json_schema` only
describes the value for the playground form and is not enforced on a call.

The state sent to the model is built from those inputs:

| State | Meaning | Ships in |
|---|---|---|
| `object` | Exactly the declared inputs, as a JSON object. This is TypeSafe's native form: structured values stay structured, and nothing is templated. OpenAI receives it serialized as text. | [Build step 1](#build-order), Runs |
| `text` | A string template over the inputs, `MUSTACHE` or `F_STRING`, using Phoenix's existing formatters (rules below). | [Build step 1](#build-order), Runs |
| `input` | One declared input's value, unchanged: text, an object, or an array. For a caller that already has its whole state as one value, and for benchmarks whose states are objects with keys that vary per example. | [Build step 1](#build-order), Runs |
| `messages` | A message list, for OpenAI's message-style `input` and for images. | [Build step 5](#build-order), with assets and `box` |

A `text` template may only reference declared inputs, checked on write. An
object, array, boolean, or null renders as JSON when named on its own, nested
values included; dotted paths (both formats) and Mustache sections still read
into it. Names inside a Mustache section aren't checked on write, since they may
be the input's own fields.

There is no JSON template. Reshaping data belongs in the app or the dataset, so
the rules for substituting into JSON never have to exist.

### Questions

```jsonc
[
  { "name": "urgent",   "type": "predicate", "instructions": "...",
    "criteria": { "true": "...", "false": "..." } },  // both optional
  { "name": "team",     "type": "choice", "instructions": "...",
    "choices": [{ "value": "billing", "description": "..." },
                { "value": "technical", "description": "..." }] },
  { "name": "severity", "type": "scale",  "instructions": "...",
    "levels": [{ "label": "low", "description": "..." },
               { "label": "medium", "description": "..." },
               { "label": "high", "description": "..." }] }
                                                      // 2–10 levels; index = level
]
```

A later type is additive. `box`, for example, asks where something is in an
image input:

```jsonc
{ "name": "mug", "type": "box", "instructions": "the mug in `photo`" }
```

- **Names are identities.** They are answer keys: run outputs and app code read
  answers by name. Renaming is allowed but flagged, because it breaks continuity
  with earlier runs and with app code.
- **Write-time rules.** Question names are unique within a version, choice
  values are unique within a question, a choice has 2–255 options, and a scale
  has 2–10 levels. A list loses the key uniqueness a JSON object would give, so
  uniqueness is checked explicitly. There is no limit on the number of
  questions.
  - *Where the limits come from:* both providers document 2–255 choices
    (TypeSafe in its API docs, OpenAI in its SDK's request types); the 2–10
    levels are TypeSafe's, and OpenAI documents no level limit. Neither
    documents a question limit, and request size and context length are the
    provider's to enforce.
- **When the rules run.** When questions are accepted, by a run or a save,
  never on read: the stored types check structure only, so tightening a rule
  can't make an old version unreadable.
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

### Provider Wire Formats

Every translation in one place, from the installed SDKs (`openai`'s
`decision_create_params` and `decision`, `typesafe_sdk`'s `SystemOneRequest`
and `SystemOneResponse`). These are what the shared translation fixtures in the
[Apps step](#build-order) must pin down.

**Requests**, from Phoenix to each provider:

| Phoenix | OpenAI Decisions | System One | Lost |
|---|---|---|---|
| Questions: ordered list, `name` required | Ordered list, `name` optional | Object keyed by name | Nothing; the object keeps the list's order, since Python dicts are ordered |
| `predicate`: `instructions`, `criteria: {true, false}` | `predicate`: `instructions` | `noul`: `instructions`, `criteria` | OpenAI: criteria as their own field, since they are folded into the instructions |
| `choice`: `choices: [{value, description?}]`, `value` a string | `choices: [{value, description?}]`, `value` a string or boolean | `criteria: {value: description}` | Nothing when sending, since Phoenix's values are strings; but a version can't hold OpenAI's boolean values |
| `scale`: `levels: [{label, description?}]` | `score`: `levels: [{label, description?}]` | `score`: `criteria: [description, ...]` | System One: the label when there is a description |
| Text fields: strings | Strings | Strings, JSON, or null | Nothing when sending, since Phoenix's text is a string; but a version can't hold System One's JSON text, such as structured instructions |
| State: `object`, `text`, or `input` | `input`: text, or messages with images (HTTP or data URLs, at most 128) | `state`: text, object, or array, plus `assets` (multipart parts) | OpenAI: a structured state is serialized as text |
| `box` (later) | None; refused | `box` | — |
| — | `safety_identifier` (per call) | — | Not modeled |
| — | — | Preview headers (danger zone) | Not stored ([Models and Preview Flags](#models-and-preview-flags)) |

**Responses**, from each provider to Phoenix:

| Phoenix | OpenAI Decisions | System One | Lost |
|---|---|---|---|
| Keyed by question name | List, each with an optional `name` | Object keyed by name | Nothing |
| `predicate`: `probability` | `predicate`: `probability` | `noul`: `noul` | Nothing |
| `choice`: `choice`, `confidence`, `probabilities` (map) | `probabilities: [{value, probability}]`, values strings or booleans | The same as Phoenix | Nothing for string values; a boolean value fails the call, since Phoenix's answers hold strings ([open question](#open-questions)) |
| `scale`: `expected_level`, `confidence`, `probabilities` (map by level) | `score`, `probabilities: [{label, value, probability}]` | `score`, `probabilities`, `legend` (level → criterion) | OpenAI's labels and System One's `legend`; both can be rebuilt from the questions asked (the task's or version's fixed questions), and a judge's annotation stores the asked levels beside the answer |
| `refusal` | `refusal`, with no reason | None | Nothing |
| `box` (later): edges as fractions, optional `confidence` | None | The same | — |
| Usage: input and output tokens | Also cached, cache-write, and reasoning tokens | Input and output tokens | OpenAI's extra token counts, which are kept only on the span |
| Resolved model | `model` | `model` | Nothing |

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
run or `OLLAMA_BASE_URL` with no default (an
[open question](#open-questions)). That variable names chat's
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

Each response carries `inputs`, `state`, `questions`, and the model.

`phoenix-client` (Python and TypeScript) adds:

```python
decision = client.decisions.get(decision_identifier="triage", tag="production")
kwargs = decision.format(inputs={"ticket": ticket}, sdk="typesafe")
result = await typesafe.system_one(**kwargs)  # or openai.decisions.create(**kwargs)
```

`format` validates the inputs against the declared signature, builds the state,
and translates the questions for the chosen SDK. It's the same translation the
server adapters do, held to the same fixtures.

To link app traces to versions, the app's instrumentation must record the
decision version ID on the `DECISION` span, so Phoenix can group production runs
by version. The ID can't ride along in `format`'s result: both SDK calls reject
unknown keyword arguments, and `**kwargs` unpacking keeps only the keys. So it
needs its own channel, such as a context manager around the call, as
OpenInference's `using_prompt_template` does for prompts. Which attribute holds
it is an [open question](#open-questions).

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
   usage, and the decision version ID (once its attribute is chosen; see
   [Open Questions](#open-questions)).

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
| `prompt_version_id`, optional, `ON DELETE SET NULL` | `decision_version_id`, also optional with `ON DELETE SET NULL` (`decisionVersionId` on the input). Recorded for provenance only: the task runs its copy, not the version |
| Model and connection, or a custom provider | Model and `connection`, or a custom provider |
| `templateVariablesPath` (default `input`): `{{query}}` reads `input.query` | `inputValuesPath` (default `input`): input `ticket` reads `input.ticket` |
| `appendedMessagesPath`: messages from the example, appended | No equivalent: every example uses the task's fixed questions |
| `evaluators`: dataset evaluators judge each run | `evaluators`: the same |

Only the declared inputs are read from the object at `inputValuesPath`, so an
example may carry other fields (a benchmark's questions, say) beside them. There
is no per-input mapping: input names must match the example's field names, as a
prompt's template variables must.

Decision tasks require at least one fixed question. Per-example question loading
is not supported: the API, saved decisions, and playground use the same fixed
question model. Datasets with varying question definitions must be split into
tasks with fixed questions or run through application code outside this workflow.

Requests are checked twice:

- **Before the run starts,** the connection must resolve and every example must
  make a request; otherwise nothing is stored and the run is refused with a
  count and the first reasons.
- **When each example runs,** the request is built again, since a resumed
  experiment or a rule tightened since the start can fail where the first check
  passed. Such an example is recorded as the run's error without calling the
  model.

Rate limits and transient failures go through the runner's backoff, with the
SDK's own retries off.

### Run Output

A run's output is the answers by question name, with no decision rule applied,
stored as `{"task_output": <answers>}` with the answers shown in [A Decision, End
to End](#a-decision-end-to-end).

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

### Planned Decision Metrics

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
- Token totals per trace, per project, and per session
  (`dataloaders/token_counts.py`, `token_counts_by_trace` in `db/helpers.py`,
  `db/session_aggregates.py`) sum only `LLM` spans. Cost summaries read
  `SpanCost` rows, which exist only for priced spans.
- Prompt experiment runs (`playground_experiment_runs.py`) fill
  `prompt_token_count` and `completion_token_count` from the LLM keys. Decision
  experiment runs fill neither.

Token counts are in scope: experiment runs and trace totals read the decision
keys too. Cost is in scope only if a provider publishes per-token prices for
decision models; until then, decision spans have no cost, and the UI shows none
rather than zero.

## Decision Evaluators

A decision evaluator uses a decision model as a judge. It maps the target's
fields into declared inputs, renders the state, asks fixed questions in one call, and projects the normalized answers into
annotations. It shares provider clients with decision tasks, but the two roles
remain distinct: a task produces answers to evaluate; a judge produces verdicts.
Built-in metrics that compare decision predictions with references are separate.

In the running example, `triage-accuracy` is a decision with three inputs,
`input`, `output`, and `reference`, sent as an `object` state. It asks one
predicate, `accuracy`: given the ticket, would the team the run chose handle it
as well as the reference team? That takes judgment, since teams overlap and a
reference can be one acceptable answer among several.

A judge pinned to that decision is bound to the triage dataset under the name
`accuracy`. The binding maps `input` to the example's ticket, `output` to a
triage run's answers, and `reference` to the example's reference answers. With
one question, the annotation takes the binding's name (see [Answer
Mapping](#answer-mapping)), so each run gets one `accuracy` annotation, scored
with the probability of true and labeled by a threshold.

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

### Definition

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

### Bindings

Inputs are mapped by the **binding**, never the saved evaluator. A dataset
binding maps experiment context into declared inputs through existing JSONPath
and literal mappings. A project binding does the same for its target context.
One saved judge can serve several datasets or projects with different mappings.
Preserve structured input types and reuse decision state rendering; descriptive
input JSON schemas do not become new runtime coercion or validation rules.

Store a projection policy on the evaluator for predicate thresholds,
choice scores, scale-label mode, and optimization direction. Bindings don't
override it, dataset and project bindings alike, so a judge scores the same
wherever it runs, and an edit to its policy reaches every binding. Scoring one
judge differently in two places takes two judges. A per-binding override could be
added later as a nullable binding column without breaking anything. A decision
binding stores no `output_configs`: they are derived from the judge whenever they
are read; how requests may still send them is under [Output Configs and
Projection Policies](#output-configs-and-projection-policies).

The policy's GraphQL shape is under [GraphQL](#graphql).

### Compatible Updates

Guard owned-tag deletion and every move, including moves through version
creation. Validate the proposed version and policy against binding inputs,
question identities/types, choice values, and scale meanings. A
breaking bound change must fail with the affected binding names and require an
explicit migration or separate evaluator. Reordering inputs, questions, or choices
is compatible; reordering a scale's levels is not, since a level's index is its
score. Input JSON schemas are descriptive, so changing them is compatible. A
version of another decision can never be pinned. Compatible changes affect future
execution snapshots.

### Answer Mapping

Derive one `OutputConfigType` per question from the selected version, then apply
the effective projection policy. Annotation names use `result_annotation_names`:
one question writes under the binding's name, several under
`{binding}.{question}`. The runner's rule for other evaluators, that a lone output
writes under its config's name, does not apply: a decision's configs are named
after its questions, and two bindings of one judge must not share a name.
Changing between one and several questions changes annotation names, so it is a
breaking bound update, even if an old question remains.

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
Retryable provider failures must reach the runner's retry handler. A judge
returns a failure as an error result with `error_exc` attached, and the runner
records such a result as a failure without retrying. So the runner re-raises a
decision judge's returned rate-limit or transient failure, as classified by the
judge's own client. Retries then differ by where a judge runs:

- **A decision judge in an experiment:** the runner retries it, and the judge
  runs without SDK retries, so the two don't stack. As for any retried work, a
  retried attempt's trace is not kept.
- **A decision judge in a preview:** nothing retries a preview, so the judge
  keeps its SDK retries.
- **An LLM judge:** it returns failures the same way, but the runner doesn't
  re-raise them, so it is recorded on the first failure. Giving it the same
  retries is a separate change.

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
  Existing attached-evaluator persistence writes traces and annotations in
  separate transactions, so a crash between them can leave one without the
  other.

Evaluator-as-task calibration has a different input context from an attached
judge. Calibration sees dataset `input`, `output`, and `metadata`. An attached
judge sees task `output`, dataset `reference`, dataset `input`, and `metadata`.
Preview and mapping controls must use the actual execution role, not assume the
same mapping works for both.

How the runtime reaches each part of Phoenix, and what completes each milestone,
is in the [appendix](#appendix-decision-evaluator-implementation).

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
  - `runDecision(input: RunDecisionInput)`: `connection` (a `@oneOf` of
    `builtIn: {providerKey, baseUrl, credentials}` or `customProvider: {id}`),
    `modelName`, `inputs`, `state` (a `@oneOf` of `object: true`,
    `text: {template, templateFormat}`, or `input: name`), `inputValues`, and
    `questions`, returning `result`
    (`model`, `answers`, `usage`), `span`, and `error`.
  - `runDecisionVersion(input: {decisionVersionId, inputValues, credentials})`
   : runs a saved version as saved, its definition, model, and provider
    included, so a caller doesn't copy the version into `runDecision`.
    `credentials` and `baseUrl` serve a version on a built-in provider (a
    version stores no endpoint, so a local Ollama is named by the call); a
    custom provider brings its own key and endpoint (whether a version should
    store one is an [open question](#open-questions)). It returns the same
    payload as `runDecision`.
  - `createDecision`: a name, a description, metadata, the first
    version as a `DecisionVersionInput`, and tags. A name already in use is a
    conflict.
  - `patchDecision` (description, metadata) and `deleteDecision`.
  - `createDecisionVersion`: a new version, optionally taking tags from
    older ones.
  - `setDecisionVersionTag` creates a tag or moves it to the given
    version; `deleteDecisionVersionTag`.
  - `cloneDecision` copies a decision under a new name and records its source
    (`Decision.sourceDecision`).
  - Labels: `createDecisionLabel`, `patchDecisionLabel`, `deleteDecisionLabels`,
    and `setDecisionLabels` / `unsetDecisionLabels` to attach them.
  - Judges: `createDecisionEvaluator`, `patchDecisionEvaluator`, and
    `deleteDecisionEvaluator`; dataset bindings through
    `createDatasetDecisionEvaluator` and `updateDatasetDecisionEvaluator`. See
    [Decision Evaluators](#decision-evaluators).
  - A version is checked against the rules a run uses. A custom provider must
    serve decisions through the API the version names (`OPENAI` or `TYPESAFE`).
- Queries: `decisions`, newest first and filtered by name as `prompts`
  is; `node` for `Decision`, `DecisionVersion`, and `DecisionVersionTag`; and
  `Decision.version(versionId, tagName)`, the latest version when neither is
  given. Unlike `Prompt.version` it is null when there is no such version, so
  asking for a missing tag doesn't null the rest of the query. `decisions`
  also filters by `labelIds`, and `decisionLabels` lists the labels.
- Projection policies are typed objects, on judges and on frozen experiment
  definitions. `DecisionProjectionPolicyInput`
  accepts a list of question settings. Each question setting
  selects exactly one of `predicate`, `choice`, or `scale`, following the decision
  question input pattern. For example:

  ```graphql
  projectionPolicy: {
    questions: [{ predicate: { name: "accuracy", threshold: 0.8 } }]
  }
  ```

  Every variant carries the question `name` and `optimizationDirection`. Predicates
  have `threshold`, choices have typed `{choice, score}` entries, and scales have
  `includeLabel`. Output questions implement `DecisionQuestionProjection`; clients
  select variant fields through inline fragments. Output questions and choice
  scores follow the decision's declared order, since the stored map's key order
  differs across databases. Reject duplicate question names and choice-score
  entries; a validation error names the question. Omitting a patch policy
  preserves it. This GraphQL representation maps to the existing stored policy
  format without changing it.
- Subscriptions: `experimentsOverDataset` takes a `decision` task beside
  `prompt` and `evaluator`; see [Experiments](#experiments).

## Open Questions

- **Span attribute for the version ID.** Whether OpenInference gets a
  `decision.version_id`-style attribute, or apps put it in span metadata the way
  prompt IDs are carried today. Until it's settled, `runDecision`,
  `runDecisionVersion`, and decision experiments record no version ID, so traces
  can't be grouped by version.
- **What loading a DECISION span recovers.** The playground loads a DECISION
  span as it does an LLM span: it reads the questions and the state from the
  provider body in `input.value`, the model from `decision.request.model_name`,
  the provider from `decision.provider` (or `decision.system`), and shows the
  recorded output. Four things are lost:
  - The template and inputs. An LLM span carries `llm.prompt_template.*`, so
    loading it restores the template's variables. A DECISION span holds only
    the rendered state, so the playground opens on the final text or JSON, not
    the version's template and inputs. It can't run over a dataset, and saving
    it wouldn't reproduce the version. Recording the state template and input
    values on the span would fix this, as OpenInference does for prompts.
  - The saved version, until the span records its ID (the question above).
  - Spans in other formats. Only OpenAI and TypeSafe bodies parse, so a span an
    app instruments for another provider doesn't load.
  - The custom provider. The span records its name, not its ID, so the user
    picks it from the model menu.

  The first and third are part of [Span Contents](#span-contents), and are
  decided by the same deadline, since older traces keep whatever spans hold.
- **Renaming questions.** Whether a rename should create a new decision, or keep
  the decision and mark earlier runs as answering a different question.
- **Retries for LLM judges.** An LLM judge is recorded on its first returned
  failure, while a decision judge is retried (see [Refusals, Errors, and
  Metadata](#refusals-errors-and-metadata)). Extending the retries to LLM judges
  changes existing behavior, so it is a separate change.
- **A deleted custom provider, for prompts.** Decisions are settled: deleting
  a custom provider that a decision version or a decision experiment task uses
  is refused, and a frozen judge whose provider is gone fails with not found
  rather than falling back. Prompts still fall back: deleting a provider sets
  `custom_provider_id` to null on prompt versions and prompt tasks, so a saved
  prompt or a resumed task silently runs on the built-in provider of the same
  kind, with the server's key and default endpoint. Whether prompts should get
  the same guard is outside this spec, but it would make the two families agree.
- **A default Ollama address.** Phoenix refuses to run Ollama without
  `OLLAMA_BASE_URL` or a run's `baseUrl`, in chat, the agent, and decisions,
  although Ollama listens on `http://localhost:11434`. A default would need to
  change all three together, so the chat and decision tabs agree. The error
  would then name the variable when the default can't be reached, so Docker
  and remote deployments still learn what to set. Ollama also reports
  `credentialsSet: true` with no address, so a picker offers a model whose
  first run fails.
- **Whether a version stores its endpoint.** A version stores no endpoint, as
  a prompt doesn't, so every run of a saved Ollama version must pass `baseUrl`
  unless the server sets `OLLAMA_BASE_URL`. A judge has no call to pass it on:
  Phoenix builds judges with no base URL, so a judge on a built-in Ollama
  version runs only where the server sets `OLLAMA_BASE_URL`. A custom provider
  pointed at Ollama brings its own endpoint and avoids this.
- **The playground's state modes.** The state editor has three modes. Text is
  a template and saves as `text`, or as `input` when it is a single variable.
  JSON is a fixed value: a non-empty object is sent as `object`, an array or
  `{}` unchanged as `input`, and any other value as text. It can't be saved or
  run over a dataset. Inputs lists input
  names, sends their values from the Inputs panel as `object`, and is how a
  saved `object` state loads.

  The state mode and template format control different things. **Text, JSON,
  and Inputs choose how to construct the state. Mustache, F-string, and None
  choose whether and how to substitute template variables.** Their interaction
  in the current playground is:

  | State editor mode | Mustache | F-string | None |
  |---|---|---|---|
  | **Text** | Substitutes `{{name}}` in the text template. | Substitutes `{name}` in the text template. | Uses the text literally, including any placeholder braces. |
  | **JSON** | Substitutes `{{name}}` into the JSON source, then parses the result as JSON. The result must still be valid JSON. | Parses the JSON without substituting variables. A string such as `"{name}"` stays that literal string. | Parses the JSON without substituting variables. A string such as `"{{name}}"` stays that literal string. |
  | **Inputs** | Looks up each listed input name and builds an object from its value; no template substitution is involved. | Looks up each listed input name and builds an object from its value; no template substitution is involved. | Looks up each listed input name and builds an object from its value; no template substitution is involved. |

  For example, Text `Reference: {{reference}}` with Mustache and input
  `reference = A` produces the string `Reference: A`. JSON
  `{"reference": "{{reference}}"}` with Mustache produces the object
  `{"reference": "A"}`. Inputs `reference, output`, with values `A` and `B`,
  produces `{"reference": "A", "output": "B"}` under all three template
  settings. Inputs names are lookup keys, so they need no placeholder braces.
  See [State Construction Walkthroughs](#appendix-state-construction-walkthroughs)
  for nested input values, the wire payload, and a comparison with Text and JSON.

  F-string substitution is skipped for JSON because JSON's object braces
  conflict with F-string's placeholder syntax. This is a restriction of the
  current implementation, rather than a requirement that structured data can
  never contain variables. Mustache substitution happens on the JSON source,
  rather than on parsed string values, so inserted quotes or other content can
  make the result invalid JSON.

  The table describes state construction. The template setting also controls
  substitution in question instructions for an ad hoc playground run,
  regardless of the state mode. Saved versions and dataset runs require fixed
  questions and reject question template variables.

  Text can express the same evidence as an object, but an ordinary text
  template renders that evidence into a string. A Text state consisting of a
  single variable is the exception: it saves as `input` and passes the caller's
  value through unchanged, including objects and arrays. Inputs builds an
  object from several named values instead. That distinction matters when
  loading saved definitions or preserving structured dataset values; it does
  not by itself settle whether the editor needs three separate modes.

  Three things are unsettled:
  - JSON and Inputs overlap: in Mustache, `{"a": "{{a}}"}` runs about the same
    as Inputs `a`. Merging them would need a save rule: JSON saves as `object`
    when every value is exactly its own variable. The editor wouldn't show that
    rule. F-string couldn't use it at all: its braces would have to be doubled,
    and the state would then no longer parse as JSON.
  - JSON mode fills template variables into the JSON text before parsing it,
    which is the client-side JSON template that
    [Inputs and State](#inputs-and-state) rules out on the server. It is never
    saved, but it is the substitution behavior the rule was meant to avoid.
  - Inputs-panel values are always text, so a playground run sends strings
    where a dataset run sends real JSON values. Each input's `json_schema`
    could type the panel's fields. Saving also drops each input's
    `description` and `json_schema`, as Text mode does.
- **What an input's `json_schema` is for.** Nothing acts on it: a call doesn't
  enforce it ([Inputs and State](#inputs-and-state)), the playground neither
  shows nor saves it, and its only reader is a decision evaluator's
  `inputSchema`, which copies it into each input's property. Options: check
  values against it on a run (a loose schema written only to describe the
  input would then fail dataset runs), use it to type the Inputs panel and to
  check Mustache section names, or drop it until one of those is built. The
  JSON scalars around it stay JSON whichever is chosen: `inputValues` is keyed
  by each version's own input names, `metadata` by the user's, and
  `inputSchema` matches the other evaluator types.
- **Boolean choice values.** OpenAI's choice values may be booleans, and
  `true` and `"true"` are different choices. Phoenix stores every value as a
  string, so it can't send a boolean. A boolean in a response fails the call,
  since answers hold strings, but Phoenix never sends one, so OpenAI doesn't
  return one. The playground's OpenAI import turns a boolean value into `"true"`
  or `"false"`. Supporting `string | boolean` values would also require typed
  keys in answers, probability maps, and annotation labels. That could be added
  later without changing the current string-only contract.
- **Per-call request options.** OpenAI takes `safety_identifier` with each
  call, and System One takes `assets`. Neither belongs on a version. The
  question `options` field is per question, and `assets` waits on the
  `messages` state, so per-call options (an end-user ID, a provider flag) have
  no place yet: a run's input, the connection, or `format()`'s arguments for
  apps.

## Implementation Status

Everywhere Phoenix uses a chat model, a decision model needs an equivalent.
Providers and models are done: built-in TypeSafe, OpenAI, and Ollama; custom
`openai` and `typesafe` providers with capability checks; credentials; the
catalog; and decision models kept out of every chat path. The rest follows the
[Build Order](#build-order)'s steps, one table per track. Each step names its
chat equivalent in parentheses. "Server" and "UI" are the two halves of PR #16875,
which now holds both.

### Tested

| Step | Built | Missing |
|---|---|---|
| **Runs** (chat: completion subscription, LLM spans, prompt tasks, experiment views) | Server: `runDecision`; the task, the runner, `DecisionTaskConfig`; dataset tasks use fixed questions; dataset evaluators attach to decision tasks and read answers by path. UI: the Decision tab, with custom providers, Ollama, free-text model names, and span replay; dataset mode. | The version ID on spans (an [open question](#open-questions)); answer cells, since experiment pages show answers as raw JSON. |
| **Saved decisions** (chat: prompts, versions, tags, prompt pages) | Server: tables, versions, tags, labels, cloning, GraphQL CRUD, lookup by name, `runDecisionVersion`; decision tasks record their version. UI: playground save and load, the decisions library, version pages and diffs, labels, cloning. | — |
| **Apps** (chat: `prompts.get` and `format`, REST) | Nothing. | REST routes; `decisions.get` and `format` in Python and TypeScript; shared translation fixtures; [whether Phoenix translates](#translating-for-apps). |
| **Measurement** (chat: LLM counts and costs everywhere) | Spans record `decision.token_count.*`; nothing reads them. | Token totals on traces and experiment runs; cost only if providers publish prices; built-in decision metrics and the experiment report; a [reference answer convention](#reference-answers-in-datasets). |
| **Assets, `messages` state, and `box`** | Nothing; `box` is rejected as an evaluator output, which blocks no other type. | All of it; image inputs wait on assets and the `messages` state. |

### Judging

| Step | Built | Missing |
|---|---|---|
| **Dataset evaluators**, milestone 1 (chat: `LLMEvaluator` on a prompt and tag; dataset evaluator bindings) | Server: the `DecisionEvaluator` subtype, its owned tag, projection policy, and derived outputs, in GraphQL and REST; bindings with input mappings, previews (also as a binding), execution snapshots (`ExperimentJob.frozenDecisionEvaluators`), evaluation resume, refusals. UI: create, attach, and edit; mapping and scoring; preview; a details page; refusals and uncertainty on annotations; deleting a custom provider that judges use is refused. | Refused counts and coverage in summaries; the frozen judges in the UI. |
| **Calibration** in the evaluator playground, milestone 2 (chat: evaluator tasks against expected outputs) | `EvaluatorDefinitionInput.decisionEvaluatorId` reaches the runner. | An inline decision evaluator definition, its rebuild in the runner, its form; opening a judge as a playground evaluator task. |
| **Online evaluation**, milestone 3 (chat: project bindings; sweeper, producer, executor) | Server: binding a judge to a project over REST, with its inputs checked against what a span, trace, or session fills; judge changes that break a project binding are refused; the fingerprint pins the tagged version, the judge's policy, and a custom provider's revision; the executor runs the judge with server-side credentials and the online byte cap, lets refusals through result validation, and retries the provider's rate limits and transient failures without spending attempts; timeouts count as provider timeouts; the primary result and a typed `decision` field on span, trace, and session annotations. | A GraphQL mutation and UI for binding a judge to a project; decision details in span, trace, and session annotation views. |
| **Library**, outside this spec (chat: `phoenix-evals` `ClassificationEvaluator(llm: LLM)`) | Separate work (`llm: LLM \| Decision`). | — |

### Cross-Cutting

- **Traces.** `DECISION` spans render as decisions and replay into the
  playground.
- **The agent.** Not yet: its playground and experiment tools don't know
  decision panels or runs.
- **Before shipping:** the [decisions before release](#decisions-before-release), to be
  decided as a team, and the PostgreSQL migration and tests, which have run only
  on SQLite.
- **Renaming questions** ([an open question](#open-questions)) decides how the
  UI flags a rename; the tables don't depend on it, since a rename is a new
  version.

## Build Order

Two tracks, one per [role](#where-decisions-run). Each step lists what it needs
first.

**Tested track**

1. **Runs.** Schema types, validation, the inputs signature, and `runDecision`;
   decision experiments shaped like prompt tasks; the UI's playground runs and
   dataset mode. This completes the regular playground for unsaved decisions.
   *Needs:* nothing.
2. **Saved decisions.** Tables, versions, and tags; GraphQL CRUD; the decision
   task gains `decision_version_id`; playground save and load. *Needs:* Runs.
3. **Apps.** REST routes and `phoenix-client` `get` and `format` (Python, then
   TypeScript), with the shared translation fixtures. *Needs:* Saved decisions.
4. **Measurement.** Token counts on traces and experiment runs; built-in decision
   metrics and the experiment report. *Needs:* Runs.
5. **Assets, `messages` state, and `box`,** together. *Needs:* TypeSafe moving
   them out of the danger zone.

**Judging track**, in [three delivery milestones](#milestones). Shared runtime,
derived outputs, projection policy, and tracing support all three.

1. **Dataset evaluators.** Saved decision evaluators and dataset bindings,
   including UI, preview, experiment evaluation and resume. *Needs:* Saved
   decisions, since evaluators refer to saved definitions as `LLMEvaluator` refers
   to `prompt_id`; not app formatting, measurement, or assets.
2. **Calibration.** Inline evaluator authoring and evaluator-as-task
   calibration. *Needs:* Dataset evaluators.
3. **Online evaluation.** Project bindings. *Needs:* Dataset evaluators.

## Appendix: Decision Evaluator Implementation

Where the [decision evaluator](#decision-evaluators) runtime meets the rest of
Phoenix, and what completes each milestone. The behavior it implements is
specified above; this is the checklist the code is held to.

### Runtime and Integration Points

Implement one `DecisionEvaluator(BaseEvaluator)` runtime with shared output
schema derivation and answer projection. Use it from saved-row loaders, previews,
experiment reconstruction, and online hydration. Provider translation remains in
`decision_clients.py`; do not reuse the chat evaluator's tool validation.

- **Persistence.** Add the joined evaluator subtype, owned-tag references,
  projection policy, and experiment snapshots. Keep
  deletion and concurrent edits consistent with existing evaluator services and
  lock ordering. Extend
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
cancellation, tracing, CRUD/discovery, owned-tag guards, compatible updates, and
SQLite/PostgreSQL migrations. Resume tests cover mixed completed/pending judges,
missing/errored outputs, terminal refusals, incomplete multi-output sets, tag/policy/
mapping edits, live-binding deletion, and crashes around persistence, including
between the separate trace and annotation transactions. Exercise
existing LLM/CODE/BUILTIN dataset evaluator flows for regressions.

Milestone 2 adds shared inline preview and evaluator-as-task calibration with
frozen definitions and correct role-specific contexts. Milestone 3 adds all
project targets, fingerprint/hydration concurrency tests, atomic refusal-aware
publication, health/result views and protection from recursive evaluator traffic.
The complete feature includes all three milestones.

## Appendix: State Construction Walkthroughs

These examples follow the current behavior in the
[playground matrix](#open-questions). They distinguish the editor's state mode,
Phoenix's GraphQL run input, and the final state sent through a provider adapter.
GraphQL snippets are excerpts: model configuration and question definitions are
omitted so the state construction is visible.

### Inputs: Preserve a Nested Ticket and Policy

Suppose a decision asks whether a support ticket requires urgent attention under
the customer's support policy. The question's instructions are fixed:

> Does this ticket require urgent attention under the policy for the customer's
> plan? Use the reported impact and workaround availability.

First, select **Inputs** in the state editor and enter:

```text
ticket, policy
```

This declares two input names. It does not declare the fields inside either
value. A dataset example or API caller supplies actual nested objects:

```json
{
  "ticket": {
    "subject": "Production sign-in is down",
    "customer": {"name": "Acme", "plan": "enterprise"},
    "impact": {"affected_users": 250, "workaround_available": false}
  },
  "policy": {
    "plans": {
      "enterprise": {
        "response_hours": 1,
        "urgent_when": "Production is blocked and no workaround exists"
      }
    }
  }
}
```

For a dataset run, these keys are read from the example at `inputValuesPath`.
For a direct GraphQL `runDecision` call, the relevant wire fields are:

```json
{
  "inputs": [{"name": "ticket"}, {"name": "policy"}],
  "state": {"object": true},
  "inputValues": {
    "ticket": {
      "subject": "Production sign-in is down",
      "customer": {"name": "Acme", "plan": "enterprise"},
      "impact": {"affected_users": 250, "workaround_available": false}
    },
    "policy": {
      "plans": {
        "enterprise": {
          "response_hours": 1,
          "urgent_when": "Production is blocked and no workaround exists"
        }
      }
    }
  }
}
```

Phoenix validates the input names, then builds an object with one field per
declared input. The final state is exactly the first JSON object above: `ticket`
and `policy`, including all their nested fields. The number `250` remains a
number and `false` remains a boolean. Nothing is flattened, and there is no
template substitution. Choosing Mustache, F-string, or None does not change this
state.

The provider adapter translates that state for the selected provider. TypeSafe
accepts the structured state; OpenAI receives it serialized as text. The model
can connect the customer's enterprise plan to its policy and the reported lack
of a workaround. The expected answer is that the ticket requires urgent
attention; Phoenix does not extract those nested facts through a template.

The current playground Inputs panel accepts text values. Pasting the ticket's
JSON into a panel field supplies a string containing JSON, rather than the
object shown here. Use structured dataset or API values for this example;
typing JSON into the panel is not a substitute for that distinction.

### Text: Read Nested Fields into a String

Use the same input values, but select **Text** and **Mustache**, with this state:

```text
Customer plan: {{ticket.customer.plan}}
Urgent when: {{policy.plans.enterprise.urgent_when}}
```

The declared inputs are still `ticket` and `policy`: dotted paths refer to fields
within those root inputs. The GraphQL state declaration is now:

```json
{
  "text": {
    "template": "Customer plan: {{ticket.customer.plan}}\nUrgent when: {{policy.plans.enterprise.urgent_when}}",
    "templateFormat": "MUSTACHE"
  }
}
```

With the same `inputValues`, Phoenix constructs this string state:

```text
Customer plan: enterprise
Urgent when: Production is blocked and no workaround exists
```

An F-string template can read the same fields using `{ticket.customer.plan}`
and `{policy.plans.enterprise.urgent_when}`. With None, the placeholder text
stays literal instead.

Dotted paths have meaning here because the text formatter interprets them.
Entering `ticket.customer.plan` in **Inputs** instead declares one literal input
name. It requires a separately supplied value under that exact key and produces
an object such as `{"ticket.customer.plan": "enterprise"}`; it does not traverse
the `ticket` object.

There is also a useful exception to rendering Text as a string: when saving a
decision or building a dataset task, a Text state consisting only of
`{{ticket}}` becomes `input: "ticket"`. That passes the whole ticket value
unchanged. Its final state is the ticket object itself, without an outer
`ticket` field. Inputs `ticket` instead produces `{"ticket": <ticket value>}`.

### JSON: Supply a Concrete Structured State

For a one-off playground run, select **JSON** and **None**, then paste the first
JSON object from the Inputs example into the state editor. The playground parses
it and sends its non-empty top-level object using `state: {object: true}`, with
`ticket` and `policy` as the inputs and the parsed objects as their values.
The final state is the same nested object as in the Inputs example.

The difference is how those values are supplied and reused. JSON mode supplies
the values written in the editor for that run. Inputs declares names whose
values come from the panel, dataset rows, or callers. Currently, JSON mode
cannot be saved as a reusable decision or run over a dataset; Inputs can.

Switching this JSON example to Mustache permits substitution into its source,
but does not turn it into a reusable input mapping. Inserted content must leave
valid JSON, and F-string substitution is skipped in JSON mode. These restrictions
are why a JSON template is not equivalent to directly passing nested values as
Inputs.

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
