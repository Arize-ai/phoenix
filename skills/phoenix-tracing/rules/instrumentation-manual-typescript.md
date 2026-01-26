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
| RETRIEVER | `withSpan` | Vector search, document retrieval |
| LLM | `withSpan` | LLM API calls (prefer auto-instrumentation) |
| EMBEDDING | `withSpan` | Embedding generation |
| RERANKER | `withSpan` | Document re-ranking |
| GUARDRAIL | `withSpan` | Safety checks, content moderation |
| EVALUATOR | `withSpan` | LLM evaluation |

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

## withSpan for Other Kinds

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

## See Also

- **Span attributes:** `span-chain.md`, `span-retriever.md`, `span-tool.md`, etc.
- **Attribute helpers:** https://docs.arize.com/phoenix/tracing/manual-instrumentation-typescript#attribute-helpers
- **Auto-instrumentation:** `instrumentation-auto-typescript.md` for framework integrations
