"""Utilities for generating and regenerating OpenTelemetry-compliant span and trace IDs."""

import random
from copy import deepcopy
from typing import TYPE_CHECKING, Sequence, Union, overload

from phoenix.client.__generated__ import v1

if TYPE_CHECKING:
    import pandas as pd

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


@overload
def uniquify_spans(
    spans: Sequence[v1.Span],
    *,
    in_place: bool = False,
) -> list[v1.Span]: ...


@overload
def uniquify_spans(
    spans: "pd.DataFrame",
    *,
    in_place: bool = False,
) -> "pd.DataFrame": ...


def uniquify_spans(
    spans: Union[Sequence[v1.Span], "pd.DataFrame"],
    *,
    in_place: bool = False,
) -> Union[list[v1.Span], "pd.DataFrame"]:
    """
    Regenerates span and trace IDs while maintaining parent-child relationships.

    This utility generates new valid OpenTelemetry-compliant span_ids and trace_ids
    for a collection of spans. The parent-child relationships within the span
    collection are preserved by mapping old IDs to new IDs consistently.

    Args:
        spans: A sequence of Span objects or a pandas DataFrame (typically from
            get_spans_dataframe) to regenerate IDs for.
        in_place: If True, modifies the original spans. If False (default),
            creates deep copies of the spans before modification.

    Returns:
        If input is a list of Span objects: A list of Span objects with regenerated IDs.
        If input is a DataFrame: A DataFrame with regenerated IDs in the index and columns.

        If in_place=True, returns the modified input. If in_place=False, returns
        a deep copy with modifications.

    Example:
        With Span objects:
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

        With DataFrame:
            >>> # Get spans as DataFrame
            >>> df = client.spans.get_spans_dataframe(
            ...     project_identifier="my-project"
            ... )
            >>>
            >>> # Generate new IDs for the DataFrame
            >>> new_df = uniquify_spans(df)
    """
    # Check if input is a DataFrame
    try:
        import pandas as pd

        is_dataframe = isinstance(spans, pd.DataFrame)
    except ImportError:
        is_dataframe = False

    if is_dataframe:
        return _uniquify_spans_dataframe(spans, in_place=in_place)
    else:
        return _uniquify_spans_list(spans, in_place=in_place)


def _uniquify_spans_list(
    spans: Sequence[v1.Span],
    *,
    in_place: bool = False,
) -> list[v1.Span]:
    """Original implementation for list of Span objects."""
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


def _uniquify_spans_dataframe(
    df: "pd.DataFrame",
    *,
    in_place: bool = False,
) -> "pd.DataFrame":
    """Implementation for pandas DataFrame."""
    import pandas as pd

    if not in_place:
        df = df.copy(deep=True)

    # Create mappings for old to new IDs
    trace_id_mapping: dict[str, str] = {}
    span_id_mapping: dict[str, str] = {}

    # Generate new IDs from DataFrame columns and index
    if "context.trace_id" in df.columns:
        unique_trace_ids = df["context.trace_id"].dropna().unique()
        for old_trace_id in unique_trace_ids:
            old_trace_id_str = str(old_trace_id)
            if old_trace_id_str and old_trace_id_str not in trace_id_mapping:
                trace_id_mapping[old_trace_id_str] = _generate_trace_id()

    # Get span IDs from both index and column
    span_ids_to_map: set[str] = set()

    # Add span IDs from index
    index_name = df.index.name
    if index_name is None or index_name == "span_id":
        span_ids_to_map.update(str(idx) for idx in df.index)

    # Add span IDs from column if it exists
    if "context.span_id" in df.columns:
        span_ids_to_map.update(str(sid) for sid in df["context.span_id"].dropna())

    # Generate mappings for all unique span IDs
    for old_span_id in span_ids_to_map:
        if old_span_id and old_span_id not in span_id_mapping:
            span_id_mapping[old_span_id] = _generate_span_id()

    # Apply new IDs to DataFrame

    # Update trace_id column
    if "context.trace_id" in df.columns:
        df["context.trace_id"] = df["context.trace_id"].map(
            lambda x: trace_id_mapping.get(str(x), x) if pd.notna(x) else x
        )

    # Update span_id column
    if "context.span_id" in df.columns:
        df["context.span_id"] = df["context.span_id"].map(
            lambda x: span_id_mapping.get(str(x), x) if pd.notna(x) else x
        )

    # Update parent_id column
    if "parent_id" in df.columns:
        df["parent_id"] = df["parent_id"].map(
            lambda x: span_id_mapping.get(str(x), x) if pd.notna(x) else x
        )

    # Update the index if it contains span IDs
    if index_name is None or index_name == "span_id":
        new_index = pd.Index(
            [span_id_mapping.get(str(idx), str(idx)) for idx in df.index], name=index_name
        )
        df.index = new_index

    return df
