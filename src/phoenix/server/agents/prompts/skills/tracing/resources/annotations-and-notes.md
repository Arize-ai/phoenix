# Annotations and Notes

Annotations and notes are **feedback attached after the fact** to a span, trace, or session — separate
from the OpenInference attributes the instrumentation emitted. They are how human judgment, LLM
judgments, and open-coding observations get recorded against trace data.

## Annotations

An annotation is durable, structured feedback with:

- `name` — the dimension being judged (e.g. `answer_relevance`, `tool_selection`).
- `label` and/or `score` — the outcome (`"pass"`, `"fail"`, `0.9`).
- `explanation` — why.
- `annotatorKind` — **who produced it**: `HUMAN`, `LLM`, or `CODE`.
- `metadata`, `identifier`, `createdAt`/`updatedAt`.

GraphQL: `Span.spanAnnotations { name label score explanation annotatorKind }`,
`Trace.traceAnnotations { … }`. In a span `filterCondition`: `annotations['<name>'].label == 'fail'`
or `annotations['<name>'].score < 0.5` (the legacy alias `evals['<name>']` also works).

### `annotatorKind` is the trust signal

The same annotation shape carries very different authority depending on who made it:

- **`HUMAN` — the closest thing to a source of truth.** A person deliberately recorded this judgment.
  Treat human annotations as ground truth for evaluating LLM/agent behavior: they are what you calibrate
  automated evals *against*, not just one opinion among many. When a human label and an LLM label
  disagree, the human label wins for measuring quality.
- **`LLM` — a judgment, useful but fallible.** Produced by an LLM-as-judge (including you). Strong signal
  at scale, but it can be wrong or biased; validate it against human labels before trusting a rate built
  from it.
- **`CODE` — a deterministic check.** A code evaluator's result (regex match, JSON-valid, exact-match).
  Reliable within the narrow thing it checks.

Practical consequences:

- **Never record your own judgment as `HUMAN`.** If you (an LLM) annotate, it is `LLM`. Reserve `HUMAN`
  for feedback a person explicitly gave.
- **When measuring model quality, prefer human annotations as the reference set.** Report LLM/CODE
  annotations as automation to be checked against that reference, not as equivalents.
- **Filtering and aggregation depend on consistent `name` + label vocabulary** across spans — the same
  dimension must always use the same name and label set, regardless of annotator kind.

## Notes

A **note** is a special annotation with `name == "note"`. It carries only an `explanation` (free-form
text) and an author — no `label` or `score`. Notes are **open coding**: a reviewer's or an LLM's
raw, unstructured observation about a span/trace/session *before* it has been distilled into a named,
scored dimension.

- Modeled as an annotation named `note`, so it lives alongside real annotations but is queried/filtered
  as its own thing. The UI and CLI treat `name: "note"` specially: annotation views typically **exclude**
  `note` (`filter: { exclude: { names: ["note"] } }`), and notes views **include only** it
  (`filter: { include: { names: ["note"] } }`). CLI mirrors this: `px … add-note` writes a note;
  `--include-notes` surfaces the `notes[]` array separately from `annotations[]`.
- A note captures an *opinion of a specific user or LLM* — "the retriever returned onboarding docs for a
  cancellation question" — without yet committing to a category name or a pass/fail scale.
- Notes are the input to the coding workflow: open-code with free-form notes first, then axial-code them
  into named annotation dimensions with fixed label vocabularies. See the `annotate-spans` skill for
  turning notes into structured annotations, and `debug-trace` for the diagnosis loop that produces them.

## Annotation vs. note — quick contrast

| | Annotation | Note |
| --- | --- | --- |
| `name` | the judged dimension | always `"note"` |
| Outcome | `label` and/or `score` | none — `explanation` only |
| Purpose | structured, filterable, aggregatable feedback | free-form open-coding observation |
| Stage | after you've named a dimension | before — raw observation |
| Trust | read via `annotatorKind` (`HUMAN` ≈ ground truth) | an opinion of one user/LLM; not a verdict |
