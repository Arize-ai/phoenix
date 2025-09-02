from phoenix.client import Client
from phoenix.client.resources.annotations import SpanDocumentAnnotationData

client = Client()

# Log multiple document annotations
annotations = [
    SpanDocumentAnnotationData(
        name="x",
        document_position=0,
        span_id="468d2810f529b6e9",
        annotator_kind="LLM",
        result={"label": "relevant", "score": 0.9},
    ),
    SpanDocumentAnnotationData(
        name="x",
        document_position=1,
        span_id="468d2810f529b6e9",
        annotator_kind="LLM",
        result={"label": "irrelevant", "score": 0.1},
    ),
]


annotations = client.annotations.log_document_annotations(
    document_annotations=annotations, sync=True
)
print(annotations)
