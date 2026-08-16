# Manual Instrumentation (TypeScript)

Add custom spans using convenience wrappers or withSpan for fine-grained tracing control.

## Setup

```bash
npm install @arizeai/phoenix-otel @arizeai/openinference-core
```

```typescript
import { register } from "@arizeai/phoenix-otel";
register({ projectName: "my-app" });
```

## Quick Reference

| Span Kind | Method | Use Case |
|-----------|--------|----------|
| CHAIN | `traceChain` | Workflows, pipelines, orchestration |
| AGENT | `traceAgent` | Multi-step reasoning, planning |
| TOOL | `traceTool` | External APIs, function calls |
| LLM | `traceLLM` | LLM API calls (prefer auto-instrumentation) |
| RETRIEVER | `traceRetriever` | Vector search, document retrieval |
| RERANKER | `traceReranker` | Document re-ranking |
| EMBEDDING | `traceEmbedding` | Embedding generation |
| GUARDRAIL | `traceGuardrail` | Safety checks, content moderation |
| EVALUATOR | `traceEvaluator` | LLM evaluation |
| PROMPT | `tracePrompt` | Prompt construction, rendering, templating |

Every OpenInference span kind has a matching wrapper. Each `trace*` wrapper is a
shorthand for `withSpan(fn, { ...options, kind })` with `kind` pre-set, so it takes
the same options *except* `kind`. Reach for `withSpan` directly only when you want
`processInput`/`processOutput` to build richer attributes than the default
JSON-serialized `input.value`/`output.value`. All wrappers are re-exported from
`@arizeai/phoenix-otel` as well as `@arizeai/openinference-core`. The kind-specific
wrappers beyond `traceChain`/`traceAgent`/`traceTool` are marked `@experimental` in
`@arizeai/openinference-core`.

## Convenience Wrappers

```typescript
import { traceChain, traceAgent, traceTool } from "@arizeai/openinference-core";

// CHAIN - workflows
const pipeline = traceChain(
  async (query: string) => {
    const docs = await retrieve(query);
    return await generate(docs, query);
  },
  { name: "rag-pipeline" }
);

// AGENT - reasoning
const agent = traceAgent(
  async (question: string) => {
    const thought = await llm.generate(`Think: ${question}`);
    return await processThought(thought);
  },
  { name: "my-agent" }
);

// TOOL - function calls
const getWeather = traceTool(
  async (city: string) => fetch(`/api/weather/${city}`).then(r => r.json()),
  { name: "get-weather" }
);
```

The remaining span kinds have dedicated wrappers too — same call shape, `kind`
pre-set:

```typescript
import {
  traceLLM,
  traceRetriever,
  traceReranker,
  traceEmbedding,
  traceGuardrail,
  traceEvaluator,
  tracePrompt,
} from "@arizeai/openinference-core"; // also re-exported from @arizeai/phoenix-otel

// RETRIEVER - fetch documents (RAG)
const retrieveDocuments = traceRetriever(
  async (query: string) => vectorStore.similaritySearch(query, 5),
  { name: "vector-search" }
);

// EVALUATOR - score output quality (LLM-as-a-judge)
const evaluateAnswer = traceEvaluator(
  async (question: string, answer: string) => judge.score({ question, answer }),
  { name: "answer-evaluation" }
);
```

## withSpan for Custom Attributes

When the default JSON-serialized I/O isn't enough, drop to `withSpan` (or pass
`processInput`/`processOutput` to any `trace*` wrapper) to build richer attributes:

```typescript
import { withSpan, getInputAttributes, getRetrieverAttributes } from "@arizeai/openinference-core";

// RETRIEVER with custom attributes
const retrieve = withSpan(
  async (query: string) => {
    const results = await vectorDb.search(query, { topK: 5 });
    return results.map(doc => ({ content: doc.text, score: doc.score }));
  },
  {
    kind: "RETRIEVER",
    name: "vector-search",
    processInput: (query) => getInputAttributes(query),
    processOutput: (docs) => getRetrieverAttributes({ documents: docs })
  }
);
```

**Options:**

```typescript
withSpan(fn, {
  kind: "RETRIEVER",              // OpenInference span kind
  name: "span-name",              // Span name (defaults to function name)
  processInput: (args) => {},     // Transform input to attributes
  processOutput: (result) => {},  // Transform output to attributes
  attributes: { key: "value" }    // Static attributes
});
```

