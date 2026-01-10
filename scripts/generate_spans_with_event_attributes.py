"""
Generate synthetic spans with events that have attributes using OpenTelemetry.

This script creates spans with various event types (info, exception) that include
custom attributes, useful for testing the Phoenix UI's display of span event attributes.
"""

from datetime import datetime
from random import choice, randint
from secrets import token_hex

from faker import Faker
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

fake = Faker()

# Phoenix server endpoint
endpoint = "http://localhost:6006/v1/traces"

# Set up the tracer
tracer_provider = TracerProvider(
    resource=Resource({"openinference.project.name": "EVENT_ATTRIBUTES_TEST"})
)
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))
tracer = tracer_provider.get_tracer(__name__)


def create_llm_span_with_events():
    """Create an LLM span with various events that have attributes."""
    with tracer.start_as_current_span(f"llm_call_{token_hex(4)}") as span:
        span.set_attribute("openinference.span.kind", "LLM")
        span.set_attribute("llm.model_name", choice(["gpt-4", "claude-3-opus", "gemini-pro"]))
        span.set_attribute("llm.provider", choice(["openai", "anthropic", "google"]))
        span.set_attribute("input.value", fake.text(max_nb_chars=100))
        span.set_attribute("output.value", fake.text(max_nb_chars=200))

        # Add info event with attributes
        span.add_event(
            name="model.config",
            attributes={
                "temperature": 0.7,
                "max_tokens": 1000,
                "top_p": 0.9,
                "frequency_penalty": 0.0,
                "presence_penalty": 0.0,
                "model_version": "2024-01-15",
            },
        )

        # Add another info event with different attributes
        span.add_event(
            name="cache.hit",
            attributes={
                "cache_key": token_hex(8),
                "cache_ttl": 3600,
                "hit_ratio": 0.85,
                "cache_backend": "redis",
            },
        )


def create_chain_span_with_events():
    """Create a chain span with nested LLM calls and events."""
    with tracer.start_as_current_span(f"chain_{token_hex(4)}") as span:
        span.set_attribute("openinference.span.kind", "CHAIN")
        span.set_attribute("input.value", fake.sentence())

        # Add workflow event with attributes
        span.add_event(
            name="workflow.step.start",
            attributes={
                "step_name": "data_processing",
                "step_index": 0,
                "total_steps": 3,
                "workflow_id": token_hex(6),
            },
        )

        # Create child LLM spans
        for i in range(randint(1, 3)):
            create_llm_span_with_events()

        # Add completion event
        span.add_event(
            name="workflow.step.complete",
            attributes={
                "step_name": "data_processing",
                "duration_ms": randint(100, 5000),
                "items_processed": randint(10, 100),
                "success": True,
            },
        )

        span.set_attribute("output.value", fake.sentence())


def create_retriever_span_with_events():
    """Create a retriever span with search and ranking events."""
    with tracer.start_as_current_span(f"retriever_{token_hex(4)}") as span:
        span.set_attribute("openinference.span.kind", "RETRIEVER")
        span.set_attribute("input.value", fake.question())

        # Add search event with attributes
        span.add_event(
            name="search.query.executed",
            attributes={
                "query": fake.question(),
                "index_name": "documents",
                "search_type": "semantic",
                "embedding_model": "text-embedding-ada-002",
                "top_k": 10,
                "similarity_threshold": 0.75,
            },
        )

        # Add ranking event
        span.add_event(
            name="results.reranked",
            attributes={
                "reranker_model": "cross-encoder",
                "num_candidates": 10,
                "num_results": 5,
                "rerank_time_ms": randint(50, 200),
            },
        )

        # Set output with retrieved documents
        documents = [{"text": fake.text(), "score": fake.pyfloat(min_value=0.5, max_value=1.0)}
                    for _ in range(5)]
        span.set_attribute("retrieval.documents", str(documents))


def create_span_with_exception_event():
    """Create a span with an exception event that has attributes."""
    with tracer.start_as_current_span(f"failed_operation_{token_hex(4)}") as span:
        span.set_attribute("openinference.span.kind", "CHAIN")

        # Add exception event with attributes
        error_types = ["TimeoutError", "ValueError", "ConnectionError", "RateLimitError"]
        error_type = choice(error_types)

        span.add_event(
            name="exception",
            attributes={
                "exception.type": error_type,
                "exception.message": f"Operation failed: {fake.sentence()}",
                "exception.stacktrace": f"  File \"/app/main.py\", line {randint(10, 100)}, in process\n    {fake.sentence()}",
                "exception.escaped": False,
                "retry_attempt": randint(1, 3),
                "max_retries": 3,
                "error_code": f"ERR_{randint(1000, 9999)}",
            },
        )

        # Mark span as error
        span.set_status(trace.Status(trace.StatusCode.ERROR, f"{error_type}: Operation failed"))


def create_tool_span_with_events():
    """Create a tool span with execution events."""
    with tracer.start_as_current_span(f"tool_{token_hex(4)}") as span:
        span.set_attribute("openinference.span.kind", "TOOL")
        span.set_attribute("tool.name", choice(["calculator", "weather_api", "database_query"]))

        # Add tool execution event
        span.add_event(
            name="tool.execution.start",
            attributes={
                "tool_version": "1.2.0",
                "parameters": str({"arg1": fake.word(), "arg2": randint(1, 100)}),
                "execution_mode": "async",
            },
        )

        # Add validation event
        span.add_event(
            name="tool.input.validated",
            attributes={
                "validation_schema": "json_schema_v7",
                "validation_time_ms": randint(1, 10),
                "valid": True,
            },
        )

        # Add result event
        span.add_event(
            name="tool.execution.complete",
            attributes={
                "execution_time_ms": randint(100, 2000),
                "result_size_bytes": randint(100, 10000),
                "cache_written": choice([True, False]),
            },
        )


def main():
    """Generate various types of spans with events that have attributes."""
    print("Generating spans with event attributes...")
    print(f"Target endpoint: {endpoint}")
    print()

    # Create multiple traces with different span types
    for i in range(5):
        print(f"Creating trace {i + 1}/5...")

        with tracer.start_as_current_span(f"trace_root_{token_hex(4)}") as root_span:
            root_span.set_attribute("openinference.span.kind", "CHAIN")
            root_span.set_attribute("session.id", f"session_{randint(1, 10)}")
            root_span.set_attribute("user.id", f"user_{randint(1, 100)}")

            # Add trace-level event
            root_span.add_event(
                name="trace.started",
                attributes={
                    "timestamp": datetime.now().isoformat(),
                    "trace_id": token_hex(16),
                    "environment": "development",
                    "version": "1.0.0",
                },
            )

            # Create various types of child spans
            create_llm_span_with_events()
            create_chain_span_with_events()
            create_retriever_span_with_events()
            create_tool_span_with_events()

            # Randomly add a span with an exception
            if randint(0, 1):
                create_span_with_exception_event()

            # Add trace completion event
            root_span.add_event(
                name="trace.completed",
                attributes={
                    "total_duration_ms": randint(1000, 10000),
                    "num_spans": randint(5, 20),
                    "status": "success",
                },
            )

    # Flush to ensure all spans are sent
    tracer_provider.force_flush()
    print()
    print("✓ Successfully generated spans with event attributes!")
    print("Check Phoenix UI at http://localhost:6006 to view the traces.")


if __name__ == "__main__":
    main()
