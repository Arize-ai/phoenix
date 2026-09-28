"""The grain vocabularies and everything that has to agree with them.

An evaluation context reads the span names straight off the span document, and
nothing generates one list from another, so these tests hold them together.
"""

from __future__ import annotations

import inspect
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

import pytest

from phoenix.db import models
from phoenix.server.api.helpers.dataset_helpers import (
    get_span_annotations_by_name,
    span_eval_context,
)
from phoenix.server.online_eval import bound_variables
from phoenix.server.online_eval.bound_variables import (
    SESSION_BOUND_VARIABLE_NAMES,
    SESSION_METADATA_FIELD_NAMES,
    SPAN_ANNOTATION_ENTRY_FIELD_NAMES,
    SPAN_BOUND_VARIABLE_NAMES,
    SPAN_METADATA_FIELD_NAMES,
    TRACE_BOUND_VARIABLE_NAMES,
    TRACE_METADATA_FIELD_NAMES,
)
from phoenix.trace.dsl.trace_filter import TRACE_BINDINGS


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


@pytest.mark.parametrize(
    "vocabulary,record_fields",
    [
        pytest.param(SPAN_BOUND_VARIABLE_NAMES, SPAN_METADATA_FIELD_NAMES, id="span"),
        pytest.param(SESSION_BOUND_VARIABLE_NAMES, SESSION_METADATA_FIELD_NAMES, id="session"),
        pytest.param(TRACE_BOUND_VARIABLE_NAMES, TRACE_METADATA_FIELD_NAMES, id="trace"),
    ],
)
def test_no_record_field_name_collides_with_a_vocabulary_name(
    vocabulary: frozenset[str],
    record_fields: frozenset[str],
) -> None:
    assert not vocabulary & record_fields, (
        "Record fields share `metadata` with the grain vocabulary flat, so a "
        "vocabulary name spelled like a record field would shadow it. Rename "
        "the new name."
    )


def test_every_trace_scalar_is_assigned_by_the_loader() -> None:
    """A non-aggregate name the trace filter language binds must be assigned by
    ``load_trace_bound_variables``; the defaulting sweep would otherwise hand the
    evaluator ``None`` for it without any test noticing."""
    source = inspect.getsource(bound_variables.load_trace_bound_variables)
    assigned = set(re.findall(r'resolved\[rowid\]\["(\w+)"\]\s*=', source))
    scalars = bound_variables.TRACE_BOUND_VARIABLE_NAMES - TRACE_BINDINGS.aggregate_names
    assert scalars, "the trace filter language binds no scalar names"
    assert scalars <= assigned, sorted(scalars - assigned)