## Capturing Input/Output

**Always capture I/O for evaluation-ready spans.** Use `getInputAttributes` and `getOutputAttributes` helpers for automatic MIME type detection:

```typescript
import {
  getInputAttributes,
  getOutputAttributes,
  withSpan,
} from "@arizeai/openinference-core";

const handleQuery = withSpan(
  async (userInput: string) => {
    const result = await agent.generate({ prompt: userInput });
    return result;
  },
  {
    name: "query.handler",
    kind: "CHAIN",
    // Use helpers - automatic MIME type detection
    processInput: (input) => getInputAttributes(input),
    processOutput: (result) => getOutputAttributes(result.text),
  }
);

await handleQuery("What is 2+2?");
```

**What gets captured:**

```json
{
  "input.value": "What is 2+2?",
  "input.mime_type": "text/plain",
  "output.value": "2+2 equals 4.",
  "output.mime_type": "text/plain"
}
```

**Helper behavior:**
- Strings → `text/plain`
- Objects/Arrays → `application/json` (automatically serialized)
- `undefined`/`null` → No attributes set

**Why this matters:**
- Phoenix evaluators require `input.value` and `output.value`
- Phoenix UI displays I/O prominently for debugging
- Enables exporting data for fine-tuning datasets

### Custom I/O Processing

Add custom metadata alongside standard I/O attributes:

```typescript
const processWithMetadata = withSpan(
  async (query: string) => {
    const result = await llm.generate(query);
    return result;
  },
  {
    name: "query.process",
    kind: "CHAIN",
    processInput: (query) => ({
      "input.value": query,
      "input.mime_type": "text/plain",
      "input.length": query.length,  // Custom attribute
    }),
    processOutput: (result) => ({
      "output.value": result.text,
      "output.mime_type": "text/plain",
      "output.tokens": result.usage?.totalTokens,  // Custom attribute
    }),
  }
);
```

## Logging pre-built spans via the client (no OpenTelemetry)

When you already have span data — e.g. reconstructing a trace from logs, or copying
spans from one project to another — you can POST them directly with `logSpans` from
`@arizeai/phoenix-client/spans` instead of running the OTel SDK. Spans use Phoenix's
simplified structure, the same shape `getSpans` returns, so spans read from one
project can be logged straight into another.

```typescript
import { logSpans, SpanCreationError } from "@arizeai/phoenix-client/spans";
import type { Span } from "@arizeai/phoenix-client/spans";

const spans: Span[] = [
  {
    name: "answer_question",
    span_kind: "AGENT",
    context: { trace_id: "abc123", span_id: "root01" },
    start_time: "2024-01-01T00:00:00Z",
    end_time: "2024-01-01T00:00:01Z",
    status_code: "OK",
    attributes: { "input.value": "What is Phoenix?" },
  },
];

try {
  const result = await logSpans({
    project: { projectName: "my-app" }, // or { projectId } or a plain project name string
    spans,
  });
  console.log(`Queued ${result.totalQueued} of ${result.totalReceived} spans`);
} catch (error) {
  if (error instanceof SpanCreationError) {
    // All-or-nothing: if any span is invalid or a duplicate, NONE are queued.
    console.error(error.invalidSpans, error.duplicateSpans);
  }
}
```

`logSpans({ project, spans })` returns `{ totalReceived, totalQueued }` (equal on
success). If any span is invalid or duplicates an existing span, no spans are queued
and a `SpanCreationError` is thrown carrying `invalidSpans` (each `{ spanId, traceId,
error }`), `duplicateSpans` (each `{ spanId, traceId }`), and `totalInvalid` /
`totalDuplicates` counts. This function is marked `@experimental` and mirrors the
Python client's `Client.spans.log_spans` (see `instrumentation-manual-python.md`).

## See Also

- **Span attributes:** `span-chain.md`, `span-retriever.md`, `span-tool.md`, etc.
- **Attribute helpers:** https://docs.arize.com/phoenix/tracing/manual-instrumentation-typescript#attribute-helpers
- **Auto-instrumentation:** `instrumentation-auto-typescript.md` for framework integrations
