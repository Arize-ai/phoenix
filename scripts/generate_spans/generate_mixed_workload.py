from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta

from opentelemetry.trace import StatusCode

try:
    from ._shared import (
        Generator,
        add_common_arguments,
        document_attributes,
        duration_for,
        llm_attributes,
        message_attributes,
        ns,
        positive_int,
        probability,
        random_status,
        utc_now,
    )
except ImportError:  # Support direct execution from this directory.
    from _shared import (
        Generator,
        add_common_arguments,
        document_attributes,
        duration_for,
        llm_attributes,
        message_attributes,
        ns,
        positive_int,
        probability,
        random_status,
        utc_now,
    )

# Every kind OpenInference defines except UNKNOWN, which is not emitted directly — it is what
# Phoenix falls back to for an unrecognized kind, so `--malformed-rate` is what produces it.
SPAN_KINDS = (
    "AGENT",
    "CHAIN",
    "LLM",
    "TOOL",
    "RETRIEVER",
    "RERANKER",
    "EMBEDDING",
    "GUARDRAIL",
    "EVALUATOR",
    "PROMPT",
)
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
TAGS = ["support", "billing", "onboarding", "regression", "canary"]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate a bounded mix of realistic OpenInference span kinds."
    )
    add_common_arguments(parser, default_project="mixed-workload")
    parser.add_argument(
        "--traces",
        type=positive_int,
        default=100,
        help="Number of root traces to generate (default: 100).",
    )
    parser.add_argument(
        "--max-depth",
        type=positive_int,
        default=3,
        help="Deepest span nesting level in a trace (default: 3).",
    )
    parser.add_argument(
        "--max-width",
        type=positive_int,
        default=3,
        help="Most children any one span may have (default: 3).",
    )
    parser.add_argument(
        "--max-items",
        type=positive_int,
        default=3,
        help="Maximum messages, documents, or embeddings per span (default: 3).",
    )
    parser.add_argument(
        "--embedding-dimensions",
        type=positive_int,
        default=64,
        help="Vector length on EMBEDDING spans (default: 64).",
    )
    parser.add_argument(
        "--error-rate",
        type=probability,
        default=0.08,
        help="Probability that a span carries ERROR status (default: 0.08).",
    )
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
    return document_attributes(
        (
            {
                "id": f"doc-{generator.rng.randint(1_000, 9_999)}",
                "content": generator.rng.choice(DOCUMENTS),
                "score": round(generator.rng.uniform(0.55, 0.99), 4),
                "metadata": {"source": "synthetic-knowledge-base", "rank": index + 1},
            }
            for index in range(count)
        ),
        prefix,
    )


