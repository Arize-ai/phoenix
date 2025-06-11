"""Utilities for generating and regenerating OpenTelemetry-compliant span and trace IDs."""

import random
from copy import deepcopy
from typing import TYPE_CHECKING, Any, Sequence, Union, cast, overload

from phoenix.client.__generated__ import v1

if TYPE_CHECKING:
    import pandas as pd

__all__ = ["uniquify_spans", "dataframe_to_spans"]

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

        if isinstance(spans, pd.DataFrame):
            # Type assertion for type checker
            df_spans: pd.DataFrame = spans
            return _uniquify_spans_dataframe(df_spans, in_place=in_place)
    except ImportError:
        pass

    # Type assertion for type checker
    list_spans: Sequence[v1.Span] = spans  # type: ignore[assignment]
    return _uniquify_spans_list(list_spans, in_place=in_place)


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

    # Keep track of generated IDs to ensure uniqueness
    generated_trace_ids: set[str] = set()
    generated_span_ids: set[str] = set()

    # Generate new IDs and build mappings
    for span in mutable_spans:
        if span.get("context"):
            old_trace_id = span["context"].get("trace_id", "")
            if old_trace_id and old_trace_id not in trace_id_mapping:
                # Generate unique trace ID
                new_trace_id = _generate_trace_id()
                while new_trace_id in generated_trace_ids:
                    new_trace_id = _generate_trace_id()
                generated_trace_ids.add(new_trace_id)
                trace_id_mapping[old_trace_id] = new_trace_id

            old_span_id = span["context"].get("span_id", "")
            if old_span_id and old_span_id not in span_id_mapping:
                # Generate unique span ID
                new_span_id = _generate_span_id()
                while new_span_id in generated_span_ids:
                    new_span_id = _generate_span_id()
                generated_span_ids.add(new_span_id)
                span_id_mapping[old_span_id] = new_span_id

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
        unique_trace_ids = df["context.trace_id"].dropna().unique()  # pyright: ignore
        for old_trace_id in unique_trace_ids:  # pyright: ignore
            old_trace_id_str = str(old_trace_id)
            if old_trace_id_str and old_trace_id_str not in trace_id_mapping:
                trace_id_mapping[old_trace_id_str] = _generate_trace_id()

    # Get span IDs from both index and column
    span_ids_to_map: set[str] = set()

    # Add span IDs from index - check if index contains span IDs
    index_name = df.index.name  # pyright: ignore
    index_has_span_ids = False
    if index_name is None or index_name == "span_id" or "span" in str(index_name).lower():  # pyright: ignore
        # Assume index contains span IDs
        index_has_span_ids = True
        span_ids_to_map.update(str(idx) for idx in df.index if pd.notna(idx))  # pyright: ignore

    # Add span IDs from column if it exists
    if "context.span_id" in df.columns:
        span_ids_to_map.update(str(sid) for sid in df["context.span_id"].dropna() if pd.notna(sid))  # pyright: ignore

    # Generate mappings for all unique span IDs
    for old_span_id in span_ids_to_map:
        if old_span_id and old_span_id not in span_id_mapping:
            span_id_mapping[old_span_id] = _generate_span_id()

    # Apply new IDs to DataFrame

    # Update trace_id column
    if "context.trace_id" in df.columns:
        df["context.trace_id"] = df["context.trace_id"].map(  # pyright: ignore
            lambda x: trace_id_mapping.get(str(x), x) if pd.notna(x) else x  # pyright: ignore
        )

    # Update span_id column
    if "context.span_id" in df.columns:
        df["context.span_id"] = df["context.span_id"].map(  # pyright: ignore
            lambda x: span_id_mapping.get(str(x), x) if pd.notna(x) else x  # pyright: ignore
        )

    # Update parent_id column
    if "parent_id" in df.columns:
        df["parent_id"] = df["parent_id"].map(  # pyright: ignore
            lambda x: span_id_mapping.get(str(x), x) if pd.notna(x) else x  # pyright: ignore
        )

    # Update the index if it contains span IDs
    if index_has_span_ids and span_id_mapping:
        new_index_values: list[Any] = []
        for idx in df.index:  # pyright: ignore
            if pd.notna(idx):  # pyright: ignore
                old_idx_str = str(idx)  # pyright: ignore
                new_idx = span_id_mapping.get(old_idx_str, old_idx_str)
                new_index_values.append(new_idx)  # pyright: ignore
            else:
                new_index_values.append(idx)  # pyright: ignore

        new_index = pd.Index(new_index_values, name=index_name)  # pyright: ignore
        df.index = new_index

    return df


