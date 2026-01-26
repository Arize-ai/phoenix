# Manual Instrumentation (TypeScript)

Add custom spans to your LLM applications using OpenInference tracing helpers.

## Setup

```bash
npm install @arizeai/phoenix-otel @arizeai/openinference-core
```

```typescript
import { register } from "@arizeai/phoenix-otel";
register({ projectName: "my-app" });
```

## Core API

### Convenience Wrappers

Three span kinds have dedicated wrappers:

```typescript
import { traceChain, traceAgent, traceTool } from "@arizeai/openinference-core";

// CHAIN - workflows, pipelines
const myPipeline = traceChain(
  async (query: string) => {
    const docs = await retrieve(query);
    return await generate(docs, query);
  },
  { name: "rag-pipeline" }
);

// AGENT - multi-step reasoning
const myAgent = traceAgent(
  async (question: string) => {
    const docs = await retriever(question);
    return `Answer: ${docs.join("\n")}`;
  },
  { name: "my-agent" }
);

// TOOL - external function calls
const getWeather = traceTool(
  async (city: string) => {
    const res = await fetch(`https://api.weather.com/${city}`);
    return res.json();
  },
  { name: "get-weather" }
);
```

### withSpan (All Span Kinds)

Use `withSpan` for other span kinds or custom attribute handling:

```typescript
import { withSpan, getInputAttributes, getRetrieverAttributes } from "@arizeai/openinference-core";

// RETRIEVER with custom attributes
const retriever = withSpan(
  async (query: string) => {
    const results = await vectorDb.search(query, { topK: 5 });
    return results.map((doc) => ({ content: doc.text, score: doc.score }));
  },
  {
    kind: "RETRIEVER",
    name: "vector-search",
    processInput: (query) => getInputAttributes(query),
    processOutput: (documents) => getRetrieverAttributes({ documents }),
  }
);
```

## Span Kinds Reference

| Kind | Wrapper | Use Case |
|------|---------|----------|
| `CHAIN` | `traceChain` | Workflows, pipelines, orchestration |
| `AGENT` | `traceAgent` | Multi-step reasoning, planning |
| `TOOL` | `traceTool` | External APIs, function calls |
| `RETRIEVER` | `withSpan` | Vector search, document retrieval |
| `LLM` | `withSpan` | LLM API calls (prefer auto-instrumentation) |
| `EMBEDDING` | `withSpan` | Generating embeddings |
| `RERANKER` | `withSpan` | Re-ranking documents |
| `GUARDRAIL` | `withSpan` | Safety checks, content moderation |
| `EVALUATOR` | `withSpan` | LLM evaluation |

## Attribute Helpers

```typescript
import {
  getInputAttributes,
  getOutputAttributes,
  getRetrieverAttributes,
  getEmbeddingAttributes,
  getLLMAttributes,
  getToolAttributes,
  getMetadataAttributes,
} from "@arizeai/openinference-core";

// Retriever attributes
getRetrieverAttributes({
  documents: [
    { content: "Doc text", id: "doc1", score: 0.95 },
    { content: "Another doc", metadata: { source: "web" } },
  ],
});

// Embedding attributes
getEmbeddingAttributes({
  modelName: "text-embedding-ada-002",
  embeddings: [{ text: "hello", vector: [0.1, 0.2, 0.3] }],
});

// LLM attributes
getLLMAttributes({
  provider: "openai",
  modelName: "gpt-4",
  inputMessages: [{ role: "user", content: "Hello" }],
  outputMessages: [{ role: "assistant", content: "Hi!" }],
  tokenCount: { prompt: 10, completion: 5, total: 15 },
});
```

## Complete Examples

### RAG Pipeline

```typescript
import {
  traceChain,
  withSpan,
  getInputAttributes,
  getRetrieverAttributes,
} from "@arizeai/openinference-core";

const retriever = withSpan(
  async (query: string) => {
    const results = await vectorDb.search(query, { topK: 5 });
    return results.map((doc) => ({ content: doc.text, score: doc.score }));
  },
  {
    kind: "RETRIEVER",
    name: "vector-search",
    processInput: (query) => getInputAttributes(query),
    processOutput: (docs) => getRetrieverAttributes({ documents: docs }),
  }
);

const ragPipeline = traceChain(
  async (query: string) => {
    const docs = await retriever(query);  // Child: RETRIEVER span
    const context = docs.map((d) => d.content).join("\n");
    const response = await llm.chat(query, context);  // Child: LLM span (auto-instrumented)
    return response;
  },
  { name: "rag-pipeline" }
);
```

### Agent with Tools

```typescript
import { traceAgent, traceTool } from "@arizeai/openinference-core";

const searchTool = traceTool(
  async (query: string) => {
    const res = await fetch(`https://api.search.com?q=${query}`);
    return res.json();
  },
  { name: "web-search" }
);

const calculatorTool = traceTool(
  (expression: string) => eval(expression),
  { name: "calculator" }
);

const agent = traceAgent(
  async (question: string) => {
    const thought = await llm.generate(`Think: ${question}`);

    if (thought.includes("search")) {
      const results = await searchTool(question);  // Child: TOOL span
      return await llm.generate(`Answer based on: ${JSON.stringify(results)}`);
    }
    return await llm.generate(question);
  },
  { name: "react-agent" }
);
```

## withSpan Options

```typescript
withSpan(fn, {
  name: "span-name",           // Span name (defaults to function name)
  kind: "RETRIEVER",           // OpenInference span kind
  processInput: (args) => {},  // Transform input to attributes
  processOutput: (result) => {},// Transform output to attributes
  attributes: { key: "value" },// Static attributes
});
```

## Error Handling

```typescript
import { SpanStatusCode } from "@opentelemetry/api";
import { trace } from "@arizeai/phoenix-otel";

const riskyOperation = traceChain(
  async (input: string) => {
    const span = trace.getActiveSpan();
    try {
      const result = await doSomething(input);
      span?.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (e) {
      span?.recordException(e as Error);
      span?.setStatus({ code: SpanStatusCode.ERROR });
      throw e;
    }
  },
  { name: "risky-operation" }
);
```
