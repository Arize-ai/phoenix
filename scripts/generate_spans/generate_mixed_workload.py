from __future__ import annotations

import argparse
import json

from opentelemetry.trace import StatusCode

try:
    from ._shared import (
        Generator,
        add_common_arguments,
        llm_attributes,
        positive_int,
        probability,
        random_status,
    )
except ImportError:  # Support direct execution from this directory.
    from _shared import (
        Generator,
        add_common_arguments,
        llm_attributes,
        positive_int,
        probability,
        random_status,
    )

SPAN_KINDS = ("AGENT", "CHAIN", "LLM", "TOOL", "RETRIEVER", "RERANKER", "EMBEDDING")
QUERIES = (
    "How do I configure tracing for a production application?",
    "Summarize the latest account activity.",
    "Which document best answers the support question?",
)
DOCUMENTS = (
    "Production tracing should batch exports and set a stable project name.",
    "The account renewed recently and has one open support request.",
    "The troubleshooting guide explains the observed timeout and retry behavior.",
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate a bounded mix of realistic OpenInference span kinds."
    )
    add_common_arguments(parser, default_project="mixed-workload")
    parser.add_argument("--traces", type=positive_int, default=100)
    parser.add_argument("--max-depth", type=positive_int, default=3)
    parser.add_argument("--max-width", type=positive_int, default=3)
    parser.add_argument(
        "--max-items",
        type=positive_int,
        default=3,
        help="Maximum messages, documents, or embeddings per span (default: 3).",
    )
    parser.add_argument("--embedding-dimensions", type=positive_int, default=64)
    parser.add_argument("--error-rate", type=probability, default=0.08)
    parser.add_argument(
        "--malformed-rate",
        type=probability,
        default=0.0,
        help="Probability of an intentionally invalid span kind for UI fuzzing (default: 0).",
    )
    parser.add_argument(
        "--max-spans",
        type=positive_int,
        default=100_000,
        help="Safety limit checked while generating (default: 100000).",
    )
    return parser


def _documents(generator: Generator, count: int, prefix: str) -> dict[str, object]:
    attributes: dict[str, object] = {}
    for index in range(count):
        attributes[f"{prefix}.{index}.document.id"] = f"doc-{generator.rng.randint(1_000, 9_999)}"
        attributes[f"{prefix}.{index}.document.content"] = generator.rng.choice(DOCUMENTS)
        attributes[f"{prefix}.{index}.document.score"] = round(generator.rng.uniform(0.55, 0.99), 4)
        attributes[f"{prefix}.{index}.document.metadata"] = json.dumps(
            {"source": "synthetic-knowledge-base", "rank": index + 1}
        )
    return attributes


def _messages(generator: Generator, count: int, prefix: str) -> dict[str, object]:
    attributes: dict[str, object] = {}
    for index in range(count):
        role = "user" if prefix.endswith("input_messages") else "assistant"
        content = generator.rng.choice(QUERIES if role == "user" else DOCUMENTS)
        attributes[f"{prefix}.{index}.message.role"] = role
        attributes[f"{prefix}.{index}.message.content"] = content
    return attributes


def _attributes(
    generator: Generator,
    args: argparse.Namespace,
    span_kind: str,
) -> dict[str, object]:
    item_count = generator.rng.randint(1, args.max_items)
    base: dict[str, object] = {
        "input.value": generator.rng.choice(QUERIES),
        "input.mime_type": "text/plain",
        "output.value": generator.rng.choice(DOCUMENTS),
        "output.mime_type": "text/plain",
        "metadata": json.dumps({"fixture": "mixed-workload"}),
    }
    if span_kind == "LLM":
        return {
            **base,
            **llm_attributes(generator.rng),
            **_messages(generator, item_count, "llm.input_messages"),
            **_messages(generator, item_count, "llm.output_messages"),
        }
    if span_kind == "EMBEDDING":
        base["embedding.model_name"] = "text-embedding-3-small"
        for index in range(item_count):
            prefix = f"embedding.embeddings.{index}.embedding"
            base[f"{prefix}.text"] = generator.rng.choice(DOCUMENTS)
            base[f"{prefix}.vector"] = [
                generator.rng.uniform(-1, 1) for _ in range(args.embedding_dimensions)
            ]
        return base
    if span_kind == "RETRIEVER":
        return {**base, **_documents(generator, item_count, "retrieval.documents")}
    if span_kind == "RERANKER":
        return {
            **base,
            "reranker.query": generator.rng.choice(QUERIES),
            "reranker.model_name": "cohere-rerank-v3.5",
            **_documents(generator, item_count, "reranker.input_documents"),
            **_documents(generator, max(1, item_count // 2), "reranker.output_documents"),
        }
    if span_kind == "TOOL":
        return {
            **base,
            "tool.name": "knowledge_base_search",
            "tool.parameters": json.dumps({"top_k": item_count}),
        }
    return base


def _generate_span(
    generator: Generator,
    args: argparse.Namespace,
    *,
    depth: int,
    root: bool,
) -> None:
    if generator.span_count >= args.max_spans:
        raise ValueError(f"generated workload exceeds --max-spans={args.max_spans:,}")
    malformed = generator.rng.random() < args.malformed_rate
    span_kind = "INVALID_\N{ROBOT FACE}" if malformed else generator.rng.choice(SPAN_KINDS)
    status = random_status(generator.rng, error_rate=args.error_rate)
    with generator.span(
        f"{span_kind.lower()}-operation",
        span_kind,
        attributes=_attributes(generator, args, span_kind),
        status=status,
        root=root,
    ) as span:
        if status is StatusCode.ERROR:
            span.record_exception(RuntimeError("synthetic downstream request failed"))
        if depth >= args.max_depth:
            return
        for _ in range(generator.rng.randint(0, args.max_width)):
            _generate_span(generator, args, depth=depth + 1, root=False)


def generate(args: argparse.Namespace) -> Generator:
    generator = Generator.from_args(args)
    try:
        for _ in range(args.traces):
            _generate_span(generator, args, depth=1, root=True)
    except BaseException:
        generator.close()
        raise
    return generator


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generator = generate(args)
    generator.close()
    generator.print_summary()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
