# Open Coding

Free-form note-writing against sampled traces, spans, or sessions, before any taxonomy exists. After you pick a sample at the right unit (see [Choosing the unit of analysis](#choosing-the-unit-of-analysis)), read each one and write a short, specific observation of what went wrong. These raw notes feed [axial coding](axial-coding.md), where they get grouped into named failure categories — and ultimately into eval targets or fix priorities.

**Reach for this whenever** the user wants to look at LLM traffic without a fixed taxonomy yet — e.g., "what's going wrong with this agent", "I just instrumented my app, where do I start", "review these traces", "the chatbot keeps losing context", "what kinds of mistakes is the model making", "help me make sense of these conversations", or any framing that needs grounded observations before categories.

## Choosing the unit of analysis

The right unit — **trace, span, or session** — depends on the question and the system. Pick deliberately before recording; the choice determines whether you call `px trace`, `px span`, or `px session` throughout, and a wrong default is expensive to undo mid-run.

The unit is about **where the failure modes you're investigating actually live**:

- **Trace** — one input → one call graph → one output. Right for classifiers, single-shot summarizers, stateless tool-using agents, single-query RAG. Failure modes that live here: wrong answer, malformed output, missed retrieval, bad tool selection within one request.
- **Span** — one operation inside a trace. Right for in-isolation mechanical failures (an exception fired, a tool returned an error response, an output is malformed) or when you can attribute on sight to a specific component. Reach for span when the trace as a whole is fine but one piece inside it is the unit of interest.
- **Session** — a sequence of traces sharing a `session.id`. Right for multi-turn conversational agents, agents with episodic memory, anything where the failure mode is a *trajectory*: context loss across turns, drift from the user's stated goal, the agent forgetting a stated preference, repeated user clarifications. These failures don't exist on any single trace; they only exist *across* traces.

### Diagnostic — three signals to read

1. **User framing.** *Tilts session*: "conversation", "agent forgot", "drift", "memory", "across turns", "user had to repeat themselves". *Tilts trace*: "this trace", "this call", "the response was wrong", "wrong output". *Tilts span*: "exception", "error response", "malformed", "the retrieval failed".

2. **Data shape.** Probe before the loop:

   ```bash
   px trace list --limit 200 --format raw --no-progress \
     | jq '
       [ .[] | .sessionId // empty ]
       | { with_session: length,
           distinct_sessions: (group_by(.) | length),
           median_traces_per_session:
             (group_by(.) | map(length) | sort | .[length/2|floor] // 0) }
     '
   ```

   `with_session: 0` → sessions not wired; trace is the grain. `median_traces_per_session: 1` → single-trace sessions; still trace. `median_traces_per_session: 5+` → sessions are meaningful; session is plausibly right.

3. **System type.** Open one recent trace and inspect the root span's input. A single user message → one turn or one shot. A message *array* (`[{role: user}, {role: assistant}, ...]`) → that's a turn within a longer dialogue; the dialogue lives at the session level.

   ```bash
   px trace get <trace-id> --format raw \
     | jq '.rootSpan.attributes["input.value"] | (try fromjson catch .) | (type, length?)'
   ```

### Commit out loud, then proceed

State the unit explicitly before recording any note:

> "Question: 'the chatbot keeps losing context'. Data: median 7 traces per session, message-array inputs. Recording at the **session** level; will drop to **trace** for single-turn observations, **span** for mechanical failures."

The unit can shift if data demands it — a trace-level investigation that surfaces "the agent never remembers earlier turns" should pivot to session. Record the observation, then refocus the next batch. The unit is a starting hypothesis, not a contract.

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

## Process

1. **Start a session** — `coding_session_start` once per shell
2. **Pick the unit** — work through [Choosing the unit of analysis](#choosing-the-unit-of-analysis) and commit to trace, span, or session
3. **Inspect** — fetch one entity at the chosen unit (trace / span / session)
4. **Read** — input, output, exceptions, tool calls, retrieved context, and (at session level) the trajectory across child traces
5. **Note** — write one specific sentence describing what went wrong (or skip if correct)
6. **Record** — `px {trace,span,session} add-note <id> --text "..." --identifier "$PHOENIX_CODING_SESSION_ID"`, picking the command that matches the unit committed in step 2. Drop to a finer unit (e.g., trace → span) when an observation is mechanically attributable; reach to a coarser unit (e.g., trace → session) when the observation is cross-trace. Also write the [sidecar annotation](#sidecar-annotation) at the same level so the run is filterable in the Phoenix UI.
7. **Iterate** — move to the next entity; repeat until the sample is exhausted or saturation hits
8. **Hand off** — keep the same shell open for [axial coding](axial-coding.md), then `coding_session_end` to print the UI link

## Inspection

Use `px` to read context at the unit committed in [Choosing the unit](#choosing-the-unit-of-analysis):

- **Trace unit** — read one trace's input → tool calls → retrieved context → output as one story.
- **Span unit** — read one operation's input/output and surrounding spans for context.
- **Session unit** — read the sequence of traces in order; the trajectory (turns, retrievals, tool-call patterns *across* traces) is the data, not any single trace's inputs and outputs.

Drill to a finer unit (trace → span) only when the failure is mechanical or attributable on sight; reach to a coarser unit (trace → session) when the observation is genuinely cross-trace.

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

Use the `add-note` command matching the unit committed in [Choosing the unit](#choosing-the-unit-of-analysis): `px trace add-note`, `px span add-note`, or `px session add-note`. Every call carries `--identifier "$PHOENIX_CODING_SESSION_ID"`.

Passing `--identifier "$PHOENIX_CODING_SESSION_ID"` does two things:
- Tags the note row with the session id, so `GET /v1/projects/<pid>/{trace,span,session}_annotations?identifier=<sess-id>` returns every artifact this run produced.
- Makes the call **upsert** on `(entity_id, name='note', identifier)` — re-running open coding on the same entity within the same session overwrites the prior note instead of appending a second row. (Without `--identifier`, the server stamps a unique `px-{kind}-note:<uuid>` and each call appends.)

```bash
# Trace-level note — single-call failures
px trace add-note <trace-id> \
  --text "Asked about returns; final answer covered shipping policy instead" \
  --identifier "$PHOENIX_CODING_SESSION_ID"

# Span-level note — mechanical or attributable-on-sight failures
px span add-note <span-id> \
  --text "Tool call returned 500 — vendor API unreachable" \
  --identifier "$PHOENIX_CODING_SESSION_ID"

# Session-level note — trajectory failures across multiple turns
px session add-note <session-id> \
  --text "Agent forgot the user's stated dietary restriction by turn 4 and recommended a dish that violated it" \
  --identifier "$PHOENIX_CODING_SESSION_ID"
```

The interactive loop below walks **traces**. To run it at the **session** or **span** unit, swap `px trace list` / `px trace get` / `px trace add-note` / `px trace annotate` for the `px session ...` (or `px span ...`) equivalents and the JSON path `.traceId` for `.sessionId` (or `.context.span_id`). The structure is identical.

```bash
# Walk recent traces, write a trace-level note + sidecar per failing trace
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
