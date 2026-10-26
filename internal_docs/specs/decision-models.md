# Decision Models

## 1. Summary

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
Before Release](#5-decisions-before-release); the rest of the spec assumes their
current defaults. The GraphQL catalog, what is built, and the build order come
last.

This is a working discussion document, not a finalized API reference. §5 holds
choices we need to make before release; §16 holds the other open design and
ergonomics questions. The design in §9–15 follows the current defaults so we can
discuss a concrete proposal without treating those defaults as settled. §17
reports implementation status, while the appendices explain how the pieces fit
and illustrate current behavior. Code being built does not close a deliberation,
and a proposed behavior does not mean it has been implemented or verified.

## 2. A Decision, End to End

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
([App Access](#11-app-access)); a dataset run does the same per example
([Experiments](#13-experiments)). Either way, the answers come back by question
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

This is Phoenix's normalized answer map, as used inside an experiment run's
`output.task_output`. It is not the literal GraphQL response: GraphQL returns
an ordered answer list with a `name` on each answer, camelCase fields such as
`expectedLevel`, and probability lists instead of maps. See
[Run Output](#131-run-output) for the experiment envelope and
[GraphQL](#15-graphql) for the run API.

These answers are the output being tested. A second decision can judge them:
the `triage-accuracy` judge in [Decision Evaluators](#14-decision-evaluators)
reads a run's answers beside the dataset's reference answers and writes one
annotation per run.

## 3. Where Decisions Run

A model plays one of two roles in Phoenix, and a decision model can be the model
in either:

| | Prompt (chat model) | Decision (decision model) |
|---|---|---|
| **Task**: the regular playground, experiments, and apps | Prompt task. Exists. | Decision task. **This spec.** |
| **Evaluator**: the evaluator playground and evaluators | LLM evaluator. Exists. | Decision evaluator. [This spec](#14-decision-evaluators), dataset bindings first. |

In the task role, a decision's answers are the output: what is being
evaluated, never an evaluation. Evaluators judge them, exactly as they judge a
prompt's completions. Only in the evaluator role do answers become evaluations
(annotations), and that is where problems such as an answer type with no
annotation form belong.

The `phoenix-evals` work on decision models as the judging model
(`ClassificationEvaluator(llm: LLM | Decision)`) is separate from this spec.

## 4. Stable and Volatile

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
| Versions, and tags that apps follow | Wire formats and model names ([Provider Wire Formats](#103-provider-wire-formats)) |
| | Preview flags such as danger-zone headers; which providers exist |

"One typed answer per question" is a bet, not a fact: both providers agree on
it today. A multi-select choice, several boxes for one question, or questions
asked about different parts of the state would each break it, and would need a
new answer type or a change to the stable core.

## 5. Decisions Before Release

These are one-way doors: cheap to change now, expensive once stored data, apps,
and evaluators depend on them. Each has a current default so work can proceed,
and the rest of this spec is written assuming those defaults. Each needs a
deliberate team decision before a release ships it. Smaller, reversible unknowns
are in [Open Questions](#16-open-questions).

| Decision | Current default | Must be decided before |
|---|---|---|
| [Answer format](#51-answer-format) | Phoenix's own | The REST routes and `phoenix-client`, or the built-in metrics, whichever ships first |
| [Stored question format](#52-stored-question-format) | Phoenix's own, close to OpenAI's | Saved decisions ship in a release |
| [Span contents](#53-span-contents) | Raw provider bodies only | OpenInference instruments apps that call `format` |
| [Reference answers in datasets](#54-reference-answers-in-datasets) | No convention; evaluators map paths | The built-in metrics ship (decided with them) |
| [Translating for apps](#55-translating-for-apps) | Phoenix translates in `format()` | `phoenix-client` ships `format()` |
| [Evaluator annotation metadata](#56-evaluator-annotation-metadata) | Unversioned `metadata.decision` | A release stores judge results |
| [Output configs and scoring policies](#57-output-configs-and-scoring-policies) | Accept and check: a decision binding takes `output_configs` only as an echo | The evaluator REST routes ship decision judges |
| [Evaluator version pinning](#58-evaluator-version-pinning) | Direct `decision_version_id` (`NOT NULL`, `ON DELETE RESTRICT`) on `decision_evaluators` | A release ships `decision_evaluators` and `/v1/evaluators` for decision judges |

The first six choose a format at a boundary: the stored version, the run
output, the span, a dataset's reference answers, the SDK arguments handed to
apps, and a judge's annotations. At each, Phoenix can use a provider's format or
its own, and they are related enough to decide together. The last two are the
shape and storage of the evaluator contract: how a judge's scoring is written,
and how a judge records which decision version it runs.

Each is laid out the same way: the **current default**, the **alternatives**,
the **tradeoffs**, and the point to **decide before**.

### 5.1 Answer Format

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
- **One answer vocabulary.** GraphQL and run outputs describe the same answer
  concepts, with different representations: GraphQL uses named answers in a
  list, camelCase fields, and probability lists; run outputs use a map keyed by
  question name, snake_case fields, and probability maps inside `task_output`.
  A provider format in run outputs alone would also change the answer vocabulary.
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
scoring policy decides, and the answer's expected level. By default the two
values happen to match, which makes the shared name easier to misread, not
safer (see [Questions](#102-questions)).

**Decide before** run outputs become a contract: before the REST routes and
`phoenix-client` (the [Apps step](#18-build-order)) or the built-in decision
metrics (the Measurement step), whichever comes first. Changing it after means
migrating stored run outputs and every evaluator mapping written against them.

### 5.2 Stored Question Format

What `decision_versions.questions` (and the state and inputs beside them) is
written in.

**Current default:** Phoenix's own vocabulary, translated at the edge
([principle 1](#9-principles)); this records the alternative, so the choice is made
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
  faster-changing vendor (see [Stable and Volatile](#4-stable-and-volatile)), and
  `noul` and an annotation-colliding `score` enter Phoenix's vocabulary.
- **Datasets supply values, not question definitions.** Each decision task uses
  fixed Phoenix questions across its examples, independently of the provider.

The prompt precedent picked the format with the most use, and that is the
measure to check here too: how much Phoenix users run each provider.

**Decide before** saved decisions ship in a release. Until then, changing it means
changing code; after, it means migrating stored versions and a new API version
for clients ([principle 7](#9-principles)).

### 5.3 Span Contents

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
  Formats](#103-provider-wire-formats)), not the version's own questions. Specifically:
  - **State representation:** TypeSafe records a structured state as a JSON
    object or array in `input.value.state` (which replays into the playground's
    `JSON` mode and cannot be saved or run over a dataset without choosing
    `Value` or `Object`), whereas OpenAI serializes structured state into a JSON
    string in `input.value.input` (which replays into `Text` mode, sending a
    JSON-encoded string if the user switches the model to TypeSafe).
  - **Question fields:** OpenAI folds predicate `criteria` (`true` / `false`)
    into `instructions` (`\nTrue if: ...\nFalse if: ...`), losing the separate
    criteria fields on import; TypeSafe sends `level.description ?? level.label`
    for each scale level, so importing places the rubric string into `label` and
    leaves `description` empty.
  And every reader of answers from traces (replaying a span into the playground,
  any metric over production traffic) has to parse each provider's format, and
  keep up with its changes. Adding a span to a dataset is one of those readers:
  the export treats only `LLM` and `RETRIEVER` spans specially
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
[Open Questions](#16-open-questions)) is one piece of this. **Decide before** apps
are instrumented against `format` (the [Apps step](#18-build-order)), with
OpenInference.

### 5.4 Reference Answers in Datasets

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

Whatever the built-in metrics (the [Measurement step](#18-build-order)) accept becomes
the format users build benchmark datasets in, including outside Phoenix. **Decide
before** the built-in metrics, together with them.

### 5.5 Translating for Apps

**Current default:** [App Access](#11-app-access) has `phoenix-client`'s `format()`
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
  Question Format](#52-stored-question-format)), so for apps on that vendor, this
  choice and the stored format are decided together.

Once apps call `format()`, removing or narrowing it breaks them. **Decide
before** `phoenix-client` ships it (the [Apps step](#18-build-order)).

A related choice, easier to reverse: a version pins its model, as a prompt
version does. Changing or replacing a deprecated model means a new version, and
an app following a tag gets whatever model that version names. A per-call
override could be added later without breaking anything.

### 5.6 Evaluator Annotation Metadata

A decision judge writes ordinary annotations: a label, a score, and for a refusal
a fixed explanation. Everything a decision adds goes in `metadata.decision`,
which is the only way a reader can tell a refusal from a missing score, or see
the judge's uncertainty.

**Current default:** the shape implemented ahead of this decision, defined by
Pydantic models in `decision_evaluators.py` that both writers build from:

- **Answered or refused:** `status` (`answered` or `refused`), `question` (`name`,
  `type`, a choice's `choices` and a scale's `levels`, since the answer and
  scoring refer to them by value or position only), `answer` (Phoenix's normalized answer, with confidence and
  probabilities), `scoring` (the question's applied scoring settings),
  `requested_model`, `provider`, and optional `resolved_model`,
  `custom_provider_id`, and `source` (evaluator, decision, version, and binding
  IDs when available).
- **Error:** `status: error` and optional `source`; the message is the annotation's
  `error`. Errors the runner records itself (a timeout, or retries exhausted)
  carry the same metadata.
- **Not recorded:** usage, which stays on the span.

GraphQL exposes a typed decision result on experiment-run, span, trace, and
session annotations, parsed with the same models and null when the metadata
doesn't match. The shared UI already renders refusal status, the question,
probability or expected level, confidence, and choice or level distributions.
Experiment annotation queries fetch those fields; span, trace, and session
queries still need to fetch them and reuse that renderer. Metadata is ordinary
JSON that any client can write, so a match identifies the format, not which evaluator
wrote it. The preview reads `status` the same way (`chat_mutations.py`), and
annotations are exported and read by other tools. Fields added later are
optional, so earlier payloads still parse without a version field.

**Alternatives,** one per part of the shape; each part can be decided on its own:

- **Versioning:** unversioned (current, like other annotation metadata), with
  readers tolerating missing fields; or a version inside the namespace, so a
  reader can tell shapes apart without guessing.
- **Answer shape:** `answer` embeds whichever format
  [Answer Format](#51-answer-format) picks, so the two are one decision.
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
Format](#51-answer-format).

### 5.7 Output Configs and Scoring Policies

Every evaluator kind carries `output_configs`, the generic scoring contract that
the UI, the SDK, and annotation views read. A decision judge also has a scoring
policy, which says the same thing in more detail (thresholds, choice scores, scale
labels), and its output configs are derived from the policy and its questions. So
for decisions, `output_configs` is read-only in effect.

**Current default:** accept and check.

| Binding field | REST create and patch | GraphQL |
|---|---|---|
| `output_configs` on a decision binding | Accepted only if equal to the derived configs; not stored | Not taken by decision mutations |
| Reads | A binding returns only what it stores, so a decision binding's `output_configs` is null; `/v1/evaluators` returns the derived configs beside the judge's policy | Derived configs on bindings, and beside the policy on evaluators |

A decision binding's `output_configs` can therefore only repeat the server's own
answer. Bindings have no `scoring_policy`: scoring is the judge's own (see
[Bindings](#143-bindings)).

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

### 5.8 Evaluator Version Pinning

How `decision_evaluators` records the `DecisionVersion` a saved judge runs, and
how that choice relates to `LLMEvaluator`'s tag history.

**Current default:** `decision_evaluators` stores `decision_version_id`
(`NOT NULL`, `ON DELETE RESTRICT`) directly, with no `decision_id` and no
`decision_version_tag_id`. Every create or update API (GraphQL and REST) takes
`decision_version_id`, and `selected_version` joins `DecisionVersion` via an
`INNER JOIN`. `decision_version_tags` remains exclusively for user-managed
release tags (`production`, `staging`) on saved decisions. We err on the side
of simplicity for now given the complex deliberations below between direct
version pinning, the original lightweight tag workflow (`ON DELETE SET NULL`),
and the later `#16680` tag hardening.

**How `LLMEvaluator` got here (and the hardening that flew under the radar):**

1. **Original lightweight tag design (`02463bd83119`, PRs #9960 / #10694):**
   `llm_evaluators` stored `prompt_id` (`NOT NULL`) and a nullable
   `prompt_version_tag_id` (`ON DELETE SET NULL`). Creating an `LLMEvaluator`
   minted a `{name}-evaluator-{hex}` tag on the prompt for two product reasons
   (documented in `docs/phoenix/evaluation/server-evals/llm-evaluators.mdx`):
   - *Playground promotion without new UI:* when saving a new prompt version in
     the Playground, the existing **Save Prompt** modal listed `{name}-evaluator-{hex}`
     as a tag checkbox; checking it advanced the evaluator to the new version.
   - *Pin vs. `latest` visibility:* `PromptCell` (`js/app/src/pages/evaluators/PromptCell.tsx`)
     rendered `prompt @ <tag>` when pinned (or `prompt @ latest` when unpinned)
     and linked to `/redirects/prompts/{promptId}/tags/{tag}`, while the
     Prompt's **Versions** tab showed the tag badge on the active version.
   - Deleting the tag on the Prompt page set `prompt_version_tag_id = NULL`
     (`ON DELETE SET NULL`), and the evaluator fell back to the prompt's latest
     version.
2. **Later hardening (`ef09e3bc213f`, PR #16680):**
   In `LLMEvaluator`, the evaluator's contract is split across three places:
   `prompt_versions.tools` (tool function names, descriptions, and label enums),
   `llm_evaluators.output_configs` + `evaluators.description` (a duplicate copy
   of those tool names, label-to-score maps, and description), and
   `dataset_evaluators.output_configs` (optional per-dataset overrides), while
   runtime loading (`api/evaluators.py:820–822`) bare-asserts that
   `prompt_version.tools is not None`. Moving or deleting the tag from the
   prompt side could therefore desynchronize `prompt_versions.tools` from
   `llm_evaluators.output_configs` or `dataset_evaluators.output_configs`.
   To prevent that drift without removing the duplicated columns, #16680 changed
   `llm_evaluators.prompt_version_tag_id` from `ON DELETE SET NULL` to
   `ON DELETE RESTRICT`, refused tag deletes with `409 Conflict`
   (`validate_prompt_version_tag_delete`), wired evaluator locking and
   `output_configs` / `description` validation into every prompt tag
   create/upsert/move (`helpers/prompt_version_tags.py`), and hid the tag from
   `/v1/evaluators` behind a `prompt_version_id` selector.
   Because `create_llm_evaluator` unconditionally creates a tag, no API can
   clear `prompt_version_tag_id` to `NULL`, and deleting the tag is refused,
   **#16680 made `prompt_version_tag_id` effectively non-nullable for every
   newly created evaluator** (only pre-existing rows whose tag had already been
   deleted before `ef09e3bc213f` can ever have `prompt_version_tag_id IS NULL`,
   and editing such a row's prompt version immediately mints a new undeletable
   tag). That hardening flew under the radar: it contradicted the original
   design and the public docs (`llm-evaluators.mdx:102`: *"If the evaluator has
   no tag (or the tag is removed), Phoenix falls back to the latest prompt
   version"*), rejected Playground tag promotions whenever the user edited the
   tool description or label enum, left user-visible prompt tables with
   undeletable machine-generated tags, and turned `prompt_version_tag_id` into
   an over-constrained proxy for a direct `prompt_version_id` foreign key.    When `DecisionEvaluator` initially copied `LLMEvaluator`, it took that
   hardened model to its literal conclusion (`decision_id` +
   `decision_version_tag_id NOT NULL UNIQUE ON DELETE RESTRICT` +
   `guard_owned_decision_tag_move`), and the UI commits built on top of it
   (`9ea3949c05`, `640c5dc7bc`) treated the tag as an internal pin—rendering
   `decision @ v{sequenceNumber}` in `DecisionCell` instead of `PromptCell`'s
   `prompt @ {tag | latest}`—even though `DecisionEvaluator` does not store a
   duplicate `output_configs` column or per-dataset overrides (it derives
   `output_configs` from `DecisionVersion.questions` + `scoring_policy` and has
   `adapt_scoring_policy` to reconcile question changes).

**Options on the table:**

- **Option 1: Direct `decision_version_id` (`NOT NULL`, `ON DELETE RESTRICT`),
  no `decision_id`, no `decision_version_tag_id`** (current default):
  - *Engineering:* matches what every GraphQL and REST create/update input
    already takes (`decision_version_id`). Eliminates the redundant
    `decision_id` column (`selected_version.decision_id` is the single source
    of truth), the secondary join hop, the PostgreSQL outer-join `FOR UPDATE`
    workaround, synthetic tag cleanup, and cross-module tag-move/delete guards
    in `saved_decision_mutations`. Still blocks deleting a referenced `Decision`
    (`decisions.id → decision_versions.decision_id ON DELETE CASCADE` +
    `decision_evaluators.decision_version_id → decision_versions.id ON DELETE
    RESTRICT`).
  - *Product experience (gains):* keeps `decision.versionTags`,
    `DecisionVersionSelector`, and the Playground's **Save decision** modal free
    of machine-generated `{name}-evaluator-{4-hex}` checkboxes, and keeps
    `/decisions/:id/config` free of undeletable tags or stale names after an
    evaluator rename. Matches `DecisionCell` (`decision @ <versionId>`).
  - *Product experience (what it gives up):* saving a new version in the
    Playground does not offer a tag checkbox to repin the evaluator in the same
    modal (retargeting happens from the Evaluator editor via
    `DecisionVersionSelector` or inline editing), and `/decisions/:id/versions`
    does not show a tag badge indicating which evaluator is pinned to a version
    (if reverse visibility on `/decisions/:id` is desired, a read-only
    `evaluators` field on `DecisionVersion` shows live evaluator names and links
    without minting fake release tags). Because a `DecisionVersion` only defines
    `questions` while `DecisionEvaluator` owns `scoring_policy` (thresholds,
    choice scores, direction), repinning from the Evaluator editor also ensures
    the user sees `DecisionScoringPolicyEditor` and `Test with an Example`
    rather than silently applying default scoring from the Playground save modal.
- **Option 2: Original lightweight tag (`decision_id NOT NULL` + nullable
  `decision_version_tag_id ON DELETE SET NULL`, no 409 tag-move/delete guards):**
  - *Product experience:* preserves the original `LLMEvaluator` workflow from
    `llm-evaluators.mdx`—users can promote a Decision version to an evaluator by
    checking `{name}-evaluator-{4-hex}` in the Playground's **Save decision**
    modal, see the tag badge on `/decisions/:id/versions`, and delete the tag on
    `/decisions/:id/config` to fall back to the latest version (which also
    raises whether `LLMEvaluator`'s #16680 hardening should be relaxed to match).
  - *Why `DecisionEvaluator` can support this cleanly without `LLMEvaluator`'s
    failure modes:*
    1. Every `DecisionVersion` is guaranteed by schema to have valid typed
       `questions` (`predicate`, `choice`, `scale`)—unlike `PromptVersion`,
       where `tools` can be `None` and crash `assert tools is not None`.
    2. `DecisionEvaluator` stores no duplicate `output_configs` column and has
       no per-dataset `output_configs` overrides; `output_configs` are derived
       on read from `DecisionVersion.questions` + `scoring_policy`, and calling
       `adapt_scoring_policy(version.questions, evaluator.scoring_policy)` at
       read/capture time automatically preserves matching question/choice
       settings and fills defaults for new questions.
    3. Running and resumed decision dataset evaluations use
       `experiment_jobs.decision_evaluator_snapshots`,
       so moving or deleting a tag never mutates an in-flight or historical
       experiment, and online evaluation resolves the tagged (or latest)
       `decision_version_id` + adapted `scoring_policy` into its configuration
       fingerprint.
    4. If a new version adds an unmapped `input`, `DecisionEvaluator.evaluate()`
       catches it and records a normal evaluation error on the span/annotation
       (just as `LLMEvaluator` does for an unmapped template variable).
  - *Remaining subtleties:* a newly added `choice` question produces labels with
    `score = None` until choice scores are configured in the Evaluator editor;
    switching between 1 and $K > 1$ questions changes future annotation names
    between `{binding}` and `{binding}.{question}`; and every evaluator still
    adds a `{name}-evaluator-{4-hex}` entry to `decision.versionTags`.
- **Option 3: Hardened owned tag (`decision_id NOT NULL` +
  `decision_version_tag_id NOT NULL UNIQUE ON DELETE RESTRICT` + tag-move/delete
  `409` guards):**
  - Combines the costs of both without the full benefits of either: injects
    machine-generated `{name}-evaluator-{4-hex}` tags into user tag lists and
    the Playground **Save decision** dialog, but forbids deleting them on
    `/decisions/:id/config` (`409 Conflict`), fails Playground saves with `409`
    if checked on a version whose inputs or questions break a binding, and adds
    1:1 table indirection, 3NF redundancy (`decision_id`), cross-module mutation
    guards, and outer-join locking workarounds—while `DecisionCell` and
    `/v1/evaluators` hide the tag anyway.

**Decide before** a release ships `decision_evaluators` and `/v1/evaluators` for
decision judges.

## 6. Goals

- Save, version, and tag decisions.
- Let apps fetch a version by tag and get ready-to-send SDK arguments, as
  `phoenix-client` does for prompts.
- Run decisions in the playground and as experiment tasks over datasets, as
  prompts run.
- Link app traces back to the decision version that produced them.
- Run decision models as saved evaluators: dataset bindings and experiment
  evaluation first, project bindings and online evaluation second, evaluator
  calibration third.
- Add question types, input modalities, and providers without migrations.
- Keep decision models out of every chat code path.

## 7. Non-Goals

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

## 8. Why a New Family, Not Prompts

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

## 9. Principles

1. **Store Phoenix's own vocabulary; translate at the edge.** The server adapters
   translate to provider SDK arguments; the planned client formatters would do
   the same. Saved
   decision definitions never store provider request bodies; only a run's
   span keeps the raw bodies (see [Span Contents](#53-span-contents)). When client
   formatters ship, shared fixtures should keep them aligned with the server
   adapters. This is the current default, under review: see
   [Answer Format](#51-answer-format) and
   [Stored Question Format](#52-stored-question-format).
2. **New types are additive, and old clients fail clearly.** Questions and
   state variants are JSON discriminated by `type`; inputs are named declarations.
   Writes are validated strictly. Apps can pin an old `phoenix-client`, so a
   client that meets a question, input,
   or state type it doesn't know raises a clear "upgrade phoenix-client"
   error. It never drops the question or sends a partial request. A server that
   meets an unknown type (only after a downgrade) fails the read and never
   rewrites the row. Stored models also reject unknown fields today. Adding a
   field therefore needs a compatibility review: an older server may fail to
   read it, even if an API client could ignore it.
3. **Check capability at run time.** The adapter rejects what its provider can't
   express, the provider rejects what the model can't do, and both messages
   reach the user.
4. **Store references, never bytes.** Images and other assets are referenced by
   ID.
5. **Versions are immutable; tags move.** Apps can follow a tag. Experiments copy
   a version, as prompt tasks do. Saved decision evaluators currently pin a
   version ID directly; their promotion workflow is under discussion in §5.8.
6. **No results table.** A run is a `DECISION` span. Evaluator results are
   annotations. Experiments link to spans.
7. **Evolve additively, as prompts do.** An existing field never changes its
   meaning; a change adds a type or a field. There is no schema version: a
   format change is a database migration, and a breaking change for clients is
   a new API version.
8. **Questions are the only authored output schema.** Output configs are derived
   from questions and scoring settings, not authored as a competing definition.
   Experiment snapshots copy definitions for reproducibility; annotations retain
   the asked choices and levels so historical answers remain interpretable.

## 10. Data Model

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
  decision_label_id, decision_id
  PRIMARY KEY (decision_label_id, decision_id)

experiment_decision_tasks              -- ExperimentJob subtype, type = 'DECISION'
  -- see Experiments: a copy of the version's fields, the connection,
  -- the dataset paths, and an optional decision_version_id
```

The stored types for inputs, state, and questions are in `db/types/decisions.py`.
The tag on `decision_version_tags` uses a composite foreign key so a tag can
never point at another decision's version. `PromptVersionTag` doesn't do this
today; it's cheap to add here. Labels group decisions in the library, and a
clone records its source decision, so the UI can link back to it.

### 10.1 Inputs and State

A version declares its inputs by name: `[{name, description?, json_schema?}]`.
Apps pass them by name, and experiments fill them from each dataset example
(`inputValuesPath`, see [Experiments](#13-experiments)). A call
must pass exactly the declared inputs; a missing or undeclared one fails before
anything reaches the provider. Any JSON value is allowed. `json_schema` only
describes the value for the playground form and is not enforced on a call.
There must be at least one input, with nonblank, unique names. An `input` state's
name must be declared. Input values may be any JSON, but the constructed state
must be text, an object, or an array: passing a number, boolean, or null directly
as the whole state is rejected. Rendering those values into text is allowed.
Empty or whitespace-only text state is rejected.

The state sent to the model is built from those inputs:

| State | Meaning | Ships in |
|---|---|---|
| `object` | Exactly the declared inputs, as a JSON object. This is TypeSafe's native form: structured values stay structured, and nothing is templated. OpenAI receives it serialized as text. | [Build step 1](#18-build-order), Runs |
| `text` | A string template over the inputs, `MUSTACHE` or `F_STRING`, using Phoenix's existing formatters (rules below). | [Build step 1](#18-build-order), Runs |
| `input` | One declared input's value, unchanged: text, an object, or an array. For a caller that already has its whole state as one value, and for benchmarks whose states are objects with keys that vary per example. | [Build step 1](#18-build-order), Runs |
| `messages` | A message list, for OpenAI's message-style `input` and for images. | [Build step 5](#18-build-order), with assets and `box` |

A `text` template may only reference declared inputs, checked on write. An
object, array, boolean, or null renders as JSON when named on its own, nested
values included; dotted paths (both formats) and Mustache sections still read
into it. In Mustache, a present input or nested field whose value is `None`
interpolates as `"null"` while remaining falsy in `{{#name}}` / `{{^name}}`
sections; a missing key or dotted path resolves to `""` in Mustache (whereas
F-string raises). Names inside a Mustache section aren't checked on write, since
they may be the input's own fields.

The current design has no reusable JSON skeleton with input references:
reshaping data happens in the app or the dataset. This avoids substituting text
into JSON source and then reparsing it. Whether Phoenix should instead support
typed value references inside a structured state is an open authoring question
in §16. That would be a new construction capability, not Mustache or F-string
substitution into JSON text.

### 10.2 Questions

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
                                                      // 2–10 levels; values are indices 0, 1, 2
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
  has 2–10 levels. At least one question is required; names, instructions,
  choice values, and level labels cannot be blank. A list loses the key
  uniqueness a JSON object would give, so
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
  the probability-weighted mean of zero-based level indices. With three levels
  it ranges from 0 to 2, including the endpoints, and can fall between levels
  (1.7, say). It need not identify one discrete level. Scale probability maps
  use those indices as keys; JSON object keys are strings (`"0"`, `"1"`, `"2"`).
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

### 10.3 Provider Wire Formats

Every translation in one place, from the installed SDKs (`openai`'s
`decision_create_params` and `decision`, `typesafe_sdk`'s `SystemOneRequest`
and `SystemOneResponse`). These are what the shared translation fixtures in the
[Apps step](#18-build-order) must pin down.

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
| — | — | Preview headers (danger zone) | Not stored ([Models and Preview Flags](#104-models-and-preview-flags)) |

**Responses**, from each provider to Phoenix:

| Phoenix | OpenAI Decisions | System One | Lost |
|---|---|---|---|
| Keyed by question name | List, each with an optional `name` | Object keyed by name | Nothing |
| `predicate`: `probability` | `predicate`: `probability` | `noul`: `noul` | Nothing |
| `choice`: `choice`, `confidence`, `probabilities` (map) | `probabilities: [{value, probability}]`, values strings or booleans | The same as Phoenix | Nothing for string values; a boolean value fails the call, since Phoenix's answers hold strings ([open question](#16-open-questions)) |
| `scale`: `expected_level`, `confidence`, `probabilities` (map by level) | `score`, `probabilities: [{label, value, probability}]` | `score`, `probabilities`, `legend` (level → criterion) | OpenAI's labels and System One's `legend`; both can be rebuilt from the questions asked (the task's or version's fixed questions), and a judge's annotation stores the asked levels beside the answer |
| `refusal` | `refusal`, with no reason | None | Nothing |
| `box` (later): edges as fractions, optional `confidence` | None | The same | — |
| Usage: input and output tokens | Also cached, cache-write, and reasoning tokens | Input and output tokens | OpenAI's extra token counts, which are kept only on the span |
| Resolved model | `model` | `model` | Nothing |

### 10.4 Models and Preview Flags

`model_name` is free text, and a version pins it. The catalog only suggests
names, ideally from the provider's model-list endpoint. An app following a tag
gets whatever model that version names. A deprecated model shows up as the
provider's error at run time, so the UI warns when a tagged version names a
model the provider no longer lists.

### 10.5 Custom Providers

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

### 10.6 Ollama

Ollama serves its decision models through System One at `/v1/systemone`, so the
built-in `OLLAMA` provider runs them with the TypeSafe adapter and serves both
model types. It is configured the way Ollama chat is: no credentials (a
placeholder key is sent, since the SDK requires one), and a base URL from the
run or `OLLAMA_BASE_URL` with no default (an
[open question](#16-open-questions)). That variable names chat's
OpenAI-compatible root (`http://localhost:11434/v1`), so a trailing `/v1` is
dropped. The span's `decision.system` is `typesafe` and `decision.provider` is
`ollama`, a plain string until OpenInference has a value. Ollama's limits are
tighter than TypeSafe's (2–26 options, 64 KiB bodies, text only); its own error
reports them. A TypeSafe custom provider pointed at Ollama works too.

Preview flags such as `TypeSafe-Danger-Zone-Images` aren't stored at first. If
they need to be, they go in an allow-listed per-provider `options` field, never
as raw headers.

## 11. App Access

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
it is an [open question](#16-open-questions).

## 12. Execution in Phoenix

Running and saving share typed input declarations, state construction, and
questions, but take different API inputs. `DecisionVersionInput` stores the
definition and model/provider selection. `RunDecisionInput` adds a connection
and this call's `inputValues`; `RunDecisionVersionInput` takes a saved version ID,
input values, and optional credentials and `baseUrl`.

Both run mutations use the existing mutation permission checks. Problems found
while validating the definition, inputs, or connection produce GraphQL errors.
Provider failures handled by the decision client return `result: null` and a
payload `error`, with a recorded span when available. The distinction matters
for a playground that needs to keep a failed run visible alongside its trace.

1. Take a decision version (saved, or an unsaved draft) and its inputs.
2. Validate the inputs and build the state.
3. **Adapter:** translate and call the provider SDK, rejecting unsupported
   question types.
4. **Adapter:** validate with the SDK's response models, then check each answer
   against its question.
5. Normalize to the `DecisionAnswer` union.
6. Record a `DECISION` span: input with assets left out, raw response, model,
   usage, and the decision version ID (once its attribute is chosen; see
   [Open Questions](#16-open-questions)).

## 13. Experiments

A decision task runs a decision over a dataset as an experiment, the way a
prompt task runs a prompt. The playground's dataset mode creates one experiment
per decision panel through `experimentsOverDataset`; a run holds one example
and repetition. The rule is per role: task instances (prompts and decisions) may
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

Omitting `inputValuesPath` uses `input`. An explicit empty path uses the whole
example context `{input, reference, metadata}`; declared names then select keys
from that object. It does not turn an input name into a dotted path or an
independent mapping expression.

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

### 13.1 Run Output

A run's output is the answers by question name, with no decision rule applied,
stored as `{"task_output": <answers>}` with the answers shown in [A Decision, End
to End](#2-a-decision-end-to-end).

Keyed by name so evaluators reach values by path (`output.urgent.probability`),
as a dataset's reference answers are usually keyed. The fields inside each
answer are Phoenix's, though, and a dataset's need not match: the typed-decisions
references carry `label` where a choice answer has `choice` (see
[Decisions Before Release](#5-decisions-before-release)). The model that answered and
the usage stay on the `DECISION` span, which goes to the experiment's project,
as a prompt run's output is the response alone.

Evaluators read a decision run as they read a prompt run: `output` is the run's
answers and `reference` is the example's output, where a dataset keeps its
reference answers. Thresholds and other decision rules belong to the evaluator,
so changing one never needs a new model call.

### 13.2 Planned Decision Metrics

- **Built-in decision metrics.** Accuracy, Brier score, level error, and
  distance from a reference distribution, as built-in evaluators, designed with
  an experiment-level report (calibration, confidence intervals, coverage of
  refusals and missing references).

### 13.3 Tokens and Cost

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

## 14. Decision Evaluators

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
Mapping](#145-answer-mapping)), so each run gets one `accuracy` annotation, scored
with the probability of true and labeled by a threshold.

### 14.1 Milestones

1. **Dataset evaluator.** Create a saved judge from a selected decision version,
   bind it to a dataset, configure input mapping and scoring, preview it, and run
   it against experiment task outputs. Include the dataset UI, APIs, results,
   trace links, and evaluation resume. An inline-only or API-only demonstration
   does not complete this milestone.
2. **Online evaluation.** Bind the same saved evaluator to project spans, traces,
   and sessions, with existing scheduling, configuration identity, and result
   views.
3. **Evaluator calibration.** Draft or load a judge in the evaluator playground,
   preview it, and run evaluator-as-task experiments against dataset judgments.

This is delivery order, not reduced scope. Dataset evaluation does not wait for
app SDK formatters, image inputs, `box`, or online evaluation.

### 14.2 Definition

| | LLM evaluator | Decision evaluator |
|---|---|---|
| Table | `Evaluator` subtype, `kind = 'LLM'` | `Evaluator` subtype, `kind = 'DECISION'` |
| Runs | A prompt (`prompt_id`, `ON DELETE RESTRICT`) | A decision, with deletion restricted |
| Version | A prompt version tag the evaluator owns | A pinned `decision_version_id` (`ON DELETE RESTRICT`) |
| Outputs | Stored categorical `output_configs`, turned into tools | Derived from questions plus a stored scoring policy |
| Explanation | The judge may return one | No generated rationale; Phoenix explains terminal refusals |
| Annotator kind | `LLM` | `LLM` |

Creating a decision evaluator requires a selected decision version and pins
`decision_version_id` directly for now, erring on the side of simplicity while
the tradeoff between direct version pinning and the lightweight tag workflow is
deliberated under [Evaluator Version Pinning](#58-evaluator-version-pinning).
Model, provider, inputs, state, and questions come from that version. A
version's questions are fixed: bindings supply input values, not per-example
questions or question templates.

### 14.3 Bindings

Inputs are mapped by the **binding**, never the saved evaluator. A dataset
binding maps experiment context into declared inputs through existing JSONPath
and literal mappings. A project binding does the same for its target context.
One saved judge can serve several datasets or projects with different mappings.
Preserve structured input types and reuse decision state rendering; descriptive
input JSON schemas do not become new runtime coercion or validation rules.

Store a scoring policy on the evaluator for predicate thresholds,
choice scores, scale-label mode, and optimization direction. Bindings don't
override it, dataset and project bindings alike, so a judge scores the same
wherever it runs, and an edit to its policy reaches every binding. Scoring one
judge differently in two places takes two judges. A per-binding override could be
added later as a nullable binding column without breaking anything. A decision
binding stores no `output_configs`: they are derived from the judge whenever they
are read; how requests may still send them is under [Output Configs and
Scoring Policies](#57-output-configs-and-scoring-policies).

On an update, omitting the scoring policy carries it to the selected version:
settings for removed questions or choices are dropped and new questions receive
defaults. An explicitly supplied policy must fit that version; explicit null
is rejected. The policy's GraphQL shape is under [GraphQL](#15-graphql).

### 14.4 Compatible Updates

Validate every evaluator version update and policy change against binding
inputs, question identities/types, choice values, and scale meanings. A
breaking bound change must fail with the affected binding names and require an
explicit migration or separate evaluator. Reordering inputs, questions, or choices
is compatible; reordering a scale's levels is not, since a level's index is its
score. Input JSON schemas are descriptive, so changing them is compatible. A
version of another decision can never be pinned. Compatible changes affect future
execution snapshots.

**Still to settle:** the current dataset-binding edit path exempts the binding
being edited from that compatibility check and saves its mapping in the same
operation; other dataset and project bindings still block a breaking repin.
Should that count as an explicit migration, or should this path also require a
separate evaluator? A new mapping alone does not settle historical question and
annotation identity. This is part of the continuity discussion in §16.

### 14.5 Answer Mapping

Derive one `OutputConfigType` per question from the selected version, then apply
the effective scoring policy. Annotation names use `result_annotation_names`:
one question writes under the binding's name, several under
`{binding}.{question}`. This uses the shared evaluator naming helper; two
bindings of one judge must not share annotation names.
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
quality score and never replaces a class score. Scoring requires no extra
model call. Editing a threshold does not automatically rewrite historical
annotations; historical rescoring is a separate workflow.

### 14.6 Refusals, Errors, and Metadata

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
can return a failure as an error result with `error_exc` attached. Both
`EvalWorkItem` and `EvaluatorTaskWorkItem` inspect those exceptions and re-raise
rate-limit or transient failures, as classified by the judge's own provider
client, before persisting results. This applies to LLM and decision judges.
Permanent returned failures are recorded without retrying. Retries then differ
by where a judge runs:

- **A decision judge in an experiment or online evaluation:** `DecisionClient`
  always disables provider SDK retries (`max_retries=0`, matching
  `PlaygroundClient`), and the runner or online-eval executor owns retry backoff
  so retries never stack. As for any retried work, a retried attempt's trace is
  not kept.
- **A decision judge in a preview:** `DecisionClient` still runs with
  `max_retries=0` and nothing retries a preview, so a rate limit or transient
  provider failure surfaces immediately to the caller.
- **An LLM judge in an experiment:** returned rate-limit and transient failures
  reach the same runner retry handlers as decision failures. The runner owns
  retry backoff; there is no decision-only retry exception.

Each annotation records, under `metadata.decision`, its outcome status, the
question's identity and type, the normalized answer (including native
uncertainty), the applied scoring policy, and provenance: the selected
decision and version when available, the requested and resolved model, and a
non-secret connection identity. Request usage belongs on the DECISION span rather
than being repeated per annotation. The current shape is provisional; see
[Evaluator Annotation Metadata](#56-evaluator-annotation-metadata).

### 14.7 Experiment Snapshots and Resume

Freeze a dataset evaluator's resolved decision definition/version, effective
scoring policy, derived output configs, input mapping, binding name and source
IDs when attaching it to an experiment. The current implementation stores these
snapshots in `ExperimentJob.decision_evaluator_snapshots`; evaluator-as-task
definitions are stored separately in `ExperimentEvaluatorTask.definition`.
Persist no credentials; resolve them through
the connection system at execution time. Legacy experiments without a snapshot
retain their existing semantics rather than claiming reconstructable history.

On start or resume, rebuild the judge from the experiment snapshot, independently
of live binding membership. Editing or deleting the dataset binding or repinning
the evaluator must not silently change or remove already-snapshotted work.

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
is in the [appendix](#19-appendix-decision-evaluator-implementation).

## 15. GraphQL

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
  - `runDecisionVersion(input: {decisionVersionId, inputValues, credentials?, baseUrl?})`
   : runs a saved version as saved, its definition, model, and provider
    included, so a caller doesn't copy the version into `runDecision`.
    `credentials` and `baseUrl` serve a version on a built-in provider (a
    version stores no endpoint, so a local Ollama is named by the call); a
    custom provider brings its own key and endpoint (whether a version should
    store one is an [open question](#16-open-questions)). It returns the same
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
    [Decision Evaluators](#14-decision-evaluators).
  - A version is checked against the rules a run uses. A custom provider must
    serve decisions through the API the version names (`OPENAI` or `TYPESAFE`).
- Queries: `decisions`, newest first and filtered by name as `prompts`
  is; `node` for `Decision`, `DecisionVersion`, and `DecisionVersionTag`; and
  `Decision.version(versionId, tagName)`, the latest version when neither is
  given. Unlike `Prompt.version` it is null when there is no such version, so
  asking for a missing tag doesn't null the rest of the query. `decisions`
  also filters by `labelIds`, and `decisionLabels` lists the labels.
- Scoring policies are typed objects, on judges and on frozen experiment
  definitions. `DecisionScoringPolicyInput`
  accepts a list of question settings. Each question setting
  selects exactly one of `predicate`, `choice`, or `scale`, following the decision
  question input pattern. For example:

  ```graphql
  scoringPolicy: {
    questions: [{ predicate: { name: "accuracy", threshold: 0.8 } }]
  }
  ```

  Every variant carries the question `name` and `optimizationDirection`. Predicates
  have `threshold`, choices have typed `{choice, score}` entries, and scales have
  `includeLabel`. Output questions implement `DecisionQuestionScoring`; clients
  select variant fields through inline fragments. Output questions and choice
  scores follow the decision's declared order, since the stored map's key order
  differs across databases. Reject duplicate question names and choice-score
  entries; a validation error names the question. An omitted patch policy is
  adapted to the selected version; explicit null is rejected (see §14.3).
  This GraphQL representation maps to the existing stored policy
  format without changing it.
- Subscriptions: `experimentsOverDataset` takes a `decision` task beside
  `prompt` and `evaluator`; see [Experiments](#13-experiments).

## 16. Open Questions

- **Span attribute for the version ID.** Whether OpenInference gets a
  `decision.version_id`-style attribute, or apps put it in span metadata the way
  prompt IDs are carried today. Until it's settled, `runDecision`,
  `runDecisionVersion`, and decision experiments record no version ID on their
  DECISION spans, so traces cannot be grouped by version from span attributes.
  Experiment task rows already keep the saved version ID for provenance.
- **What loading a DECISION span should recover.** Is replay meant to reproduce
  the recorded provider call, or restore an editable Phoenix definition that can
  be saved, run over a dataset, or switched to another provider? Current replay
  reads the rendered OpenAI/TypeSafe body and disables templating to preserve
  literal braces. It cannot recover the original template and inputs, fields
  folded away by an adapter, or the saved version. Custom providers need to be
  selected again because the recorded name is not their database ID.

  Restoring those things needs more span data, not more reverse heuristics.
  Decide the desired experience with [Span Contents](#53-span-contents),
  including which neutral fields and version identity apps should record.
  Legacy raw-only spans still need a useful fallback. The choice is open; its
  deadline is before app instrumentation starts producing traces we keep.
- **Renaming questions and annotation naming continuity.** Renaming a question
  creates a new version of the same decision; how should the UI warn that app
  output keys and comparisons with earlier runs change? Separately, should we
  support explicit migrations of bound evaluators across question changes,
  including the dataset-edit exception in §14.4? Across all evaluator types,
  `result_annotation_names` writes a single output under `{binding}` and
  multiple outputs under `{binding}.{output}`, so changing a bound decision
  between one and several questions is treated as a breaking update
  ([Answer Mapping](#145-answer-mapping)). Supporting seamless 1-to-many
  question evolution in historical metrics and experiment columns would require
  a cross-evaluator annotation identity or version-aware migration contract,
  rather than a decision-only naming rule.
- **The evaluator error contract.** LLM and decision judges both return
  `error_exc` with failed results, and experiment work items inspect it to route
  retryable failures through the common retry handlers ([Refusals, Errors, and
  Metadata](#146-refusals-errors-and-metadata)). Whether evaluators should instead
  raise invocation failures, or keep returned errors for per-output isolation,
  remains a shared evaluator design question. It must account for previews,
  partial results, online failure classification, and terminal refusals.
- **A deleted custom provider, for prompts.** Decisions are settled: deleting
  a custom provider that a decision version or a decision experiment task uses
  is refused, and an evaluator snapshot whose provider is gone fails with not found
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
- **State authoring ergonomics in the playground.** The entire `Text`, `JSON`,
  `Value`, `Object` interaction is under deliberation: whether these should be
  modes at all, how many controls users need, where they supply example values,
  and how an ad-hoc draft becomes a reusable decision. The backend state variants
  (`text`, `input`, `object`) define execution semantics; they do not require
  matching UI modes. The current four-mode editor is an implementation to
  evaluate, not the settled product design.
  See [Current Editor Behavior](#current-editor-behavior) for the existing modes
  and examples. Deliberate the following together as one authoring workflow:
  - **The overall interaction model.** Should users choose among four modes,
    start with a concrete example and then make it reusable, or declare inputs
    first and choose how to construct state from them? Four modes expose the
    available operations directly, but ask users to understand literal values,
    templates, input references, and object construction before running a
    decision. An example-first flow makes a first run easier but needs an
    explicit promotion step; an input-first flow supports reuse from the start
    but adds setup for a one-off run. Consider a unified editor with separate
    example values and a visible preview of the constructed state. Evaluate
    each option for first runs, dataset runs, loading saved versions, and span
    replay; renaming the existing tabs alone does not settle this choice.
  - **Literal values and reuse.** Text can be literal or templated, while JSON
    supplies literal values and currently cannot be saved or run over a dataset.
    Should literal text and JSON share an example-value editor, with reuse
    expressed separately through input declarations and state construction?
    How should users promote either into a reusable decision without rebuilding
    their draft? Any design must distinguish a JSON value from a string
    containing JSON. The structured-construction question below considers
    inserting typed values into a skeleton separately from text interpolation.
  - **Template controls.** Mustache, F-string, and None currently sit beside
    modes for which they have no effect. Decide where template syntax belongs,
    whether it should appear only when rendering text, and how literal braces
    stay literal when switching workflows or replaying a span.
  - **How to expose direct values versus objects.** The current **Value** and
    **Object** labels replace the ambiguous Input / Inputs pair. Given
    `ticket = {"subject": "Refund"}`, Value `ticket` sends
    `{"subject": "Refund"}`, while Object `ticket` sends
    `{"ticket": {"subject": "Refund"}}`. The preview makes this distinction
    visible even when an object has only one input. Whether these remain
    separate modes or become one mode with an explicit wrapping choice is
    still open. Separate modes make the construction visible in the mode selector;
    one mode reduces the number of modes but needs another control to show the
    wrapping choice. Do not infer wrapping from the number of inputs: adding a
    second input must not silently change the first input's nesting. Whichever
    UI is chosen must preserve the state variant when loading and saving.
  - Inputs-panel values are currently strings, so an ad-hoc playground run
    sends strings for `Value` and `Object` where a dataset or API run can send
    structured JSON objects or arrays. An explicit text/JSON value toggle (or
    typing panel fields from each input's `json_schema`) would let ad-hoc runs
    supply structured panel values without guessing JSON from braces.
  - Authoring new `description` or `json_schema` metadata or declaring
    section-scoped inputs (e.g., `{{#urgent}}{{customer_name}}{{/urgent}}` when
    `customer_name` appears only inside a boolean Mustache section) requires UI
    controls on the input declarations; today they can be authored via the API
    and are preserved when loaded and re-saved in the playground.
- **Structured state construction.** A user may want to define a JSON skeleton
  and place input values at chosen locations: nested object fields, array
  elements, renamed fields, or several locations using the same input. Neither
  literal **JSON**, a direct **Value**, nor the current flat **Object** mode
  expresses that. A Text template can produce a string containing JSON, but
  does not preserve a structured state. Should this use case be supported in
  Phoenix, and how should it fit into the overall authoring experience?

  For example, given `ticket = {"subject": "Refund"}`, `attempts = 3`, and
  `note = "Customer asked for a refund"`, the user could author:

  ```json
  {
    "ticket": {"$input": "ticket"},
    "context": {
      "attempts": {"$input": "attempts"},
      "note": {"$input": "note"}
    },
    "audit": [{"$input": "ticket"}]
  }
  ```

  The constructed state would be:

  ```json
  {
    "ticket": {"subject": "Refund"},
    "context": {
      "attempts": 3,
      "note": "Customer asked for a refund"
    },
    "audit": [{"subject": "Refund"}]
  }
  ```

  `{"$input": "name"}` is illustrative, not a selected syntax. A reference
  replaces a whole value node with the input's JSON value. Objects remain
  objects, strings remain strings, and numbers, arrays, booleans, and null keep
  their types. Repeated references insert the same value at each location.
  Quotes or newlines inside a string do not require the user to escape them
  for insertion into JSON source. OpenAI's adapter would still serialize the
  completed state to text, as it does for other structured states.

  Options to discuss together:
  - **Keep reshaping outside Phoenix.** Callers and datasets supply the finished
    value through Value mode. This keeps Phoenix small, but makes users prepare
    data elsewhere to combine literals and inputs, rename keys, or repeat values.
  - **Add a structured builder.** Let users mix literal nodes and explicit input
    references, with a preview showing actual value types. It could be an
    extension of the JSON editor or a unified state editor; it need not become
    a fifth mode. Direct Value and flat Object construction could be convenient
    forms of the same builder, provided existing saved states retain their meaning.
  - **Choose reference and literal notation.** Tagged nodes, a separate binding
    map from output locations to inputs, or visual reference chips have different
    editing and storage costs. An ordinary literal object such as
    `{"$input": "ticket"}` must remain expressible if that spelling is reserved.
    Decide escaping or an unambiguous literal/reference representation before
    choosing the notation.
  - **Bound the feature.** Are references limited to whole named inputs or can
    they select nested fields? What happens for missing inputs or paths, and how
    are they distinguished from a present null? Does an array reference insert
    one array value or splice elements? Are dynamic keys, mixed text/reference
    strings, conditionals, or loops useful enough to include, or should those
    stay in application code? Do not silently stringify values or guess that
    JSON-looking strings should become objects.
  - **Make reuse consistent.** If adopted for saved decisions, the construction
    needs an explicit stored representation, validation, and the same semantics
    in ad-hoc runs, datasets, judges, and client formatting. Define input
    discovery and how errors identify the failing output location. Keep the
    current whole-state type restrictions unless changing them is a separate
    decision. UI notation alone must not introduce a client-only saved-state rule.

  Until this is decided and implemented, **JSON mode remains literal**. Adding
  typed references must not reinterpret existing literal JSON or bring back
  textual Mustache substitution as a shortcut.
- **What an input's `json_schema` is for.** Nothing acts on it: a call doesn't
  enforce it ([Inputs and State](#101-inputs-and-state)), the playground preserves
  it on load/save but does not expose it for editing, and its only reader is a decision evaluator's
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

## 17. Implementation Status

Everywhere Phoenix uses a chat model, a decision model needs an equivalent.
Providers and models are done: built-in TypeSafe, OpenAI, and Ollama; custom
`openai` and `typesafe` providers with capability checks; credentials; the
catalog; and decision models kept out of every chat path. The server also
blocks deleting a custom provider referenced by a saved decision version or a
decision experiment task. The tables follow the [Build Order](#18-build-order),
one per track, with the chat equivalent of each step in parentheses.

**Decision-specific behavior** explains how each workflow differs from its chat
counterpart; it does not report implementation status. **Built** records what
exists. **Missing** lists the work required to complete that step, including
both LLM-equivalent functionality and decision-specific requirements.
**Not implemented** means no implementation exists for that step;
**No remaining work identified** means no unfinished requirements are currently
identified. Optional enhancements beyond completing these steps are listed under
[Additional Planned Work](#173-additional-planned-work).

### 17.1 Tasks and Apps

| Step | Decision-specific behavior | Built | Missing |
|---|---|---|---|
| **Runs** (chat: completion subscription, LLM spans, prompt tasks, experiment views) | A request asks named, typed questions about text or structured state; answers include probabilities, choices, scales, and per-question refusals. | Server: single runs and dataset experiment execution; fixed questions per task; attached dataset evaluators; experiment tasks record their saved version. UI: the Decision tab (`Text`, `JSON`, `Value`, `Object` state modes), custom providers, Ollama, free-text model names, span replay (with `templateFormat = None`), and dataset mode; decision experiment columns and details; reopening experiments in the playground. | Normalize decision state and answers when turning spans into dataset examples or online-evaluation inputs; both currently use generic extraction of provider request/response JSON. Render typed answer cells in experiment results, which currently show raw JSON. A way to supply structured example values without a dataset; the editor interaction is under [state-authoring deliberation](#16-open-questions). |
| **Saved decisions** (chat: prompts, versions, tags, prompt pages) | A version defines an input signature, state construction, and typed questions. | Server: tables, versions, tags, labels, cloning, GraphQL CRUD, lookup by name, running saved versions; decision tasks record their version. UI: playground save and load (preserving text, direct-value, and object state variants and existing input descriptions/schemas), the decisions library, version pages and diffs, labels, cloning. | A way to author input descriptions, JSON schemas, and section-scoped declarations without the API; design this with the overall [state-authoring workflow](#16-open-questions). |
| **Apps** (chat: fetching and formatting saved prompts through SDKs and REST) | Applications consume a saved decision as provider-specific question and state arguments. | Not implemented. | REST routes; fetching and formatting saved decisions in the Python and TypeScript SDKs; shared provider-translation fixtures; recording the saved decision version on app-generated spans; resolve [whether Phoenix translates](#55-translating-for-apps). |
| **Measurement** (chat: LLM counts and costs everywhere) | Quality measures use probabilities and typed answers as well as reference judgments. | Spans record decision token counts in their raw attributes. Standard token fields and aggregates still read LLM counters. | Token fields for individual spans and their descendants; totals on traces, experiment runs, sessions, and projects; cost reporting where provider prices are available; built-in decision metrics, a decision experiment report, and a [reference answer convention](#54-reference-answers-in-datasets). |
| **Images, message inputs, and spatial answers** (chat: messages with image inputs) | Image evidence can support typed spatial questions with bounding-box answers. | Not implemented. | Message and image inputs, including asset handling and message-based state; bounding-box questions and answer rendering. |

### 17.2 Evaluators

| Step | Decision-specific behavior | Built | Missing |
|---|---|---|---|
| **Dataset evaluators**, milestone 1 (chat: saved LLM evaluators using prompt versions and tags; dataset bindings) | Projects typed answers into scores and retains probabilities and per-question refusals. | Server: saved decision evaluators with pinned versions, scoring policies, and derived outputs, exposed through GraphQL and REST; dataset input mappings; previews under the evaluator's own name or a binding's name and provenance; captured configurations, evaluation resume, and refusals. UI: the global evaluators table; create, attach, edit, mapping, scoring, preview, and details; refusal and uncertainty displays on experiment annotations. | No remaining work identified. |
| **Online evaluation**, milestone 2 (chat: project bindings; sweeper, producer, executor) | Applies decision questions and scoring policies to live spans, traces, and sessions. | Server: REST project bindings with input validation and compatibility checks; configuration identity pins the decision version, scoring policy, and provider revision. Execution uses server credentials, enforces the request-size limit, handles refusals, retries transient provider failures, and records timeouts. GraphQL exposes typed decision results on span, trace, and session annotations. Previews with `applyOnlineEvaluationLimits` pass the online request-size cap to decision evaluators. | GraphQL create/update mutations; project evaluator listing, overview, creation, and editing for decisions. Fetch decision metadata in span, trace, and session annotation queries and reuse the existing renderer. |
| **Calibration** in the evaluator playground, milestone 3 (chat: evaluator tasks against expected outputs) | Compares projected decision judgments with expected outputs to assess question and scoring choices. | Server: `EvaluatorDefinitionInput` accepts saved decision evaluator references and `inlineDecisionEvaluator` for previews and experiments; experiments capture definitions and reconstruct them on start or resume; GraphQL exposes the captured definitions. | Playground authoring of unsaved evaluators, loading saved decision evaluators, and reopening decision evaluator experiments. Extend evaluator-task source inputs to accept decision evaluator/version IDs and preserve captured decision provenance when a binding source is supplied. Verify decision evaluator-task execution and resume, including refusals and provider failures. |

### 17.3 Additional Planned Work

These optional enhancements are beyond the requirements tracked in Missing:

- **Evaluation summaries:** per-question refusal counts and the fraction of
  evaluations producing usable judgments.
- **Evaluator configuration history:** an experiment UI for inspecting the
  evaluator configuration captured when the experiment started. Attached LLM
  evaluators lack the same snapshot mechanism and inspection UI.

### 17.4 Cross-Cutting

- **Traces.** Decision spans render as decisions and replay into the playground.
  Extracting normalized decision state and answers for dataset examples and
  online evaluation is still missing, as listed under Runs.
- **Version provenance.** Prompt and decision experiment tasks already record
  their saved version. Neither playground LLM spans nor decision spans currently
  record a version ID. Recording the decision version on production app spans is
  an [App Access](#11-app-access) requirement, with the attribute still an
  [open question](#16-open-questions).
- **The agent.** Not yet: its playground and experiment tools don't know
  decision panels or runs.
- **Before shipping:** resolve the [decisions before release](#5-decisions-before-release)
  as a team and record PostgreSQL migration/test results. This document records
  SQLite verification; it does not establish whether CI or another run has
  verified PostgreSQL. The implementation status above is not a verification log.
- **Renaming questions** ([an open question](#16-open-questions)) decides how the
  UI flags a rename; the tables don't depend on it, since a rename is a new
  version.

## 18. Build Order

Two tracks, one per [role](#3-where-decisions-run). Each step lists what it needs
first.

**Tasks and Apps track**

1. **Runs.** Schema types, validation, the inputs signature, and `runDecision`;
   decision experiments shaped like prompt tasks; the UI's playground runs and
   dataset mode. This completes the regular playground for unsaved decisions.
   *Needs:* nothing.
2. **Saved decisions.** Tables, versions, and tags; GraphQL CRUD; the decision
   task gains `decision_version_id`; playground save and load. *Needs:* Runs.
3. **Apps.** REST routes and `phoenix-client` `get` and `format` (Python, then
   TypeScript), with the shared translation fixtures. *Needs:* Saved decisions.
4. **Measurement.** Token counts on individual and cumulative spans, traces,
   experiment runs, sessions, and projects; built-in decision metrics and the
   experiment report. *Needs:* Runs.
5. **Images, message inputs, and spatial answers.** Assets, message-based state,
   and bounding-box questions together. *Needs:* TypeSafe moving them out of the
   danger zone.

**Evaluators track**, in [three delivery milestones](#141-milestones). Shared runtime,
derived outputs, scoring policy, and tracing support all three.

1. **Dataset evaluators.** Saved decision evaluators and dataset bindings,
   including UI, preview, experiment evaluation and resume. *Needs:* Saved
   decisions, since evaluators refer to saved definitions as `LLMEvaluator` refers
   to `prompt_id`; not app formatting, measurement, or assets.
2. **Online evaluation.** Project bindings. *Needs:* Dataset evaluators.
3. **Calibration.** Inline evaluator authoring and evaluator-as-task
   calibration. *Needs:* Dataset evaluators.

## 19. Appendix: Decision Evaluator Implementation

Where the [decision evaluator](#14-decision-evaluators) runtime meets the rest of
Phoenix, and what completes each milestone. The behavior it implements is
specified above; this is the checklist the code is held to.

### 19.1 Runtime and Integration Points

One `DecisionEvaluator(BaseEvaluator)` runtime handles output derivation and
answer scoring across previews, experiments, and online evaluation. These notes
explain the integration points and behavior to preserve when changing them;
[Implementation Status](#17-implementation-status) tracks the remaining work.

- **Persistence.** The evaluator subtype stores a direct version pin and scoring
  policy. Attached decision judges have execution snapshots; calibration tasks
  store their definitions separately. Definition edits and deletion guards use
  the shared evaluator services and lock ordering. Annotation kind remains
  `LLM`, since these are model judgments.
- **Discovery and APIs.** GraphQL, REST, node resolution, and dataloaders expose
  decision evaluators even where authoring UI is incomplete. Keep those reads
  usable as project and calibration authoring are added.
- **Resolved configs.** Decision output configs are derived, not a stored second
  output schema. Result selection, distributions, comparisons, and annotation
  views need effective configs regardless of where an evaluator obtains them.
- **Experiments.** Attached judges run through `EvalWorkItem`; calibration uses
  `EvaluatorTaskWorkItem`. Inline decision definitions and frozen-definition
  reconstruction already exist. Remaining provenance and frontend work should
  use those paths, with tests for the distinct input contexts and resume behavior.
- **Retry ownership.** Work items use the provider client's rate-limit key and
  failure classifiers. Provider SDK retries are disabled so runner backoff does
  not stack with SDK backoff. Preserve cancellation propagation and avoid
  holding a database session during provider calls.
- **Tracing.** An evaluator emits an EVALUATOR root with a child DECISION span;
  standalone decision runs remain detached. The runtime accepts an OTel tracer
  so previews can use a no-op tracer. Preserve validation, accounting, terminal
  error metadata, and links from results to recorded traces.
- **Connections.** Deleted custom providers fail clearly or are blocked from
  deletion; they never trigger a fallback to a built-in host. An execution
  snapshot captures configuration, not the continued availability of a service.
- **Frontend.** Dataset authoring and experiment decision details already use
  the shared editors and answer renderer. Project and calibration flows still
  need their own authoring and loading work; reuse those pieces without assuming
  that a decision is a chat prompt or a tool definition.

Online evaluation resolves the selected version, effective policy/configs,
mapping, and custom-provider revision into its configuration fingerprint. It
executes that resolved configuration, not a fresh read of the live evaluator.
Scheduling and publication use the existing sweeper, producer, executor, and
claim/admission machinery. The rendered state-and-questions byte cap also applies
to previews that request online limits. Project UI work should preserve these
behaviors, including transient-error classification and evaluator-traffic
exclusion, rather than introduce a separate decision queue or consumer.

### 19.2 Completion and Verification

Milestone 1 is complete when users can author a saved decision evaluator, attach
it to a dataset through UI/API mapping and scoring controls, preview it, run it
against prompt or decision task outputs, and inspect annotations and traces.
Evaluation resume must work after task completion and server restart, with captured
configuration and explicit refusals. It does not depend on calibration or project
bindings.

Verify output derivation, threshold/tie behavior, structured mapping, one-call
multi-question execution, refused siblings, malformed responses, provider retries,
cancellation, tracing, CRUD/discovery, compatible updates, and
SQLite/PostgreSQL migrations. Resume tests cover mixed completed/pending judges,
missing/errored outputs, terminal refusals, incomplete multi-output sets, version/policy/
mapping edits, live-binding deletion, and crashes around persistence, including
between the separate trace and annotation transactions. Exercise
existing LLM/CODE/BUILTIN dataset evaluator flows for regressions.

Milestone 2 is complete when decision evaluators can be created, inspected, and
edited through the project UI and GraphQL, and their annotation details render
on spans, traces, and sessions. Previews that simulate online evaluation must
reject an oversized rendered state-and-questions request under the same limit as
scheduled execution. Verify all project targets, configuration identity and
hydration under concurrent updates, atomic publication including refusals,
health/result views, and protection from recursive evaluator traffic.

Milestone 3 completes unsaved decision evaluator submission and playground
authoring, loading, and experiment reopening. The server already accepts inline
decision evaluator definitions, captures saved evaluator definitions, and
reconstructs them for execution. Verify that previews
and evaluator-as-task experiments use the same definition, scoring, and input
context, including after resume.

The complete feature includes all three milestones.

## 20. Appendix: State Construction Walkthroughs

These examples describe the current implementation as material for the
[state-authoring discussion](#16-open-questions), not a commitment to four editor
modes. They distinguish the editor's state mode, Phoenix's GraphQL run input,
and the final state sent through a provider adapter. GraphQL snippets are
excerpts: model configuration and question definitions are omitted so the state
construction is visible.

### Current Editor Behavior

- **Text** renders a string template (`text`), or sends literal text when
  template format is `None` or no variables are referenced. Even a
  single-variable template such as `{{ticket}}` stays `text` and is rendered
  to a string.
- **JSON** supplies a concrete literal JSON value for a one-off playground
  run: a non-empty object is sent as `object`, an array or `{}` unchanged as
  `input`, and a JSON string as text. It performs no template substitution
  under any template format and cannot be saved or run over a dataset. A JSON
  skeleton with typed input references is a separate deliberation in §16;
  this mode does not currently interpret references.
- **Value** names a single declared input (`input`), passes its value through
  unchanged, and is how a saved `input` state loads under any template format.
- **Object** lists comma-separated input names (`object`), builds an object
  from their values in the Inputs panel, and is how a saved `object` state
  loads under any template format.

In the current UI, state mode and template format control different things.
**Text, JSON, Value, and Object choose how to construct the state. Mustache,
F-string, and None choose whether and how to substitute template variables in
a Text state.** Question instructions and criteria are always literal across
ad-hoc runs, dataset runs, and saved versions ([Non-Goals](#7-non-goals)).

| State editor mode | Mustache | F-string | None |
|---|---|---|---|
| **Text** | Substitutes `{{name}}` in the text template (`text`). | Substitutes `{name}` in the text template (`text`). | Uses the text literally, including any placeholder braces. |
| **JSON** | Parses the JSON literally without substituting variables. | Parses the JSON literally without substituting variables. | Parses the JSON literally without substituting variables. |
| **Value** | Looks up the single named input and sends its value unchanged (`input`). | Looks up the single named input and sends its value unchanged (`input`). | Looks up the single named input and sends its value unchanged (`input`). |
| **Object** | Looks up each listed input name and builds an object from its value (`object`). | Looks up each listed input name and builds an object from its value (`object`). | Looks up each listed input name and builds an object from its value (`object`). |

For example, Text `Reference: {{reference}}` with Mustache and input
`reference = A` produces the string `Reference: A`. Value `ticket` sends the
caller's `ticket` value unchanged without wrapping it in an outer object.
Object `reference, output`, with values `A` and `B`, produces
`{"reference": "A", "output": "B"}` under all three template settings.

Loading a saved version preserves existing input descriptions, JSON schemas,
and explicitly declared additional inputs, including section-scoped inputs.
Value and Object show a compact state preview from manual input values, or a
symbolic shape such as `<ticket>` / `{ "ticket": <ticket> }` when values are
unavailable or a dataset supplies them. JSON pasted into the Inputs panel stays
a string; the preview does not guess its type.

Those declarations and example values still need better authoring controls;
see the ergonomics discussion in §16.

### 20.1 Object: Preserve a Nested Ticket and Policy

Suppose a decision asks whether a support ticket requires urgent attention under
the customer's support policy. The question's instructions are fixed:

> Does this ticket require urgent attention under the policy for the customer's
> plan? Use the reported impact and workaround availability.

First, select **Object** in the state editor and enter:

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

### 20.2 Text: Read Nested Fields into a String

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
Entering `ticket.customer.plan` in **Object** instead declares one literal input
name. It requires a separately supplied value under that exact key and produces
an object such as `{"ticket.customer.plan": "enterprise"}`; it does not traverse
the `ticket` object.

To pass a single input's value unchanged (for example, the whole `ticket` object
without wrapping it in `{"ticket": ...}` or rendering it to a string), select
**Value** and enter `ticket`. That saves as `state: {input: "ticket"}`, whereas
**Text** `{{ticket}}` saves as a `text` template and renders to a string, and
**Object** `ticket` produces `{"ticket": <ticket value>}`.

### 20.3 JSON: Supply a Concrete Structured State

For a one-off playground run, select **JSON**, then paste the first
JSON object from the Object example into the state editor. The playground parses
it literally and sends its non-empty top-level object using
`state: {object: true}`, with `ticket` and `policy` as the inputs and the parsed
objects as their values. The final state is the same nested object as in the
Object example.

The difference is how those values are supplied and reused. JSON mode supplies
the literal values written in the editor for that run and performs no template
substitution under any template format. Value and Object declare names whose
values come from the panel, dataset rows, or callers. JSON mode cannot be saved
as a reusable decision or run over a dataset; Value and Object can.

## 21. References

- TypeSafe: [Jev 1.14 release notes](https://typesafe.ai/blog/jev-1-14),
  [images](https://docs.typesafe.ai/go/images),
  [box questions](https://docs.typesafe.ai/go/box).
- `typesafe-sdk` 0.7.5 adds `assets=`, `Box`, and `BoxAnswer`; the
  danger-zone header is still passed through `extra_headers`.
- Related specs: [Prompts](./prompts.md),
  [Sandboxes and Code Evaluators](./sandboxes-and-code-evaluators.md),
  [Server Evaluators](./server_evaluators.md),
  [Provider Routing for Evaluators](./provider-routing-for-evaluators.md).
