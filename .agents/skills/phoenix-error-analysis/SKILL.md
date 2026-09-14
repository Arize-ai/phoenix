---
name: phoenix-error-analysis
description: Find out what is going wrong in LLM or agent traffic by reading sampled Phoenix traces, spans, or sessions, writing free-form notes (open coding), then grouping the notes into a few narrow annotations, one per failure dimension with a small label set and counts, that pick eval targets and fix priorities (axial coding). Use for "what's going wrong with this agent", "I just instrumented my app, where do I start", "review these traces", "the chatbot keeps losing context", "what kinds of mistakes is the model making", "what categories of failures do we have", "what should I build evals for", "how do I prioritize fixes", "group these notes", "MECE breakdown" — or any framing that needs observations or categories grounded in real traces rather than invented top-down, even without naming the technique.
summary: Read sampled traces, write open-coding notes, then group them into narrow one-dimension annotations with counts that pick eval targets and fix priorities.
license: Apache-2.0
metadata:
  author: arize-ai
  version: "1.0.0"
---

# Error Analysis

Two phases against sampled traces, spans, or sessions. **Open coding** reads each sampled entity and writes a short, specific note on what went wrong. **Axial coding** groups those notes into a few narrow annotations, each judging one dimension of the entity with a small label set, and counts the labels to feed eval design and fix prioritization. Open coding always comes first: dimensions and labels that are not grounded in notes are invented top-down, which is the failure this workflow exists to avoid. Axial coding can also start from any existing set of open-ended observations.

**Recorded notes are the deliverable.** Open coding ends with one note per problematic entity written to the server and mirrored in the local sidecar, not with a summary in chat. Reading traces and reporting what you noticed without recording anything is a read-only diagnosis, the top-down shortcut this workflow exists to replace. A project-wide question such as "find any issues", "what's going wrong", or "any errors here" is a request for phase 1: pick the identifier, pick the unit, record a note for each problem as you find it, then summarize. A project with no annotation names yet is the normal starting state, not a reason to hold off writing.

## Choosing the unit of analysis

Pick **trace, span, or session** deliberately before recording — the choice determines what every note and annotation below targets, and a wrong default is expensive to undo mid-run. The unit is where the failure modes you're investigating actually live:

- **Trace** — one input → one output. Classifiers, single-shot summarizers, stateless tool-using agents, single-query RAG.
- **Span** — one operation inside a trace. In-isolation mechanical failures (exception, tool error response, malformed output) or failures attributable on sight to one component.
- **Session** — a sequence of traces sharing a `session.id`. Multi-turn agents where the failure is a *trajectory* — context loss across turns, goal drift, forgotten preferences — that exists only *across* traces.

Three signals to read:

1. **User framing.** "Conversation", "agent forgot", "drift", "across turns" → session. "This trace", "wrong output" → trace. "Exception", "malformed", "the retrieval failed" → span.

2. **Session wiring.** The session id lives at the root span's `session.id` attribute (not a top-level trace field); `""` means absent. List ~200 recent traces and compute how many carry a non-empty session id, how many distinct session ids appear, and the median traces per session. No session ids or median 1 → trace or span level; median 2+ → session level is plausibly right.

3. **Turn structure.** Open one recent trace's root-span `input.value` (it may be large — filter rather than reading wholesale). A single user message → one shot; a message *array* (`[{role: user}, {role: assistant}, ...]`) → a turn of a dialogue that lives at the session level.

State the chosen unit explicitly before recording any note. It can shift if the data demands it — trace-level notes that keep surfacing "the agent never remembers earlier turns" should pivot the next batch to session. The unit is a starting hypothesis, not a contract.

## Coding annotation identifier (pick this first)

Every artifact this workflow produces — open-coding notes, axial-coding labels, and the local sidecar files — is tagged with one **coding annotation identifier** so the run is queryable and revertible as a unit. Pick a descriptive, unique value before recording, e.g. `coding-run:chatbot-context-loss-2026-05-06`. (The `coding-run:` prefix is a naming convention; the value is not a Phoenix session id.)

Pass the identifier explicitly on every server write. A shell variable is fine for readability, but do not rely on shell inheritance — many agent harnesses spawn each command in a fresh subshell.

The local sidecars live at `.px/coding/<sanitized-identifier>.jsonl` (open-coding notes) and `.px/coding/<sanitized-identifier>-axial.jsonl` (axial labels), CWD-relative; sanitization replaces every character outside `[a-zA-Z0-9_-]` with `-`. Uniqueness is a **local file check**, not a server query:

