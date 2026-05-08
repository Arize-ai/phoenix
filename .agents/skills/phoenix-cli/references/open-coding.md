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

## Coding identifier (pick this first)

Every artifact this workflow produces — open-coding notes, axial-coding labels, the local sidecar files, and the UI-filter annotation — is tagged with one **coding identifier** so the run is queryable, revertible, and viewable as a unit. Pick a **descriptive, unique** identifier before recording any notes. Format suggestion:

    coding-session:<short-topic>-<YYYY-MM-DD>

Examples: `coding-session:chatbot-context-loss-2026-05-06`, `coding-session:agent-tool-misuse-q2`. Descriptive ids carry meaning for whoever opens the data later — better than an opaque uuid. The `coding-session:` prefix is a visual convention; the value is the workflow's coding identifier, not a `px session` id.

> **Workflow term vs. server annotation name.** The skill calls this value the **coding identifier**. The server-side annotation NAME used for the UI filter is unchanged — `coding_session_id` — for data compatibility with rows already written. Don't try to rename it.

Pass the identifier explicitly on every `px` call. A shell variable for readability is fine, but **do not rely on env-var inheritance** — many agent harnesses spawn each command in a fresh subshell, so the env var (`PHOENIX_CODING_IDENTIFIER`) won't propagate.

```bash
IDENT="coding-session:chatbot-context-loss-2026-05-06"
```

The local sidecar lives at `.px/coding/<sanitized-identifier>.jsonl` (CWD-relative, matching the `.px/docs` precedent). Sanitization rule: replace any character not matching `[a-zA-Z0-9_-]` with `-` before using the value in the filename — colons, slashes, and other shell-fragile characters get normalized. For `IDENT="coding-session:chatbot-context-loss-2026-05-06"` the sidecar path is `.px/coding/coding-session-chatbot-context-loss-2026-05-06.jsonl`.

Verify this run hasn't already started — uniqueness is a **local file check**, not a server query:

```bash
SLUG=$(echo -n "$IDENT" | sed 's/[^a-zA-Z0-9_-]/-/g')
SIDECAR=".px/coding/${SLUG}.jsonl"
test ! -f "$SIDECAR" || { echo "Sidecar already exists at $SIDECAR — pick a new identifier or delete the file"; exit 1; }
mkdir -p .px/coding
```

If `$SIDECAR` already exists, append a disambiguator (`-v2`, `-dustin`, etc.) to `IDENT`, re-derive `SLUG`, and re-check. The agent harness can run open coding and axial coding in independent invocations: each step re-derives `SLUG` from `IDENT` and reads/writes the same file.

## Process

