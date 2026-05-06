# Open Coding

Free-form note-writing against sampled traces, before any taxonomy exists. After you pick a sample of traces, read each one and write a short, specific observation of what went wrong. These raw notes feed [axial coding](axial-coding.md), where they get grouped into named failure categories — and ultimately into eval targets or fix priorities.

**Reach for this whenever** the user wants to look at traces or spans without a fixed taxonomy yet — e.g., "what's going wrong with this agent", "I just instrumented my app, where do I start", "review these traces", "what kinds of mistakes is the model making", "help me make sense of these outputs", or any framing that needs grounded observations before categories.

## Coding session helper (run this first)

Every artifact this workflow produces — open-coding notes, axial-coding annotations, and a UI-filter sidecar — is tagged with one identifier so the run is queryable, revertible, and viewable as a unit. Source the helper into your shell once, then call `coding_session_start` before recording any notes:

```bash
coding_session_start() {
  if [ -n "${PHOENIX_CODING_SESSION_ID:-}" ]; then
    echo "PHOENIX_CODING_SESSION_ID already set: $PHOENIX_CODING_SESSION_ID" >&2
    return 0
  fi
  local short
  short=$(uuidgen | tr '[:upper:]' '[:lower:]' | tr -d '-' | cut -c1-8)
  export PHOENIX_CODING_SESSION_ID="px-coding-session:$short"
  echo "$PHOENIX_CODING_SESSION_ID"
}

coding_session_id() {
  if [ -z "${PHOENIX_CODING_SESSION_ID:-}" ]; then
    echo "PHOENIX_CODING_SESSION_ID is unset. Run coding_session_start first." >&2
    return 1
  fi
  echo "$PHOENIX_CODING_SESSION_ID"
}

coding_session_end() {
  local sess revert=0
  if ! sess=$(coding_session_id); then
    return 1
  fi
  if [ "${1:-}" = "--revert" ]; then revert=1; fi

  if [ -z "${PHOENIX_HOST:-}" ] || [ -z "${PHOENIX_PROJECT:-}" ]; then
    echo "PHOENIX_HOST and PHOENIX_PROJECT must be set." >&2
    return 1
  fi

  # 1. Print the Phoenix UI link (sidecar-name-based filter on the project's traces page).
  local filter url
  filter="annotations['coding_session_id'].label == '$sess'"
  url="$PHOENIX_HOST/projects/$PHOENIX_PROJECT/traces?filterCondition=$(
    python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$filter"
  )"
  echo "Phoenix UI: $url"

  if [ "$revert" = "0" ]; then
    echo "Tip: re-run with --revert to delete every artifact tagged $sess." >&2
    return 0
  fi

  printf 'Revert will DELETE every annotation/note tagged %s in project %s. Type the session id to confirm: ' \
    "$sess" "$PHOENIX_PROJECT"
  local confirm; read -r confirm
  if [ "$confirm" != "$sess" ]; then
    echo "Confirmation mismatch — no DELETE issued." >&2
    return 1
  fi

  local enc_sess kind status
  enc_sess=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$sess")
  for kind in trace span session; do
    status=$(curl -s -o /dev/null -w '%{http_code}' \
      -X DELETE \
      ${PHOENIX_API_KEY:+-H "Authorization: Bearer $PHOENIX_API_KEY"} \
      "$PHOENIX_HOST/v1/projects/$PHOENIX_PROJECT/${kind}_annotations?identifier=$enc_sess&delete_all=true")
    echo "DELETE ${kind}_annotations identifier=$sess -> HTTP $status"
  done

  # Confirm the post-revert row counts (should all be zero).
  for kind in trace span session; do
    local n
    n=$(curl -s \
      ${PHOENIX_API_KEY:+-H "Authorization: Bearer $PHOENIX_API_KEY"} \
      "$PHOENIX_HOST/v1/projects/$PHOENIX_PROJECT/${kind}_annotations?identifier=$enc_sess&limit=1" \
      | python3 -c 'import json,sys; print(len(json.load(sys.stdin).get("data", [])))')
    echo "post-revert ${kind}_annotations rows for $sess: $n"
  done
}
```

Quick start:

```bash
coding_session_start                # prints e.g. px-coding-session:a1b2c3d4
echo "$PHOENIX_CODING_SESSION_ID"   # stable across this shell

# ... record notes (Recording Notes section below) ...

coding_session_end                  # prints UI link, no deletes
coding_session_end --revert         # opt-in: prompts for the session id, then DELETEs
```

The same `PHOENIX_CODING_SESSION_ID` is read by [axial-coding.md](axial-coding.md). Keep the same shell open for both stages so the id is shared.

## Choosing the unit

Open coding has two scopes that don't have to match:

- **Review scope** — the **trace**. Read input → tool calls → retrieved context → output as one story.
- **Recording scope** — **default to the trace**. The honest observation is usually trace-shaped ("asked X, got Y; the answer didn't address the question"), and forcing localization to a span at this stage commits to causal attribution you don't yet have data to support — that's axial coding's job.

  Drop to a **span** only when one of:
  - The span, read in isolation, is still wrong: an exception fired, a tool returned an error response, the output is malformed.
  - You already know the domain well enough to attribute the failure on sight without inferring across spans.

