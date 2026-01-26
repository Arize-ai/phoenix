# Phoenix Tracing: Custom Metadata Guide (TypeScript)

**Comprehensive guide for adding custom attributes and enriching spans in TypeScript.**

This guide teaches you how to add custom metadata to traces for richer observability.

---

## 1. Overview

**What is metadata?**
- Custom attributes added to spans
- Key-value pairs (e.g., `user_id="user_123"`, `environment="production"`)
- Enriches traces with application-specific context

**When to add metadata:**
- User identification (`user.id`, `user.email`)
- Environment context (`environment`, `version`, `region`)
- Business logic (`experiment_id`, `model_version`, `feature_flag`)
- Debugging (`debug_mode`, `request_id`)
- A/B testing (`variant`, `experiment_name`)

**Metadata namespace:**
- Standard attributes: `user.id`, `session.id`, `input.value`, `output.value`
- Custom attributes: `metadata.*` (e.g., `metadata.experiment_id`)

---

## 2. Universal Attributes (Work on Any Span)

### 2.1 TypeScript: `setAttribute` Context

```typescript
import { context } from "@opentelemetry/api";
import { setAttribute } from "@arizeai/openinference-core";

// All spans created within this context will have these attributes
await context.with(
  setAttribute(context.active(), "user.id", "user_123"),
  async () => {
    const result = await myApp.run(query);
  }
);
```

**For multiple attributes:**

```typescript
import { context } from "@opentelemetry/api";
import { trace } from "@opentelemetry/api";

const ctx = context.active();
const span = trace.getActiveSpan();

span?.setAttributes({
  "user.id": "user_123",
  "metadata.environment": "production",
  "metadata.version": "v2.1",
});

await context.with(ctx, async () => {
  const result = await myApp.run(query);
});
```

---

### 2.2 Example: User Tracking

```typescript
import { context, trace } from "@opentelemetry/api";

async function handleUserRequest(userId: string, query: string) {
  const span = trace.getActiveSpan();

  // All spans in this request will have user_id
  span?.setAttribute("user.id", userId);

  const response = await processQuery(query);
  return response;
}

await handleUserRequest("user_123", "What is Phoenix?");
```

**Phoenix UI:** Filter traces by `user.id == "user_123"`, track user-specific behavior.

---

## 3. Input and Output Values

**Recommended on all spans** to understand what data flowed through each operation.

### 3.1 Automatic Capture (Decorators)

```typescript
import { traceChain } from "@arizeai/openinference-core";

const process = traceChain(
  (query: string): string => {
    // Input and output automatically captured
    return `Result: ${query}`;
  },
  { name: "process" }
);
```

---

### 3.2 Manual Capture (Context Managers)

```typescript
import { withSpan } from "@arizeai/openinference-core";
import { trace } from "@opentelemetry/api";

await withSpan(
  async () => {
    const span = trace.getActiveSpan();
    span?.setAttributes({
      "input.value": userQuery,
    });

    const result = await process(userQuery);

    span?.setAttributes({
      "output.value": result,
    });
  },
  { name: "operation", kind: "CHAIN" }
);
```

---

### 3.3 Complex Input/Output (JSON)

```typescript
const inputData = { query: "Hello", filters: ["recent", "relevant"] };
span?.setAttributes({
  "input.value": JSON.stringify(inputData),
});

const outputData = { response: "Hi!", confidence: 0.95 };
span?.setAttributes({
  "output.value": JSON.stringify(outputData),
});
```

**Phoenix UI:** Displays JSON in a formatted view.

---

## 4. Prompt Templates

**Use case:** Track which prompt template was used and with what variables.

### 4.1 TypeScript: Prompt Template Attributes

```typescript
const template = "You are a helpful assistant. Answer this question: {question}";
const variables = { question: "What is Phoenix?" };

span?.setAttributes({
  "llm.prompt_template.template": template,
  "llm.prompt_template.variables": JSON.stringify(variables),
});

// Render and call LLM
const prompt = template.replace("{question}", variables.question);
const response = await llm.generate(prompt);
```

**What gets captured:**
- `llm.prompt_template.template`: Template string
- `llm.prompt_template.variables`: Template variables (JSON)

**Phoenix UI:** See which template and variables were used for each LLM call.

**Cross-reference:** See `span-llm.md` for full LLM attributes.

---

## 5. Custom Metadata Namespace

**Use `metadata.*` for arbitrary key-value pairs.**

### 5.1 TypeScript: Custom Metadata

```typescript
span?.setAttributes({
  "metadata.experiment_id": "exp_123",
  "metadata.model_version": "gpt-4-1106-preview",
  "metadata.feature_flag_enabled": true,
  "metadata.request_id": "req_abc",
  "metadata.environment": "production",
  "metadata.user_tier": "premium",
});
```

**What gets captured:**
- `metadata.experiment_id` = "exp_123"
- `metadata.model_version` = "gpt-4-1106-preview"
- `metadata.feature_flag_enabled` = true
- etc.

---

### 5.2 Filtering by Metadata in Phoenix UI

**Query DSL:**

