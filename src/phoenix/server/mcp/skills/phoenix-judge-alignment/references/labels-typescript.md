# Collect human labels in TypeScript

```typescript
import { createClient } from "@arizeai/phoenix-client";
import { createDataset } from "@arizeai/phoenix-client/datasets";
import { getSpanAnnotations, getSpans } from "@arizeai/phoenix-client/spans";

const client = createClient();
const project = { projectName: "my-app" };
const HUMAN_VERDICT_LABELS = new Set(["pass", "fail"]);

const { spans } = await getSpans({ client, project, parentId: null, limit: 500 });
const { annotations } = await getSpanAnnotations({
  client,
  project,
  spanIds: spans.map((span) => span.context.span_id),
  includeAnnotationNames: ["reviewer_verdict"],
});

// Keep the latest human annotation per span, including a cleared or unsettled label.
const latest = new Map<string, (typeof annotations)[number]>();
for (const annotation of annotations) {
  if (annotation.annotator_kind !== "HUMAN") continue;
  const current = latest.get(annotation.span_id);
  if (!current || annotation.updated_at > current.updated_at) {
    latest.set(annotation.span_id, annotation);
  }
}
const labeled = [...latest.values()].filter((annotation) =>
  HUMAN_VERDICT_LABELS.has(annotation.result?.label ?? "")
);

// Save the labels as a dataset. testIds holds the held-out span IDs when you'll tune
// the judge; drop `splits` when you're only assessing it.
const testIds = new Set<string>(heldOutSpanIds);
const spansById = new Map(spans.map((span) => [span.context.span_id, span]));

await createDataset({
  client,
  name: "reviewer-verdicts-2026-11",
  description: "Latest human reviewer_verdict label per root span",
  examples: labeled.map((annotation) => {
    const span = spansById.get(annotation.span_id);
    return {
      input: {
        question: String(span?.attributes?.["input.value"] ?? ""),
        answer: String(span?.attributes?.["output.value"] ?? ""),
      },
      output: { humanLabel: annotation.result?.label ?? null },
      spanId: annotation.span_id,
      splits: testIds.has(annotation.span_id) ? "test" : "dev", // only when tuning
    };
  }),
});
```

Set `HUMAN_VERDICT_LABELS` to the settled verdicts in the annotation config. Leave
labels such as `unsure` or `skip` out of the set.

- `getSpans` and `getSpanAnnotations` each return one page; follow `nextCursor`
  until it's `null`.
- Filter on `annotator_kind`: the same annotation name can hold `LLM` or `CODE`
  results, including the judge under test.
- Keep the most recent label per record. `updated_at` is an ISO timestamp, so string
  comparison orders it. Drop records without a label instead of treating them as
  passes.
- When the latest human label isn't a verdict (for example, "unsure"), leave the
  record out instead of using an older verdict.
- When the judge and the reviewers annotated different spans of a trace, read
  annotations for all spans in the trace and key both sides by `context.trace_id`.
- Apply any eligibility rules the user gives before deduplicating, and report how
  many records each rule removed.

Trace and session annotations have no read helper in the client. Use `fetch` to call
`GET /v1/projects/{project}/trace_annotations?trace_ids=...`, or
`session_annotations?session_ids=...` for sessions. Pass `include_annotation_names`
to leave out notes and other annotations. The response is `{ data, next_cursor }`,
and each item has `name`, `annotator_kind`, `result`, `identifier`, and
`updated_at`.

## Save the labels as a dataset

The last part of the example above saves the labels. Put the human label in the
reference output and the record being judged in the input. Create a new dataset
rather than editing one that experiments already ran against.
