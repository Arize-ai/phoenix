# Query DSL

Phoenix provides a Python DSL for querying spans. Use dot notation for flattened attributes, array[index] for elements, and `*` for wildcards.

```python
from phoenix.query import SpanQuery

# Basic filtering
SpanQuery().where("span_kind == 'LLM'")
SpanQuery().where("llm.model_name == 'gpt-4-turbo'")

# Array access
SpanQuery().where("llm.input_messages.0.message.role == 'user'")
SpanQuery().where("retrieval.documents.*.document.score > 0.9")  # wildcard

# Operators
SpanQuery().where("llm.token_count.total > 1000")  # >, >=, <, <=, ==, !=
SpanQuery().where("llm.model_name in ['gpt-4', 'claude-3']")
SpanQuery().where("exception.message contains 'timeout'")

# Logical combinations (AND = .where(), OR = .or_where())
SpanQuery().where("span_kind == 'LLM'").where("status_code == 'ERROR'")
SpanQuery().where("span_kind == 'LLM'").or_where("span_kind == 'EMBEDDING'")

# Time filtering
SpanQuery().where("start_time >= '2024-01-01'")
SpanQuery().where("start_time >= now() - interval '7 days'")

# Context filtering
SpanQuery().where("session.id == 'session_abc123'")
SpanQuery().where("user.id == 'user_xyz789'")
SpanQuery().where("metadata.environment == 'production'")
SpanQuery().where("tag.tags.* in ['high_priority']")

# Selections and aggregations
SpanQuery().select("llm.model_name", "llm.token_count.total")
SpanQuery().aggregate("count()", "sum(llm.token_count.total)", "avg(latency_ms)")
SpanQuery().group_by("llm.model_name", "status_code").aggregate("count()")

# Ordering and pagination
SpanQuery().order_by("llm.token_count.total", descending=True)
SpanQuery().limit(100).offset(50)
```
