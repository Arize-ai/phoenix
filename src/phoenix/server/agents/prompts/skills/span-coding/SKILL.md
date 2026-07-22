---
name: span-coding
description: >
  Open-code Phoenix spans with PXI-owned notes, recover those notes for axial
  coding, and promote stable categories into structured annotations. Load this
  when analyzing spans to discover failure patterns before a taxonomy exists.
summary: Use PXI span notes for span-level open coding, then recover and group them before structured annotation.
---

# Span Coding

Open coding is the exploratory pass: inspect individual spans and write short,
evidence-close notes about concrete behaviors before deciding what the categories are.
Axial coding is the synthesis pass: recover those notes, group recurring patterns, name
actionable categories, and promote stable categories into structured annotations.

The unit of analysis is always the span. Inspect spans first, avoid taxonomy labels while
collecting open notes, and only write structured annotations after the categories have
stabilized.

## Source of Truth

PXI span notes in Phoenix are the durable source of truth for open codes.

- Write open codes with `write_span_note`.
- `write_span_note` always uses identifier `pxi`.
- Each span has at most one current PXI open-coding note; repeated writes update it.
- The tool is server-executed and does not require approval.

The virtual bash filesystem is scratch space, not the canonical note store. Use files under
`/home/user/workspace/.pxi/coding/` for sampled span lists, interim memos, grouping tables,
or draft axial categories when that helps the analysis. Do not dual-write every note to a
file by default; recover durable notes from Phoenix when you need to resume.

## Open Coding

1. Use the `phoenix-graphql` skill and `phoenix-gql` to inspect spans and surrounding trace
   context.
2. Read the span input, output, status, attributes, exceptions, and nearby parent/child spans
   before writing.
3. If the span shows a concrete failure or notable behavior, call `write_span_note` with:

   ```json
   {"spanId": "<16-char OTel span id>", "note": "<specific observation>"}
   ```

4. Write what you saw, not the category you think it belongs to. Good notes cite the observed
   behavior: "Retriever returned onboarding docs for a cancellation question." Weak notes
   jump straight to categories: "retrieval_failure".
5. Skip correct spans. Open coding is a signal-building pass, not a requirement to annotate
   every span.

Do not use `batch_span_annotate` during open coding unless the user has already supplied a
stable rubric. Free-form PXI notes come first; structured annotation comes later.

## Recover PXI Span Notes

Recover PXI notes with a GraphQL query over `Project.spans`, then filter `spanNotes` locally
to `identifier == "pxi"`. There is no `list_span_notes` tool.

```graphql
query RecoverPxiSpanNotes($projectId: ID!, $first: Int = 50, $after: String) {
  node(id: $projectId) {
    ... on Project {
      spans(first: $first, after: $after) {
        edges {
          node {
            spanId
            name
            trace { traceId }
            spanNotes {
              identifier
              explanation
              createdAt
              updatedAt
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
```

Paginate until `hasNextPage` is false or the recovered sample is sufficient. Keep only notes
whose `identifier` is exactly `pxi`. When a span has no PXI note, treat it as uncoded.

## Axial Coding

Use recovered PXI notes as the raw material for axial coding.

1. Group notes that describe the same underlying failure.
2. Name categories for likely causes or fixes, not generic symptoms.
3. Check project annotation configs before creating new structured labels.
4. Use `batch_span_annotate` only after the categories and labels stabilize.
5. Keep optional bash sidecars focused on analysis handoff: grouping tables, current counts,
   and draft taxonomies. The DB notes remain the durable open-coding record.