```bash
CODING_ANNOTATION_IDENTIFIER="coding-run:chatbot-context-loss-2026-05-06"
SLUG=$(echo -n "$CODING_ANNOTATION_IDENTIFIER" | sed 's/[^a-zA-Z0-9_-]/-/g')
NOTES_SIDECAR=".px/coding/${SLUG}.jsonl"
AXIAL_SIDECAR=".px/coding/${SLUG}-axial.jsonl"
test ! -f "$NOTES_SIDECAR" || { echo "Sidecar already exists at $NOTES_SIDECAR — pick a new identifier or delete the file"; exit 1; }
mkdir -p .px/coding
```

If `$NOTES_SIDECAR` already exists, append a disambiguator (`-v2`, `-dustin`, etc.) and re-check.

**Resuming a run** — the two phases may run in independent invocations. When axial coding starts in a fresh shell, set the identifier to the same value chosen during open coding (recoverable from the wrap-up UI URL or by listing `.px/coding/*.jsonl`), skip the uniqueness check, and re-derive the sidecar paths from it. Never mint a new identifier mid-run.

## Where the writes go

The steps below name operations, not commands. Two surfaces implement them; use whichever the harness gives you. The `phoenix-cli` skill documents the `px` flags, and the `phoenix-graphql` skill's references (`project-spans-traces.md`, `sessions.md`, `annotations.md`) document the GraphQL fields and mutation inputs. This skill ships no reference files of its own.

| Operation | Phoenix CLI (`px`) | GraphQL (`phoenix-gql` or any client) |
| --- | --- | --- |
| Sample, expand, drill | `px trace list`, `px trace get <trace-id>`, `px span get <span-id>`, `px session get <session-id>` | `Project.spans(rootSpansOnly: true)`, `getTraceByOtelId`, `getSpanByOtelId`, `node(id:)` on a session |
| Check existing notes | `--include-notes` on `get`/`list` | `Span.spanNotes`; `Trace.traceAnnotations` / `ProjectSession.sessionAnnotations` where `name == "note"` |
| Write a note | `px trace add-note <trace-id> --text "..." --identifier "$CODING_ANNOTATION_IDENTIFIER"` (also `px span add-note`, `px session add-note`) | `createTraceNotes`, `createSpanNotes`, `createProjectSessionNotes` — each takes `{ note, annotatorKind: LLM, source: API, identifier }` plus an entity reference by OTel id (`{ otelId }`) or node id (`{ id }`) |
| Write an axial annotation | `px trace annotate <trace-id> --name <annotation-name> --label <label> --identifier "$CODING_ANNOTATION_IDENTIFIER"` (also `span`, `session`) | `createTraceAnnotations`, `createSpanAnnotations`, `createProjectSessionAnnotations` — Phoenix node ids only, plus `name`, `label`, `explanation`, `annotatorKind: LLM`, `source: API`, `metadata: {}`, `identifier` |
| Annotation config | `px annotation-config list`, `create`, `update <identifier>` | `createAnnotationConfig`, `updateAnnotationConfig`, `addAnnotationConfigToProject` |
| Discard the run | `px trace-annotations delete --identifier "$CODING_ANNOTATION_IDENTIFIER" --all -y` (also `span-annotations`, `session-annotations`) | No identifier-filtered sweep: collect the run's annotation node ids, then `deleteTraceAnnotations`, `deleteSpanAnnotations`, `deleteProjectSessionAnnotations` |

Note and annotation writes are synchronous and upsert on `(entity, name, identifier)`. Where the harness gates mutations behind an approval step, describe the write each command makes and keep every mutation in its own call.

## Phase 1: Open coding

Free-form note-writing. Write what you saw, not the category you think it belongs to — categorization is phase 2.

### Process

1. **Pick a coding annotation identifier** and verify the sidecar does not yet exist
2. **Pick the unit** — trace, span, or session
3. **Inspect** — fetch one entity at the chosen unit and read its input, output, exceptions, tool calls, retrieved context, and (at session level) the trajectory across child traces
4. **Note** — write one specific sentence describing what went wrong, or skip if correct
5. **Record** — write the note to the server and append a sidecar row
6. **Iterate** until the sample is exhausted or saturation hits

### Inspection

- **Trace unit** — read one trace's input → tool calls → retrieved context → output as one story.
- **Span unit** — read one operation's input/output and surrounding spans for context.
- **Session unit** — read the sequence of traces in order; the trajectory across traces is the data, not any single trace.

