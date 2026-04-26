# Open Coding

Free-form note-writing against sampled traces, before any taxonomy exists. Open coding is step 2 of the 5-step error-analysis workflow: sample → **open code** → axial code → quantify → prioritize. After you pick a sample of traces, read each one and write a short, specific observation of what went wrong. These raw notes become the raw material for [axial coding](axial-coding.md), where they are grouped into named failure categories.

## Process

1. **Inspect** — fetch a span or trace from your sample
2. **Read** — look at input, output, exceptions, tool calls, retrieved context
3. **Note** — write one specific sentence describing what went wrong (or skip if correct)
4. **Record** — attach the note to the span with `px span add-note`
5. **Iterate** — move to the next span; repeat until the sample is exhausted or saturation hits

## Inspection

Use `px` to read span context before writing a note. Sampling commands are covered in SKILL.md's Spans section — this reference assumes you already have a set of span IDs to review.

```bash
# Peek at error spans — input, output, status
px span list --status-code ERROR --limit 20 --format raw --no-progress | jq '
  .[] | {span_id: .context.span_id, name, status_code,
         input: .attributes["input.value"],
         output: .attributes["output.value"]}
'

# Full attribute set for one span (drilldown by span_id — px span get does not exist)
px span list --trace-id <trace-id> --format raw --no-progress \
  | jq '.[] | select(.context.span_id == "<span-id>")'

# Trace-level context — all spans in one trace, ordered by start_time
px trace get <trace-id> --format raw | jq '
  .spans | sort_by(.start_time) | map({name, status_code,
    input: .attributes["input.value"],
    output: .attributes["output.value"]})
'

# Check existing notes on spans you are about to review
# Notes are stored as annotations with name="note"; use --include-notes (not --include-annotations)
px span list --include-notes --limit 10 --format raw --no-progress | jq '
  .[] | select(.notes | length > 0)
  | {span_id: .context.span_id, notes: [.notes[] | .result.explanation]}
'
```

Always pipe through `jq` with `--format raw --no-progress` when scripting.

## Recording Notes

The primary write path is `px span add-note <span-id> --text "..."`.

```bash
# Add a note to a single span
px span add-note <span-id> --text "Cited a product feature that does not exist in the schema"

# Automated loop — tag all error spans with a fixed label (LLM-driven or scripted)
px span list --status-code ERROR --last-n-minutes 60 --format raw --no-progress \
  | jq -r '.[].context.span_id' \
  | while read sid; do
      px span add-note "$sid" --text "error span flagged for review"
    done

# Interactive loop — review each span and write a custom note or skip
px span list --status-code ERROR --last-n-minutes 60 --format raw --no-progress \
  | jq -r '.[].context.span_id' \
  | while read sid; do
      read -p "Note for $sid (blank to skip): " note
      [ -z "$note" ] && continue
      px span add-note "$sid" --text "$note"
    done
```

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