def dataframe_to_spans(df: "pd.DataFrame") -> list[v1.Span]:
    """
    Converts a pandas DataFrame (from get_spans_dataframe) back to a list of Span objects.

    This utility reconstructs Span objects from the flattened DataFrame structure
    returned by get_spans_dataframe. It handles the conversion of flattened column
    names (e.g., 'context.span_id') back to nested dictionaries.

    Args:
        df: A pandas DataFrame typically returned by get_spans_dataframe.

    Returns:
        A list of Span objects reconstructed from the DataFrame.

    Example:
        >>> from phoenix.client import Client
        >>> from phoenix.client.helpers.spans import dataframe_to_spans
        >>>
        >>> client = Client()
        >>>
        >>> # Get spans as DataFrame
        >>> df = client.spans.get_spans_dataframe(
        ...     project_identifier="my-project"
        ... )
        >>>
        >>> # Filter or modify the DataFrame
        >>> filtered_df = df[df['span_kind'] == 'LLM']
        >>>
        >>> # Convert back to Span objects
        >>> spans = dataframe_to_spans(filtered_df)
        >>>
        >>> # Now you can use these spans with other APIs
        >>> result = client.spans.create_spans(
        ...     project_identifier="another-project",
        ...     spans=spans
        ... )
    """
    import pandas as pd

    spans: list[v1.Span] = []

    for idx, row in df.iterrows():  # pyright: ignore
        span: dict[str, Any] = {}

        # Handle span_id from index
        if df.index.name == "span_id" or df.index.name is None:  # pyright: ignore
            span_id = str(idx)
        else:
            # If index is not span_id, try to get it from context.span_id column
            span_id = str(row.get("context.span_id", ""))  # pyright: ignore

        # Build context
        context: dict[str, str] = {}
        # pyright: ignore for pandas Series boolean operations
        if "context.trace_id" in row and pd.notna(row["context.trace_id"]):  # pyright: ignore[reportGeneralTypeIssues,reportUnknownMemberType,reportUnknownArgumentType]
            context["trace_id"] = str(row["context.trace_id"])  # pyright: ignore
        if span_id:
            context["span_id"] = span_id

        if context:
            span["context"] = context

        # Copy direct fields
        direct_fields = [
            "name",
            "span_kind",
            "parent_id",
            "status_code",
            "status_message",
            "start_time",
            "end_time",
        ]

        for field in direct_fields:
            # pyright: ignore for pandas Series boolean operations
            if field in row and pd.notna(row[field]):  # pyright: ignore[reportGeneralTypeIssues,reportUnknownMemberType,reportUnknownArgumentType]
                value = row[field]  # pyright: ignore
                # Convert timestamps to ISO format strings if they're datetime objects
                if field in ["start_time", "end_time"]:
                    if hasattr(value, "isoformat"):  # pyright: ignore
                        value = value.isoformat()  # pyright: ignore
                    else:
                        value = str(value)  # pyright: ignore
                span[field] = value

        # Handle events (usually a list)
        if "events" in row:
            try:
                events = row["events"]  # pyright: ignore
                # Check if events is not null/nan using pandas-safe method
                # pyright: ignore for pandas Series boolean operations
                if events is not None and not pd.isna(events):  # pyright: ignore[reportGeneralTypeIssues,reportUnknownMemberType,reportUnknownArgumentType]
                    # Handle various types that events might be
                    if hasattr(events, "__len__"):  # pyright: ignore
                        # Check if it's a numpy array or similar with size attribute
                        if hasattr(events, "size"):  # pyright: ignore
                            # For numpy arrays, check size > 0
                            if events.size > 0:  # pyright: ignore
                                span["events"] = list(events)  # pyright: ignore
                        elif len(events) > 0:  # pyright: ignore
                            # For regular sequences
                            if isinstance(events, list):
                                span["events"] = events
                            else:
                                # Convert array-like to list
                                span["events"] = list(events)  # pyright: ignore
                    # pyright: ignore for pandas Series boolean operations
                    elif events:  # pyright: ignore[reportGeneralTypeIssues]
                        # Single event, not a sequence
                        span["events"] = [events]
            except (ValueError, TypeError):
                # If we can't determine the length or convert, skip events
                pass

        # Reconstruct attributes from flattened columns
        attributes: dict[str, Any] = {}
        for col in df.columns:
            if col.startswith("attributes."):
                attr_name = col[len("attributes.") :]
                # pyright: ignore for pandas Series boolean operations
                if pd.notna(row[col]):  # pyright: ignore[reportGeneralTypeIssues,reportUnknownMemberType,reportUnknownArgumentType]
                    attributes[attr_name] = row[col]

        if attributes:
            span["attributes"] = attributes

        # Ensure we have required fields
        if "name" not in span:
            span["name"] = "unknown"
        if "span_kind" not in span:
            span["span_kind"] = "UNKNOWN"
        if "status_code" not in span:
            span["status_code"] = "UNSET"

        # Only add span if it has valid context
        if span.get("context", {}).get("span_id") and span.get("context", {}).get("trace_id"):
            spans.append(cast(v1.Span, span))

    return spans
