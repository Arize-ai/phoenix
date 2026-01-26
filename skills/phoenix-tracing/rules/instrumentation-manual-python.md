# Phoenix Tracing: Manual Instrumentation Guide (Python)

**Comprehensive guide for adding custom spans with decorators and context managers in Python.**

This guide teaches you how to manually instrument your LLM applications using OpenInference tracing helpers.

---

## Overview

**When to use manual instrumentation:**
- Custom LLM workflows not covered by auto-instrumentation
- Adding spans to business logic (chains, agents, tools)
- Fine-grained control over span attributes
- Instrumenting internal functions

**When to use auto-instrumentation:**
- Standard frameworks (LangChain, LlamaIndex, OpenAI SDK)
- Quick setup without custom code
- auto-instrumentation-python.md

---

## Setup

```bash
pip install arize-phoenix-otel
```

**Initialize tracing (required first):**

```python
from phoenix.otel import register
tracer_provider = register(project_name="my-app")
```

---

## Two Approaches to Manual Instrumentation

### Approach 1: Decorators (Recommended)

**Pros:**
- ✅ Automatic input/output capture
- ✅ Clean, declarative syntax
- ✅ Error handling built-in

**When to use:** Instrumenting entire functions

---

### Approach 2: Context Managers

**Pros:**
- ✅ Fine-grained control (partial function instrumentation)
- ✅ Dynamic span attributes
- ✅ Custom span logic

**When to use:** Instrumenting specific code blocks within a function

---

## Span Kinds Reference

OpenInference defines 9 span kinds, each representing a different operation type:

| Span Kind | Use Case | Example |
|-----------|----------|---------|
| `CHAIN` | Orchestration, workflows, pipelines | RAG pipeline, multi-step workflow |
| `LLM` | LLM API calls | OpenAI completion, Anthropic message |
| `RETRIEVER` | Document/context retrieval | Vector search, database query |
| `TOOL` | External API calls, function calls | Calculator, weather API, database write |
| `AGENT` | Multi-step reasoning | ReAct agent, planning agent |
| `EMBEDDING` | Generating embeddings | OpenAI embeddings, sentence-transformers |
| `RERANKER` | Re-ranking retrieved documents | Cross-encoder reranking |
| `GUARDRAIL` | Safety checks, content moderation | PII detection, toxicity filtering |
| `EVALUATOR` | LLM evaluation | Correctness eval, hallucination check |

**Cross-reference:** See `span-*.md` for detailed attribute schemas per span kind.

---

## CHAIN Spans (Orchestration)

**Use for:** Workflows, pipelines, orchestration logic

### 5.1 Decorators

```python
from phoenix.otel import register

tracer_provider = register(project_name="my-app")
tracer = tracer_provider.get_tracer(__name__)

@tracer.chain
def my_workflow(user_query: str) -> str:
    """
    Orchestrates a RAG pipeline: retrieval → reranking → LLM
    """
    docs = retrieve_documents(user_query)
    ranked_docs = rerank(docs, user_query)
    response = generate_response(ranked_docs, user_query)
    return response

# Input and output automatically captured
result = my_workflow("What is Phoenix?")
```

**Custom span name:**

```python
@tracer.chain(name="rag_pipeline")
def my_workflow(user_query: str) -> str:
    # ...
    return response
```

---

### 5.2 Context Managers

```python
from opentelemetry.trace import Status, StatusCode

with tracer.start_as_current_span(
    "rag_pipeline",
    openinference_span_kind="chain",
) as span:
    span.set_attribute("input.value", user_query)

    docs = retrieve_documents(user_query)
    ranked_docs = rerank(docs, user_query)
    response = generate_response(ranked_docs, user_query)

    span.set_attribute("output.value", response)
    span.set_status(Status(StatusCode.OK))
```

---

## RETRIEVER Spans (Document Retrieval)

**Use for:** Vector search, database queries, document retrieval

### 6.1 Decorators

```python
@tracer.retriever
def retrieve_documents(query: str) -> list[dict]:
    """
    Retrieves documents from a vector database.
    """
    results = vector_db.search(query, top_k=5)

    # Return list of dicts with 'content' and 'score' keys
    return [
        {"content": doc.text, "score": doc.score}
        for doc in results
    ]

docs = retrieve_documents("What is Phoenix?")
```

