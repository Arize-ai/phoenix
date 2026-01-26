# Phoenix Tracing: Custom Metadata Guide (Python)

**Comprehensive guide for adding custom attributes and enriching spans in Python.**

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

### 2.1 `using_attributes` Context Manager

```python
from openinference.instrumentation import using_attributes

# All spans created within this context will have these attributes
with using_attributes(
    user_id="user_123",
    metadata={"environment": "production", "version": "v2.1"}
):
    result = my_app.run(query)
```

**What gets captured:**
- `user.id` = "user_123"
- `metadata.environment` = "production"
- `metadata.version` = "v2.1"

**Applies to:**
- All spans created within the context
- Auto-instrumented spans (LLM, retriever, tool)
- Manually instrumented spans

---

### 2.2 Example: User Tracking

```python
from openinference.instrumentation import using_attributes

def handle_user_request(user_id: str, query: str):
    # All spans in this request will have user_id
    with using_attributes(user_id=user_id):
        response = process_query(query)
    return response

handle_user_request("user_123", "What is Phoenix?")
```

**Phoenix UI:** Filter traces by `user.id == "user_123"`, track user-specific behavior.

---

## 3. Input and Output Values

**Recommended on all spans** to understand what data flowed through each operation.

### 3.1 Automatic Capture (Decorators)

```python
@tracer.chain
def process(query: str) -> str:
    # Input and output automatically captured as:
    # - input.value = query
    # - output.value = return value
    return f"Result: {query}"
```

---

### 3.2 Manual Capture (Context Managers)

```python
with tracer.start_as_current_span("operation", openinference_span_kind="chain") as span:
    span.set_attribute("input.value", user_query)

    result = process(user_query)

    span.set_attribute("output.value", result)
```

---

### 3.3 Complex Input/Output (JSON)

```python
import json

with tracer.start_as_current_span("operation") as span:
    input_data = {"query": "Hello", "filters": ["recent", "relevant"]}
    span.set_attribute("input.value", json.dumps(input_data))

    output_data = {"response": "Hi!", "confidence": 0.95}
    span.set_attribute("output.value", json.dumps(output_data))
```

**Phoenix UI:** Displays JSON in a formatted view.

---

## 4. Prompt Templates

**Use case:** Track which prompt template was used and with what variables.

### 4.1 Prompt Template Attributes

```python
import json

with tracer.start_as_current_span("llm_call", openinference_span_kind="llm") as span:
    template = "You are a helpful assistant. Answer this question: {question}"
    variables = {"question": "What is Phoenix?"}

    span.set_attribute("llm.prompt_template.template", template)
    span.set_attribute("llm.prompt_template.variables", json.dumps(variables))

    # Render and call LLM
    prompt = template.format(**variables)
    response = llm.generate(prompt)
```

**What gets captured:**
- `llm.prompt_template.template`: Template string
- `llm.prompt_template.variables`: Template variables (JSON)

**Phoenix UI:** See which template and variables were used for each LLM call.

**Cross-reference:** See `span-llm.md` for full LLM attributes.

---

## 5. Custom Metadata Namespace

**Use `metadata.*` for arbitrary key-value pairs.**

### 5.1 Custom Metadata

```python
from openinference.instrumentation import using_attributes

with using_attributes(
    metadata={
        "experiment_id": "exp_123",
        "model_version": "gpt-4-1106-preview",
        "feature_flag_enabled": True,
        "request_id": "req_abc",
        "environment": "production",
        "user_tier": "premium",
    }
):
    result = my_app.run(query)
```

**What gets captured:**
- `metadata.experiment_id` = "exp_123"
- `metadata.model_version` = "gpt-4-1106-preview"
- `metadata.feature_flag_enabled` = True
- etc.

---

### 5.2 Filtering by Metadata in Phoenix UI

**Query DSL:**

```python
# In Phoenix UI search bar or client query
metadata["experiment_id"] == "exp_123"
metadata["user_tier"] == "premium"
metadata["feature_flag_enabled"] == true
```

**Export traces with specific metadata:**

```python
from phoenix.trace.dsl import SpanQuery

query = SpanQuery().where(
    "metadata['experiment_id'] == 'exp_123'"
).select(
    "span_id",
    "input.value",
    "output.value",
)

df = client.query_spans(query)
```

**Cross-reference:** export-data.md for querying.

---

## 6. Span-Specific Attributes

### 6.1 LLM Spans

```python
with tracer.start_as_current_span("llm_call", openinference_span_kind="llm") as span:
    span.set_attribute("llm.model_name", "gpt-4")
    span.set_attribute("llm.provider", "openai")
    span.set_attribute("llm.invocation_parameters.temperature", 0.7)
    span.set_attribute("llm.invocation_parameters.max_tokens", 500)

    response = llm.generate(prompt)

    span.set_attribute("llm.token_count.prompt", response.usage.prompt_tokens)
    span.set_attribute("llm.token_count.completion", response.usage.completion_tokens)
    span.set_attribute("llm.token_count.total", response.usage.total_tokens)
```

**Cross-reference:** See `span-llm.md` for full LLM attributes.

---

### 6.2 Retriever Spans

```python
import json

with tracer.start_as_current_span("vector_search", openinference_span_kind="retriever") as span:
    span.set_attribute("input.value", query)

    results = vector_db.search(query, top_k=5)

    # Set retrieval.documents attribute
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
```

**Cross-reference:** See `span-retriever.md` for full retrieval attributes.

---

### 6.3 Tool Spans