Session-level recording is rare in open coding — reach for `px session add-note` only when the observation is genuinely cross-trace ("user repeated themselves four times across the conversation"). Single-trace observations stay on the trace.

## Process

1. **Start a session** — `coding_session_start` once per shell
2. **Inspect** — fetch a trace from your sample
3. **Read** — look at input, output, exceptions, tool calls, retrieved context
4. **Note** — write one specific sentence describing what went wrong (or skip if correct)
5. **Record** — attach the note to the trace with `px trace add-note --identifier $PHOENIX_CODING_SESSION_ID` (default), or to a span with `px span add-note --identifier $PHOENIX_CODING_SESSION_ID` for in-isolation/mechanical failures. Also write the sidecar annotation (see [Sidecar annotation](#sidecar-annotation) below) so the run is filterable in the Phoenix UI.
6. **Iterate** — move to the next trace; repeat until the sample is exhausted or saturation hits
7. **Hand off** — keep the same shell open for [axial coding](axial-coding.md), then `coding_session_end` to print the UI link

## Inspection

Use `px` to read trace and span context before writing a note. Open coding reviews by **trace** — read input → tool calls → retrieved context → output as a unit. Record on the trace by default; drill to a specific span only when the failure is mechanical (exception, error response, malformed output) or you can attribute on sight (see [Choosing the unit](#choosing-the-unit)).

> **Don't filter the sample by `--status-code ERROR`.** OTel's `status_code` only flips to `ERROR` when an instrumentor catches a raised Python exception (network failure, 5xx, parse error). Hallucinations, wrong tone, retrieval misses, and bad tool selection all complete cleanly and arrive as `OK` or `UNSET`. Sampling for open coding by `--status-code ERROR` excludes the population this workflow exists to surface.

```bash
# Sample recent traces — the unit of inspection in open coding
px trace list --limit 100 --format raw --no-progress | jq '
  .[] | {trace_id: .traceId, root: .rootSpan.name, status,
         input: .rootSpan.attributes["input.value"],
         output: .rootSpan.attributes["output.value"]}
'

# Trace-level context — all spans in one trace, ordered by start_time
px trace get <trace-id> --format raw | jq '
  .spans | sort_by(.start_time) | map({span_id: .context.span_id, name, status_code,
    input: .attributes["input.value"],
    output: .attributes["output.value"]})
'

# Drill to one span (px span get does not exist; filter via span list)
px span list --trace-id <trace-id> --format raw --no-progress \
  | jq '.[] | select(.context.span_id == "<span-id>")'

# Check existing notes on traces (default) or spans you are about to review
# Notes are stored as annotations with name="note"; use --include-notes (not --include-annotations)
px trace list --include-notes --limit 10 --format raw --no-progress | jq '
  .[] | select((.notes // []) | length > 0)
  | {trace_id: .traceId, notes: [.notes[] | .result.explanation]}
'
# Same shape on spans — swap px trace for px span and use .context.span_id
```

Always pipe through `jq` with `--format raw --no-progress` when scripting.

## Recording Notes

Default write path is `px trace add-note <trace-id> --text "..." --identifier "$PHOENIX_CODING_SESSION_ID"` — most observations are trace-shaped and shouldn't pre-commit to localization. Drop to `px span add-note <span-id>` when the failure is in-isolation wrong (exception, error response, malformed output) or you already know the failure structure on sight.

Passing `--identifier "$PHOENIX_CODING_SESSION_ID"` does two things:
- Tags the note row with the session id, so `GET /v1/projects/<pid>/{trace,span,session}_annotations?identifier=<sess-id>` returns every artifact this run produced.
- Makes the call **upsert** on `(entity_id, name='note', identifier)` — re-running open coding on the same trace within the same session overwrites the prior note instead of appending a second row. (Without `--identifier`, the server stamps a unique `px-{kind}-note:<uuid>` and each call appends.)

```bash
# Trace-level note (default)
px trace add-note <trace-id> \
  --text "Asked about returns; final answer covered shipping policy instead" \
  --identifier "$PHOENIX_CODING_SESSION_ID"

# Span-level note (mechanical or attributable-on-sight failures)
px span add-note <span-id> \
  --text "Tool call returned 500 — vendor API unreachable" \
  --identifier "$PHOENIX_CODING_SESSION_ID"

# Interactive loop — walk traces, write a trace-level note + sidecar per failing trace
px trace list --last-n-minutes 60 --limit 50 --format raw --no-progress \
  | jq -r '.[].traceId' \
  | while read tid; do
      echo "── trace $tid ──"
      px trace get "$tid" --format raw | jq '
        {input: .rootSpan.attributes["input.value"],
         output: .rootSpan.attributes["output.value"],
         spans: (.spans | sort_by(.start_time) | map({name, status_code}))}
      '
      read -p "Note for $tid (blank to skip): " note
      [ -z "$note" ] && continue
      px trace add-note "$tid" --text "$note" --identifier "$PHOENIX_CODING_SESSION_ID"
      px trace annotate "$tid" \
        --name coding_session_id \
        --label "$PHOENIX_CODING_SESSION_ID" \
        --identifier "$PHOENIX_CODING_SESSION_ID"
    done
```

Bulk auto-tagging by status code (e.g. `px span list --status-code ERROR | xargs ... add-note "error"`) is **not open coding** — open coding is manual, observation-grounded, and ranges over all failure modes, not just spans where Python raised. Skip the bulk-by-status-code shortcut; it produces fewer, less informative notes than walking traces.

### Sidecar annotation

Every entity that receives an open-coding note (or an axial-coding annotation later) also needs a sidecar annotation so the Phoenix UI can filter by session. Phoenix's UI filter language is name-based, not identifier-based — there is no UI primitive for filtering by `identifier`, so a sidecar annotation whose **name** is constant and whose **label** is the session id is what the URL printed by `coding_session_end` actually filters on.

Run this once per touched entity, alongside the `add-note` (and again later when axial coding annotates a different entity):

```bash
px trace annotate <trace-id> \
  --name coding_session_id \
  --label "$PHOENIX_CODING_SESSION_ID" \
  --identifier "$PHOENIX_CODING_SESSION_ID"
# or px span annotate / px session annotate at matching levels
```

The sidecar's identifier matches the session id, so the revert in `coding_session_end --revert` cleans it up in the same DELETE call as the notes and the axial-coding annotations.

**Fallback write paths (one-line asides):**

- `POST /v1/trace_notes` and `POST /v1/span_notes` and `POST /v1/session_notes` — accept one `{data: {trace_id|span_id|session_id, note, identifier}}` per request; the optional `identifier` field upserts on `(entity_id, name='note', identifier)` when non-empty.
- `@arizeai/phoenix-client` `addTraceNote`, `addSpanNote`, and `addSessionNote` wrap the same endpoints and accept an optional `identifier` field on the note object.
- `px api graphql` rejects mutations with `"Only queries are permitted."` — use `px {trace,span,session} add-note` or the REST endpoints instead.

## What Makes a Good Note

| Weak note            | Why it's weak             | Good note                                                                  | Why it's strong                             |
| -------------------- | ------------------------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| "Wrong answer"       | No observable detail      | "Said the store closes at 6pm but policy is 9pm"                           | Quotes observed vs. correct value           |
| "Bad tone"           | Vague judgment            | "Used first-name greeting for an enterprise support ticket"                | Specifies the context mismatch              |
| "Hallucination"      | Labels before observing   | "Cited a product feature ('auto-renew') that does not exist in the schema" | Describes what was fabricated               |
| "Retrieval issue"    | Category, not observation | "Retrieved docs about shipping when the question was about returns"        | States what was retrieved vs. needed        |
| "Model confused"     | Opaque                    | "Answered in Spanish when the user wrote in English"                       | Observable and reproducible                 |

Write what you saw, not the category you think it belongs to — categorization happens in [axial coding](axial-coding.md). Short prefixes like `TONE:` or `FACTUAL:` are a personal shorthand, not a repo convention.

## Saturation

Stop writing notes when observations stop being new. Signals:

- **Repeats** — the last 10–15 traces produced notes that describe failures you've already seen.
- **Paraphrase convergence** — you catch yourself writing minor variations of earlier notes.
- **Skips outnumber notes** — most recent traces are correct and need no note.

At saturation, move on to [axial coding](axial-coding.md) to group what you have. Continuing past saturation adds traces but not insight. You do not need to annotate every trace — annotating correct ones dilutes signal.

## Listing what this session produced

At any time during the run you can list every artifact tagged with the current session id:

```bash
# All notes + structured annotations + sidecars across the three entity kinds
for kind in trace span session; do
  px api rest GET "/v1/projects/$PHOENIX_PROJECT/${kind}_annotations" \
    --query "identifier=$PHOENIX_CODING_SESSION_ID" \
    --query 'limit=1000' \
    --format raw --no-progress \
    | jq --arg kind "$kind" '{kind: $kind, rows: .data}'
done
```

## Wrapping up

When the session is done, print the UI link and (optionally) revert everything this run produced:

```bash
coding_session_end                  # prints UI link only
coding_session_end --revert         # prompts for the session id, then DELETEs
```

`coding_session_end --revert` issues three identifier-bound DELETEs (one per kind). Each call covers notes, structured annotations, and sidecars in one shot because they share the underlying annotation table.

## Principles

- **One identifier per session** — every artifact carries `$PHOENIX_CODING_SESSION_ID`; never mint a per-stage id.
- **Free-form over structured** — do not pre-commit to a taxonomy during open coding; categories emerge in axial coding.
- **Specific over general** — quote or paraphrase the observed failure; vague labels ("bad response") carry no signal.
- **Context before labeling** — inspect input, output, and retrieved context before writing any note.
- **Iterate before categorizing** — work through the full sample first; resist grouping while still collecting.
- **Skip is valid** — a correct span needs no note; annotating everything dilutes signal.
- **Revert is opt-in** — `coding_session_end --revert` deletes; the bare call only prints the link.