> **Don't sample by span status `ERROR`.** OTel's `status_code` only flips to `ERROR` when an instrumentor catches a raised exception. Hallucinations, wrong tone, retrieval misses, and bad tool selection all complete cleanly as `OK` or `UNSET` — filtering to error status excludes the population this workflow exists to surface.

#### What to look for

A checklist, not a taxonomy — categories come later. Note the first thing that goes wrong; a downstream symptom gets its own note only if it has an independent cause.

- **Explicit errors** — exceptions or error messages in tool, LLM, or retriever spans
- **Cost and latency** — unusually high token counts or slow spans
- **Retrieval quality** — irrelevant, missing, or low-scoring chunks
- **Response quality** — hallucination, factual errors, wrong tone, inappropriate refusals
- **Tool use** — wrong tool, malformed call, mishandled result
- **Trajectory** — loops, detours, unfinished tasks; across a session, lost context or goal drift
- **Instrumentation gaps** — missing spans or attributes; a blind spot is a finding

Treat existing evals and annotations as one input among many. Read content, not status: a success status can hide an error in the attributes, and an exception can be expected behavior.

Whatever the tooling, the fetches are: **sample** recent traces (trace id, root span name, status, root-span `input.value` / `output.value`); **expand** one trace into its spans ordered by start time; **drill** into a single span by id when the unit is the span; and **check existing notes** on entities you are about to review — notes are stored server-side as annotations with the reserved name `note`. As always, be aware that the data may be verbose, so take care not to blow up the context.

### Recording notes

