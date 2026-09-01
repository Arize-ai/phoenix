---
name: phoenix-axial-coding
description: Group open-coding notes on Phoenix traces, spans, or sessions into a MECE failure taxonomy with counts, then pick eval targets and fix priorities. Use whenever the user has observations and needs categories — "what categories of failures do we have", "what should I build evals for", "how do I prioritize fixes", "group these notes", "MECE breakdown" — or any framing that asks for categories or counts grounded in real traces rather than invented top-down. Follows phoenix-open-coding.
summary: Group open-coding notes into a MECE failure taxonomy with counts, then pick eval targets and fix priorities.
license: Apache-2.0
metadata:
  author: arize-ai
  version: "1.0.0"
---

# Axial Coding

Group open-ended observations into a structured failure taxonomy: named categories with counts, feeding eval design and fix prioritization. Works best on `phoenix-open-coding` output, but can start from any set of open-ended observations.

## Coding annotation identifier (reuse the open-coding value)

Reuse the **coding annotation identifier** chosen in open coding — every write below carries it explicitly; never mint a new id mid-run. In a fresh shell or agent invocation, set it to the same value (recoverable from the wrap-up UI URL or by listing `.px/coding/*.jsonl`); do not rely on inherited env vars across harness-spawned subshells.

```bash
CODING_ANNOTATION_IDENTIFIER="coding-run:chatbot-context-loss-2026-05-06"
SLUG=$(echo -n "$CODING_ANNOTATION_IDENTIFIER" | sed 's/[^a-zA-Z0-9_-]/-/g')
NOTES_SIDECAR=".px/coding/${SLUG}.jsonl"
AXIAL_SIDECAR=".px/coding/${SLUG}-axial.jsonl"
```

## Process

