---
name: phoenix-tracing
description: OpenInference semantic conventions and instrumentation for Phoenix AI observability. Use when implementing LLM tracing, creating custom spans, or deploying to production.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: Python, TypeScript
---

# Phoenix Tracing

Comprehensive guide for instrumenting LLM applications with OpenInference tracing in Phoenix. Contains rule files covering setup, instrumentation, span types, and production deployment.

## When to Apply

Reference these guidelines when:

- Setting up Phoenix tracing (Python or TypeScript)
- Creating custom spans for LLM operations
- Adding attributes following OpenInference conventions
- Deploying tracing to production
- Querying and analyzing trace data

## Rule Categories

| Priority | Category        | Description                    | Prefix                     |
| -------- | --------------- | ------------------------------ | -------------------------- |
| 1        | Setup           | Installation and configuration | `setup-*`                  |
| 2        | Instrumentation | Auto and manual tracing        | `instrumentation-*`        |
| 3        | Span Types      | 9 span kinds with attributes   | `span-*`                   |
| 4        | Organization    | Projects and sessions          | `projects-*`, `sessions-*` |
| 5        | Enrichment      | Custom metadata                | `metadata-*`               |
| 6        | Production      | Batch processing, masking      | `production-*`             |
| 7        | Feedback        | Annotations and evaluation     | `annotations-*`            |

## Quick Reference

### 1. Setup (START HERE)

- `setup-python` - Install arize-phoenix-otel, configure endpoint
- `setup-typescript` - Install @arizeai/phoenix-otel, configure endpoint

### 2. Instrumentation

- `instrumentation-auto-python` - Auto-instrument OpenAI, LangChain, etc.
- `instrumentation-auto-typescript` - Auto-instrument supported frameworks
- `instrumentation-manual-python` - Custom spans with decorators
- `instrumentation-manual-typescript` - Custom spans with wrappers

### 3. Span Types (with full attribute schemas)

- `span-llm` - LLM API calls (model, tokens, messages, cost)
- `span-chain` - Multi-step workflows and pipelines
- `span-retriever` - Document retrieval (documents, scores)
- `span-tool` - Function/API calls (name, parameters)
- `span-agent` - Multi-step reasoning agents
- `span-embedding` - Vector generation
- `span-reranker` - Document re-ranking
- `span-guardrail` - Safety checks
- `span-evaluator` - LLM evaluation

### 4. Organization

- `projects-python` / `projects-typescript` - Group traces by application
- `sessions-python` / `sessions-typescript` - Track conversations

### 5. Enrichment

- `metadata-python` / `metadata-typescript` - Custom attributes

### 6. Production (CRITICAL)

- `production-python` / `production-typescript` - Batch processing, PII masking

### 7. Feedback

- `annotations-overview` - Feedback concepts
- `annotations-python` / `annotations-typescript` - Add feedback to spans

### Reference Files

- `fundamentals-overview` - Traces, spans, attributes basics
- `fundamentals-required-attributes` - Required fields per span type
- `fundamentals-universal-attributes` - Common attributes (user.id, session.id)
- `fundamentals-flattening` - JSON flattening rules
- `attributes-messages` - Chat message format
- `attributes-metadata` - Custom metadata schema
- `attributes-graph` - Agent workflow attributes
- `attributes-exceptions` - Error tracking

## Common Attributes

| Attribute                 | Purpose              | Example                |
| ------------------------- | -------------------- | ---------------------- |
| `openinference.span.kind` | Span type (required) | `"LLM"`, `"RETRIEVER"` |
| `input.value`             | Operation input      | JSON or text           |
| `output.value`            | Operation output     | JSON or text           |
| `user.id`                 | User identifier      | `"user_123"`           |
| `session.id`              | Conversation ID      | `"session_abc"`        |
| `llm.model_name`          | Model identifier     | `"gpt-4"`              |
| `llm.token_count.total`   | Token usage          | `1500`                 |
| `tool.name`               | Tool/function name   | `"get_weather"`        |

## Common Workflows

**Quick Start:**

1. `setup-{lang}` → Install and configure
2. `instrumentation-auto-{lang}` → Enable auto-instrumentation
3. Check Phoenix for traces

**Custom Spans:**

1. `setup-{lang}` → Install
2. `instrumentation-manual-{lang}` → Add decorators/wrappers
3. `span-{type}` → Reference attributes

**Production:** `production-{lang}` → Configure batching and masking

## How to Use

Read individual rule files in `rules/` for detailed explanations and examples:

```
rules/setup-python.md
rules/instrumentation-manual-typescript.md
rules/span-llm.md
```

Use file prefixes to find what you need:

```bash
ls rules/span-*           # Span type specifications
ls rules/*-python.md      # Python guides
ls rules/*-typescript.md  # TypeScript guides
```

## References

**Phoenix Documentation:**

- [Phoenix Documentation](https://docs.arize.com/phoenix)
- [OpenInference Spec](https://github.com/Arize-ai/openinference/tree/main/spec)

**Python API Documentation:**

- [Python OTEL Package](https://arize-phoenix.readthedocs.io/projects/otel/en/latest/) - `arize-phoenix-otel` API reference
- [Python Client Package](https://arize-phoenix.readthedocs.io/projects/client/en/latest/) - `arize-phoenix-client` API reference

**TypeScript API Documentation:**

- [TypeScript Packages](https://arize-ai.github.io/phoenix/) - `@arizeai/phoenix-otel`, `@arizeai/phoenix-client`, and other TypeScript packages
