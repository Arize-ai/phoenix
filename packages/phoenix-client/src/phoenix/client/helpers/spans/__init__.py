"""Utilities for generating and regenerating OpenTelemetry-compliant span and trace IDs."""

import random
from copy import deepcopy
from typing import Sequence

from phoenix.client.__generated__ import v1

# Source implementation:opentelemetry.sdk.trace.id_generator.RandomIdGenerator

_INVALID_SPAN_ID = 0x0000000000000000
_INVALID_TRACE_ID = 0x00000000000000000000000000000000


def _generate_trace_id() -> str:
    trace_id = random.getrandbits(128)
    while trace_id == _INVALID_TRACE_ID:
        trace_id = random.getrandbits(128)
    return hex(trace_id)[2:].zfill(32)


def _generate_span_id() -> str:
    span_id = random.getrandbits(64)
    while span_id == _INVALID_SPAN_ID:
        span_id = random.getrandbits(64)
    return hex(span_id)[2:].zfill(16)


def uniquify_spans(
    spans: Sequence[v1.Span],
    *,
    in_place: bool = False,
) -> list[v1.Span]:
    """
    Regenerates span and trace IDs while maintaining parent-child relationships.

    This utility generates new valid OpenTelemetry-compliant span_ids and trace_ids
    for a collection of spans. The parent-child relationships within the span
    collection are preserved by mapping old IDs to new IDs consistently.

    Args:
        spans: A sequence of Span objects to regenerate IDs for.
        in_place: If True, modifies the original spans. If False (default),
            creates deep copies of the spans before modification.

    Returns:
        A list of Span objects with regenerated IDs. If in_place=True, this is
        the same list as the input (modified in place). If in_place=False, this
        is a new list with deep copies of the input spans.

    Example:
        >>> from phoenix.client import Client
        >>> client = Client()
        >>>
        >>> # Original spans that may have duplicate IDs
        >>> spans = [...]
        >>>
        >>> # Generate new IDs to ensure uniqueness
        >>> from phoenix.client.helpers.spans import uniquify_spans
        >>> new_spans = uniquify_spans(spans)
        >>>
        >>> # Now create the spans with guaranteed unique IDs
        >>> result = client.spans.create_spans(
        ...     project_identifier="my-project",
        ...     spans=new_spans
        ... )
    """
    if in_place:
        mutable_spans = spans if isinstance(spans, list) else list(spans)
    else:
        mutable_spans = list(deepcopy(spans))

    # Create mappings for old to new IDs
    trace_id_mapping: dict[str, str] = {}
    span_id_mapping: dict[str, str] = {}

    # Generate new IDs and build mappings
    for span in mutable_spans:
        if span.get("context"):
            old_trace_id = span["context"].get("trace_id", "")
            if old_trace_id and old_trace_id not in trace_id_mapping:
                trace_id_mapping[old_trace_id] = _generate_trace_id()

            old_span_id = span["context"].get("span_id", "")
            if old_span_id and old_span_id not in span_id_mapping:
                span_id_mapping[old_span_id] = _generate_span_id()

    # Apply new IDs and update parent references
    for span in mutable_spans:
        if span.get("context"):
            # Update trace_id
            old_trace_id = span["context"].get("trace_id", "")
            if old_trace_id in trace_id_mapping:
                span["context"]["trace_id"] = trace_id_mapping[old_trace_id]

            # Update span_id
            old_span_id = span["context"].get("span_id", "")
            if old_span_id in span_id_mapping:
                span["context"]["span_id"] = span_id_mapping[old_span_id]

        # Update parent_id if it exists
        old_parent_id = span.get("parent_id")
        if old_parent_id and old_parent_id in span_id_mapping:
            span["parent_id"] = span_id_mapping[old_parent_id]

    return mutable_spans