```python
with tracer.start_as_current_span("tool_call", openinference_span_kind="tool") as span:
    span.set_attribute("tool.name", "get_weather")
    span.set_attribute("tool.description", "Fetches current weather for a city")
    span.set_attribute("tool.parameters", json.dumps({"city": "San Francisco"}))

    result = get_weather("San Francisco")

    span.set_attribute("output.value", result)
```

**Cross-reference:** See `span-tool.md` for full tool attributes.

---

## 7. Common Metadata Patterns

### 7.1 A/B Testing

```python
from openinference.instrumentation import using_attributes

# Track which variant a user sees
with using_attributes(
    metadata={
        "experiment_name": "model_comparison",
        "variant": "gpt-4",  # or "claude-3"
    }
):
    result = run_experiment(query)
```

**Phoenix UI:** Filter by `metadata.variant`, compare performance across variants.

---

### 7.2 Feature Flags

```python
with using_attributes(
    metadata={
        "feature_flag": "new_retrieval_algorithm",
        "flag_enabled": True,
    }
):
    result = my_app.run(query)
```

**Phoenix UI:** Compare traces with `flag_enabled=true` vs `flag_enabled=false`.

---

### 7.3 Model Versioning

```python
with using_attributes(
    metadata={
        "model_version": "gpt-4-1106-preview",
        "embedding_model": "text-embedding-3-small",
    }
):
    result = my_app.run(query)
```

**Phoenix UI:** Track which model versions were used, compare performance.

---

### 7.4 Environment Context

```python
import os

with using_attributes(
    metadata={
        "environment": os.getenv("ENV", "development"),
        "region": os.getenv("AWS_REGION", "us-west-2"),
        "version": "v2.1.0",
    }
):
    result = my_app.run(query)
```

**Phoenix UI:** Filter by environment, debug production vs staging differences.

---

### 7.5 Request Tracking

```python
import uuid

request_id = str(uuid.uuid4())

with using_attributes(
    user_id=user_id,
    metadata={
        "request_id": request_id,
        "ip_address": request.remote_addr,
        "user_agent": request.headers.get("User-Agent"),
    }
):
    result = handle_request(request)
```

**Phoenix UI:** Search by `request_id`, track full request lifecycle.

---

## 8. Adding Metadata to Specific Spans

**Use case:** Add metadata to a single span, not all spans in a context.

### 8.1 Span Attributes

```python
with tracer.start_as_current_span("operation") as span:
    # Add custom attributes to this span only
    span.set_attribute("metadata.custom_field", "custom_value")
    span.set_attribute("metadata.debug_mode", True)

    result = process()
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
- `dict`: Serialize with `json.dumps()`

**Example:**

```python
span.set_attribute("metadata.config", json.dumps({"key": "value"}))
```

---

## 10. Best Practices

### 10.1 Use Descriptive Attribute Names

**Bad:**
```python
span.set_attribute("metadata.val", "123")
span.set_attribute("metadata.x", True)
```

**Good:**
```python
span.set_attribute("metadata.experiment_id", "exp_123")
span.set_attribute("metadata.feature_flag_enabled", True)
```

---

### 10.2 Use Standard Attributes When Available

**Bad:**
```python
span.set_attribute("metadata.user", "user_123")
```

**Good:**
```python
with using_attributes(user_id="user_123"):
    # Uses standard `user.id` attribute
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
```python
span.set_attribute("metadata.email", "alice@example.com")  # PII
span.set_attribute("metadata.ssn", "123-45-6789")  # Sensitive
```

**Good:**
```python
span.set_attribute("user.id", "user_123")  # No PII
span.set_attribute("metadata.user_tier", "premium")  # Non-sensitive
```

**If PII is needed:** production-guide.md for data masking.

---

### 10.4 Use Metadata for Filtering and Analysis

**Phoenix UI supports filtering by metadata:**

```python
# Search bar in Phoenix UI
metadata["experiment_id"] == "exp_123"
metadata["user_tier"] == "premium" and llm.model_name == "gpt-4"
```

**Querying via client:**

```python
from phoenix.trace.dsl import SpanQuery

query = SpanQuery().where(
    "metadata['experiment_id'] == 'exp_123' and span_kind == 'LLM'"
).select(
    "llm.model_name",
    "llm.token_count.total",
)

df = client.query_spans(query)
```

---

## 11. Complete Example

### 11.1 Enriched RAG Pipeline

```python
import json
from phoenix.otel import register
from openinference.instrumentation import using_attributes

# Setup
tracer_provider = register(project_name="rag-app")
tracer = tracer_provider.get_tracer(__name__)

@tracer.chain
def rag_pipeline(query: str, user_id: str, experiment_id: str) -> str:
    # Add context metadata for all spans in this pipeline
    with using_attributes(
        user_id=user_id,
        metadata={
            "experiment_id": experiment_id,
            "model_version": "gpt-4-1106-preview",
            "environment": "production",
        }
    ):
        # Retrieval
        docs = retrieve_documents(query)

        # LLM generation with prompt template tracking
        with tracer.start_as_current_span("llm_generation", openinference_span_kind="llm") as span:
            template = "Answer the question based on context:\n{context}\n\nQuestion: {question}"
            variables = {"context": "\n".join([doc["content"] for doc in docs]), "question": query}

            span.set_attribute("llm.prompt_template.template", template)
            span.set_attribute("llm.prompt_template.variables", json.dumps(variables))

            prompt = template.format(**variables)
            response = llm.generate(prompt)

        return response

# Run pipeline
result = rag_pipeline(
    query="What is Phoenix?",
    user_id="user_123",
    experiment_id="exp_rag_v2",
)
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
