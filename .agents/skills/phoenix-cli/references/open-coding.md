# Open Coding

Free-form note-writing against sampled traces, before any taxonomy exists. Open coding is step 2 of the 5-step error-analysis workflow: sample → **open code** → axial code → quantify → prioritize. After you pick a sample of traces, read each one and write a short, specific observation of what went wrong. These raw notes become the raw material for [axial coding](axial-coding.md), where they are grouped into named failure categories.

**Reach for this whenever** the user wants to look at traces or spans without a fixed taxonomy yet — e.g., "what's going wrong with this agent", "I just instrumented my app, where do I start", "review these traces", "what kinds of mistakes is the model making", "help me make sense of these outputs", or any framing that needs grounded observations before categories.

## Process

1. **Inspect** — fetch a trace from your sample, then drill to the relevant span
2. **Read** — look at input, output, exceptions, tool calls, retrieved context
3. **Note** — write one specific sentence describing what went wrong (or skip if correct)
4. **Record** — attach the note to the span with `px span add-note`
5. **Iterate** — move to the next trace; repeat until the sample is exhausted or saturation hits

## Inspection

Use `px` to read trace and span context before writing a note. Open coding samples by **trace** — read the input → tool calls → retrieved context → output as a unit, then drill to the specific span the failure landed on.

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

# Check existing notes on spans you are about to review
# Notes are stored as annotations with name="note"; use --include-notes (not --include-annotations)
px span list --include-notes --limit 10 --format raw --no-progress | jq '
  .[] | select(.notes | length > 0)
  | {span_id: .context.span_id, notes: [.notes[] | .result.explanation]}
'
```

Always pipe through `jq` with `--format raw --no-progress` when scripting.

## Recording Notes

The primary write path is `px span add-note <span-id> --text "..."`. Notes are span-level — when a trace fails, attach the note to the span the failure landed on (often the LLM or tool span, not always the root).

```bash
# Add a note to a single span
px span add-note <span-id> --text "Cited a product feature that does not exist in the schema"

# Interactive loop — walk a trace sample, drill to a span, write a note
px trace list --last-n-minutes 60 --limit 50 --format raw --no-progress \
  | jq -r '.[].traceId' \
  | while read tid; do
      echo "── trace $tid ──"
      px trace get "$tid" --format raw | jq '
        .spans | sort_by(.start_time)
        | map({span_id: .context.span_id, name, status_code,
               output: .attributes["output.value"]})
      '
      read -p "Span ID to annotate (blank to skip trace): " sid
      [ -z "$sid" ] && continue
      read -p "Note for $sid: " note
      [ -z "$note" ] && continue
      px span add-note "$sid" --text "$note"
    done
```

Bulk auto-tagging by status code (e.g. `px span list --status-code ERROR | xargs ... add-note "error"`) is **not open coding** — open coding is manual, observation-grounded, and ranges over all failure modes, not just spans where Python raised. Skip the bulk-by-status-code shortcut; it produces fewer, less informative notes than walking traces.

**Fallback write paths (one-line asides):**

- `POST /v1/span_notes` — accepts one `{data: {span_id, note}}` object per request (not a batch array); use for scripted writes outside the CLI.
- `@arizeai/phoenix-client` `addSpanNote` — wraps the same REST endpoint; single-call-per-note, no batch efficiency.
- `px api graphql` rejects mutations with `"Only queries are permitted."` — use `px span add-note` or the REST endpoint instead.

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

- **Repeats** — the last 10–15 spans produced notes that describe failures you've already seen.
- **Paraphrase convergence** — you catch yourself writing minor variations of earlier notes.
- **Skips outnumber notes** — most recent spans are correct and need no note.

At saturation, move on to [axial coding](axial-coding.md) to group what you have. Continuing past saturation adds spans but not insight. You do not need to annotate every span — annotating correct spans dilutes signal.

## Principles

- **Free-form over structured** — do not pre-commit to a taxonomy during open coding; categories emerge in axial coding.
- **Specific over general** — quote or paraphrase the observed failure; vague labels ("bad response") carry no signal.
- **Context before labeling** — inspect input, output, and retrieved context before writing any note.
- **Iterate before categorizing** — work through the full sample first; resist grouping while still collecting.
- **Skip is valid** — a correct span needs no note; annotating everything dilutes signal.
