---
description: >-
  Qdrant is an open-source vector search engine built for high-dimensional vectors
  and large scale workflows
---

# Qdrant

<figure><img src="https://qdrant.tech/img/qdrant-logo.svg" alt=""Qdrant Logo><figcaption></figcaption></figure>

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
client = QdrantClient("localhost", port=6333)

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

## LangChain Integration

If you're using LangChain, it's even easier:

```python
from langchain_community.vectorstores import Qdrant
from langchain_openai import OpenAIEmbeddings
from openinference.instrumentation.langchain import LangChainInstrumentor

# Set up embeddings and vector store
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vector_store = Qdrant(client=client, collection_name="my_docs", embeddings=embeddings)

# Auto-instrument LangChain for tracing
LangChainInstrumentor().instrument()

def search_with_langchain(query):
    """Search using LangChain with Phoenix tracing"""
    return vector_store.similarity_search(query, k=5)
```

## RAG with Qdrant

Here's a simple RAG setup:

```python
from langchain.chains import RetrievalQA
from langchain_openai import ChatOpenAI

def create_rag_chain():
    """Create a RAG chain with Qdrant"""
    llm = ChatOpenAI(model="gpt-3.5-turbo")
    retriever = vector_store.as_retriever(search_kwargs={"k": 4})
    
    return RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever
    )

# Use it (LangChainInstrumentor will automatically trace this)
rag_chain = create_rag_chain()
result = rag_chain.invoke({"query": "What is Phoenix?"})
```

## Evaluating Your RAG System

Phoenix makes it easy to evaluate how well your Qdrant searches are working:

```python
import phoenix as px
from phoenix.evals import RelevanceEvaluator, OpenAIModel, run_evals
from phoenix.session.evaluation import get_retrieved_documents

# Get your Phoenix client
phoenix_client = px.Client()

# Get recent retrieval spans
retriever_spans_df = get_retrieved_documents(phoenix_client)

# Set up evaluator
eval_model = OpenAIModel(model_name="gpt-4")
relevance_evaluator = RelevanceEvaluator(eval_model)

# Run evaluations
relevance_evals_df = run_evals(retriever_spans_df, [relevance_evaluator])[0]

# Log results back to Phoenix
from phoenix.trace import DocumentEvaluations
phoenix_client.log_evaluations(
    DocumentEvaluations(eval_name="Relevance", dataframe=relevance_evals_df)
)
```

## LlamaIndex Integration

For LlamaIndex users, Qdrant integration is even more powerful:

```python
import phoenix as px
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.core import VectorStoreIndex, Settings
from llama_index.embeddings.openai import OpenAIEmbedding
from qdrant_client import QdrantClient

# Start Phoenix
px.launch_app()

# Enable Phoenix tracing for LlamaIndex
from llama_index.core import set_global_handler
set_global_handler("arize_phoenix")

# Set up Qdrant and LlamaIndex
client = QdrantClient("localhost", port=6333)
vector_store = QdrantVectorStore(client=client, collection_name="my_docs")
Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")

# Create index and query engine
index = VectorStoreIndex.from_vector_store(vector_store)
query_engine = index.as_query_engine()

# Query with automatic tracing
response = query_engine.query("What is Phoenix?")
```

## Hybrid Search with Qdrant

Qdrant supports hybrid search combining dense and sparse vectors:

```python
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.core.vector_stores.types import VectorStoreQueryMode
from fastembed.sparse.sparse_text_embedding import SparseTextEmbedding

# Set up hybrid vector store
sparse_model = SparseTextEmbedding(model_name="prithivida/Splade_PP_en_v1")
hybrid_vector_store = QdrantVectorStore(
    client=client,
    collection_name="hybrid_docs",
    enable_hybrid=True,
    sparse_doc_fn=lambda texts: sparse_model.embed(texts),
    sparse_query_fn=lambda texts: sparse_model.embed(texts)
)

# Create hybrid retriever
hybrid_retriever = VectorIndexRetriever(
    index=hybrid_vector_index,
    vector_store_query_mode=VectorStoreQueryMode.HYBRID,
    sparse_top_k=2,
    similarity_top_k=3,
    alpha=0.1  # 0 = sparse only, 1 = dense only
)
```

## Examples

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th></th><th data-hidden data-card-cover data-type="files"></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td><strong>Complete Qdrant + LlamaIndex + Phoenix Tutorial</strong></td><td>Full tutorial showing dense and hybrid search with Qdrant, LlamaIndex, and Phoenix evaluation.</td><td><a href="../.gitbook/assets/Tutorials.jpg">Tutorials.jpg</a></td><td><a href="https://github.com/qdrant/qdrant-rag-eval/blob/a101fac6bbf93ae753ffcaa7d7c4eb940dae0464/workshop-rag-eval-qdrant-arize/notebooks/llama_qdrant_rag_phoenix.ipynb">https://github.com/qdrant/qdrant-rag-eval/blob/main/workshop-rag-eval-qdrant-arize/notebooks/llama_qdrant_rag_phoenix.ipynb</a></td></tr><tr><td><strong>LangChain Qdrant Example</strong></td><td>Simple LangChain + Qdrant example with Phoenix tracing.</td><td><a href="../.gitbook/assets/Tutorials.jpg">Tutorials.jpg</a></td><td><a href="https://github.com/Arize-ai/phoenix/blob/main/examples/cron-evals/README.md">https://github.com/Arize-ai/phoenix/blob/main/examples/cron-evals/README.md</a></td></tr></tbody></table>

## Further Reading

- [Qdrant Docs](https://qdrant.tech/documentation/)
- [LangChain Integration](https://python.langchain.com/docs/integrations/vectorstores/qdrant/)
- [LlamaIndex Integration](https://developers.llamaindex.ai/python/framework-api-reference/storage/vector_store/qdrant/)
