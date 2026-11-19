# Score traces in TypeScript

Read records from a Phoenix project, run evaluators over them, and log the results
back as annotations. The level you read is the level you annotate.

| Level | Read | Log |
| ----- | ---- | --- |
| Span | `getSpans` | `logSpanAnnotations` |
| Trace | root spans from `getSpans({ parentId: null })` | `logTraceAnnotations` |
| Session | `listSessions`, then `getSessionTurns` | `logSessionAnnotations` |
| Document | retriever spans | `logDocumentAnnotations` |

All of these are in `@arizeai/phoenix-client/spans`, `/traces`, and `/sessions`.

## Score spans or traces

```typescript
import { createClient } from "@arizeai/phoenix-client";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";
import { logTraceAnnotations } from "@arizeai/phoenix-client/traces";

const client = createClient();

const { spans } = await getSpans({
  client,
  project: { projectName: "my-app" },
  parentId: null, // root spans: one per trace
  limit: 500,
});

const results = await Promise.all(
  spans.map(async (span) => {
    const result = await answersQuestion.evaluate({
      input: String(span.attributes?.["input.value"] ?? ""),
      output: String(span.attributes?.["output.value"] ?? ""),
    });
    return { span, result };
  })
);

await logSpanAnnotations({
  client,
  spanAnnotations: results.map(({ span, result }) => ({
    spanId: span.context.span_id,
    name: "answers_question",
    label: result.label,
    score: result.score,
    explanation: result.explanation,
    annotatorKind: "LLM",
  })),
  sync: true,
});

// The same result as a trace annotation:
await logTraceAnnotations({
  client,
  traceAnnotations: results.map(({ span, result }) => ({
    traceId: span.context.trace_id,
    name: "answers_question",
    label: result.label,
    score: result.score,
    explanation: result.explanation,
    annotatorKind: "LLM",
  })),
  sync: true,
});
```

- `getSpans` returns one page. Pass the returned `nextCursor` back as `cursor` until
  it's `null` to read everything.
- `getSpans` filters by `traceIds`, `spanIds`, `parentId`, `name`, `spanKind`,
  `statusCode`, and `attributes`. It has no filter expression; the Python client and
  `px span list` do.
- Span attribute values are `unknown`. Convert them with `String(...)` or parse JSON
  before passing them to an evaluator.
- A failed judge call rejects. Catch it per record, count it, and leave that record
  out of the logged annotations instead of logging an empty one.
- `Promise.all` sends every judge call at once. For more than a few dozen records,
  run them in batches to stay under the provider's rate limit.
- Logging is asynchronous unless `sync: true`. An annotation with the same name on
  the same record replaces the old one unless you set a distinct `identifier`.

## Score sessions

```typescript
import {
  getSessionTurns,
  listSessions,
  logSessionAnnotations,
} from "@arizeai/phoenix-client/sessions";

const sessions = await listSessions({ client, projectName: "my-app" });

const sessionAnnotations = await Promise.all(
  sessions.map(async (session) => {
    const turns = await getSessionTurns({ client, sessionId: session.sessionId });
    const conversation = turns
      .map((turn) => `User: ${turn.input?.value ?? ""}\nAssistant: ${turn.output?.value ?? ""}`)
      .join("\n");
    const result = await resolvedJudge.evaluate({ conversation });
    return {
      sessionId: session.sessionId,
      name: "resolved",
      label: result.label,
      score: result.score,
      explanation: result.explanation,
      annotatorKind: "LLM" as const,
    };
  })
);

await logSessionAnnotations({ client, sessionAnnotations, sync: true });
```

Each turn's input and output come from its trace's root span, without tool calls.
When the judge needs tool calls and results, or the conversation lives on an LLM
span's message list, read each turn's spans with
`getSpans({ traceIds: [turn.traceId] })` and add them to the transcript.

## Keep scoring new traces

For a script that runs again as traces arrive, skip a record only when its
annotation came from the current evaluator version and is newer than the record's
last activity. Store the version in the annotation's `metadata`. After you change
the evaluator, rescore everything. For spans:

```typescript
import { getSpanAnnotations } from "@arizeai/phoenix-client/spans";

const { annotations } = await getSpanAnnotations({
  client,
  project: { projectName: "my-app" },
  spanIds: spans.map((span) => span.context.span_id),
  includeAnnotationNames: ["answers_question"],
});
const scored = new Set(annotations.map((annotation) => annotation.span_id));
const toScore = spans.filter((span) => !scored.has(span.context.span_id));
```

`getSpanAnnotations` is paged like `getSpans`. Print how many records the script
scored, skipped, and failed, and exit nonzero when evaluator calls failed.
