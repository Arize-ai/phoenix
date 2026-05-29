---
name: annotate-spans
description: >
  Write effective, consistent annotations on LLM/agent spans and traces, and coach the user on annotation practice. Load this whenever you are about to record structured feedback with the `batch_span_annotate` tool, or when the user asks how to annotate, label, score, or review spans/traces, build a failure taxonomy, or set up human/LLM review. Do NOT load for: pure analysis with no intent to save feedback (use debug-trace), latency or cost statistics, or prompt authoring (use playground).
---

# Annotating Spans and Traces

An annotation is durable, structured feedback attached to a span or trace: a `name` (the dimension being judged), an optional `label` and/or `score` (the outcome), and an `explanation` (why). Annotations are not throwaway commentary — they accumulate into a dataset the user filters, aggregates, and iterates against.

A good annotation earns its place by being useful *later*:

- **Filterable** — `annotations['answer_relevance'].label == 'fail'` returns the spans you meant.
- **Aggregatable** — counting labels across spans yields a failure rate that tells the user where to focus.
- **Auditable** — months later, the explanation still justifies the judgment without rerunning anything.
- **Curatable** — failing spans can be pulled into a dataset to drive evals or fixes.

This skill governs the *judgment* behind annotations. The `batch_span_annotate` tool description governs the *mechanics* (one array, ID requirements, update keying); follow both, and never contradict the tool's naming and identifier rules.

## What Makes an Annotation Useful

1. **Grounded in observed behavior, not generic quality vibes.** Annotate what actually went wrong or right in *this* span. "Cited a refund policy that does not exist in the retrieved context" beats a free-floating `hallucination_score: 0.3`. Generic dimensions like `helpfulness` or `coherence` are rarely grounded in the application's real failure modes — prefer names that point at a concrete behavior.

2. **One dimension per annotation.** `name` is the rubric dimension; the outcome lives in `label`/`score`. Use `name: "tool_selection"`, `label: "incorrect"` — not `name: "wrong_tool"`. If you find yourself judging two things at once (e.g., retrieval relevance *and* answer faithfulness), write two annotations.

3. **Target the most specific responsible span.** Annotate the LLM span for model output, the tool span for tool behavior, the retriever span for retrieval quality. Reserve root agent/chain spans for genuinely end-to-end judgments (task success, trajectory). A faithfulness failure pinned to the right LLM span is actionable; the same label on the root span forces the user to hunt.

4. **Judge the first failure, not every downstream symptom.** Errors cascade — bad retrieval produces a bad answer. Annotate the root cause where it occurred. Add a separate annotation downstream only when it reveals an independent problem, not a consequence of the first.

5. **Prefer crisp labels over fuzzy scores.** A binary or small categorical label (`pass`/`fail`, `relevant`/`irrelevant`, `correct`/`partial`/`incorrect`) is easy to apply consistently and easy to aggregate. Use a numeric `score` only when the scale is genuinely meaningful and defined; put the rubric, scale, or threshold in `metadata` so the number is interpretable later.

6. **Explanations are specific observations, not restatements.** Write what you saw, citing the evidence. Good: "Returned chunks about onboarding; user asked about cancellation — no relevant chunk retrieved." Weak: "The retrieval was bad." Always include an explanation for any score, any failure, any unclear label, or any judgment the user might want to revisit.

7. **Be consistent across spans.** The same dimension must use the same `name` and the same label vocabulary everywhere, or filtering and rate computation break. Decide the vocabulary once, then apply it uniformly. Keep names stable across runs (no `_v2`/`_new` suffixes).

8. **Set `annotatorKind` honestly.** `LLM` for your own judgment, `HUMAN` only when recording feedback the user explicitly gave, `CODE` for deterministic checks. Don't record your own opinion as `HUMAN`.

## Mode A: Coaching the User

When the user asks *how* to annotate (rather than asking you to do it), teach the process rather than handing over a fixed rubric:

