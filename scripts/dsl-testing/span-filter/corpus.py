"""Deliberately hostile span data for exercising the span-filter DSL.

A clean fixture never exercises a cast, and an empty one exercises nothing at
all -- a per-row failure cannot happen where there are no rows. Every value here
was chosen because some part of the DSL has to survive it: text where a number
is expected, all three JSON boolean encodings, nulls, containers where scalars
belong, multi-byte keys and annotation names.

The data is plain Python so it can be seeded onto either backend through the
ORM. Nothing here is dialect-specific; that is the point -- the same rows are
used to check that SQLite and PostgreSQL agree.
"""

from __future__ import annotations

from typing import Any, NamedTuple, Optional

PROJECT_NAME = "dsl-corpus"
TRACE_PREFIX = "dsl-corpus-"


class SpanSpec(NamedTuple):
    key: str
    """Stable identifier, used as the span_id and in expectations."""
    span_kind: str
    status_code: str
    latency_seconds: float
    attributes: dict[str, Any]
    why: str
    """What this row is here to break."""
    parent_id: Optional[str] = None


class AnnotationSpec(NamedTuple):
    span_key: str
    name: str
    label: Optional[str]
    score: Optional[float]
    why: str


# `flag` cycles through every encoding a JSON boolean can arrive in, `num`
# through castable and uncastable text, `r` is a bare key that a half-typed
# condition can collide with, and `deep`/`arr` are containers where a scalar is
# expected. `metadata` is populated separately from the top level so both
# `attributes['x']` and `metadata['x']` paths are covered.
SPANS: tuple[SpanSpec, ...] = (
    SpanSpec(
        key="s01",
        span_kind="LLM",
        status_code="OK",
        latency_seconds=1,
        attributes={
            "r": True,
            "flag": True,
            "num": "1.5",
            "input": {"value": "hello"},
            "deep": {"a": {"b": 1}},
            "arr": [1, 2, 3],
            "uni": "café",
            "dot.key": "v",
            "metadata": {"flag": True},
        },
        why="real JSON booleans and a genuinely numeric string",
    ),
    SpanSpec(
        key="s02",
        span_kind="CHAIN",
        status_code="ERROR",
        latency_seconds=2,
        attributes={
            "r": "yes",
            "flag": "true",
            "num": "abc",
            "input": {"value": "world"},
            "deep": {"a": {"b": 2}},
            "arr": ["x"],
            "uni": "naïve",
            "dot.key": "v",
            "metadata": {"flag": "true"},
        },
        why="textual booleans, and text that cannot be cast to a number",
    ),
    SpanSpec(
        key="s03",
        span_kind="TOOL",
        status_code="UNSET",
        latency_seconds=3,
        parent_id="missing-parent-s03",
        attributes={
            "r": 1,
            "flag": 1,
            "num": "1_000",
            "input": {"value": "hi"},
            "deep": {"a": {"b": 3}},
            "arr": [],
            "uni": "日本語",
            "dot.key": "v",
            "metadata": {"flag": 1},
        },
        why="numeric boolean encoding, underscore literal PostgreSQL rejects, orphan",
    ),
    SpanSpec(
        key="s04",
        span_kind="RETRIEVER",
        status_code="OK",
        latency_seconds=4,
        attributes={
            "r": None,
            "flag": None,
            "num": "nan",
            "input": {"value": None},
            "deep": {},
            "arr": None,
            "uni": "",
            "dot.key": "v",
            "metadata": {"flag": None},
        },
        why="JSON null everywhere, and the non-finite float spellings",
    ),
    SpanSpec(
        key="s05",
        span_kind="LLM",
        status_code="ERROR",
        latency_seconds=5,
        attributes={
            "r": {"nested": True},
            "flag": False,
            "num": "inf",
            "input": {"value": "x"},
            "deep": {"a": None},
            "arr": [[1]],
            "uni": "ünïcodé",
            "dot.key": "v",
            "metadata": {"flag": False},
        },
        why="containers where a scalar is expected",
    ),
    SpanSpec(
        key="s06",
        span_kind="CHAIN",
        status_code="UNSET",
        latency_seconds=6,
        parent_id="missing-parent-s06",
        attributes={
            "r": "",
            "flag": "false",
            "num": " 12 ",
            "input": {"value": "  "},
            "deep": {"a": {"b": 0}},
            "arr": [0],
            "uni": " ",
            "dot.key": "v",
            "metadata": {"flag": "false"},
        },
        why="empty and whitespace strings, padded numerics, second orphan",
    ),
    SpanSpec(
        key="s07",
        span_kind="TOOL",
        status_code="OK",
        latency_seconds=7,
        attributes={
            "r": 0,
            "flag": 0,
            "num": 42,
            "input": {"value": "ok"},
            "deep": {"a": {"b": 7}},
            "arr": [7],
            "uni": "plain",
            "dot.key": "v",
            "metadata": {"flag": 0},
        },
        why="the well-behaved control row",
    ),
    SpanSpec(
        key="s08",
        span_kind="RETRIEVER",
        status_code="ERROR",
        latency_seconds=8,
        attributes={
            "r": False,
            "flag": "TRUE",
            "num": "-0.5",
            "input": {"value": "neg"},
            "uni": "x",
            "dot.key": "v",
            "llm": {"token_count": {"total": "not-a-number", "prompt": "10"}},
            "metadata": {"flag": "TRUE"},
        },
        why="known-numeric attributes holding text; mixed-case textual boolean",
    ),
    SpanSpec(
        key="bare01",
        span_kind="CHAIN",
        status_code="OK",
        latency_seconds=9,
        attributes={"num": 3},
        why="carries no annotations, so LEFT JOIN semantics are exercised",
    ),
    SpanSpec(
        key="bare02",
        span_kind="CHAIN",
        status_code="OK",
        latency_seconds=10,
        attributes={"num": 3},
        why="second annotation-free span",
    ),
)

