---
name: phoenix-open-coding
description: Write free-form notes against sampled Phoenix traces, spans, or sessions. Use when the user wants to make sense of LLM or agent traffic but has no categories yet — "what's going wrong with this agent", "I just instrumented my app, where do I start", "review these traces", "the chatbot keeps losing context", "what kinds of mistakes is the model making", "help me make sense of these conversations" — or any framing that needs grounded observations before categories, even without naming the technique. Precedes phoenix-axial-coding.
summary: Write free-form notes on sampled traces, spans, or sessions.
license: Apache-2.0
metadata:
  author: arize-ai
  version: "1.0.0"
---

# Open Coding

Free-form note-writing against sampled traces, spans, or sessions. Pick a unit, read each sampled entity, and write a short, specific observation of what went wrong. The raw notes feed axial coding (`phoenix-axial-coding`), where they get grouped into named failure categories.

## Choosing the unit of analysis

Pick **trace, span, or session** deliberately before recording — the choice determines what every note and annotation below targets, and a wrong default is expensive to undo mid-run. The unit is where the failure modes you're investigating actually live:

- **Trace** — one input → one output. Classifiers, single-shot summarizers, stateless tool-using agents, single-query RAG.
- **Span** — one operation inside a trace. In-isolation mechanical failures (exception, tool error response, malformed output) or failures attributable on sight to one component.
- **Session** — a sequence of traces sharing a `session.id`. Multi-turn agents where the failure is a *trajectory* — context loss across turns, goal drift, forgotten preferences — that exists only *across* traces.

Three signals to read:

1. **User framing.** "Conversation", "agent forgot", "drift", "across turns" → session. "This trace", "wrong output" → trace. "Exception", "malformed", "the retrieval failed" → span.

2. **Session wiring.** The session id lives at the root span's `session.id` attribute (not a top-level trace field); `""` means absent. List ~200 recent traces and compute how many carry a non-empty session id, how many distinct session ids appear, and the median traces per session. No session ids or median 1 → trace or span level; median 2+ → session level is plausibly right.

3. **Turn structure.** Open one recent trace's root-span `input.value` (it may be large — filter rather than reading wholesale). A single user message → one shot; a message *array* (`[{role: user}, {role: assistant}, ...]`) → a turn of a dialogue that lives at the session level.

State the chosen unit explicitly before recording any note. It can shift if the data demands it — trace-level notes that keep surfacing "the agent never remembers earlier turns" should pivot the next batch to session. The unit is a starting hypothesis, not a contract.

## Coding annotation identifier (pick this first)

Every artifact this workflow produces — open-coding notes, axial-coding labels, and the local sidecar files — is tagged with one **coding annotation identifier** so the run is queryable and revertible as a unit. Pick a descriptive, unique value before recording, e.g. `coding-run:chatbot-context-loss-2026-05-06`. (The `coding-run:` prefix is a naming convention; the value is not a Phoenix session id.)

Pass the identifier explicitly on every server write. A shell variable is fine for readability, but do not rely on shell inheritance — many agent harnesses spawn each command in a fresh subshell.

The local sidecar lives at `.px/coding/<sanitized-identifier>.jsonl` (CWD-relative); sanitization replaces every character outside `[a-zA-Z0-9_-]` with `-`. Uniqueness is a **local file check**, not a server query:

```bash
CODING_ANNOTATION_IDENTIFIER="coding-run:chatbot-context-loss-2026-05-06"
SLUG=$(echo -n "$CODING_ANNOTATION_IDENTIFIER" | sed 's/[^a-zA-Z0-9_-]/-/g')
NOTES_SIDECAR=".px/coding/${SLUG}.jsonl"
test ! -f "$NOTES_SIDECAR" || { echo "Sidecar already exists at $NOTES_SIDECAR — pick a new identifier or delete the file"; exit 1; }
mkdir -p .px/coding
```

If `$NOTES_SIDECAR` already exists, append a disambiguator (`-v2`, `-dustin`, etc.) and re-check. Open coding and axial coding may run in independent invocations: each step re-derives `SLUG` from the same identifier and reads/writes the same file.

## Process

1. **Pick a coding annotation identifier** and verify the sidecar does not yet exist
2. **Pick the unit** — trace, span, or session
3. **Inspect** — fetch one entity at the chosen unit and read its input, output, exceptions, tool calls, retrieved context, and (at session level) the trajectory across child traces
4. **Note** — write one specific sentence describing what went wrong, or skip if correct
5. **Record** — write the note to the server and append a sidecar row
6. **Iterate** until the sample is exhausted or saturation hits
7. **Hand off** — axial coding reads the sidecar directly

## Inspection

- **Trace unit** — read one trace's input → tool calls → retrieved context → output as one story.
- **Span unit** — read one operation's input/output and surrounding spans for context.
- **Session unit** — read the sequence of traces in order; the trajectory across traces is the data, not any single trace.

> **Don't sample by span status `ERROR`.** OTel's `status_code` only flips to `ERROR` when an instrumentor catches a raised exception. Hallucinations, wrong tone, retrieval misses, and bad tool selection all complete cleanly as `OK` or `UNSET` — filtering to error status excludes the population this workflow exists to surface.

Whatever the tooling, the fetches are: **sample** recent traces (trace id, root span name, status, root-span `input.value` / `output.value`); **expand** one trace into its spans ordered by start time; **drill** into a single span by id when the unit is the span; and **check existing notes** on entities you are about to review — notes are stored server-side as annotations with the reserved name `note`. As always, be aware that the data may be verbose, so take care not to blow up the context.

## Recording Notes

For each session, trace, or span you inspect, submit a note to the server and also save a local copy. Every write should carry the note text and an explicit `identifier` set to the coding annotation identifier.

After every successful note write to the server, append one JSONL line to `$NOTES_SIDECAR` — the sidecar is what axial coding reads, with no server round-trip:

```json
{"entity_kind":"trace","entity_id":"<trace-id>","note":"<text>","identifier":"<original identifier value, unsanitized>","ts":"<ISO-8601 UTC>"}
```

## What Makes a Good Note

Write what you saw, not the category you think it belongs to — categorization happens in axial coding.

| Weak note         | Good note                                                           |
| ----------------- | ------------------------------------------------------------------- |
| "Wrong answer"    | "Said the store closes at 6pm but policy is 9pm"                    |
| "Retrieval issue" | "Retrieved docs about shipping when the question was about returns" |

## Saturation

Stop when observations stop being new: the last 10–15 entities repeat failures you've already seen, you catch yourself paraphrasing earlier notes, or skips outnumber notes. Resist grouping into categories while still collecting; at saturation, move on to axial coding. You do not need to annotate every trace — annotating correct ones dilutes signal.

## Wrapping up

Hand off to `phoenix-axial-coding`, which reads `$NOTES_SIDECAR` directly. If the run ends here instead, follow that skill's **Wrapping up** section for the two closing moves: sharing the Phoenix UI link filtered to this run's coding annotation identifier, and — only with explicit user confirmation — the identifier-bound delete sweep plus sidecar removal that discards everything the run produced.
