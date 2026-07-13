---
name: annotate-spans
description: >
  Write effective, consistent annotations on LLM/agent spans and traces, and coach the user on annotation practice. Load this whenever you are about to record structured feedback with the `batch_span_annotate` tool, or when the user asks how to annotate, label, score, or review spans/traces, build a failure taxonomy, or set up human/LLM review. Do NOT load for: pure analysis with no intent to save feedback (use debug-trace), latency or cost statistics, or prompt authoring (use playground).
summary: Create consistent span or trace annotations and help design useful feedback taxonomies.
---

# Annotating Spans and Traces

An annotation is durable, structured feedback attached to a span or trace: a `name` (the dimension being judged), an optional `label` and/or `score` (the outcome), and an `explanation` (why). Annotations are not throwaway commentary — they accumulate into a dataset the user filters, aggregates, and iterates against.

A good annotation earns its place by being useful *later*:

- **Filterable** — `annotations['answer_relevance'].label == 'fail'` returns matching spans; `trace_annotations['task_success'].label == 'fail'` returns spans belonging to matching traces.
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

7. **Be consistent across spans.** The same dimension must use the same `name` and the same label vocabulary everywhere, or filtering and rate computation break. The project's annotation configs *are* that shared vocabulary — annotate into a config's `name` and labels rather than deciding fresh each run (see [Work From the Project's Annotation Configs](#work-from-the-projects-annotation-configs)). Keep names stable across runs (no `_v2`/`_new` suffixes).

8. **Set `annotatorKind` honestly.** `LLM` for your own judgment, `HUMAN` only when recording feedback the user explicitly gave, `CODE` for deterministic checks. Don't record your own opinion as `HUMAN`.

## Work From the Project's Annotation Configs

An **annotation config** is the project's codified rubric for one dimension: a `name`, a type (categorical / continuous / freeform), and the allowed outcomes — a categorical config's `values` (each a `label` with an optional `score`), or a continuous config's `lowerBound`/`upperBound`. Configs are the source of truth for annotation vocabulary: they drive the annotation UI, keep names and labels consistent across runs, and let a later visit reuse the grading criteria instead of reinventing it. Annotate *into* configs rather than inventing a name and label set each time.

Before writing any annotation:

1. **Pull the project's configs first.** Query `Project.annotationConfigs` and read the existing names and their label/score schemes. This is the established rubric — prefer it over anything you would invent. (Resolve the project node id as described in the `phoenix-graphql` skill.)

   ```graphql
   query ProjectAnnotationConfigs($projectId: ID!) {
     node(id: $projectId) {
       ... on Project {
         annotationConfigs(first: 100) {
           edges { node {
             __typename
             ... on AnnotationConfigBase { name description annotationType }
             ... on CategoricalAnnotationConfig { id optimizationDirection values { label score } }
             ... on ContinuousAnnotationConfig { id optimizationDirection lowerBound upperBound }
             ... on FreeformAnnotationConfig { id }
           } }
         }
       }
     }
   }
   ```
2. **Reuse an existing config when one fits.** Annotate with the config's exact `name` and a `label` from its `values` (or a `score` within its bounds). This is what keeps `annotations['tool_selection'].label == 'incorrect'` filterable and aggregatable across runs. A config that already defines the scale also answers questions you would otherwise stop to ask the user (e.g. "what numeric range?") — don't `ask_user` for something a config already specifies.
3. **When a new category emerges that no config covers, codify it before (or as) you annotate** — don't add an ad-hoc annotation and move on. Use the annotation-config tools rather than raw GraphQL mutations; the tools provide the approval surface and the frontend owns the write path.
   - **No close config** → call `create_annotation_config` with the new rubric and the current project's `projectId`, then annotate against that config's `name` after the proposal is accepted.
   - **A config is close but missing a label** → call `update_annotation_config` to replace it with the complete desired scheme, then annotate. Update is a full replace: pass the existing `values` plus the new one, keep the same `name`, and do not omit values you want to keep.

   Codifying first means the next visit to this project rediscovers the criteria instead of growing a second, differently-named rubric for the same thing. Use `type: "categorical" | "continuous" | "freeform"` and set `optimizationDirection` to `MINIMIZE`, `MAXIMIZE`, or `NONE` when it matters.
4. **Surface the choice explicitly.** Tell the user when you reused a config versus proposed a new one or extended an existing one, and why. Naming or changing a rubric is a decision they may want to weigh in on.

**Do not cross-contaminate projects.** Config names are global, and a same-named config may be bound to other projects with different semantics. Prefer configs already associated with *this* project; only create or associate configs for the project in context. Never repurpose another project's rubric just because its name looks right.

## Mode A: Coaching the User

When the user asks *how* to annotate (rather than asking you to do it), teach the process rather than handing over a fixed rubric:

1. **Start from failures they have actually seen.** Resist proposing a polished taxonomy up front — a pre-baked list causes confirmation bias. Ask what's going wrong, or use the `debug-trace` skill to surface real failure modes first.
2. **Open-code before naming.** Encourage free-form notes on a handful of traces ("what's the first thing wrong here?") before committing to category names.
3. **Axial-code into a small vocabulary.** Group similar notes into 5–10 named, mutually distinct, actionable categories. Each should be specific enough that two reviewers would label the same span the same way.
4. **Define the label set per category.** Usually binary. Write a one-sentence definition so the boundary is unambiguous. Once the vocabulary stabilizes, codify each category as an annotation config (see [Work From the Project's Annotation Configs](#work-from-the-projects-annotation-configs)) so the rubric persists and the next session reuses it instead of re-deriving it.
5. **Apply, then aggregate.** Label a representative sample consistently, then compute failure rates to prioritize. Highest-frequency × highest-impact wins.
6. **Fix-first.** Remind the user that many failures (missing prompt instruction, missing tool, retrieval bug) are better *fixed* than measured. Reserve standing annotations/evals for failures they will iterate on repeatedly or that need a guardrail.

Explain *why* a convention matters ("stable names let you trend this over time") rather than only stating it.

## Mode B: Writing Annotations Yourself

When the user asks you to save annotations:

1. **Confirm scope and intent.** Only annotate when the user wants feedback persisted, not during ordinary analysis. Know which spans and which dimension(s) are in scope. If no failure modes are established yet, diagnose first with the `debug-trace` skill, then return here to persist the results — don't re-derive a taxonomy.
2. **Inspect before judging.** Read the actual span input/output (and relevant parent/child spans for context). Never annotate from span status codes alone — a success status can mask an error in attributes, and an exception can be expected behavior.
3. **Pick the dimension(s) from the project's annotation configs.** Pull the configs first and reuse a matching config's `name` and label/score scheme; if a needed category has no config, create or extend one (see [Work From the Project's Annotation Configs](#work-from-the-projects-annotation-configs)) before writing. Then judge every span in the batch on that fixed vocabulary. If you're judging more than one dimension, settle each one's config up front.
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
