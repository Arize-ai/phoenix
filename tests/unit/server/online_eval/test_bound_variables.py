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
    SESSION_METADATA_FIELD_NAMES,
    SPAN_BOUND_VARIABLE_NAMES,
    SPAN_METADATA_FIELD_NAMES,
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


def test_span_record_fields_match_the_authoring_surface() -> None:
    assert _mirrored_names("SPAN_METADATA_FIELDS") == set(SPAN_METADATA_FIELD_NAMES), (
        f"The span record fields in {_MIRROR.name} no longer match the ones a span "
        "context carries under `metadata`."
    )


def test_session_record_fields_match_the_authoring_surface() -> None:
    assert _mirrored_names("SESSION_METADATA_FIELDS") == set(SESSION_METADATA_FIELD_NAMES), (
        f"The session record fields in {_MIRROR.name} no longer match the ones a "
        "session context carries under `metadata`."
    )


def _span_metadata() -> Mapping[str, Any]:
    """A span context's ``metadata``, built off an unsaved span."""
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
    metadata: Mapping[str, Any] = span_eval_context(
        span, trace_id="trace-under-test", annotations=[]
    )["metadata"]
    return metadata


def test_span_metadata_is_exactly_the_vocabulary_and_the_record_fields() -> None:
    assert set(_span_metadata()) == SPAN_BOUND_VARIABLE_NAMES | SPAN_METADATA_FIELD_NAMES, (
        "A span context's `metadata` carries the filter vocabulary and the record "
        "fields, nothing else. A name the filter language gains needs its value "
        "added to the builder; a new record field is declared in "
        "SPAN_METADATA_FIELD_NAMES beside it."
    )


def test_no_record_field_name_collides_with_a_vocabulary_name() -> None:
    assert not SPAN_BOUND_VARIABLE_NAMES & SPAN_METADATA_FIELD_NAMES
    assert not SESSION_BOUND_VARIABLE_NAMES & SESSION_METADATA_FIELD_NAMES, (
        "Record fields share `metadata` with the grain vocabulary flat, so a "
        "vocabulary name spelled like a record field would shadow it. Rename "
        "the new name."
    )
