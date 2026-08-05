"""Traces that arrive incomplete, the way real collectors receive them.

Every other scenario emits whole traces: each span's parent is also exported. Production is
not like that. Head sampling drops the root, an exporter dies mid-flush, the root is still in
flight when the children land, or an upstream service was never instrumented. Phoenix has to
render those anyway, promoting an orphan to a pseudo-root.

Three shapes, each named so a specific failure is easy to find:

- ``orphan-child``   the root was never sent; one child stands alone
- ``missing-middle`` root and grandchild arrive, the span between them does not
- ``in-flight``      children have landed and the root has not (yet)
"""

from __future__ import annotations

import argparse
import json
from collections import Counter

try:
    from ._shared import (
        Generator,
        add_common_arguments,
        detached_parent,
        llm_attributes,
        positive_int,
    )
except ImportError:  # Support direct execution from this directory.
    from _shared import (
        Generator,
        add_common_arguments,
        detached_parent,
        llm_attributes,
        positive_int,
    )

QUESTION = "Summarize the incident and name the owner."
ANSWER = "Retry amplification after the 2.14.0 deploy; the service owner is on point."


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate traces whose spans are missing, as sampling and drops produce."
    )
    add_common_arguments(parser, default_project="partial-traces")
    parser.add_argument(
        "--traces",
        type=positive_int,
        default=12,
        help="Number of traces to generate for each shape (default: 12).",
    )
    parser.add_argument(
        "--children",
        type=positive_int,
        default=3,
        help="Children hanging off an unsent parent (default: 3).",
    )
    return parser


def _metadata(shape: str, note: str) -> str:
    return json.dumps({"fixture": "partial-traces", "shape": shape, "missing": note})


def _orphan_child(generator: Generator, args: argparse.Namespace, index: int) -> None:
    """The root was sampled away; a single child arrives with a parent nobody has."""
    with generator.span(
        "orphan-child",
        "LLM",
        attributes={
            **llm_attributes(generator.rng, input_value=QUESTION, output_value=ANSWER),
            "metadata": _metadata("orphan-child", "root"),
        },
        parent=detached_parent(generator.rng),
        root=True,
    ):
        pass


def _missing_middle(generator: Generator, args: argparse.Namespace, index: int) -> None:
    """Root and grandchild both arrive; the span joining them was dropped.

    The grandchild is attached to an unexported context *inside the root's trace*, so the
    trace is present and only the link between its two halves is missing.
    """
    with generator.span(
        "assistant-request",
        "CHAIN",
        attributes={
            "input.value": QUESTION,
            "output.value": ANSWER,
            "metadata": _metadata("missing-middle", "intermediate CHAIN span"),
        },
        root=True,
    ) as root:
        absent = detached_parent(generator.rng, within=root.get_span_context().trace_id)

    with generator.span(
        "rerank-context",
        "RERANKER",
        attributes={
            "reranker.query": QUESTION,
            "reranker.top_k": 2,
            "metadata": _metadata("missing-middle", "intermediate CHAIN span"),
        },
        parent=absent,
    ):
        pass


def _in_flight(generator: Generator, args: argparse.Namespace, index: int) -> None:
    """Children landed first and the root has not arrived — a trace still being written."""
    absent = detached_parent(generator.rng)
    for child in range(args.children):
        with generator.span(
            f"step-{child + 1}",
            "CHAIN",
            attributes={
                "input.value": QUESTION,
                "metadata": _metadata("in-flight", "root, still open"),
            },
            parent=absent,
            root=True,
        ):
            with generator.span(
                "chat-completion",
                "LLM",
                attributes=llm_attributes(generator.rng, output_value=ANSWER),
            ):
                pass


SHAPES = {
    "orphan-child": _orphan_child,
    "missing-middle": _missing_middle,
    "in-flight": _in_flight,
}


def generate(args: argparse.Namespace) -> tuple[Generator, Counter[str]]:
    """Return the generator plus a count of traces emitted per shape."""
    generator = Generator.from_args(args)
    emitted: Counter[str] = Counter()
    try:
        for shape, build in SHAPES.items():
            for index in range(args.traces):
                build(generator, args, index)
                emitted[shape] += 1
    except BaseException:
        generator.close()
        raise
    return generator, emitted


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generator, emitted = generate(args)
    generator.close()
    generator.print_summary()
    print("shapes=")
    for shape, count in sorted(emitted.items()):
        print(f"  {shape}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
