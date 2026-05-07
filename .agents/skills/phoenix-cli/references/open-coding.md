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

2. **Data shape.** Probe before the loop. The session id lives at `rootSpan.attributes["session.id"]` (it is *not* a top-level field on the trace JSON), and is `""` for traces that aren't session-wired — filter both:

   ```bash
   px trace list --limit 200 --format raw --no-progress \
     | jq '
       [ .[] | .rootSpan.attributes["session.id"] // empty | select(. != "") ]
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

## Coding session identifier (pick this first)

Every artifact this workflow produces — open-coding notes, axial-coding annotations, and a UI-filter sidecar — is tagged with one identifier so the run is queryable, revertible, and viewable as a unit. Pick a **descriptive, unique** identifier before recording any notes. Format suggestion:

    coding-session:<short-topic>-<YYYY-MM-DD>

Examples: `coding-session:chatbot-context-loss-2026-05-06`, `coding-session:agent-tool-misuse-q2`. Descriptive ids carry meaning for whoever opens the data later — better than an opaque uuid.

Verify the id isn't already in use in this project (any of the three kinds — they share the underlying annotation table). One read, expect zero rows:

```bash
export PHOENIX_CODING_SESSION_ID="coding-session:chatbot-context-loss-2026-05-06"

px trace list-annotations --identifier "$PHOENIX_CODING_SESSION_ID" --format raw --no-progress \
  | jq 'length'
# Expect 0. If non-zero, append a disambiguator (-v2, -dustin, etc.) and re-check.
```

Keep the same shell open through axial coding — the env var persists, and [axial-coding.md](axial-coding.md) reads the same `PHOENIX_CODING_SESSION_ID`. If you start axial coding in a fresh shell, just `export PHOENIX_CODING_SESSION_ID=...` again with the same value.

## Process

1. **Pick a session id** — choose a descriptive identifier and verify uniqueness (see [Coding session identifier](#coding-session-identifier-pick-this-first))
2. **Pick the unit** — work through [Choosing the unit of analysis](#choosing-the-unit-of-analysis) and commit to trace, span, or session
3. **Inspect** — fetch one entity at the chosen unit (trace / span / session)
4. **Read** — input, output, exceptions, tool calls, retrieved context, and (at session level) the trajectory across child traces
5. **Note** — write one specific sentence describing what went wrong (or skip if correct)
6. **Record** — `px {trace,span,session} add-note <id> --text "..." --identifier "$PHOENIX_CODING_SESSION_ID"` plus the matching [sidecar annotation](#sidecar-annotation) — see [Recording Notes](#recording-notes) for the full pattern and unit-shifting.
7. **Iterate** — move to the next entity; repeat until the sample is exhausted or saturation hits
8. **Hand off** — keep the same shell open for [axial coding](axial-coding.md), then share the UI link from [Wrapping up](#wrapping-up)

## Inspection

Use `px` to read context at the unit committed in [Choosing the unit](#choosing-the-unit-of-analysis):

- **Trace unit** — read one trace's input → tool calls → retrieved context → output as one story.
- **Span unit** — read one operation's input/output and surrounding spans for context.
- **Session unit** — read the sequence of traces in order; the trajectory (turns, retrievals, tool-call patterns *across* traces) is the data, not any single trace's inputs and outputs.

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

Interactive loop — walks traces; for span or session units, swap `px trace` for `px span` / `px session` and the JSON path (`.traceId` → `.context.span_id` / `.session_id`) accordingly:

```bash
px trace list --last-n-minutes 60 --limit 50 --format raw --no-progress \
  | jq -r '.[].traceId' \
  | while read tid; do
      echo "── trace $tid ──"
      px trace get "$tid" --format raw | jq '
        {input: .rootSpan.attributes["input.value"],
         output: .rootSpan.attributes["output.value"]}
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

Every entity that receives an open-coding note (or an axial-coding annotation later) also needs a sidecar annotation so the Phoenix UI can filter by session. Phoenix's UI filter language is name-based, not identifier-based — there is no UI primitive for filtering by `identifier`, so a sidecar annotation whose **name** is constant and whose **label** is the session id is what the wrap-up UI link actually filters on.

Run this once per touched entity, alongside the `add-note` (and again later when axial coding annotates a different entity):

```bash
px trace annotate <trace-id> \
  --name coding_session_id \
  --label "$PHOENIX_CODING_SESSION_ID" \
  --identifier "$PHOENIX_CODING_SESSION_ID"
# or px span annotate / px session annotate at matching levels
```

The sidecar's identifier matches the session id, so the [wrap-up DELETE](#wrapping-up) cleans it up in the same call as the notes and the axial-coding annotations.

**Fallback write paths (one-line asides):**

- `POST /v1/trace_notes` and `POST /v1/span_notes` and `POST /v1/session_notes` — accept one `{data: {trace_id|span_id|session_id, note, identifier}}` per request; the optional `identifier` field upserts on `(entity_id, name='note', identifier)` when non-empty.
- `@arizeai/phoenix-client` `addTraceNote`, `addSpanNote`, and `addSessionNote` wrap the same endpoints and accept an optional `identifier` field on the note object.
- The GraphQL endpoint rejects mutations with `"Only queries are permitted."` — write through `px {trace,span,session} add-note` or the REST endpoints above.

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

At any time during the run you can list every artifact tagged with the current session id. The `--include-notes` flag opts in to the `name="note"` rows that the GET endpoint excludes by default:

```bash
# All notes + structured annotations + sidecars across the three entity kinds
for kind in trace span session; do
  px "$kind" list-annotations \
    --identifier "$PHOENIX_CODING_SESSION_ID" \
    --include-notes \
    --format raw --no-progress \
    | jq --arg kind "$kind" '{kind: $kind, rows: .}'
done
```

## Wrapping up

When the session is done, share the Phoenix UI link with the user. The link filters the project's traces page by the sidecar annotation. The UI route `/projects/:projectId` expects an encoded GraphQL node ID, not a project name — resolve it via `px project get`:

```bash
project_id=$(px project get "$PHOENIX_PROJECT" --format raw --no-progress | jq -r '.id')
encoded=$(python3 -c 'import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))' \
  "annotations['coding_session_id'].label == '$PHOENIX_CODING_SESSION_ID'")
echo "Phoenix UI: $PHOENIX_HOST/projects/$project_id/traces?filterCondition=$encoded"
```

If the user wants to discard everything this session produced, three identifier-bound deletes handle it. **Confirm with the user before running** — this is destructive. Each call requires `--all` (or both `--start-time` and `--end-time`) to authorize the sweep; narrowers like `--identifier` filter further but never authorize on their own. Set `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true` first if not already exported:

```bash
for kind in trace span session; do
  px "$kind" delete-annotations \
    --identifier "$PHOENIX_CODING_SESSION_ID" \
    --all -y \
    --format raw --no-progress
done
```

Each call covers notes, structured annotations, and sidecars in one shot because they share the underlying annotation table.

## Principles

- **One identifier per session** — every artifact carries `$PHOENIX_CODING_SESSION_ID`; never mint a per-stage id.
- **Free-form over structured** — do not pre-commit to a taxonomy during open coding; categories emerge in axial coding.
- **Specific over general** — quote or paraphrase the observed failure; vague labels ("bad response") carry no signal.
- **Context before labeling** — inspect input, output, and retrieved context before writing any note.
- **Iterate before categorizing** — work through the full sample first; resist grouping while still collecting.
- **Skip is valid** — a correct span needs no note; annotating everything dilutes signal.
- **Revert is opt-in** — the wrap-up DELETE only runs after explicit user confirmation; the default path prints the UI link and stops.
