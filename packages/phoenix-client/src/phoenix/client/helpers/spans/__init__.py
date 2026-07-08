"""Utilities for generating and regenerating OpenTelemetry-compliant span and trace IDs."""

import random
from copy import deepcopy
from typing import TYPE_CHECKING, Any, Sequence, cast

from phoenix.client.__generated__ import v1

from .rag import (
    async_get_input_output_context,
    async_get_retrieved_documents,
    get_input_output_context,
    get_retrieved_documents,
)

Span = v1.Span

if TYPE_CHECKING:
    import pandas as pd

__all__ = [
    "uniquify_spans",
    "uniquify_spans_dataframe",
    "dataframe_to_spans",
    "get_input_output_context",
    "get_retrieved_documents",
    "async_get_input_output_context",
    "async_get_retrieved_documents",
]

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
    spans: Sequence[Span],
    *,
    in_place: bool = False,
) -> list[Span]:
    """
    Regenerates span and trace IDs for a sequence of Span objects while maintaining parent-child
    relationships. Typically used when creating spans with the client to ensure that the spans
    have unique OpenTelemetry IDs to avoid collisions and guarantee that the spans can be inserted.

    This utility generates new valid OpenTelemetry-compliant span_ids and trace_ids
    for a collection of spans. The parent-child relationships within the span
    collection are preserved by mapping old IDs to new IDs consistently.

    Args:
        spans (Sequence[v1.Span]): A sequence of Span objects to regenerate IDs for.
        in_place (bool): If True, modifies the original spans. If False (default),
            creates deep copies of the spans before modification.

    Returns:
        list[v1.Span]: A list of Span objects with regenerated IDs.
            If in_place=True, returns the modified input. If in_place=False, returns
            a deep copy with modifications.

    Examples:
        Basic usage::

            from phoenix.client import Client
            from phoenix.client.helpers.spans import uniquify_spans

            client = Client()

            # Original spans that may have duplicate IDs
            spans = [...]

            # Generate new IDs to ensure uniqueness
            new_spans = uniquify_spans(spans)

            # Now create the spans with guaranteed unique IDs
            result = client.spans.create_spans(
                project_identifier="my-project",
                spans=new_spans
            )
    """
    if in_place:
        mutable_spans = spans if isinstance(spans, list) else list(spans)
    else:
        mutable_spans = list(deepcopy(spans))

    trace_id_mapping: dict[str, str] = {}
    span_id_mapping: dict[str, str] = {}

    generated_trace_ids: set[str] = set()
    generated_span_ids: set[str] = set()

    for span in mutable_spans:
        if span.get("context"):
            old_trace_id = span["context"].get("trace_id", "")
            if old_trace_id and old_trace_id not in trace_id_mapping:
                new_trace_id = _generate_trace_id()
                while new_trace_id in generated_trace_ids:
                    new_trace_id = _generate_trace_id()
                generated_trace_ids.add(new_trace_id)
                trace_id_mapping[old_trace_id] = new_trace_id

            old_span_id = span["context"].get("span_id", "")
            if old_span_id and old_span_id not in span_id_mapping:
                new_span_id = _generate_span_id()
                while new_span_id in generated_span_ids:
                    new_span_id = _generate_span_id()
                generated_span_ids.add(new_span_id)
                span_id_mapping[old_span_id] = new_span_id

    for span in mutable_spans:
        if span.get("context"):
            old_trace_id = span["context"].get("trace_id", "")
            if old_trace_id in trace_id_mapping:
                span["context"]["trace_id"] = trace_id_mapping[old_trace_id]

            old_span_id = span["context"].get("span_id", "")
            if old_span_id in span_id_mapping:
                span["context"]["span_id"] = span_id_mapping[old_span_id]

        old_parent_id = span.get("parent_id")
        if old_parent_id and old_parent_id in span_id_mapping:
            span["parent_id"] = span_id_mapping[old_parent_id]

    return mutable_spans