# `quality` covers every span so existence checks have a full population;
# `hallucination` covers only half so a two-name conjunction has to narrow.
# The remaining names exist to stress the aliaser, which splices by byte offset.
ANNOTATIONS: tuple[AnnotationSpec, ...] = (
    AnnotationSpec("s01", "quality", "high", 0.1, "numeric-looking label absent"),
    AnnotationSpec("s02", "quality", "low", 0.2, ""),
    AnnotationSpec("s03", "quality", "100", 0.3, "label that looks like a number"),
    AnnotationSpec("s04", "quality", "", None, "empty label and NULL score"),
    AnnotationSpec("s05", "quality", "n/a", 0.5, ""),
    AnnotationSpec("s06", "quality", "0.5", 0.6, "label that parses as a float"),
    AnnotationSpec("s07", "quality", "TRUE", 0.7, "label that looks like a boolean"),
    AnnotationSpec("s08", "quality", "not-a-number", None, "second NULL score"),
    AnnotationSpec("s01", "hallucination", "no", 0.05, ""),
    AnnotationSpec("s02", "hallucination", "yes", 0.10, ""),
    AnnotationSpec("s03", "hallucination", "no", 0.15, ""),
    AnnotationSpec("s04", "hallucination", "yes", 0.20, ""),
    AnnotationSpec("s01", "Q&A Correctness", "lbl-1", 0.75, "ampersand and space in the name"),
    AnnotationSpec("s02", "Q&A Correctness", "lbl-2", 0.75, ""),
    AnnotationSpec("s01", "café", "lbl-1", 0.75, "multi-byte name; byte vs character offsets"),
    AnnotationSpec("s02", "café", "lbl-2", 0.75, ""),
    AnnotationSpec("s01", "日本語", "lbl-1", 0.75, "wider multi-byte name"),
    AnnotationSpec("s02", "日本語", "lbl-2", 0.75, ""),
    AnnotationSpec("s01", "span_annotation_0", "lbl-1", 0.75, "collides with the alias prefix"),
    AnnotationSpec("s02", "span_annotation_0", "lbl-2", 0.75, ""),
)


def annotation_names() -> tuple[str, ...]:
    seen: dict[str, None] = {}
    for annotation in ANNOTATIONS:
        seen.setdefault(annotation.name, None)
    return tuple(seen)
