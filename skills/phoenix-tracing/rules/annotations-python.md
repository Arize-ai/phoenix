# Python SDK Annotation Patterns


## Client Setup

```python
from phoenix.client import Client
client = Client()  # Default: http://localhost:6006
# client = Client(endpoint="http://phoenix.example.com:6006")
```

## Span Annotations

```python
# Single
client.spans.add_span_annotation(
    span_id="abc123",
    annotation_name="quality",
    annotator_kind="HUMAN",
    label="high_quality",
    score=0.95,
    explanation="Accurate and well-formatted",
    metadata={"reviewer": "alice"},
    identifier="review_v1",
    sync=True
)

# Batch
from phoenix.client.resources.spans import SpanAnnotationData

client.spans.log_span_annotations(
    span_annotations=[
        SpanAnnotationData(
            name="sentiment",
            span_id="span1",
            annotator_kind="LLM",
            result={"label": "positive", "score": 0.9}
        ),
        SpanAnnotationData(
            name="sentiment",
            span_id="span2",
            annotator_kind="LLM",
            result={"label": "negative", "score": 0.1}
        )
    ],
    sync=False
)

# From DataFrame
import pandas as pd

df = pd.DataFrame({
    'span_id': ['span1', 'span2'],
    'name': ['quality', 'quality'],
    'annotator_kind': ['HUMAN', 'LLM'],
    'label': ['good', 'fair'],
    'score': [0.8, 0.6],
    'explanation': ['Well written', 'Acceptable'],
    'metadata': [{'reviewer': 'alice'}, {'model': 'gpt-4'}]
})

client.spans.log_span_annotations_dataframe(dataframe=df, sync=True)
```

## Document Annotations

Target specific documents in RETRIEVER spans. **No custom identifiers** - uniquely identified by `(name, span_id, document_position)`.

```python
# Single
client.spans.add_document_annotation(
    span_id="retriever_span",
    document_position=0,  # 0-based index
    annotation_name="relevance",
    annotator_kind="LLM",
    label="relevant",
    score=0.95,
    explanation="Directly answers question",
    metadata={"model": "gpt-4"},
    sync=True
)

# Batch
from phoenix.client.resources.spans import SpanDocumentAnnotationData

client.spans.log_document_annotations(
    document_annotations=[
        SpanDocumentAnnotationData(
            name="relevance",
            span_id="span1",
            document_position=0,
            annotator_kind="LLM",
            result={"label": "relevant", "score": 0.9}
        ),
        SpanDocumentAnnotationData(
            name="relevance",
            span_id="span1",
            document_position=1,
            annotator_kind="LLM",
            result={"label": "irrelevant", "score": 0.1}
        )
    ],
    sync=False
)
```

## Trace Annotations

Feedback on entire traces (end-to-end interactions).

```python
# Single
client.traces.add_trace_annotation(
    trace_id="trace_abc",
    annotation_name="correctness",
    annotator_kind="HUMAN",
    label="correct",
    score=1.0,
    explanation="Accurate and complete",
    metadata={"reviewer": "bob"},
    identifier="final_review",
    sync=True
)

# Batch
from phoenix.client.resources.traces import TraceAnnotationData

client.traces.log_trace_annotations(
    trace_annotations=[
        TraceAnnotationData(
            name="helpfulness",
            trace_id="trace1",
            annotator_kind="HUMAN",
            result={"label": "helpful", "score": 0.9}
        ),
        TraceAnnotationData(
            name="helpfulness",
            trace_id="trace2",
            annotator_kind="LLM",
            result={"label": "not_helpful", "score": 0.2}
        )
    ],
    sync=False
)
```

## Session Annotations

Feedback on multi-turn conversations.

```python
# Single
client.sessions.add_session_annotation(
    session_id="session_xyz",
    annotation_name="user_satisfaction",
    annotator_kind="HUMAN",
    label="satisfied",
    score=0.85,
    explanation="Goal achieved",
    metadata={"session_length": 5},
    identifier="end_review",
    sync=True
)

# Batch
from phoenix.client.resources.sessions import SessionAnnotationData

client.sessions.log_session_annotations(
    session_annotations=[
        SessionAnnotationData(
            name="completion_rate",
            session_id="session1",
            annotator_kind="CODE",
            result={"score": 1.0, "label": "completed"}
        ),
        SessionAnnotationData(
            name="completion_rate",
            session_id="session2",
            annotator_kind="CODE",
            result={"score": 0.0, "label": "abandoned"}
        )
    ],
    sync=False
)
```

## RAG Pipeline Example

```python
from phoenix.client import Client
from phoenix.client.resources.spans import SpanDocumentAnnotationData

client = Client()

# Document relevance
client.spans.log_document_annotations(
    document_annotations=[
        SpanDocumentAnnotationData(
            name="relevance", span_id="retriever_span", document_position=i,
            annotator_kind="LLM", result={"label": label, "score": score}
        )
        for i, (label, score) in enumerate([
            ("relevant", 0.95), ("relevant", 0.80), ("irrelevant", 0.10)
        ])
    ]
)

# LLM response quality
client.spans.add_span_annotation(
    span_id="llm_span",
    annotation_name="faithfulness",
    annotator_kind="LLM",
    label="faithful",
    score=0.90,
    sync=True
)

# Overall trace quality
client.traces.add_trace_annotation(
    trace_id="trace_123",
    annotation_name="correctness",
    annotator_kind="HUMAN",
    label="correct",
    score=1.0,
    metadata={"user_feedback": "thumbs_up"},
    sync=True
)
```

## Async Client

```python
from phoenix.client import AsyncClient

async def annotate():
    async with AsyncClient() as client:
        await client.spans.add_span_annotation(
            span_id="span123",
            annotation_name="quality",
            label="good",
            score=0.8,
            sync=True
        )
```