```typescript
// In Phoenix UI search bar or client query
metadata["experiment_id"] == "exp_123"
metadata["user_tier"] == "premium"
metadata["feature_flag_enabled"] == true
```

**Export traces with specific metadata:**

```typescript
import { SpanQuery } from "@arizeai/phoenix-client";

const query = new SpanQuery()
  .where("metadata['experiment_id'] == 'exp_123'")
  .select("span_id", "input.value", "output.value");

const df = await client.querySpans(query);
```

**Cross-reference:** export-typescript.md for querying.

---

## 6. Span-Specific Attributes

### 6.1 LLM Spans

```typescript
import { withSpan } from "@arizeai/openinference-core";
import { trace } from "@opentelemetry/api";

await withSpan(
  async () => {
    const span = trace.getActiveSpan();

    span?.setAttributes({
      "llm.model_name": "gpt-4",
      "llm.provider": "openai",
      "llm.invocation_parameters.temperature": 0.7,
      "llm.invocation_parameters.max_tokens": 500,
    });

    const response = await llm.generate(prompt);

    span?.setAttributes({
      "llm.token_count.prompt": response.usage.prompt_tokens,
      "llm.token_count.completion": response.usage.completion_tokens,
      "llm.token_count.total": response.usage.total_tokens,
    });
  },
  { name: "llm_call", kind: "LLM" }
);
```

**Cross-reference:** See `span-llm.md` for full LLM attributes.

---

### 6.2 Retriever Spans

```typescript
import { withSpan } from "@arizeai/openinference-core";
import { trace } from "@opentelemetry/api";

await withSpan(
  async () => {
    const span = trace.getActiveSpan();
    span?.setAttribute("input.value", query);

    const results = await vectorDb.search(query, { topK: 5 });

    // Set retrieval.documents attribute
    const documents = results.map((doc) => ({
      "document.id": doc.id,
      "document.content": doc.text,
      "document.score": doc.score,
      "document.metadata": JSON.stringify(doc.metadata),
    }));

    span?.setAttribute("retrieval.documents", JSON.stringify(documents));
  },
  { name: "vector_search", kind: "RETRIEVER" }
);
```

**Cross-reference:** See `span-retriever.md` for full retrieval attributes.

---

### 6.3 Tool Spans

```typescript
import { withSpan } from "@arizeai/openinference-core";
import { trace } from "@opentelemetry/api";

await withSpan(
  async () => {
    const span = trace.getActiveSpan();

    span?.setAttributes({
      "tool.name": "get_weather",
      "tool.description": "Fetches current weather for a city",
      "tool.parameters": JSON.stringify({ city: "San Francisco" }),
    });

    const result = await getWeather("San Francisco");

    span?.setAttribute("output.value", result);
  },
  { name: "tool_call", kind: "TOOL" }
);
```

**Cross-reference:** See `span-tool.md` for full tool attributes.

---

## 7. Common Metadata Patterns

### 7.1 A/B Testing

```typescript
import { trace } from "@opentelemetry/api";

async function runExperiment(query: string, variant: string) {
  const span = trace.getActiveSpan();

  // Track which variant a user sees
  span?.setAttributes({
    "metadata.experiment_name": "model_comparison",
    "metadata.variant": variant, // "gpt-4" or "claude-3"
  });

  const result = await runModel(query, variant);
  return result;
}
```

**Phoenix UI:** Filter by `metadata.variant`, compare performance across variants.

---

### 7.2 Feature Flags

```typescript
const span = trace.getActiveSpan();

span?.setAttributes({
  "metadata.feature_flag": "new_retrieval_algorithm",
  "metadata.flag_enabled": true,
});

const result = await myApp.run(query);
```

**Phoenix UI:** Compare traces with `flag_enabled=true` vs `flag_enabled=false`.

---

### 7.3 Model Versioning

```typescript
const span = trace.getActiveSpan();

span?.setAttributes({
  "metadata.model_version": "gpt-4-1106-preview",
  "metadata.embedding_model": "text-embedding-3-small",
});

const result = await myApp.run(query);
```

**Phoenix UI:** Track which model versions were used, compare performance.

---

### 7.4 Environment Context

```typescript
const span = trace.getActiveSpan();

span?.setAttributes({
  "metadata.environment": process.env.NODE_ENV || "development",
  "metadata.region": process.env.AWS_REGION || "us-west-2",
  "metadata.version": "v2.1.0",
});

const result = await myApp.run(query);
```

**Phoenix UI:** Filter by environment, debug production vs staging differences.

---

### 7.5 Request Tracking

```typescript
import { randomUUID } from "crypto";

const requestId = randomUUID();
const span = trace.getActiveSpan();

span?.setAttributes({
  "user.id": userId,
  "metadata.request_id": requestId,
  "metadata.ip_address": request.ip,
  "metadata.user_agent": request.headers["user-agent"],
});

const result = await handleRequest(request);
```

**Phoenix UI:** Search by `request_id`, track full request lifecycle.

---

## 8. Adding Metadata to Specific Spans

**Use case:** Add metadata to a single span, not all spans in a context.

### 8.1 TypeScript: Span Attributes

