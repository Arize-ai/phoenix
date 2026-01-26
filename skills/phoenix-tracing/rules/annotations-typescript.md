# TypeScript SDK Annotation Patterns


## Client Setup

```typescript
import { createClient } from "phoenix-client";
const client = createClient();  // Default: http://localhost:6006
// const client = createClient({ baseUrl: "http://phoenix.example.com:6006" });
```

## Type Definitions

```typescript
interface Annotation {
  name: string;
  label?: string;
  score?: number;
  explanation?: string;
  identifier?: string;
  metadata?: Record<string, unknown>;
}

interface SpanAnnotation extends Annotation {
  spanId: string;
  annotatorKind?: "HUMAN" | "LLM" | "CODE";
}

interface DocumentAnnotation extends SpanAnnotation {
  documentPosition: number;  // 0-based index
}

interface TraceAnnotation extends Annotation {
  traceId: string;
  annotatorKind?: "HUMAN" | "LLM" | "CODE";
}

interface SessionAnnotation extends Annotation {
  sessionId: string;
  annotatorKind?: "HUMAN" | "LLM" | "CODE";
}
```

## Span Annotations

```typescript
import { addSpanAnnotation, logSpanAnnotations } from "phoenix-client";

// Single
const result = await addSpanAnnotation({
  client,
  spanAnnotation: {
    spanId: "abc123",
    name: "quality",
    annotatorKind: "HUMAN",
    label: "high_quality",
    score: 0.95,
    explanation: "Accurate and well-formatted",
    identifier: "review_v1",
    metadata: { reviewer: "alice" }
  },
  sync: true
});

// Batch
const results = await logSpanAnnotations({
  client,
  spanAnnotations: [
    {
      spanId: "span1",
      name: "sentiment",
      annotatorKind: "LLM",
      label: "positive",
      score: 0.9
    },
    {
      spanId: "span2",
      name: "sentiment",
      annotatorKind: "LLM",
      label: "negative",
      score: 0.1
    }
  ],
  sync: false
});
```

## Document Annotations

Target specific documents in RETRIEVER spans. **No custom identifiers** - uniquely identified by `(name, spanId, documentPosition)`.

```typescript
import { addDocumentAnnotation, logDocumentAnnotations } from "phoenix-client";

// Single
const result = await addDocumentAnnotation({
  client,
  documentAnnotation: {
    spanId: "retriever_span",
    documentPosition: 0,  // 0-based index
    name: "relevance",
    annotatorKind: "LLM",
    label: "relevant",
    score: 0.95,
    explanation: "Directly answers question",
    metadata: { model: "gpt-4" }
  },
  sync: true
});

// Batch
const results = await logDocumentAnnotations({
  client,
  documentAnnotations: [
    {
      spanId: "span1",
      documentPosition: 0,
      name: "relevance",
      annotatorKind: "LLM",
      label: "relevant",
      score: 0.9
    },
    {
      spanId: "span1",
      documentPosition: 1,
      name: "relevance",
      annotatorKind: "LLM",
      label: "irrelevant",
      score: 0.1
    }
  ],
  sync: false
});
```

## Trace Annotations

Feedback on entire traces (end-to-end interactions).

```typescript
import { addTraceAnnotation, logTraceAnnotations } from "phoenix-client";

// Single
const result = await addTraceAnnotation({
  client,
  traceAnnotation: {
    traceId: "trace_abc",
    name: "correctness",
    annotatorKind: "HUMAN",
    label: "correct",
    score: 1.0,
    explanation: "Accurate and complete",
    identifier: "final_review",
    metadata: { reviewer: "bob" }
  },
  sync: true
});

// Batch
const results = await logTraceAnnotations({
  client,
  traceAnnotations: [
    {
      traceId: "trace1",
      name: "helpfulness",
      annotatorKind: "HUMAN",
      label: "helpful",
      score: 0.9
    },
    {
      traceId: "trace2",
      name: "helpfulness",
      annotatorKind: "LLM",
      label: "not_helpful",
      score: 0.2
    }
  ],
  sync: false
});
```

## Session Annotations

Feedback on multi-turn conversations.

```typescript
import { addSessionAnnotation, logSessionAnnotations } from "phoenix-client";

// Single
const result = await addSessionAnnotation({
  client,
  sessionAnnotation: {
    sessionId: "session_xyz",
    name: "user_satisfaction",
    annotatorKind: "HUMAN",
    label: "satisfied",
    score: 0.85,
    explanation: "Goal achieved",
    identifier: "end_review",
    metadata: { sessionLength: 5 }
  },
  sync: true
});

// Batch
const results = await logSessionAnnotations({
  client,
  sessionAnnotations: [
    {
      sessionId: "session1",
      name: "completion_rate",
      annotatorKind: "CODE",
      score: 1.0,
      label: "completed"
    },
    {
      sessionId: "session2",
      name: "completion_rate",
      annotatorKind: "CODE",
      score: 0.0,
      label: "abandoned"
    }
  ],
  sync: false
});
```

## RAG Pipeline Example

```typescript
import { createClient, logDocumentAnnotations, addSpanAnnotation, addTraceAnnotation } from "phoenix-client";

const client = createClient();

async function annotateRAGPipeline() {
  // Document relevance
  await logDocumentAnnotations({
    client,
    documentAnnotations: [
      { spanId: "retriever_span", documentPosition: 0, name: "relevance",
        annotatorKind: "LLM", label: "relevant", score: 0.95 },
      { spanId: "retriever_span", documentPosition: 1, name: "relevance",
        annotatorKind: "LLM", label: "relevant", score: 0.80 },
      { spanId: "retriever_span", documentPosition: 2, name: "relevance",
        annotatorKind: "LLM", label: "irrelevant", score: 0.10 }
    ]
  });

  // LLM response quality
  await addSpanAnnotation({
    client,
    spanAnnotation: {
      spanId: "llm_span",
      name: "faithfulness",
      annotatorKind: "LLM",
      label: "faithful",
      score: 0.90
    },
    sync: true
  });

  // Overall trace quality
  await addTraceAnnotation({
    client,
    traceAnnotation: {
      traceId: "trace_123",
      name: "correctness",
      annotatorKind: "HUMAN",
      label: "correct",
      score: 1.0,
      metadata: { userFeedback: "thumbs_up" }
    },
    sync: true
  });
}

annotateRAGPipeline().catch(console.error);
```

## Error Handling

```typescript
try {
  const result = await addSpanAnnotation({
    client,
    spanAnnotation: { spanId: "span123", name: "quality", label: "good", score: 0.8 },
    sync: true
  });
  if (result) console.log("Created:", result.id);
} catch (error) {
  console.error("Failed:", error);
}
```
