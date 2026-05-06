# Axial Coding

Group open-ended observations into structured failure taxonomies. Axial coding turns notes, trace observations, or open-coding output into named categories with counts, supporting downstream work like eval design and fix prioritization. It works well after [open coding](open-coding.md), but can start from any set of open-ended observations.

**Reach for this whenever** the user has observations and needs structure — e.g., "what categories of failures do we have", "what should I build evals for", "how do I prioritize fixes", "group these notes", "MECE breakdown", or any framing that asks for categories or counts grounded in real traces rather than invented top-down.

## Coding session identifier (reuse the open-coding session)

Reuse the `PHOENIX_CODING_SESSION_ID` chosen in open coding — every `annotate` call below passes `--identifier "$PHOENIX_CODING_SESSION_ID"`. In a fresh shell, re-export the same value (recoverable from the wrap-up UI URL or any annotation row); don't mint a new id. See [open-coding.md#coding-session-identifier-pick-this-first](open-coding.md#coding-session-identifier-pick-this-first) for the rationale.

## Choosing the unit

Open coding's diagnostic in [open-coding.md#choosing-the-unit-of-analysis](open-coding.md#choosing-the-unit-of-analysis) commits to a unit (trace, span, or session). Axial coding inherits that unit by default — if open coding ran at the session level, most axial labels will too; same for trace and span.

**An axial label can live at a different level than the note that informed it** — that's a feature, and it works in every direction:

- *Trace → span*: a trace-level note "answered shipping when asked about returns" can produce a span-level annotation on the retrieval span once a pattern reveals retrieval as the consistent culprit.
- *Trace → session*: a batch of trace-level notes describing single-turn confusion can produce a session-level annotation once you see the pattern is "the agent doesn't track the user's stated context across turns."
- *Session → trace*: a session-level note about cross-turn drift may, on closer reading, attribute to one specific turn where the agent dropped the thread; a trace-level annotation can name that turn.

Whichever level you write the axial label on, write the sidecar on the same entity (see [Sidecar](#sidecar-annotation) below) so the UI link picks it up.

## Process

1. **Confirm the session id** — `echo $PHOENIX_CODING_SESSION_ID` to make sure it's still exported from open coding (re-export with the same value if you're in a fresh shell)
2. **Gather** — collect open-coding notes from the entities you reviewed (at the unit committed in open coding), filtered to this session via `?identifier=$PHOENIX_CODING_SESSION_ID`
3. **Pattern** — group notes with common themes
4. **Name** — create actionable category names
5. **Attribute** — decide what level each category lives at; an axial label can move up (trace → session) or down (trace → span) from the source note's level to the level the pattern actually implicates
6. **Quantify** — count failures per category

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

Open-coding notes are stored as annotations with `name="note"` and the session identifier set via `add-note --identifier`. Filter the project's notes endpoint by that identifier to read back exactly the rows this session produced. Run at the same unit open coding wrote at:

```bash
# Trace-level notes from this session
px api rest GET "/v1/projects/$PHOENIX_PROJECT/trace_annotations" \
  --query "identifier=$PHOENIX_CODING_SESSION_ID" \
  --query 'limit=1000' \
  --format raw --no-progress \
  | jq '
    [ .data[] | select(.name == "note") ]
    | map({ trace_id, note: .result.explanation })
  '
```

For span- or session-level notes, swap `trace_annotations` → `span_annotations` / `session_annotations` and `trace_id` → `span_id` / `session_id` in the jq.

For notes outside this session (older runs, another reviewer's notes), drop the identifier filter or use `px {trace,span,session} list --include-notes`.

### 2. Group — synthesize categories

Review the note text collected above. Manually identify recurring themes and draft candidate category names. Aim for MECE coverage: each note should fit exactly one category.

### 3. Record — write axial-coding annotations

Write one annotation per entity using `px {trace,span,session} annotate`, passing `--identifier "$PHOENIX_CODING_SESSION_ID"` on every call. The level can differ from where the source note lives — see [Recording](#recording) below.

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
# Trace-level label — the trace as a whole exhibits the failure
px trace annotate <trace-id> \
  --name axial_coding_category \
  --label answered_off_topic \
  --explanation "asked about returns; answer covered shipping" \
  --annotator-kind HUMAN \
  --identifier "$PHOENIX_CODING_SESSION_ID"

# Span-level label — the pattern implicates a specific component
px span annotate <span-id> \
  --name axial_coding_category \
  --label retrieval_off_topic \
  --explanation "retrieved shipping docs for a returns query" \
  --annotator-kind HUMAN \
  --identifier "$PHOENIX_CODING_SESSION_ID"

# Session-level label — the failure is a trajectory across turns
px session annotate <session-id> \
  --name axial_coding_category \
  --label cross_turn_context_loss \
  --explanation "agent dropped the user's stated dietary restriction by turn 4" \
  --annotator-kind HUMAN \
  --identifier "$PHOENIX_CODING_SESSION_ID"
```

Accepted flags: `--name`, `--label`, `--score`, `--explanation`, `--annotator-kind` (`HUMAN`, `LLM`, `CODE`), `--identifier`. There is no `--sync` flag — the CLI passes `sync=true` itself.

### Sidecar annotation

Write a `coding_session_id` sidecar at the same level as the axial label — see [open-coding.md#sidecar-annotation](open-coding.md#sidecar-annotation) for why. If open coding already wrote a sidecar on the same entity, this call upserts (idempotent).

```bash
# Same level as the axial-coding label above
px trace annotate <trace-id> \
  --name coding_session_id \
  --label "$PHOENIX_CODING_SESSION_ID" \
  --identifier "$PHOENIX_CODING_SESSION_ID"
# or px span annotate / px session annotate at matching levels
```

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

The same pattern works for span-level or session-level notes — swap `trace_annotations` for `span_annotations` / `session_annotations`, `.trace_id` for `.span_id` / `.session_id`, and `px trace` for `px span` / `px session`.

**Fallback paths:** REST `POST /v1/{trace,span,session}_annotations` and `@arizeai/phoenix-client`'s `addSpanAnnotation` / `addSessionAnnotation` (no `addTraceAnnotation` is exported today — use REST or `px trace annotate`). `px api graphql` rejects mutations.

## Wrapping up

After axial coding finishes, share the Phoenix UI link with the user. The link points to the project's traces table filtered by the sidecar — `annotations['coding_session_id'].label == '<sess-id>'`:

```bash
encoded=$(python3 -c 'import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))' \
  "annotations['coding_session_id'].label == '$PHOENIX_CODING_SESSION_ID'")
echo "Phoenix UI: $PHOENIX_HOST/projects/$PHOENIX_PROJECT/traces?filterCondition=$encoded"
```

If the user wants to discard everything this session produced (open-coding notes, axial-coding annotations, and sidecars), three identifier-bound DELETEs handle it. **Confirm before running** — destructive:

```bash
for kind in trace span session; do
  curl -X DELETE \
    ${PHOENIX_API_KEY:+-H "Authorization: Bearer $PHOENIX_API_KEY"} \
    "$PHOENIX_HOST/v1/projects/$PHOENIX_PROJECT/${kind}_annotations?identifier=$PHOENIX_CODING_SESSION_ID&delete_all=true"
done
```

Each call removes notes, axial-coding annotations, and sidecars together because they share the underlying annotation table.

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
