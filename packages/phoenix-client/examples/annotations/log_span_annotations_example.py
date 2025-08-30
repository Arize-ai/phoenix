from openai import OpenAI

from phoenix.client import Client

openai = OpenAI()

openai.chat.completions.create(model="gpt-4o", messages=[{"role": "user", "content": "bla"}])
client = Client()

# Add a single span annotation
annotation = client.annotations.add_span_annotation(
    span_id="5fc5e05698943a2b",
    annotation_name="sentiment",
    label="positive",
    score=0.9,
)

# Log multiple annotations
annotations = [
    {
        "name": "sentiment",
        "span_id": "5fc5e05698943a2b",
        "annotator_kind": "HUMAN",
        "result": {"label": "positive", "score": 0.9},
    },
    {
        "name": "sentiment",
        "span_id": "4acfd24afcd04f2a",
        "annotator_kind": "HUMAN",
        "result": {"label": "negative", "score": 0.1},
    },
]


client.annotations.log_span_annotations(span_annotations=annotations)
