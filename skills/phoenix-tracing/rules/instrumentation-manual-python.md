# Manual Instrumentation (Python)

Add custom spans using decorators or context managers for fine-grained tracing control.

## Setup

```bash
pip install arize-phoenix-otel
```

```python
from phoenix.otel import register
tracer_provider = register(project_name="my-app")
tracer = tracer_provider.get_tracer(__name__)
```

## Quick Reference

| Span Kind | Decorator | Use Case |
|-----------|-----------|----------|
| CHAIN | `@tracer.chain` | Orchestration, workflows, pipelines |
| RETRIEVER | `@tracer.retriever` | Vector search, document retrieval |
| TOOL | `@tracer.tool` | External API calls, function execution |
| AGENT | `@tracer.agent` | Multi-step reasoning, planning |
| LLM | `@tracer.llm` | LLM API calls (manual only) |
| EMBEDDING | `@tracer.embedding` | Embedding generation |
| RERANKER | `@tracer.reranker` | Document re-ranking |
| GUARDRAIL | `@tracer.guardrail` | Safety checks, content moderation |
| EVALUATOR | `@tracer.evaluator` | LLM evaluation, quality checks |

## Decorator Approach (Recommended)

**Use for:** Full function instrumentation, automatic I/O capture

```python
@tracer.chain
def rag_pipeline(query: str) -> str:
    docs = retrieve_documents(query)
    ranked = rerank(docs, query)
    return generate_response(ranked, query)

@tracer.retriever
def retrieve_documents(query: str) -> list[dict]:
    results = vector_db.search(query, top_k=5)
    return [{"content": doc.text, "score": doc.score} for doc in results]

@tracer.tool
def get_weather(city: str) -> str:
    response = requests.get(f"https://api.weather.com/{city}")
    return response.json()["weather"]
```

**Custom span names:**

```python
@tracer.chain(name="rag-pipeline-v2")
def my_workflow(query: str) -> str:
    return process(query)
```

## Context Manager Approach

**Use for:** Partial function instrumentation, custom attributes, dynamic control

```python
from opentelemetry.trace import Status, StatusCode
import json

def retrieve_with_metadata(query: str):
    with tracer.start_as_current_span(
        "vector_search",
        openinference_span_kind="retriever"
    ) as span:
        span.set_attribute("input.value", query)

        results = vector_db.search(query, top_k=5)

        documents = [
            {
                "document.id": doc.id,
                "document.content": doc.text,
                "document.score": doc.score
            }
            for doc in results
        ]
        span.set_attribute("retrieval.documents", json.dumps(documents))
        span.set_status(Status(StatusCode.OK))

        return documents
```

## See Also

- **Span attributes:** `span-chain.md`, `span-retriever.md`, `span-tool.md`, `span-llm.md`, `span-agent.md`, `span-embedding.md`, `span-reranker.md`, `span-guardrail.md`, `span-evaluator.md`
- **Auto-instrumentation:** `instrumentation-auto-python.md` for framework integrations
- **API docs:** https://docs.arize.com/phoenix/tracing/manual-instrumentation