def uniquify_spans_dataframe(
    df: "pd.DataFrame",
    *,
    in_place: bool = False,
) -> "pd.DataFrame":
    """
    Regenerates span and trace IDs for a pandas DataFrame while maintaining parent-child
    relationships. Typically used when creating spans with the client to ensure that the spans
    have unique OpenTelemetry IDs to avoid collisions and guarantee that the spans can be inserted.

    This utility generates new valid OpenTelemetry-compliant span_ids and trace_ids
    for a DataFrame of spans (typically from get_spans_dataframe). The parent-child
    relationships within the span collection are preserved by mapping old IDs to new IDs
    consistently.

    Args:
        df (pd.DataFrame): A pandas DataFrame (typically from get_spans_dataframe) to
            regenerate IDs for.
        in_place (bool): If True, modifies the original DataFrame. If False (default),
            creates a deep copy of the DataFrame before modification.

    Returns:
        pd.DataFrame: A DataFrame with regenerated IDs in the index and columns.
            If in_place=True, returns the modified input. If in_place=False, returns
            a deep copy with modifications.

    Examples:
        Basic usage::

            from phoenix.client import Client
            from phoenix.client.helpers.spans import uniquify_spans_dataframe

            client = Client()

            # Get spans as DataFrame
            df = client.spans.get_spans_dataframe(
                project_identifier="my-project"
            )

            # Generate new IDs for the DataFrame
            new_df = uniquify_spans_dataframe(df)

            # Use the DataFrame with unique IDs
            print(f"Generated {len(new_df)} spans with unique IDs")
    """
    import pandas as pd

    if not in_place:
        df = df.copy(deep=True)

    trace_id_mapping: dict[str, str] = {}
    span_id_mapping: dict[str, str] = {}

    if "context.trace_id" in df.columns:
        unique_trace_ids = df["context.trace_id"].dropna().unique()  # pyright: ignore
        for old_trace_id in unique_trace_ids:  # pyright: ignore
            old_trace_id_str = str(old_trace_id)  # pyright: ignore[reportUnknownArgumentType]
            if old_trace_id_str and old_trace_id_str not in trace_id_mapping:
                trace_id_mapping[old_trace_id_str] = _generate_trace_id()

    span_ids_to_map: set[str] = set()

    # Add span IDs from index - check if index contains span IDs
    index_name = df.index.name  # pyright: ignore
    index_has_span_ids = False
    if index_name is None or index_name == "span_id" or "span" in str(index_name).lower():  # pyright: ignore
        # Assume index contains span IDs
        index_has_span_ids = True
        span_ids_to_map.update(str(idx) for idx in df.index if pd.notna(idx))  # pyright: ignore

    if "context.span_id" in df.columns:
        span_ids_to_map.update(str(sid) for sid in df["context.span_id"].dropna() if pd.notna(sid))  # pyright: ignore

    for old_span_id in span_ids_to_map:
        if old_span_id and old_span_id not in span_id_mapping:
            span_id_mapping[old_span_id] = _generate_span_id()

    if "context.trace_id" in df.columns:
        df["context.trace_id"] = df["context.trace_id"].map(  # pyright: ignore
            lambda x: trace_id_mapping.get(str(x), x) if pd.notna(x) else x  # pyright: ignore
        )

    if "context.span_id" in df.columns:
        df["context.span_id"] = df["context.span_id"].map(  # pyright: ignore
            lambda x: span_id_mapping.get(str(x), x) if pd.notna(x) else x  # pyright: ignore
        )

    if "parent_id" in df.columns:
        df["parent_id"] = df["parent_id"].map(  # pyright: ignore
            lambda x: span_id_mapping.get(str(x), x) if pd.notna(x) else x  # pyright: ignore
        )

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


