from __future__ import annotations

import argparse
import json
from datetime import timezone

from opentelemetry.trace import Status, StatusCode

try:
    from ._shared import (
        Generator,
        add_common_arguments,
        llm_attributes,
        non_negative_int,
        positive_int,
    )
except ImportError:  # Support direct execution from this directory.
    from _shared import (
        Generator,
        add_common_arguments,
        llm_attributes,
        non_negative_int,
        positive_int,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate spans with representative structured events and exceptions."
    )
    add_common_arguments(parser, default_project="event-attributes")
    parser.add_argument(
        "--traces",
        type=positive_int,
        default=5,
        help="Number of traces to generate (default: 5).",
    )
    parser.add_argument(
        "--exceptions-per-trace",
        type=non_negative_int,
        default=2,
        help="Exception spans attached to each trace (default: 2).",
    )
    return parser


def _llm_span(generator: Generator, index: int) -> None:
    model_attributes = llm_attributes(
        generator.rng,
        input_value="Summarize the account and recommend the next support action.",
        output_value="The account is healthy; follow up on the pending renewal.",
    )
    with generator.span(f"llm-call-{index}", "LLM", attributes=model_attributes) as span:
        span.add_event(
            "model.config",
            {
                "temperature": 0.2,
                "max_tokens": 1_000,
                "top_p": 0.9,
                "model_version": "production",
            },
        )
        span.add_event(
            "cache.lookup",
            {
                "cache_key": f"account:{generator.rng.randint(1_000, 9_999)}",
                "cache_ttl": 3_600,
                "hit": generator.rng.random() < 0.7,
                "cache_backend": "redis",
            },
        )
        if generator.rng.random() < 0.2:
            span.add_event(
                "rate_limit.warning",
                {"current_rate": 95, "max_rate": 100, "window_seconds": 60},
            )


def _chain_span(generator: Generator) -> None:
    with generator.span(
        "support-workflow",
        "CHAIN",
        attributes={"input.value": "Resolve the customer's account question."},
    ) as span:
        workflow_id = f"workflow-{generator.rng.randint(10_000, 99_999)}"
        span.add_event(
            "workflow.step.start",
            {"step_name": "account_review", "step_index": 1, "workflow_id": workflow_id},
        )
        for index in range(generator.rng.randint(1, 3)):
            _llm_span(generator, index + 1)
        span.add_event(
            "workflow.step.complete",
            {
                "step_name": "account_review",
                "duration_ms": generator.rng.randint(180, 1_800),
                "items_processed": generator.rng.randint(3, 20),
                "success": True,
            },
        )
        span.set_attribute("output.value", "The support workflow completed successfully.")


def _retriever_span(generator: Generator) -> None:
    query = "What changed in the customer's account?"
    with generator.span(
        "account-retrieval", "RETRIEVER", attributes={"input.value": query}
    ) as span:
        span.add_event(
            "search.query.executed",
            {
                "query": query,
                "index_name": "account-documents",
                "search_type": "hybrid",
                "embedding_model": "text-embedding-3-small",
                "top_k": 10,
                "similarity_threshold": 0.75,
            },
        )
        span.add_event(
            "results.reranked",
            {
                "reranker_model": "cohere-rerank-v3.5",
                "num_candidates": 10,
                "num_results": 5,
                "rerank_time_ms": generator.rng.randint(35, 140),
            },
        )
        if generator.rng.random() < 0.25:
            span.add_event(
                "vector_db.retry",
                {
                    "error_type": "ConnectionTimeout",
                    "database": "pgvector",
                    "retry_count": 1,
                    "timeout_ms": 2_000,
                    "fallback_used": True,
                },
            )
        documents = [
            {
                "id": f"account-note-{index + 1}",
                "text": "A recent account note with relevant support context.",
                "score": round(generator.rng.uniform(0.72, 0.98), 3),
            }
            for index in range(5)
        ]
        span.set_attribute("retrieval.documents", json.dumps(documents))


def _tool_span(generator: Generator) -> None:
    with generator.span(
        "lookup-account",
        "TOOL",
        attributes={"tool.name": "account_lookup"},
    ) as span:
        span.add_event(
            "tool.execution.start",
            {
                "tool_version": "2.1.0",
                "parameters": json.dumps({"account_id": "acct-1234"}),
                "execution_mode": "async",
            },
        )
        span.add_event(
            "tool.input.validated",
            {"validation_schema": "json-schema-2020-12", "validation_time_ms": 2, "valid": True},
        )
        span.add_event(
            "tool.execution.complete",
            {
                "execution_time_ms": generator.rng.randint(40, 350),
                "result_size_bytes": generator.rng.randint(500, 4_000),
                "cache_written": generator.rng.random() < 0.4,
            },
        )


def _exception_span(generator: Generator, index: int) -> None:
    error_type = generator.rng.choice(
        ("TimeoutError", "ValidationError", "ConnectionError", "RateLimitError")
    )
    message = f"{error_type}: the synthetic downstream operation failed"
    with generator.span(f"failed-operation-{index}", "CHAIN", status=StatusCode.ERROR) as span:
        span.add_event(
            "exception",
            {
                "exception.type": error_type,
                "exception.message": message,
                "exception.stacktrace": (
                    '  File "/app/workflow.py", line 42, in run\n'
                    "    raise DownstreamOperationError()"
                ),
                "exception.escaped": False,
                "retry_attempt": generator.rng.randint(1, 3),
                "max_retries": 3,
                "error_code": f"ERR_{generator.rng.randint(1_000, 9_999)}",
            },
        )
        span.set_status(Status(StatusCode.ERROR, message))


def generate(args: argparse.Namespace) -> Generator:
    generator = Generator.from_args(args)
    try:
        for trace_index in range(args.traces):
            with generator.span(
                f"support-request-{trace_index + 1}",
                "CHAIN",
                attributes={
                    "session.id": (
                        f"session-{generator.rng.randint(1, max(2, args.traces // 2 + 1))}"
                    ),
                    "user.id": f"user-{generator.rng.randint(1, 100)}",
                },
                root=True,
            ) as root:
                span_count_at_root_start = generator.span_count
                root.add_event(
                    "trace.started",
                    {
                        "timestamp": datetime_now_iso(),
                        "environment": "development",
                        "version": "1.0.0",
                    },
                )
                _llm_span(generator, 1)
                _chain_span(generator)
                _retriever_span(generator)
                _tool_span(generator)
                for exception_index in range(args.exceptions_per_trace):
                    _exception_span(generator, exception_index + 1)
                root.add_event(
                    "trace.completed",
                    {
                        "child_spans": generator.span_count - span_count_at_root_start,
                        "status": "completed_with_test_errors"
                        if args.exceptions_per_trace
                        else "success",
                    },
                )
    except BaseException:
        generator.close()
        raise
    return generator


def datetime_now_iso() -> str:
    from datetime import datetime

    return datetime.now(timezone.utc).isoformat()


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generator = generate(args)
    generator.close()
    generator.print_summary()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