def _messages(generator: Generator, count: int, prefix: str) -> dict[str, object]:
    role = "user" if prefix.endswith("input_messages") else "assistant"
    return message_attributes(
        (
            {
                "role": role,
                "content": generator.rng.choice(QUERIES if role == "user" else DOCUMENTS),
            }
            for _ in range(count)
        ),
        prefix,
    )


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
        # tag.tags is a list attribute, and the only place in the package that exercises one
        # besides embedding vectors.
        "tag.tags": generator.rng.sample(TAGS, generator.rng.randint(1, 3)),
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
            "reranker.top_k": max(1, item_count // 2),
            **_documents(generator, item_count, "reranker.input_documents"),
            **_documents(generator, max(1, item_count // 2), "reranker.output_documents"),
        }
    if span_kind == "TOOL":
        return {
            **base,
            "tool.name": "knowledge_base_search",
            "tool.parameters": json.dumps({"top_k": item_count}),
        }
    if span_kind == "GUARDRAIL":
        # No guardrail-specific semantic conventions exist; the verdict is the span's output.
        blocked = generator.rng.random() < 0.15
        return {
            **base,
            "output.value": "blocked" if blocked else "allowed",
            "metadata": json.dumps(
                {"fixture": "mixed-workload", "policy": "pii-and-toxicity", "blocked": blocked}
            ),
        }
    if span_kind == "EVALUATOR":
        score = round(generator.rng.betavariate(4.0, 2.0), 4)
        return {
            **base,
            "output.value": "correct" if score >= 0.5 else "incorrect",
            "metadata": json.dumps(
                {"fixture": "mixed-workload", "evaluator": "qa_correctness", "score": score}
            ),
        }
    if span_kind == "PROMPT":
        return {
            **base,
            "llm.prompt_template.template": "Answer the question using {context}: {question}",
            "llm.prompt_template.variables": json.dumps(
                {"context": generator.rng.choice(DOCUMENTS), "question": base["input.value"]}
            ),
            "llm.prompt_template.version": f"v{generator.rng.randint(1, 3)}",
        }
    return base


# Roughly how long each kind of work takes when it is not dominated by generation. LLM spans
# get their duration from the tokens they produced instead (see duration_for).
KIND_SECONDS = {
    "EMBEDDING": (0.01, 0.08),
    "RETRIEVER": (0.02, 0.25),
    "RERANKER": (0.03, 0.20),
    "TOOL": (0.05, 0.90),
    "GUARDRAIL": (0.01, 0.12),
    "EVALUATOR": (0.10, 0.60),
    "PROMPT": (0.001, 0.01),
}


class _Node:
    """One planned span. Timing is resolved before anything is emitted.

    `Generator.span` needs both timestamps up front, so a parent cannot know its own end until
    its children are known. Planning the tree first is what lets a parent's duration be the
    sum of the work beneath it rather than an independently drawn number, which is the only
    way a waterfall reads as real work.
    """

    __slots__ = ("kind", "attributes", "status", "children", "own", "duration")

    def __init__(self, kind, attributes, status, children, own):  # noqa: ANN001
        self.kind = kind
        self.attributes = attributes
        self.status = status
        self.children = children
        self.own = own
        self.duration = own + sum(child.duration for child in children)


def _plan(generator: Generator, args: argparse.Namespace, depth: int, budget: list[int]) -> _Node:
    budget[0] += 1
    if budget[0] > args.max_spans:
        raise ValueError(f"generated workload exceeds --max-spans={args.max_spans:,}")
    malformed = generator.rng.random() < args.malformed_rate
    span_kind = "INVALID_\N{ROBOT FACE}" if malformed else generator.rng.choice(SPAN_KINDS)
    attributes = _attributes(generator, args, span_kind)
    status = random_status(generator.rng, error_rate=args.error_rate)
    if span_kind == "LLM":
        own = duration_for(generator.rng, int(attributes.get("llm.token_count.completion", 0)))
    else:
        own = generator.rng.uniform(*KIND_SECONDS.get(span_kind, (0.01, 0.15)))
    children = (
        []
        if depth >= args.max_depth
        else [
            _plan(generator, args, depth + 1, budget)
            for _ in range(generator.rng.randint(0, args.max_width))
        ]
    )
    return _Node(span_kind, attributes, status, children, own)


def _emit(generator: Generator, node: _Node, start: datetime, *, root: bool) -> None:
    with generator.span(
        f"{node.kind.lower()}-operation",
        node.kind,
        attributes=node.attributes,
        start_time=ns(start),
        end_time=ns(start + timedelta(seconds=node.duration)),
        status=node.status,
        status_message=(
            "synthetic downstream request failed" if node.status is StatusCode.ERROR else None
        ),
        root=root,
    ) as span:
        if node.status is StatusCode.ERROR:
            span.record_exception(RuntimeError("synthetic downstream request failed"))
        # The parent does a little of its own work before delegating, so children sit inside
        # the parent's window rather than starting flush with it.
        cursor = start + timedelta(seconds=node.own / 2)
        for child in node.children:
            _emit(generator, child, cursor, root=False)
            cursor += timedelta(seconds=child.duration)


def generate(args: argparse.Namespace) -> Generator:
    generator = Generator.from_args(args)
    budget = [0]
    try:
        for _ in range(args.traces):
            node = _plan(generator, args, 1, budget)
            _emit(generator, node, utc_now() - timedelta(seconds=node.duration), root=True)
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