1. **Set the coding annotation identifier** to the open-coding value and derive the sidecar paths (above)
2. **Gather** — read this run's notes from `$NOTES_SIDECAR`. An absent file means open coding hasn't run for this identifier in this CWD — stop and run it first. The newest `ts` per entity wins; fix or drop a malformed line without touching its neighbors. To include notes from other reviewers or earlier runs, fetch them from the server (annotations with the reserved name `note`).
3. **Group** — identify recurring themes in the note text and draft category names, bottom-up from the data. Aim for MECE coverage: each note fits exactly one category.
4. **Attribute** — decide what level each category lives at (see [Choosing the level](#choosing-the-level))
5. **Configure** — register the stabilized taxonomy as a categorical annotation config (see [Annotation config](#annotation-config))
6. **Record** — write one axial annotation per entity under the run's annotation name and append a sidecar row
7. **Quantify** — count failures per category from `$AXIAL_SIDECAR`: group the current rows by `axial_label`, newest `ts` per entity wins. No server query — the sidecar holds exactly the labels this run wrote.

## Choosing the level

Axial coding inherits open coding's unit by default, but a label can live at a different level than the note that informed it, in any direction: trace-level "answered shipping when asked about returns" notes can produce a span-level label on the retrieval span once retrieval emerges as the consistent culprit; trace-level single-turn-confusion notes can produce a session-level label once the pattern is "doesn't track context across turns"; a session-level drift note can attribute to one specific turn and produce a trace-level label. Write the label at the level the pattern actually implicates.

Categorize the entities you took notes on: `$NOTES_SIDECAR` is the source of candidates, and labels are written only after reading the note text and surrounding context. Do **not** select entities by error status — that captures only raised exceptions and excludes most failure modes (hallucination, wrong tone, retrieval miss).

## Annotation config

Once the categories have stabilized — after Group and Attribute, not per-write — register the taxonomy as a **categorical annotation config** before recording:

1. **Pick the annotation name** — descriptive and particular to what the taxonomy categorizes, e.g. `billing_support_failure_mode` or `docs_rag_retrieval_error`, never a generic `category`. The annotation and its config share this name; that is how Phoenix links them.
2. **Check the project's existing annotation configs.** If one already covers this taxonomy, reuse its name and extend its values with the new categories rather than creating a near-duplicate — and prefer its established labels where a category matches one.
3. **Create or update** a categorical config under the chosen name whose values are the final category labels, and associate it with the project.

Annotations write fine without a config, but the config is what makes the categories first-class in the Phoenix UI: human annotators get the taxonomy as a dropdown instead of free text, and later runs inherit a shared label vocabulary instead of drifting. If a new category emerges mid-recording, add it to the config before writing labels with it.

## Recording

Write one annotation per entity with:

- **name**: the annotation name chosen in [Annotation config](#annotation-config), e.g. `billing_support_failure_mode`
- **label**: the category, e.g. `answered_off_topic`
- **explanation** (optional): e.g. "asked about returns; answer covered shipping"
- **annotator kind**: `HUMAN`
- **identifier**: the coding annotation identifier

The server also accepts an optional score. Writes upsert on `(entity_id, name, identifier)`. The server's default write mode enqueues asynchronously — prefer a synchronous mode where the tooling offers one, so the row is applied before continuing.

After each write, append one JSONL row to `$AXIAL_SIDECAR`:

```json
{"entity_kind":"trace","entity_id":"<trace-id>","annotation_name":"<annotation-name>","axial_label":"<label>","explanation":"<optional explanation>","identifier":"<original identifier value, unsanitized>","ts":"<ISO-8601 UTC>"}
```

`entity_kind` (`"trace"`, `"span"`, or `"session"`) matches the level the annotation was written at; `identifier` is the **original** unsanitized value — the sanitized form lives only in the filename. To revise a label, replace the row or append a newer one: the newest `ts` per `(entity_kind, entity_id, annotation_name)` is current, matching the server upsert.

## Example Taxonomy

```yaml
failure_taxonomy:
  content_quality:
    hallucination: [invented_facts, fictional_citations]
    incompleteness: [partial_answer, missing_key_info]
    inaccuracy: [wrong_numbers, wrong_dates]

  communication:
    tone_mismatch: [too_casual, too_formal]
    clarity: [ambiguous, jargon_heavy]

  context:
    user_context: [ignored_preferences, misunderstood_intent]
    retrieved_context: [ignored_documents, wrong_context]

  agent:
    tool_use: [wrong_tool, wrong_parameters, unnecessary_call]
    state_management: [lost_context, stuck_in_loop]

  safety:
    missing_disclaimers: [legal, medical, financial]
```

## What Makes a Good Category

- **Named for the cause**, not the symptom ("wrong_tool_selected", not "bad_output")
- **Tied to a fix** — if you can't name a remediation, the category is too vague
- **Grounded in data** — emerged from actual note text, not assumed upfront

## Wrapping up

Share Phoenix UI links with the user: one per level — span, trace, session — that actually carries this run's annotations, filtered to the run's work. Skip levels with none. Each tab reads its filter from its own search param; an unrecognized or misspelled param is silently dropped, leaving an unfiltered table.

The filter DSLs cannot compare an annotation's `identifier` — an accessor exposes only `.label`, `.score`, `.explanation`, or bare existence — so filter on the run's annotation names instead: a bare accessor like `annotations['<annotation-name>']` matches entities where that annotation exists. The per-run annotation name keeps the axial clause precise; `note` is a shared name, so the notes clause also matches other reviewers' notes.

| Level annotated | Tab and search param | Filter expression |
| --- | --- | --- |
| span | `/spans?spanFilterCondition=` | `annotations['note'] or annotations['<annotation-name>']` |
| trace | `/traces?traceFilterCondition=` | `trace_annotations['note'] or trace_annotations['<annotation-name>']` |
| session | `/sessions?sessionFilterCondition=` | `session_annotations['note'] or session_annotations['<annotation-name>']` |

URL-encode each expression into its tab's param:

    <endpoint>/projects/<project-node-id>/<tab>?<param>=<encoded-expression>
