# Axial Coding

Group open-ended observations into structured failure taxonomies. Axial coding turns notes, trace observations, or open-coding output into named categories with counts, supporting downstream work like eval design and fix prioritization. It works well after [open coding](open-coding.md), but can start from any set of open-ended observations.

**Reach for this whenever** the user has observations and needs structure — e.g., "what categories of failures do we have", "what should I build evals for", "how do I prioritize fixes", "group these notes", "MECE breakdown", or any framing that asks for categories or counts grounded in real traces rather than invented top-down.

## Coding session helper (reuse the open-coding session)

Axial coding shares one identifier with open coding so a single revert / single UI link covers both stages. **Use the same shell that ran open coding** — the `PHOENIX_CODING_SESSION_ID` env var is already exported and every `annotate` call below should pass `--identifier "$PHOENIX_CODING_SESSION_ID"`.

If you're starting axial coding fresh in a new shell (e.g., resuming on a different machine), source the helper from [open-coding.md](open-coding.md#coding-session-helper-run-this-first) and either:

- Set the existing id manually: `export PHOENIX_CODING_SESSION_ID=px-coding-session:<short>` — pulled from a previous `coding_session_id` invocation or from the URL `coding_session_end` printed at the end of open coding.
- Mint a new id with `coding_session_start` — but the resulting axial-coding rows won't share an identifier with the open-coding notes from the prior shell, so the "list everything in one call" and "revert in one call" guarantees collapse.

## Choosing the unit

