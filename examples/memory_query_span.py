"""Trace a memory query with Phoenix OTEL.

Run a Phoenix server locally, then execute:

    python examples/memory_query_span.py
"""

from time import perf_counter

from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from phoenix.otel import register

MEMORIES = [
    {"id": "mem-1", "content": "User prefers concise release notes.", "score": 0.92},
    {"id": "mem-2", "content": "User works primarily in Python.", "score": 0.81},
]


def query_memory(query: str) -> list[dict[str, float | str]]:
    """Simulate a memory lookup that returns ranked results."""
    query_terms = set(query.lower().split())
    return [
        memory
        for memory in MEMORIES
        if query_terms.intersection(str(memory["content"]).lower().split())
    ]


tracer_provider = register(project_name="memory-query-example")
tracer = tracer_provider.get_tracer(__name__)

query = "What format does the user prefer for release notes?"
start_time = perf_counter()

with tracer.start_as_current_span("memory.query") as span:
    span.set_attribute(
        SpanAttributes.OPENINFERENCE_SPAN_KIND,
        OpenInferenceSpanKindValues.RETRIEVER.value,
    )
    span.set_attribute(SpanAttributes.INPUT_VALUE, query)
    span.set_attribute("memory.query", query)

    results = query_memory(query)
    latency_ms = (perf_counter() - start_time) * 1000
    top_score = float(results[0]["score"]) if results else 0.0

    span.set_attribute("memory.result_count", len(results))
    span.set_attribute("memory.top_score", top_score)
    span.set_attribute("memory.hit", bool(results))
    span.set_attribute("memory.latency_ms", latency_ms)

    for index, result in enumerate(results):
        span.set_attribute(f"retrieval.documents.{index}.document.id", str(result["id"]))
        span.set_attribute(
            f"retrieval.documents.{index}.document.content",
            str(result["content"]),
        )
        span.set_attribute(f"retrieval.documents.{index}.score", float(result["score"]))

    span.set_attribute("retrieval.documents", len(results))
    span.set_attribute(
        SpanAttributes.OUTPUT_VALUE,
        "\n".join(str(result["content"]) for result in results) or "No memory found.",
    )

print(f"memory.query returned {len(results)} result(s) in {latency_ms:.2f} ms")