def dataframe_to_spans(df: "pd.DataFrame") -> list[Span]:
    """
    Converts a pandas DataFrame (from get_spans_dataframe) back to a list of Span objects.

    This utility reconstructs Span objects from the flattened DataFrame structure
    returned by get_spans_dataframe. It handles the conversion of flattened column
    names (e.g., 'context.span_id') back to nested dictionaries.

    Args:
        df (pd.DataFrame): A pandas DataFrame typically returned by get_spans_dataframe.
            Timestamps in 'start_time' and 'end_time' columns must be timezone-aware.

    Returns:
        list[v1.Span]: A list of Span objects reconstructed from the DataFrame.

    Raises:
        ValueError: If start_time or end_time columns contain timezone-naive timestamps.

    Examples:
        Basic usage::

            from phoenix.client import Client
            from phoenix.client.helpers.spans import dataframe_to_spans

            client = Client()

            # Get spans as DataFrame
            df = client.spans.get_spans_dataframe(
                project_identifier="my-project"
            )

            # Filter or modify the DataFrame
            filtered_df = df[df['span_kind'] == 'LLM']

            # Convert back to Span objects
            spans = dataframe_to_spans(filtered_df)
            print(f"Converted {len(spans)} spans from DataFrame")

            # Now you can use these spans with other APIs
            result = client.spans.create_spans(
                project_identifier="another-project",
                spans=spans
            )
    """
    import pandas as pd

    spans: list[Span] = []

    for idx, row in df.iterrows():  # pyright: ignore
        span: dict[str, Any] = {}

        # Determine span_id: prefer context.span_id column, fall back to index only if it's
        # actually a span_id (not a default integer index)
        span_id = ""
        if "context.span_id" in row and pd.notna(row["context.span_id"]):  # pyright: ignore[reportGeneralTypeIssues,reportUnknownMemberType,reportUnknownArgumentType]
            span_id = str(row["context.span_id"])  # pyright: ignore
        elif "span_id" in row and pd.notna(row["span_id"]):  # pyright: ignore[reportGeneralTypeIssues,reportUnknownMemberType,reportUnknownArgumentType]
            span_id = str(row["span_id"])  # pyright: ignore
        elif isinstance(idx, str):  # pyright: ignore
            span_id = str(idx)

        if not span_id:
            raise ValueError(f"Row {idx}: Missing span_id")

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
                if field in ["start_time", "end_time"]:
                    if hasattr(value, "tzinfo") and value.tzinfo is None:  # pyright: ignore
                        raise ValueError(
                            f"Row {idx}: column '{field}' contains a timezone-naive timestamp. "
                            f"All timestamps must be timezone-aware (e.g., use UTC). "
                            f"Convert naive timestamps using: "
                            f"df['{field}'] = df['{field}'].dt.tz_localize('UTC')"
                        )
                    if hasattr(value, "isoformat"):  # pyright: ignore
                        value = value.isoformat()  # pyright: ignore
                    else:
                        value = str(value)  # pyright: ignore
                span[field] = value

        if "events" in row:
            try:
                events = row["events"]  # pyright: ignore
                # Check if events is not null/nan using pandas-safe method
                # pyright: ignore for pandas Series boolean operations
                if events is not None and not pd.isna(events):  # pyright: ignore[reportGeneralTypeIssues,reportUnknownMemberType,reportUnknownArgumentType]
                    if hasattr(events, "__len__"):  # pyright: ignore
                        if len(events) > 0:  # pyright: ignore
                            if isinstance(events, list):
                                span["events"] = events
                            else:
                                span["events"] = list(events)  # pyright: ignore
                    elif events:  # pyright: ignore[reportGeneralTypeIssues]
                        span["events"] = [events]
            except (ValueError, TypeError):
                pass

        # Reconstruct attributes from flattened columns
        attributes: dict[str, Any] = {}
        for col in df.columns:
            if col.startswith("attributes."):
                attr_name = col[len("attributes.") :]
                value = row[col]  # pyright: ignore

                # Handle different data types that might cause issues with pd.notna()
                try:
                    if isinstance(value, (list, tuple)):
                        attributes[attr_name] = value
                    elif hasattr(value, "__len__") and not isinstance(value, str):  # pyright: ignore[reportUnknownArgumentType]
                        if len(value) > 0:  # pyright: ignore
                            attributes[attr_name] = value
                    elif pd.notna(value):  # pyright: ignore[reportGeneralTypeIssues,reportUnknownMemberType,reportUnknownArgumentType]
                        attributes[attr_name] = value
                except (ValueError, TypeError):
                    if value is not None:
                        attributes[attr_name] = value

        if attributes:
            span["attributes"] = attributes

        if "name" not in span:
            span["name"] = "unknown"
        if "span_kind" not in span:
            span["span_kind"] = "UNKNOWN"
        if "status_code" not in span:
            span["status_code"] = "UNSET"

        if span.get("context", {}).get("span_id") and span.get("context", {}).get("trace_id"):
            spans.append(cast(Span, span))

    return spans