1. **Start from failures they have actually seen.** Resist proposing a polished taxonomy up front — a pre-baked list causes confirmation bias. Ask what's going wrong, or use the `debug-trace` skill to surface real failure modes first.
2. **Open-code before naming.** Encourage free-form notes on a handful of traces ("what's the first thing wrong here?") before committing to category names.
3. **Axial-code into a small vocabulary.** Group similar notes into 5–10 named, mutually distinct, actionable categories. Each should be specific enough that two reviewers would label the same span the same way.
4. **Define the label set per category.** Usually binary. Write a one-sentence definition so the boundary is unambiguous.
5. **Apply, then aggregate.** Label a representative sample consistently, then compute failure rates to prioritize. Highest-frequency × highest-impact wins.
6. **Fix-first.** Remind the user that many failures (missing prompt instruction, missing tool, retrieval bug) are better *fixed* than measured. Reserve standing annotations/evals for failures they will iterate on repeatedly or that need a guardrail.

Explain *why* a convention matters ("stable names let you trend this over time") rather than only stating it.

## Mode B: Writing Annotations Yourself

When the user asks you to save annotations:

1. **Confirm scope and intent.** Only annotate when the user wants feedback persisted, not during ordinary analysis. Know which spans and which dimension(s) are in scope. If no failure modes are established yet, diagnose first with the `debug-trace` skill, then return here to persist the results — don't re-derive a taxonomy.
2. **Inspect before judging.** Read the actual span input/output (and relevant parent/child spans for context). Never annotate from span status codes alone — a success status can mask an error in attributes, and an exception can be expected behavior.
3. **Pick the dimension(s) and a fixed label vocabulary** before writing, so every span in the batch is judged on the same scale. If you're judging more than one dimension, decide each one's vocabulary up front.
4. **Annotate the right span for each judgment** (principle 3) and the first failure (principle 4). Use only real IDs from context or prior tool results — never guess span IDs.
5. **Write a grounded explanation per annotation** citing the specific evidence in that span.
6. **Batch the related annotations into one `batch_span_annotate` call** and pick the `identifier` to match your intent (annotations are keyed by `(name, span, identifier)`):
   - Use a **stable** identifier that names you as the author — e.g. `pxi` — when the judgment should be *updatable*: re-reviewing the same span and dimension overwrites the prior annotation instead of duplicating it.
   - Use a **descriptive, run-scoped** identifier — e.g. `pxi:tool-misuse-2026-05-29` — for a discrete review batch you may want to query or revert as a unit later. This mirrors the Phoenix CLI's `coding-run:<topic>-<date>` convention: a descriptive id carries meaning for whoever opens the data later, far better than an opaque constant.
   - Either way, the author prefix keeps your annotations distinguishable from human or other-evaluator annotations on the same span. Do not reuse one identifier for two unrelated runs you'd want to revert separately.
7. **Report back** what you annotated, the dimension(s) and vocabulary used, and the distribution of labels — and link to a representative annotated span so the user can verify. Build links from the OpenTelemetry hex IDs in the `spanId`/`traceId` GraphQL fields (never the Relay `id` field): `[short label](/redirects/spans/<spanId>)` for a span, or `[short label](/redirects/traces/<traceId>)` when no single span captures the judgment. A span link lands the user on the exact annotated node.

## Anti-Patterns

- **Generic score columns** (`hallucination_score`, `quality_score`) not tied to a concrete observed behavior.
- **Outcome baked into the name** (`name: "passed_relevance"`) instead of `name: "relevance"`, `label: "pass"`.
- **Inconsistent vocabulary** across spans (`fail` here, `bad` there, `0` elsewhere) — kills filtering and aggregation.
- **Annotating every downstream symptom** of a single root failure.
- **Labeling without an explanation** when the judgment is anything but trivially obvious.
- **Annotating from status codes or metadata** without reading the actual span content.
- **Recording your own judgment as `HUMAN`**, or guessing span IDs.
- **Inventing a taxonomy before reading traces**, when coaching the user.
