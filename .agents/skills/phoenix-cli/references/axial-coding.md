# Axial Coding

Group open-ended notes into structured failure taxonomies. Axial coding is **step 3** of the 5-step error-analysis workflow: sample → open code → **axial code** → quantify → prioritize. See [open-coding.md](open-coding.md) for step 2 (adding open-coding notes to spans).

## Process

1. **Gather** - Collect open coding notes from reviewed spans
2. **Pattern** - Group notes with common themes
3. **Name** - Create actionable category names
4. **Quantify** - Count failures per category

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

### 1. Gather — extract open-coding notes

Open-coding notes are stored as annotations with `name="note"` and are only returned when `--include-notes` is passed. Use `--include-annotations` instead and you will get structured annotations but **not** notes — the server excludes notes from the annotations array.

```bash
px span list --include-notes --format raw --no-progress | jq '
  [ .[] | select(.notes | length > 0) ]
  | map({
      span_id: .context.span_id,
      notes: [ .notes[].result.explanation ]
    })
'
```

### 2. Group — synthesize categories

Review the note text collected above. Manually identify recurring themes and draft candidate category names. Aim for MECE coverage: each note should fit exactly one category.

### 3. Record — write axial-coding annotations

Write one annotation per span using `px span annotate`. See the **Recording** section below.

### 4. Quantify — count per category

After recording, use `--include-annotations` to count how many spans carry each label:

```bash
px span list --include-annotations --format raw --no-progress | jq '
  [ .[] | .annotations[]? | select(.name == "failure_category" and .result.label != null) ]
  | group_by(.result.label)
  | map({ label: .[0].result.label, count: length })
  | sort_by(-.count)
'
```

Filter to a specific annotation name to check coverage:

```bash
px span list --include-annotations --format raw --no-progress | jq '
  [ .[] | select(.annotations | map(select(.name == "failure_category")) | length > 0) ]
  | length
'
```

## Recording

Use `px span annotate` to write an axial-coding label for each span:

```bash
px span annotate <span-id> \
  --name failure_category \
  --label hallucination \
  --explanation "invented a feature that does not exist" \
  --annotator-kind HUMAN
```

Accepted flags: `--name`, `--label`, `--score`, `--explanation`, `--annotator-kind` (`HUMAN`, `LLM`, `CODE`). There are no `--identifier` or `--sync` flags on this command.

### Bulk recording

Stream span IDs from `px span list` and apply `px span annotate` per span:

```bash
px span list --status-code ERROR --format raw --no-progress \
  | jq -r '.[].context.span_id' \
  | while read sid; do
      px span annotate "$sid" \
        --name failure_category \
        --label hallucination \
        --annotator-kind HUMAN
    done
```

Aside: for Node-based bulk scripts, `@arizeai/phoenix-client` exposes `addSpanAnnotation` and `addSpanNote`.

Aside: `px api graphql` rejects mutations — it cannot write annotations.

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

To find where failures occur between agent states, identify the last-OK span before each first-ERROR span within a trace:

```bash
px span list --format raw --no-progress | jq '
  group_by(.context.trace_id)
  | map(
      sort_by(.start_time)
      | { trace_id: .[0].context.trace_id,
          last_ok:    map(select(.status_code == "OK"))    | last | .name,
          first_err:  map(select(.status_code == "ERROR")) | first | .name }
    )
  | [ .[] | select(.first_err != null) ]
  | group_by([.last_ok, .first_err])
  | map({ transition: "\(.[0].last_ok) → \(.[0].first_err)", count: length })
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

- **MECE** - Each failure fits ONE category
- **Actionable** - Categories suggest fixes
- **Bottom-up** - Let categories emerge from data
