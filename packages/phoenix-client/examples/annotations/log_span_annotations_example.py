from phoenix.client import Client
from phoenix.client.resources.spans import SpanAnnotationData

client = Client()

# Add a single span annotation
annotation = client.spans.add_span_annotation(
    span_id="72dda197b0e1b3ef",
    annotation_name="sentiment",
    label="positive",
    score=0.9,
)

# Log multiple annotations
annotations = [
    SpanAnnotationData(
        name="sentiment",
        span_id="72dda197b0e1b3ef",
        annotator_kind="HUMAN",
        result={"label": "positive", "score": 0.9},
    ),
    SpanAnnotationData(
        name="sentiment",
        span_id="72dda197b0e1b3ef",
        annotator_kind="HUMAN",
        result={"label": "negative", "score": 0.1},
    ),
]


client.spans.log_span_annotations(span_annotations=annotations)
