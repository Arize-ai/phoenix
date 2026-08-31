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

import pytest

from phoenix.db import models
from phoenix.server.api.helpers.dataset_helpers import get_span_annotations_by_name
from phoenix.server.online_eval.bound_variables import (
    SESSION_BOUND_VARIABLE_NAMES,
    SESSION_METADATA_FIELD_NAMES,
    SESSION_TURN_FIELD_NAMES,
    SPAN_ANNOTATION_ENTRY_FIELD_NAMES,
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


def _mirrored_string_array(declaration: str) -> set[str]:
    """The strings listed under one ``as const`` array declaration."""
    source = _MIRROR.read_text(encoding="utf-8")
    block = re.search(
        rf"const {declaration} = \[(.*?)\] as const;",
        source,
        re.DOTALL,
    )
    assert block is not None, (
        f"No `{declaration}` declaration in {_MIRROR.name}. If it was renamed or "
        "restructured, update this test to read the new shape."
    )
    return set(re.findall(r'"([^"]+)"', block.group(1)))


def _mirrored_grain_table(declaration: str) -> dict[str, str]:
    """Which per-grain declaration each grain of one lookup table points at."""
    source = _MIRROR.read_text(encoding="utf-8")
    block = re.search(
        rf"const {declaration}: Record<.*?> = \{{(.*?)^\}};",
        source,
        re.DOTALL | re.MULTILINE,
    )
    assert block is not None, (
        f"No `{declaration}` lookup in {_MIRROR.name}. If it was renamed or "
        "restructured, update this test to read the new shape."
    )
    return dict(re.findall(r"^\s*(\w+):\s*(\w+),", block.group(1), re.MULTILINE))


# A new grain (or a new mirrored shape) is one row here: without its row, the
# frontend can gain or lose a whole list and nothing fails.
_MIRRORED_NAME_SETS = [
    pytest.param(SPAN_BOUND_VARIABLE_NAMES, "SPAN_BOUND_VARIABLES", id="span-vocabulary"),
    pytest.param(SESSION_BOUND_VARIABLE_NAMES, "SESSION_BOUND_VARIABLES", id="session-vocabulary"),
    pytest.param(SPAN_METADATA_FIELD_NAMES, "SPAN_METADATA_FIELDS", id="span-record-fields"),
    pytest.param(
        SESSION_METADATA_FIELD_NAMES, "SESSION_METADATA_FIELDS", id="session-record-fields"
    ),
]

# Every grain the authoring surface routes, and the declaration it routes to.
# A grain added on one side only is invisible to the pair checks above, which
# see registered declarations and nothing else.
_GRAIN_TABLES = ("BOUND_VARIABLES_BY_GRAIN", "METADATA_FIELDS_BY_GRAIN")

_REGISTERED_MIRROR_DECLARATIONS = frozenset(str(param.values[1]) for param in _MIRRORED_NAME_SETS)

_MIRRORED_STRING_ARRAYS = [
    pytest.param(SESSION_TURN_FIELD_NAMES, "SESSION_TURN_FIELDS", id="session-turn-fields"),
    pytest.param(
        SPAN_ANNOTATION_ENTRY_FIELD_NAMES, "SPAN_ANNOTATION_FIELDS", id="span-annotation-fields"
    ),
]


@pytest.mark.parametrize("grain_table", _GRAIN_TABLES)
def test_every_grain_is_held_to_a_server_vocabulary(grain_table: str) -> None:
    """A grain the editor offers but this test never mirrors is the gap itself.

    The pair checks read the declarations ``_MIRRORED_NAME_SETS`` names, so a
    grain added to the authoring surface without its row there drifts freely.
    This reads the grains off the editor's own lookup tables instead.
    """
    unregistered = {
        grain: ts_declaration
        for grain, ts_declaration in _mirrored_grain_table(grain_table).items()
        if ts_declaration not in _REGISTERED_MIRROR_DECLARATIONS
    }
    assert not unregistered, (
        f"`{grain_table}` in {_MIRROR.name} routes grains this test does not "
        f"check: {unregistered}. Add a `_MIRRORED_NAME_SETS` row pairing each "
        "declaration with its phoenix.server.online_eval.bound_variables "
        "constant, so the grain's names are held to what an evaluation binds."
    )


@pytest.mark.parametrize("server_names,ts_declaration", _MIRRORED_NAME_SETS)
def test_vocabulary_and_record_fields_match_the_authoring_surface(
    server_names: frozenset[str], ts_declaration: str
) -> None:
    assert _mirrored_names(ts_declaration) == set(server_names), (
        f"`{ts_declaration}` in {_MIRROR.name} no longer matches the names an "
        "evaluation binds. Edit that list so the editor offers exactly what the "
        "server supplies."
    )


@pytest.mark.parametrize("server_names,ts_declaration", _MIRRORED_STRING_ARRAYS)
def test_entry_shapes_match_the_authoring_surface(
    server_names: frozenset[str], ts_declaration: str
) -> None:
    assert _mirrored_string_array(ts_declaration) == set(server_names), (
        f"`{ts_declaration}` in {_MIRROR.name} no longer matches the entry shape the server builds."
    )


def test_annotation_entries_carry_exactly_the_declared_fields() -> None:
    annotation = models.SpanAnnotation(
        span_rowid=1,
        name="correctness",
        annotator_kind="LLM",
        label="correct",
        score=1.0,
        explanation="",
        metadata_={},
        identifier="",
        source="APP",
        user_id=None,
    )
    (entry,) = get_span_annotations_by_name([annotation])["correctness"]
    assert set(entry) == SPAN_ANNOTATION_ENTRY_FIELD_NAMES


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
