---
description: >-
  Qdrant is an open-source vector search engine built for high-dimensional vectors
  and large scale workflows
---

# Qdrant

<figure><img src="https://qdrant.tech/img/qdrant-logo.svg" alt="Qdrant Logo"><figcaption></figcaption></figure>

**Website:** [qdrant.tech](https://qdrant.tech/)

Qdrant is a fast, open-source vector search engine for building RAG applications and semantic search. Phoenix helps you trace and evaluate your Qdrant-powered applications to understand how well your vector searches are working.

## Quick Start

### 1. Run Qdrant with Docker

```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 2. Install the Python client

```bash
pip install qdrant-client phoenix
```

### 3. Basic usage with Phoenix tracing

```python
import phoenix as px
from qdrant_client import QdrantClient
from phoenix.otel import register

# Start Phoenix
px.launch_app()

# Set up tracing
tracer_provider = register(project_name="qdrant-app")
tracer = tracer_provider.get_tracer(__name__)

# Connect to Qdrant
client = QdrantClient(host="localhost", port=6333)

def search_documents(query_vector):
    """Search for similar documents"""
    with tracer.start_as_current_span("search_documents") as span:
        results = client.query_points(
            collection_name="my_docs",
            query=query_vector,
            limit=5
        ).points
        span.set_attribute("result_count", len(results))
        return results
```

## Examples

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th></th><th data-hidden data-card-cover data-type="files"></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td><strong>Complete Qdrant + LlamaIndex + Phoenix Tutorial</strong></td><td>Full tutorial showing dense and hybrid search with Qdrant, LlamaIndex, and Phoenix evaluation.</td><td><a href="../.gitbook/assets/Tutorials.jpg">Tutorials.jpg</a></td><td><a href="https://github.com/qdrant/qdrant-rag-eval/blob/a101fac6bbf93ae753ffcaa7d7c4eb940dae0464/workshop-rag-eval-qdrant-arize/notebooks/llama_qdrant_rag_phoenix.ipynb">https://github.com/qdrant/qdrant-rag-eval/blob/main/workshop-rag-eval-qdrant-arize/notebooks/llama_qdrant_rag_phoenix.ipynb</a></td></tr><tr><td><strong>LangChain Qdrant Example</strong></td><td>Simple LangChain + Qdrant example with Phoenix tracing.</td><td><a href="../.gitbook/assets/Tutorials.jpg">Tutorials.jpg</a></td><td><a href="https://github.com/Arize-ai/phoenix/blob/main/examples/cron-evals/README.md">https://github.com/Arize-ai/phoenix/blob/main/examples/cron-evals/README.md</a></td></tr></tbody></table>

## Further Reading

- [Qdrant Docs](https://qdrant.tech/documentation/)