Open-coding notes are usually **trace-level** (see [open-coding.md#choosing-the-unit](open-coding.md#choosing-the-unit)) — examples below lead with `px trace` and fall back to `px span` for span-level notes. **An axial label can live at a different level than the note that informed it** — that's a feature: a trace-level note "answered shipping when asked returns" can produce a span-level annotation on the retrieval span once a pattern reveals retrieval as the consistent culprit. Re-attribution at axial coding time is what axial coding *is*. Whichever level you write the axial label on, write the sidecar on the same entity (see [Sidecar](#sidecar-annotation) below) so the UI link picks it up.

Default placement: trace-level for both the `axial_coding_category` annotation and its sidecar. Drop to span when the pattern implicates a specific component; reach for session only when the category is genuinely cross-trace.

## Process

1. **Confirm the session id** — run `coding_session_id` to make sure `PHOENIX_CODING_SESSION_ID` is still exported from open coding
2. **Gather** — Collect open-coding notes from the entities you reviewed (trace-level by default), filtered to this session via `?identifier=$PHOENIX_CODING_SESSION_ID`
3. **Pattern** — Group notes with common themes
4. **Name** — Create actionable category names
5. **Attribute** — Decide what level each category lives at; an axial label can move from the note's level to the component the pattern implicates
6. **Quantify** — Count failures per category

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

  safety:
    missing_disclaimers: [legal, medical, financial]
```

## Reading

### 1. Gather — extract this session's open-coding notes

Open-coding notes are stored as annotations with `name="note"` and the session identifier you set via `add-note --identifier`. Filter the project's notes endpoint by that identifier to read back exactly the rows this session produced:

```bash
# Trace-level notes from this session (default for open coding)
px api rest GET "/v1/projects/$PHOENIX_PROJECT/trace_annotations" \
  --query "identifier=$PHOENIX_CODING_SESSION_ID" \
  --query 'limit=1000' \
  --format raw --no-progress \
  | jq '
    [ .data[] | select(.name == "note") ]
    | map({ trace_id, note: .result.explanation })
  '

# Span-level notes from this session (when open coding dropped to span)
px api rest GET "/v1/projects/$PHOENIX_PROJECT/span_annotations" \
  --query "identifier=$PHOENIX_CODING_SESSION_ID" \
  --query 'limit=1000' \
  --format raw --no-progress \
  | jq '
    [ .data[] | select(.name == "note") ]
    | map({ span_id, note: .result.explanation })
  '
```

If you need notes from outside this session (older runs, shared notes from another reviewer), drop the identifier filter — `px trace list --include-notes` and `px span list --include-notes` still work as in the pre-session world.

### 2. Group — synthesize categories

Review the note text collected above. Manually identify recurring themes and draft candidate category names. Aim for MECE coverage: each note should fit exactly one category.

### 3. Record — write axial-coding annotations

Write one annotation per entity using `px trace annotate` or `px span annotate`. Pass `--identifier "$PHOENIX_CODING_SESSION_ID"` on every call so the row shares the session identifier (which both makes it queryable in one call and makes a re-run within the same session **upsert** instead of producing a second row). The level can differ from where the source note lives — see the **Recording** section below.

### 4. Quantify — count per category, scoped to this session

After recording, list this session's annotations and count by label. The `?identifier=` filter narrows the read to exactly the rows this run produced; without it you'd be counting the entire project history of `axial_coding_category`.

```bash
px api rest GET "/v1/projects/$PHOENIX_PROJECT/trace_annotations" \
  --query "identifier=$PHOENIX_CODING_SESSION_ID" \
  --query 'limit=1000' \
  --format raw --no-progress \
  | jq '
    [ .data[] | select(.name == "axial_coding_category" and .result.label != null) ]
    | group_by(.result.label)
    | map({ label: .[0].result.label, count: length })
    | sort_by(-.count)
  '
```

For span-level annotations, swap `trace_annotations` for `span_annotations` (and the read-back JSON's `span_id` for `trace_id`).

## Recording

Use the matching annotate command for the level the **label** belongs at — which may differ from where the source note lives (see [Choosing the unit](#choosing-the-unit)). Every call carries `--identifier "$PHOENIX_CODING_SESSION_ID"`:

```bash
# Trace-level label (most common — the trace as a whole exhibits the failure)
px trace annotate <trace-id> \
  --name axial_coding_category \
  --label answered_off_topic \
  --explanation "asked about returns; answer covered shipping" \
  --annotator-kind HUMAN \
  --identifier "$PHOENIX_CODING_SESSION_ID"

# Span-level label (when the pattern implicates a specific component)
px span annotate <span-id> \
  --name axial_coding_category \
  --label retrieval_off_topic \
  --explanation "retrieved shipping docs for a returns query" \
  --annotator-kind HUMAN \
  --identifier "$PHOENIX_CODING_SESSION_ID"
```

Accepted flags: `--name`, `--label`, `--score`, `--explanation`, `--annotator-kind` (`HUMAN`, `LLM`, `CODE`), `--identifier`. There is no `--sync` flag — the CLI passes `sync=true` itself.

### Sidecar annotation

Every entity you axial-annotate also needs a `coding_session_id` sidecar annotation at the same level. Phoenix's UI filter language is name-based — there is no UI primitive for filtering by `identifier`, so the URL printed by `coding_session_end` filters on `annotations['coding_session_id'].label == '<sess-id>'`. Without the sidecar, the UI link returns nothing.

```bash
# Same level as the axial-coding label above
px trace annotate <trace-id> \
  --name coding_session_id \
  --label "$PHOENIX_CODING_SESSION_ID" \
  --identifier "$PHOENIX_CODING_SESSION_ID"
# or px span annotate / px session annotate at matching levels
```

If [open coding](open-coding.md#sidecar-annotation) already wrote a sidecar on the same entity, this is an upsert (no second row) — the `(entity_id, name='coding_session_id', identifier=$PHOENIX_CODING_SESSION_ID)` key is shared. Writing it again is idempotent and safe.

### Bulk recording

Axial coding categorizes the entities you took notes on during open coding. Do **not** filter by `--status-code ERROR` — that captures only spans where Python raised, which excludes most failure modes (hallucination, wrong tone, retrieval miss). See [open-coding.md](open-coding.md#inspection) for the full reasoning.

```bash
# Bulk-annotate traces that already have open-coding notes from THIS session
px api rest GET "/v1/projects/$PHOENIX_PROJECT/trace_annotations" \
  --query "identifier=$PHOENIX_CODING_SESSION_ID" \
  --query 'limit=1000' \
  --format raw --no-progress \
  | jq -r '[.data[] | select(.name == "note")] | .[].trace_id' \
  | sort -u \
  | while read tid; do
      px trace annotate "$tid" \
        --name axial_coding_category \
        --label answered_off_topic \
        --annotator-kind HUMAN \
        --identifier "$PHOENIX_CODING_SESSION_ID"
      px trace annotate "$tid" \
        --name coding_session_id \
        --label "$PHOENIX_CODING_SESSION_ID" \
        --identifier "$PHOENIX_CODING_SESSION_ID"
    done
```

The same pattern works for span-level notes — swap `trace_annotations` for `span_annotations`, `.trace_id` for `.span_id`, and `px trace` for `px span`.

Aside: for Node-based bulk scripts, `@arizeai/phoenix-client` exposes `addSpanAnnotation`, `addSpanNote`, `addTraceNote`, `addSessionAnnotation`, and `addSessionNote`; all accept an optional `identifier` field on the input object. (No `addTraceAnnotation` is exported today; use the REST endpoint or `px trace annotate --identifier` for trace-level annotations.)

Aside: `px api graphql` rejects mutations — it cannot write annotations.

## Wrapping up

After axial coding finishes, print the Phoenix UI link and decide whether to keep or revert what the session produced:

```bash
coding_session_end                  # prints UI link, no deletes
coding_session_end --revert         # prompts for the session id, then DELETEs
```

The link points to the project's traces table filtered by the sidecar — `annotations['coding_session_id'].label == '<sess-id>'`. Revert is opt-in and issues three identifier-bound DELETEs (one per kind), each of which removes notes, axial-coding annotations, and sidecars in a single call (they share the annotation table).

## Agent Failure Taxonomy

```yaml
agent_failures:
  planning: [wrong_plan, incomplete_plan]
  tool_selection: [wrong_tool, missed_tool, unnecessary_call]
  tool_execution: [wrong_parameters, type_error]
  state_management: [lost_context, stuck_in_loop]
  error_recovery: [no_fallback, wrong_fallback]
```

### Transition Matrix — jq sketch

To find where failures occur between agent states, identify the last non-error span before each first-error span within a trace. Note: OTel leaves most spans at `status_code == "UNSET"` and only sets `"OK"` when code explicitly does so — match `!= "ERROR"` rather than `== "OK"` so the matrix works on typical OTel data.

```bash
px span list --format raw --no-progress | jq '
  group_by(.context.trace_id)
  | map(
      sort_by(.start_time)
      | { trace_id: .[0].context.trace_id,
          last_non_error: map(select(.status_code != "ERROR")) | last | .name,
          first_err:      map(select(.status_code == "ERROR")) | first | .name }
    )
  | [ .[] | select(.first_err != null) ]
  | group_by([.last_non_error, .first_err])
  | map({ transition: "\(.[0].last_non_error) → \(.[0].first_err)", count: length })
  | sort_by(-.count)
'
```

Use the output to tally which state-to-state transitions are most failure-prone and add them to your taxonomy.

## What Makes a Good Category

A useful category is:
- **Named for the cause**, not the symptom ("wrong_tool_selected", not "bad_output")
- **Tied to a fix** — if you can't name a remediation, the category is too vague
- **Grounded in data** — emerged from actual note text, not assumed upfront

## Principles

- **One identifier per session** — every `annotate` and sidecar carries `$PHOENIX_CODING_SESSION_ID`, the same value open coding used.
- **MECE** — Each failure fits ONE category.
- **Actionable** — Categories suggest fixes.
- **Bottom-up** — Let categories emerge from data.
- **Sidecar always paired** — never write `axial_coding_category` without writing the matching `coding_session_id` sidecar; the UI link depends on it.