```typescript
import { withSpan } from "@arizeai/openinference-core";
import { trace } from "@opentelemetry/api";

await withSpan(
  async () => {
    const span = trace.getActiveSpan();

    // Add custom attributes to this span only
    span?.setAttributes({
      "metadata.custom_field": "custom_value",
      "metadata.debug_mode": true,
    });

    const result = await process();
  },
  { name: "operation" }
);
```

---

## 9. Attribute Data Types

**Supported types:**
- `string`: `"hello"`
- `number`: `123`, `45.6`
- `boolean`: `true`, `false`
- `array`: `["a", "b", "c"]` (strings, numbers, or booleans)
- `null`: Not supported (use empty string or omit)

**Complex types (use JSON):**
- `object`: Serialize with `JSON.stringify()`

**Example:**

```typescript
span?.setAttribute("metadata.config", JSON.stringify({ key: "value" }));
```

---

## 10. Best Practices

### 10.1 Use Descriptive Attribute Names

**Bad:**
```typescript
span?.setAttribute("metadata.val", "123");
span?.setAttribute("metadata.x", true);
```

**Good:**
```typescript
span?.setAttribute("metadata.experiment_id", "exp_123");
span?.setAttribute("metadata.feature_flag_enabled", true);
```

---

### 10.2 Use Standard Attributes When Available

**Bad:**
```typescript
span?.setAttribute("metadata.user", "user_123");
```

**Good:**
```typescript
span?.setAttribute("user.id", "user_123");
// Uses standard `user.id` attribute
```

**Standard attributes:**
- `user.id`, `user.email`
- `session.id`
- `input.value`, `output.value`
- `llm.model_name`, `llm.token_count.*`

**Cross-reference:** See `fundamentals-universal-attributes.md` for full list.

---

### 10.3 Avoid PII in Metadata (Unless Masked)

**Bad:**
```typescript
span?.setAttribute("metadata.email", "alice@example.com");  // PII
span?.setAttribute("metadata.ssn", "123-45-6789");  // Sensitive
```

**Good:**
```typescript
span?.setAttribute("user.id", "user_123");  // No PII
span?.setAttribute("metadata.user_tier", "premium");  // Non-sensitive
```

**If PII is needed:** production-guide-typescript.md for data masking.

---

### 10.4 Use Metadata for Filtering and Analysis

**Phoenix UI supports filtering by metadata:**

```typescript
// Search bar in Phoenix UI
metadata["experiment_id"] == "exp_123"
metadata["user_tier"] == "premium" && llm.model_name == "gpt-4"
```

**Querying via client:**

```typescript
import { SpanQuery } from "@arizeai/phoenix-client";

const query = new SpanQuery()
  .where("metadata['experiment_id'] == 'exp_123' && span_kind == 'LLM'")
  .select("llm.model_name", "llm.token_count.total");

const df = await client.querySpans(query);
```

---

## 11. Complete Example

### 11.1 TypeScript: Enriched RAG Pipeline

```typescript
import { register } from "@arizeai/openinference-instrumentation-openai";
import { trace } from "@opentelemetry/api";
import { traceChain, withSpan } from "@arizeai/openinference-core";

// Setup
const tracerProvider = register({ projectName: "rag-app" });

const ragPipeline = traceChain(
  async (query: string, userId: string, experimentId: string): Promise<string> => {
    const span = trace.getActiveSpan();

    // Add context metadata for all spans in this pipeline
    span?.setAttributes({
      "user.id": userId,
      "metadata.experiment_id": experimentId,
      "metadata.model_version": "gpt-4-1106-preview",
      "metadata.environment": "production",
    });

    // Retrieval
    const docs = await retrieveDocuments(query);

    // LLM generation with prompt template tracking
    const response = await withSpan(
      async () => {
        const llmSpan = trace.getActiveSpan();

        const template = "Answer the question based on context:\n{context}\n\nQuestion: {question}";
        const variables = {
          context: docs.map((doc) => doc.content).join("\n"),
          question: query,
        };

        llmSpan?.setAttributes({
          "llm.prompt_template.template": template,
          "llm.prompt_template.variables": JSON.stringify(variables),
        });

        const prompt = template
          .replace("{context}", variables.context)
          .replace("{question}", variables.question);

        const result = await llm.generate(prompt);
        return result;
      },
      { name: "llm_generation", kind: "LLM" }
    );

    return response;
  },
  { name: "rag_pipeline" }
);

// Run pipeline
const result = await ragPipeline(
  "What is Phoenix?",
  "user_123",
  "exp_rag_v2"
);
```

**Phoenix UI:** All spans have:
- `user.id` = "user_123"
- `metadata.experiment_id` = "exp_rag_v2"
- `metadata.model_version` = "gpt-4-1106-preview"
- `metadata.environment` = "production"
- LLM span has prompt template and variables

---

## 12. Next Steps

**Organize traces:**
- Projects and sessions

**Export data:**
- Query by metadata

**Production deployment:**
- Data masking for sensitive metadata

**Attribute reference:**
- `fundamentals-universal-attributes.md` - Standard attributes
- attribute files - Attribute schemas by category