For each session, trace, or span you inspect, submit a note to the server (see [Where the writes go](#where-the-writes-go)) and also save a local copy. Every write should carry the note text and an explicit `identifier` set to the coding annotation identifier. Record as you go, entity by entity — do not batch the notes into a closing summary.

After every successful note write to the server, append one JSONL line to `$NOTES_SIDECAR` — the sidecar is what axial coding reads, with no server round-trip:

```json
{"entity_kind":"trace","entity_id":"<trace-id>","note":"<text>","identifier":"<original identifier value, unsanitized>","ts":"<ISO-8601 UTC>"}
```

### What makes a good note

| Weak note         | Good note                                                           |
| ----------------- | ------------------------------------------------------------------- |
| "Wrong answer"    | "Said the store closes at 6pm but policy is 9pm"                    |
| "Retrieval issue" | "Retrieved docs about shipping when the question was about returns" |

### Saturation

Stop when observations stop being new: the last 10–15 entities repeat failures you've already seen, you catch yourself paraphrasing earlier notes, or skips outnumber notes. Resist grouping into categories while still collecting. You do not need to annotate every trace — annotating correct ones dilutes signal.

## Between phases: proceed or offer

At saturation, decide whether to continue into axial coding:

- If the user asked for categories, a taxonomy, counts, eval targets, or fix priorities — or framed the task as error analysis end to end — continue directly into phase 2.
- Otherwise stop here: summarize what the notes surfaced, then offer to continue with axial coding and wait for the user's answer rather than starting it. If the run ends here, follow [Wrapping up](#wrapping-up).

## Phase 2: Axial coding

Turn the open-coding notes into a small set of **annotations, each judging one dimension** of the entity: one question about its behavior, answered with a few labels. An entity carries one annotation per dimension its note touches, so a trace can end up with two or three. The output is several narrow annotations with two to four labels each — not one wide `<app>_failure_mode` annotation whose labels span unrelated concerns. A wide annotation cannot be aggregated per dimension, cannot be reused by an eval that judges one thing, and forces one label onto entities that failed in two ways.

### Process

1. **Set the coding annotation identifier** to the open-coding value and derive the sidecar paths (see [Resuming a run](#coding-annotation-identifier-pick-this-first))
2. **Gather** — read this run's notes from `$NOTES_SIDECAR`. An absent file means open coding hasn't run for this identifier in this CWD — stop and run phase 1 first. The newest `ts` per entity wins; fix or drop a malformed line without touching its neighbors. To include notes from other reviewers or earlier runs, fetch them from the server (annotations with the reserved name `note`).
3. **Group** — cluster notes that answer the same question about the entity ("did it pick the right tool?", "did the answer stay grounded in what was retrieved?", "did it finish the task it was asked to do?"). Each cluster is a candidate dimension. Work bottom-up from the note text; do not start from a list of dimensions.
4. **Define** — for each dimension, name the annotation for the question it asks (`tool_selection`, `answer_faithfulness`) and choose its labels: the failure outcomes the notes describe, plus one passing value so an eval can later apply the same annotation to entities that pass. Labels within a dimension are mutually exclusive; if two labels could both be true of one entity, they belong to different dimensions.
5. **Attribute** — decide what level each dimension lives at (see [Choosing the level](#choosing-the-level))
6. **Configure** — register one categorical annotation config per dimension (see [Annotation configs](#annotation-configs))
7. **Record** — for each noted entity, write one annotation per dimension its note touches, and append one sidecar row per annotation
8. **Quantify** — count labels per dimension from `$AXIAL_SIDECAR`: group the current rows by `(annotation_name, axial_label)`, newest `ts` per `(entity, annotation_name)` wins. No server query — the sidecar holds exactly the labels this run wrote.

### Shaping the dimensions

- **One question per annotation.** The name is the question (`tool_selection`), the label is the answer (`hallucinated_tool`). Judging tool choice and harness stability at once means two annotations.
- **Small label sets.** Two to four labels is typical. An annotation with more than about five labels is almost always carrying several dimensions; split it.
- **Labels are outcomes, not components.** `retrieval` or `tool_use` is a dimension name, not a label. If a label reads as a noun for a part of the system, promote it to its own annotation and describe its outcomes as the labels.
- **A run yields a handful of dimensions.** Three to six is usual. Every note should map to a label in at least one dimension; a note that fits nowhere is a new dimension or a sign an existing one is defined too narrowly.
- **Separate agent judgment from infrastructure.** Provider errors, persistence failures, and UI crashes are real findings but not agent behavior; give them their own dimension rather than listing them beside model mistakes.

### Choosing the level

Axial coding inherits open coding's unit by default, but an annotation can live at a different level than the note that informed it, in any direction: trace-level "answered shipping when asked about returns" notes can produce a span-level `retrieval_relevance` label on the retrieval span once retrieval emerges as the consistent culprit; trace-level single-turn-confusion notes can produce a session-level `context_tracking` label once the pattern is "doesn't track context across turns"; a session-level drift note can attribute to one specific turn and produce a trace-level label. Write each annotation at the level its dimension actually implicates — different dimensions in one run may live at different levels.

Categorize the entities you took notes on: `$NOTES_SIDECAR` is the source of candidates, and labels are written only after reading the note text and surrounding context. Do **not** select entities by error status — that captures only raised exceptions and excludes most failure modes (hallucination, wrong tone, retrieval miss).

### Annotation configs

Once the dimensions have stabilized — after Group and Define, not per-write — register **one categorical annotation config per dimension** before recording:

1. **Name each config for its dimension.** The config shares the annotation's name (`tool_selection`, `answer_faithfulness`); that is how Phoenix links them. Never a generic `category`, and never one config that bundles every dimension.
2. **Check the project's existing annotation configs.** If one already judges the same dimension, reuse its name and labels, extending its values only for an outcome the notes surfaced that it lacks. Do not create a near-duplicate under a new name.
3. **Create or update** each config with the dimension's final labels as its values, and associate it with the project.

Annotations write fine without a config, but the config is what makes a dimension first-class in the Phoenix UI: human annotators get its labels as a dropdown instead of free text, and later runs inherit a shared vocabulary instead of drifting. If a new label emerges mid-recording, add it to that dimension's config before writing with it.

### What makes a good annotation

An annotation is useful later only if it is filterable, aggregatable, and auditable. So:

1. **Name the dimension; put the outcome in the label.** `tool_selection` = `hallucinated_tool`, not `hallucinated_tool` = `true`, and not `failure_mode` = `hallucinated_tool`.
2. **One dimension per annotation.** Judging relevance *and* faithfulness means two annotations; so does judging tool choice *and* task completion.
3. **Annotate the responsible entity.** The retriever span for retrieval, the LLM span for output; the trace or session only for end-to-end judgments.
4. **Label the first failure.** Label a downstream effect separately only if it is an independent problem.
5. **Prefer labels to scores.** A small label set is applied consistently and aggregates cleanly; use a score only when the config defines the scale.
6. **Cite evidence in the explanation.** "Retrieved onboarding docs for a cancellation question", not "retrieval was bad".
7. **Keep names and labels stable across runs.** No `_v2` suffixes, and no borrowing another project's config because the name fits.

### Recording labels

For each entity and each dimension its note touches, write one annotation with:

- **name**: that dimension's annotation name, e.g. `retrieval_relevance`
- **label**: the outcome, e.g. `off_topic`
- **explanation** (optional): e.g. "asked about returns; retrieved shipping docs"
- **annotator kind**: `LLM` for your own judgment, `HUMAN` only for one the user gave you
- **identifier**: the coding annotation identifier

The server also accepts an optional score. Writes upsert on `(entity_id, name, identifier)`, so the same entity can carry several annotations under one identifier as long as their names differ. The server's default write mode enqueues asynchronously — prefer a synchronous mode where the tooling offers one, so the row is applied before continuing.

After each write, append one JSONL row to `$AXIAL_SIDECAR` — one row per annotation, so an entity labelled on two dimensions gets two rows:

```json
{"entity_kind":"trace","entity_id":"<trace-id>","annotation_name":"<annotation-name>","axial_label":"<label>","explanation":"<optional explanation>","identifier":"<original identifier value, unsanitized>","ts":"<ISO-8601 UTC>"}
```

`entity_kind` (`"trace"`, `"span"`, or `"session"`) matches the level the annotation was written at; `identifier` is the **original** unsanitized value — the sanitized form lives only in the filename. To revise a label, replace the row or append a newer one: the newest `ts` per `(entity_kind, entity_id, annotation_name)` is current, matching the server upsert.

### Example dimensions

Each key is an annotation name; its values are that annotation's labels. A run produces a few of these, not a tree.

```yaml
tool_selection: [correct, wrong_tool, hallucinated_tool, unnecessary_call]
retrieval_relevance: [relevant, off_topic, nothing_retrieved]
answer_faithfulness: [grounded, invented_fact, invented_citation]
context_tracking: [kept, ignored_preference, goal_drift]
task_completion: [completed, partial, abandoned]
```

### What makes a good dimension

- **Asks one question** whose answers are mutually exclusive — if two labels can both apply, it is two dimensions
- **Named for the behavior judged**, with outcomes in the labels ("tool_selection" = "wrong_tool", not "bad_output")
- **Tied to a fix** — if you can't name a remediation for its failing labels, the dimension is too vague
- **Grounded in data** — emerged from actual note text, not assumed upfront

## Wrapping up

Applies whether the run ends after phase 1 or phase 2.

If axial coding ran, list the dimensions you wrote and say for each whether you reused, extended, or created its annotation config — the rubric is the user's to weigh in on. Link the dimensions to the project's configuration page, `<endpoint>/projects/<project-node-id>/config`, which lists that project's annotation configs next to its annotations — not the instance-wide annotation settings page, which mixes in every other project's configs.

Share Phoenix UI links with the user: one per level — span, trace, session — that actually carries this run's notes or annotations, filtered to the run's work. Skip levels with none. Each tab reads its filter from its own search param; an unrecognized or misspelled param is silently dropped, leaving an unfiltered table.

Filter on the coding annotation identifier — annotation accessors expose `.identifier` alongside `.label`, `.score`, and `.explanation` — so each link shows exactly this run's notes and axial annotations. Add one `<annotation-name>` clause per dimension written at that level, joined with `or`; drop them if axial coding did not run:

| Level annotated | Tab and search param | Filter expression |
| --- | --- | --- |
| span | `/spans?spanFilterCondition=` | `annotations['note'].identifier == '<id>' or annotations['<annotation-name>'].identifier == '<id>'` |
| trace | `/traces?traceFilterCondition=` | `trace_annotations['note'].identifier == '<id>' or trace_annotations['<annotation-name>'].identifier == '<id>'` |
| session | `/sessions?sessionFilterCondition=` | `session_annotations['note'].identifier == '<id>' or session_annotations['<annotation-name>'].identifier == '<id>'` |

URL-encode each expression into its tab's param:

    <endpoint>/projects/<project-node-id>/<tab>?<param>=<encoded-expression>

When citing an individual finding, link directly to the annotated entity as well as sharing the filtered tables. For a trace, use `<endpoint>/projects/<project-node-id>/traces/<otel-trace-id>`. For a span, use that trace URL with `selectedSpanNodeId=<span-node-id>` so the annotated span opens selected. Resolve the span's Relay node ID and containing OpenTelemetry trace ID from the fetched data; the selection parameter does not accept an OpenTelemetry span ID. Preserve existing search parameters such as `timeRangeKey=30d` and URL-encode the added value.

**Discarding the run** — only with the user's explicit confirmation, since it is destructive. For each of trace, span, and session, delete the project's annotations filtered to the coding annotation identifier; this removes every dimension's labels at once, since they share the identifier. The server requires an explicit delete-all flag (or a time bound) to authorize the sweep; the identifier filter narrows but never authorizes on its own. Then remove `$NOTES_SIDECAR` and `$AXIAL_SIDECAR`. Each per-kind delete removes notes and axial annotations together because they share the underlying annotation table.