1. **Pick a coding identifier** — choose a descriptive value and verify the sidecar file does not yet exist (see [Coding identifier](#coding-identifier-pick-this-first))
2. **Pick the unit** — work through [Choosing the unit of analysis](#choosing-the-unit-of-analysis) and commit to trace, span, or session
3. **Inspect** — fetch one entity at the chosen unit (trace / span / session)
4. **Read** — input, output, exceptions, tool calls, retrieved context, and (at session level) the trajectory across child traces
5. **Note** — write one specific sentence describing what went wrong (or skip if correct)
6. **Record** — `px {trace,span,session} add-note <id> --text "..." --identifier "$IDENT" --format raw --no-progress`, capture the returned `id`, append a JSONL line to the sidecar, then write the matching [UI-filter annotation](#ui-filter-annotation) — see [Recording Notes](#recording-notes) for the full pattern.
7. **Iterate** — move to the next entity; repeat until the sample is exhausted or saturation hits
8. **Hand off** — axial coding reads the sidecar directly (no shared shell required); see [Wrapping up](#wrapping-up) for the UI link

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

Use the `add-note` command matching the unit committed in [Choosing the unit](#choosing-the-unit-of-analysis): `px trace add-note`, `px span add-note`, or `px session add-note`. Every call carries an explicit `--identifier "$IDENT"` and `--format raw --no-progress` so the response can be parsed.

Passing `--identifier "$IDENT"` does two things:
- Tags the note row with the coding identifier on the server, so the cleanup `delete-annotations --identifier "$IDENT" --all` sweep removes every artifact this run produced.
- Makes the call **upsert** on `(entity_id, name='note', identifier)` — re-running open coding on the same entity within the same coding identifier overwrites the prior note instead of appending a second row. (Without `--identifier`, the server stamps a unique `px-{kind}-note:<uuid>` and each call appends.)

After every successful `add-note`, capture the returned `id` and append one JSONL line to the local sidecar `$SIDECAR`. The sidecar is what axial coding reads — no server round-trip.

**Sidecar JSONL line shape (one per `add-note`):**

```json
{"entity_kind":"trace","entity_id":"<trace-id>","note":"<text>","annotation_id":"<id from add-note response>","identifier":"<original IDENT, unsanitized>","ts":"<ISO-8601 UTC>"}
```

Fields:
- `entity_kind` — `"trace"`, `"span"`, or `"session"` (matches the `add-note` subcommand used)
- `entity_id` — the entity argument passed to `add-note` (trace id, span id, or session id)
- `note` — the `--text` value, verbatim
- `annotation_id` — the `id` field from the `add-note --format raw` response (server-assigned)
- `identifier` — the **original** `$IDENT` value, unsanitized; the sanitized form lives only in the filename
- `ts` — ISO-8601 UTC timestamp (e.g. `2026-05-08T17:14:09Z`) of the local append

Examples — each pairs one `px ... add-note` with one sidecar append:

```bash
# Trace-level note — single-call failures
ANN_ID=$(px trace add-note <trace-id> \
  --text "Asked about returns; final answer covered shipping policy instead" \
  --identifier "$IDENT" \
  --format raw --no-progress \
  | jq -r '.id')
jq -nc --arg eid "<trace-id>" --arg id "$ANN_ID" --arg ident "$IDENT" \
  --arg note "Asked about returns; final answer covered shipping policy instead" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{entity_kind:"trace", entity_id:$eid, note:$note, annotation_id:$id, identifier:$ident, ts:$ts}' \
  >> "$SIDECAR" || { echo "FATAL: server POST succeeded but sidecar append to $SIDECAR failed; re-run add-note to resync"; exit 1; }

# Span-level note — mechanical or attributable-on-sight failures
ANN_ID=$(px span add-note <span-id> \
  --text "Tool call returned 500 — vendor API unreachable" \
  --identifier "$IDENT" \
  --format raw --no-progress \
  | jq -r '.id')
jq -nc --arg eid "<span-id>" --arg id "$ANN_ID" --arg ident "$IDENT" \
  --arg note "Tool call returned 500 — vendor API unreachable" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{entity_kind:"span", entity_id:$eid, note:$note, annotation_id:$id, identifier:$ident, ts:$ts}' \
  >> "$SIDECAR" || { echo "FATAL: server POST succeeded but sidecar append to $SIDECAR failed; re-run add-note to resync"; exit 1; }

# Session-level note — trajectory failures across multiple turns
ANN_ID=$(px session add-note <session-id> \
  --text "Agent forgot the user's stated dietary restriction by turn 4 and recommended a dish that violated it" \
  --identifier "$IDENT" \
  --format raw --no-progress \
  | jq -r '.id')
jq -nc --arg eid "<session-id>" --arg id "$ANN_ID" --arg ident "$IDENT" \
  --arg note "Agent forgot the user's stated dietary restriction by turn 4 and recommended a dish that violated it" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{entity_kind:"session", entity_id:$eid, note:$note, annotation_id:$id, identifier:$ident, ts:$ts}' \
  >> "$SIDECAR" || { echo "FATAL: server POST succeeded but sidecar append to $SIDECAR failed; re-run add-note to resync"; exit 1; }
```

### Sidecar-write failure protocol

If the local append fails **after** the server POST already succeeded, the skill **stops with a fatal error** and reports the inconsistency. Do not silently swallow the failure — axial coding would otherwise miss the note. Recovery: re-run the same `add-note` call. The server upsert is idempotent on `(entity_id, name='note', identifier)`, so the second POST overwrites the first server row in place; the agent then re-attempts the sidecar append. The sidecar resyncs on retry.

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
      ANN_ID=$(px trace add-note "$tid" \
        --text "$note" \
        --identifier "$IDENT" \
        --format raw --no-progress \
        | jq -r '.id')
      jq -nc --arg eid "$tid" --arg id "$ANN_ID" --arg ident "$IDENT" \
        --arg note "$note" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{entity_kind:"trace", entity_id:$eid, note:$note, annotation_id:$id, identifier:$ident, ts:$ts}' \
        >> "$SIDECAR" \
        || { echo "FATAL: sidecar append failed after server POST for $tid; re-run add-note"; exit 1; }
      px trace annotate "$tid" \
        --name coding_session_id \
        --label "$IDENT" \
        --identifier "$IDENT"
    done
```

Bulk auto-tagging by status code (e.g. `px span list --status-code ERROR | xargs ... add-note "error"`) is **not open coding** — open coding is manual, observation-grounded, and ranges over all failure modes, not just spans where Python raised. Skip the bulk-by-status-code shortcut; it produces fewer, less informative notes than walking traces.

### UI-filter annotation

Every entity that receives an open-coding note (or an axial-coding label later) also needs a UI-filter annotation so the Phoenix UI can filter by coding identifier. Phoenix's UI filter language is name-based, not identifier-based — there is no UI primitive for filtering by `identifier`, so an annotation whose **name** is the constant `coding_session_id` and whose **label** is the coding identifier value is what the wrap-up UI link actually filters on.

The annotation NAME `coding_session_id` is the load-bearing data key on the server and is **unchanged** in this rewrite. The skill's workflow term is "coding identifier"; the server key stays `coding_session_id` for compatibility with rows already written.

Run this once per touched entity, alongside the `add-note` (and again later when axial coding labels a different entity):

```bash
px trace annotate <trace-id> \
  --name coding_session_id \
  --label "$IDENT" \
  --identifier "$IDENT"
# or px span annotate / px session annotate at matching levels
```

The annotation's `--identifier` matches `$IDENT`, so the [wrap-up DELETE](#wrapping-up) cleans it up in the same call as the notes and the axial-coding labels.

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

## Listing what this run produced

The local sidecar is the source of truth for notes written this run — read it directly:

```bash
# All notes captured this run, oldest first
cat "$SIDECAR" | jq -s 'sort_by(.ts)'

# Just the trace-level notes
jq -c 'select(.entity_kind == "trace")' "$SIDECAR"

# Distinct entities touched (e.g. for handoff to axial coding)
jq -r '.entity_id' "$SIDECAR" | sort -u
```

Malformed lines: each line is independently parseable JSON. If `jq` fails on a line, fix or drop that line — do not edit other lines. Missing-file behavior: an absent sidecar means open coding has not yet started for this coding identifier; treat that as zero notes, not an error.

## Wrapping up

When the run is done, share the Phoenix UI link with the user. The link filters the project's traces page by the `coding_session_id` annotation written alongside each note. The UI route `/projects/:projectId` expects an encoded GraphQL node ID, not a project name — resolve it via `px project get`:

```bash
project_id=$(px project get "$PHOENIX_PROJECT" --format raw --no-progress | jq -r '.id')
encoded=$(python3 -c 'import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))' \
  "annotations['coding_session_id'].label == '$IDENT'")
echo "Phoenix UI: $PHOENIX_HOST/projects/$project_id/traces?filterCondition=$encoded"
```

If the user wants to discard everything this run produced, three identifier-bound deletes handle the server side and one `rm` handles the local sidecars. **Confirm with the user before running** — this is destructive. Each call requires `--all` (or both `--start-time` and `--end-time`) to authorize the sweep; `--identifier` filters further but never authorizes on its own. Set `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true` first if not already exported:

```bash
for kind in trace span session; do
  px "$kind" delete-annotations \
    --identifier "$IDENT" \
    --all -y \
    --format raw --no-progress
done
rm -f "$SIDECAR" ".px/coding/${SLUG}-axial.jsonl"
```

Each `delete-annotations` call covers notes, structured annotations, and the `coding_session_id` annotation in one shot because they share the underlying annotation table.

## Principles

- **One coding identifier per run** — every server artifact and every sidecar line carries the same `$IDENT`; never mint a per-stage id.
- **Pass `--identifier` explicitly** — every `px` call gets `--identifier "$IDENT"`; do not rely on inherited env vars across harness-spawned subshells.
- **Sidecar is source of truth for notes** — axial coding reads from the local sidecar, not from the server; a note that exists server-side but is missing from the sidecar is a fatal inconsistency, not a recoverable lag.
- **Free-form over structured** — do not pre-commit to a taxonomy during open coding; categories emerge in axial coding.
- **Specific over general** — quote or paraphrase the observed failure; vague labels ("bad response") carry no signal.
- **Context before labeling** — inspect input, output, and retrieved context before writing any note.
- **Iterate before categorizing** — work through the full sample first; resist grouping while still collecting.
- **Skip is valid** — a correct span needs no note; annotating everything dilutes signal.
- **Revert is opt-in** — the wrap-up DELETE only runs after explicit user confirmation; the default path prints the UI link and stops.
