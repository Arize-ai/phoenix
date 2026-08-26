"""The grain vocabularies and everything that has to agree with them.

``js/app/src/pages/project/evaluators/evaluatorBoundVariables.ts`` repeats the
names in :mod:`phoenix.server.online_eval.bound_variables` so the evaluator
editor can order and describe them without asking the server, and an evaluation
context reads the span names straight off the span document. Nothing generates
any of those lists from another, so these tests are the seam that holds them
together: a name the filter language gains or loses fails here until the
frontend list and the span document are edited to match.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Mapping

from phoenix.db import models
from phoenix.server.online_eval.bound_variables import (
    SESSION_BOUND_VARIABLE_NAMES,
    SPAN_BOUND_VARIABLE_NAMES,
)
from phoenix.server.online_eval.executor import span_eval_context

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


def _span_entity() -> Mapping[str, Any]:
    """The ``metadata.span`` document, built off an unsaved span."""
    start_time = datetime.now(timezone.utc)
    span = models.Span(
        span_id="span-under-test",
        parent_id=None,
        name="span",
        span_kind="LLM",
        start_time=start_time,
        end_time=start_time + timedelta(seconds=1),
        attributes={},
        events=[],
        status_code="OK",
        status_message="",
        cumulative_error_count=0,
        cumulative_llm_token_count_prompt=0,
        cumulative_llm_token_count_completion=0,
    )
    entity: Mapping[str, Any] = span_eval_context(span, trace_id="trace-under-test")["metadata"][
        "span"
    ]
    return entity


def test_every_span_name_is_readable_from_the_span_document() -> None:
    missing = set(SPAN_BOUND_VARIABLE_NAMES) - set(_span_entity())
    assert not missing, (
        f"The span document has no field for {sorted(missing)}. A span context reads "
        "each vocabulary name straight off that document, so a name the filter "
        "language gains needs the matching field added beside it."
    )


def test_neither_grain_root_name_collides_with_its_vocabulary() -> None:
    assert "span" not in SPAN_BOUND_VARIABLE_NAMES
    assert "session" not in SESSION_BOUND_VARIABLE_NAMES, (
        "A grain root shares `metadata` with the grain vocabulary, so a vocabulary "
        "name spelled like the root would shadow the record. Rename the new name."
    )