**What gets captured:**
- `input.value`: Query string
- `output.value`: Retrieved documents
- `retrieval.documents`: Array of document objects (content, score)

---

### 6.2 Context Managers (Advanced)

```python
import json

with tracer.start_as_current_span(
    "vector_search",
    openinference_span_kind="retriever",
) as span:
    span.set_attribute("input.value", query)

    results = vector_db.search(query, top_k=5)

    # Set retrieval.documents attribute (OpenInference format)
    documents = [
        {
            "document.id": doc.id,
            "document.content": doc.text,
            "document.score": doc.score,
            "document.metadata": json.dumps(doc.metadata),
        }
        for doc in results
    ]
    span.set_attribute("retrieval.documents", json.dumps(documents))
    span.set_attribute("output.value", json.dumps(documents))
```

**Cross-reference:** See `span-retriever.md` for full retrieval attributes.

---

## TOOL Spans (Function Calls)

**Use for:** External API calls, calculator, database writes, any function execution

### 7.1 Decorators

```python
@tracer.tool
def get_weather(city: str) -> str:
    """
    Calls a weather API to get the current weather.
    """
    response = requests.get(f"https://api.weather.com/{city}")
    return response.json()["weather"]

weather = get_weather("San Francisco")
```

**What gets captured:**
- `tool.name`: Function name (e.g., "get_weather")
- `tool.description`: Function docstring
- `tool.parameters`: Function arguments
- `input.value`: Serialized input
- `output.value`: Serialized output

---

### 7.2 Custom Tool Attributes

```python
@tracer.tool(
    name="weather_api",
    description="Fetches weather from Weather.com API",
)
def get_weather(city: str, units: str = "fahrenheit") -> str:
    """
    This docstring is overridden by the description parameter above.
    """
    # ...
    return weather

weather = get_weather("San Francisco", units="celsius")
```

---

## AGENT Spans (Multi-Step Reasoning)

**Use for:** Agents that use tools, multi-step reasoning, planning

### 8.1 Decorators

```python
@tracer.agent
def react_agent(user_query: str) -> str:
    """
    ReAct agent that reasons and uses tools.
    """
    thought = llm.generate(f"Think: {user_query}")

    if "need to search" in thought:
        docs = search_tool(user_query)
        answer = llm.generate(f"Answer based on: {docs}")
    else:
        answer = llm.generate(user_query)

    return answer

result = react_agent("What's the weather in Paris?")
```

**What gets captured:**
- Agent spans automatically create a parent span for the entire agent execution
- Child spans (LLM, tool calls) are nested under the agent span

---

## LLM Spans (Manual)

**Note:** Auto-instrumentation is recommended for LLM calls. Manual instrumentation is only needed for custom LLM clients or advanced use cases.

### 9.1 Decorators (Simple)

```python
@tracer.llm
def call_llm(prompt: str) -> str:
    """
    Calls a custom LLM API.
    """
    response = my_llm_client.complete(prompt)
    return response.text

output = call_llm("Hello, world!")
```

---

### 9.2 Context Managers (Advanced)

```python
from opentelemetry.trace import Status, StatusCode

with tracer.start_as_current_span("llm_call", openinference_span_kind="llm") as span:
    messages = [{"role": "user", "content": "Hello!"}]
    span.set_attribute("input.value", json.dumps(messages))
    span.set_attribute("llm.model_name", "gpt-4")

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=messages,
        )
        span.set_attribute("output.value", response.choices[0].message.content)
        span.set_attribute("llm.token_count.total", response.usage.total_tokens)
        span.set_status(Status(StatusCode.OK))
    except Exception as e:
        span.record_exception(e)
        span.set_status(Status(StatusCode.ERROR))
        raise
```

**Cross-reference:** See `span-llm.md` for full LLM attributes.

---

## EMBEDDING Spans

**Use for:** Generating embeddings

### 10.1 Decorators

```python
@tracer.embedding
def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generates embeddings for a list of texts.
    """
    embeddings = embedding_model.encode(texts)
    return embeddings.tolist()

vectors = generate_embeddings(["Hello", "World"])
```

**What gets captured:**
- `embedding.model_name`: Model name
- `embedding.embeddings`: List of embedding objects (text, vector)
- `input.value`: Input texts

