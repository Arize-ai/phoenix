"""The authoring surface mirrors this module's vocabulary, and the two must agree.

``js/app/src/pages/project/evaluators/evaluatorBoundVariables.ts`` repeats the
names in :mod:`phoenix.server.online_eval.bound_variables` so the evaluator
editor can order and describe them without asking the server. Nothing generates
one list from the other, so these tests are the seam that holds them together:
a name the filter language gains or loses changes the derived vocabulary here
and fails until the frontend list is edited to match.
"""

from __future__ import annotations

import re
from pathlib import Path

from phoenix.db.types.evaluators import InputMapping
from phoenix.server.online_eval.bound_variables import (
    SESSION_BOUND_VARIABLE_NAMES,
    SPAN_BOUND_VARIABLE_NAMES,
    bind_context_bound_variables,
)

_MIRROR = (
    Path(__file__).parents[4]
    / "js"
    / "app"
    / "src"
    / "pages"
    / "project"
    / "evaluators"
    / "evaluatorBoundVariables.ts"
)


def _mirrored_names(declaration: str) -> set[str]:
    """The names listed under one ``EvaluatorBoundVariable[]`` declaration."""
    source = _MIRROR.read_text(encoding="utf-8")
    block = re.search(
        rf"const {declaration}: EvaluatorBoundVariable\[\] = \[(.*?)^\];",
        source,
        re.DOTALL | re.MULTILINE,
    )
    assert block is not None, (
        f"No `{declaration}` declaration in {_MIRROR.name}. If it was renamed or "
        "restructured, update this test to read the new shape."
    )
    return set(re.findall(r'name:\s*"([^"]+)"', block.group(1)))


def test_span_vocabulary_matches_the_authoring_surface() -> None:
    assert _mirrored_names("SPAN_BOUND_VARIABLES") == set(SPAN_BOUND_VARIABLE_NAMES), (
        f"The span names in {_MIRROR.name} no longer match the ones an evaluation "
        "binds. Edit that list so the editor offers exactly what the server supplies."
    )


def test_session_vocabulary_matches_the_authoring_surface() -> None:
    assert _mirrored_names("SESSION_BOUND_VARIABLES") == set(SESSION_BOUND_VARIABLE_NAMES), (
        f"The session names in {_MIRROR.name} no longer match the ones an evaluation "
        "binds. Edit that list so the editor offers exactly what the server supplies."
    )


def _schema(*names: str) -> dict[str, object]:
    return {"properties": {name: {} for name in names}}


class TestBindContextBoundVariables:
    """The preview path binds unmapped vocabulary names from the entity document."""

    def test_span_names_bind_from_the_span_document(self) -> None:
        bound = bind_context_bound_variables(
            context={"span": {"latency_ms": 12.5, "span_kind": "LLM", "output_value": "x"}},
            input_schema=_schema("output", "latency_ms", "span_kind"),
            input_mapping=InputMapping(path_mapping={}, literal_mapping={}),
        )
        assert bound.literal_mapping == {"latency_ms": 12.5, "span_kind": "LLM"}

    def test_session_names_bind_from_the_session_document(self) -> None:
        bound = bind_context_bound_variables(
            context={"session": {"num_traces": 3, "first_input": "hi", "turns": []}},
            input_schema=_schema("output", "num_traces", "first_input"),
            input_mapping=InputMapping(path_mapping={}, literal_mapping={}),
        )
        assert bound.literal_mapping == {"first_input": "hi", "num_traces": 3}

    def test_an_explicit_mapping_wins_over_the_document(self) -> None:
        original = InputMapping(
            path_mapping={"latency_ms": "span.attributes.custom"},
            literal_mapping={"span_kind": "CHAIN"},
        )
        bound = bind_context_bound_variables(
            context={"span": {"latency_ms": 12.5, "span_kind": "LLM"}},
            input_schema=_schema("latency_ms", "span_kind"),
            input_mapping=original,
        )
        assert bound is original

    def test_a_name_the_document_lacks_stays_unbound(self) -> None:
        original = InputMapping(path_mapping={}, literal_mapping={})
        bound = bind_context_bound_variables(
            context={"span": {"span_kind": "LLM"}},
            input_schema=_schema("latency_ms"),
            input_mapping=original,
        )
        assert bound is original

    def test_a_context_without_an_entity_document_is_untouched(self) -> None:
        original = InputMapping(path_mapping={}, literal_mapping={})
        bound = bind_context_bound_variables(
            context={"input": "question", "output": "answer"},
            input_schema=_schema("latency_ms"),
            input_mapping=original,
        )
        assert bound is original