**Cross-reference:** See `span-embedding.md` for full embedding attributes.

---

## RERANKER Spans

**Use for:** Re-ranking retrieved documents

### 11.1 Decorators

```python
@tracer.reranker
def rerank_documents(query: str, documents: list[str]) -> list[dict]:
    """
    Re-ranks documents using a cross-encoder.
    """
    scores = cross_encoder.predict([(query, doc) for doc in documents])

    ranked = [
        {"content": doc, "score": score}
        for doc, score in sorted(zip(documents, scores), key=lambda x: -x[1])
    ]
    return ranked

ranked_docs = rerank_documents("What is Phoenix?", retrieved_docs)
```

**Cross-reference:** See `span-reranker.md` for full reranker attributes.

---

## GUARDRAIL Spans

**Use for:** Safety checks, content moderation, PII detection

### 12.1 Decorators

```python
@tracer.guardrail
def check_toxicity(text: str) -> dict:
    """
    Checks if text contains toxic content.
    """
    score = toxicity_model.predict(text)
    return {"is_safe": score < 0.5, "toxicity_score": score}

result = check_toxicity(user_input)
```

**Cross-reference:** See `span-guardrail.md` for full guardrail attributes.

---

## EVALUATOR Spans

**Use for:** LLM evaluation, correctness checks, hallucination detection

### 13.1 Decorators

```python
@tracer.evaluator
def evaluate_correctness(question: str, answer: str, reference: str) -> dict:
    """
    Evaluates if the answer is correct given the reference.
    """
    prompt = f"Question: {question}\nAnswer: {answer}\nReference: {reference}\nIs the answer correct?"
    llm_response = llm.generate(prompt)

    return {
        "label": "correct" if "yes" in llm_response.lower() else "incorrect",
        "score": 1.0 if "yes" in llm_response.lower() else 0.0,
    }

eval_result = evaluate_correctness(question, answer, reference)
```

**Cross-reference:** See `span-evaluator.md` for full evaluator attributes.

---

## Choosing the Right Span Kind

| If you're instrumenting... | Use span kind... | Example |
|----------------------------|------------------|---------|
| Multi-step workflow | `CHAIN` | RAG pipeline, agent loop |
| Database/vector search | `RETRIEVER` | Pinecone query, Weaviate search |
| External API call | `TOOL` | Weather API, calculator |
| Agent reasoning | `AGENT` | ReAct, planning agent |
| LLM API call | `LLM` | OpenAI, Anthropic |
| Embedding generation | `EMBEDDING` | OpenAI embeddings |
| Document re-ranking | `RERANKER` | Cross-encoder reranking |
| Content moderation | `GUARDRAIL` | Toxicity check, PII detection |
| LLM evaluation | `EVALUATOR` | Correctness eval, hallucination check |

---

## Best Practices

### 15.1 Use Descriptive Span Names

**Bad:**
```python
@tracer.chain(name="process")
def process(input: str) -> str:
    # ...
```

**Good:**
```python
@tracer.chain(name="rag_pipeline")
def process(input: str) -> str:
    # ...
```

---

### 15.2 Capture Input and Output

**Decorators do this automatically:**

```python
@tracer.chain
def my_function(input: str) -> str:
    # Input and output automatically captured
    return output
```

**Context managers require manual capture:**

```python
with tracer.start_as_current_span("my-span", openinference_span_kind="chain") as span:
    span.set_attribute("input.value", input)
    result = process(input)
    span.set_attribute("output.value", result)
```

---

### 15.3 Handle Errors

```python
with tracer.start_as_current_span("operation") as span:
    try:
        result = risky_operation()
        span.set_status(Status(StatusCode.OK))
    except Exception as e:
        span.record_exception(e)
        span.set_status(Status(StatusCode.ERROR))
        raise
```

---

### 15.4 Nest Spans for Context

```python
@tracer.chain
def rag_pipeline(query: str) -> str:
    # Parent span: rag_pipeline (CHAIN)

    docs = retrieve_documents(query)  # Child span: retrieve_documents (RETRIEVER)
    response = generate_response(docs, query)  # Child span: generate_response (LLM)

    return response
```

Phoenix UI will show the nested structure.

---
