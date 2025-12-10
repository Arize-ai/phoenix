import json
import logging
from datetime import datetime, timezone, tzinfo
from io import StringIO
from typing import TYPE_CHECKING, Any, Iterable, Literal, Optional, Sequence, Union, cast, overload

import httpx
from typing_extensions import TypeAlias

from phoenix.client.utils.annotation_helpers import (
    _chunk_document_annotations_dataframe,  # pyright: ignore[reportPrivateUsage]
    _chunk_span_annotations_dataframe,  # pyright: ignore[reportPrivateUsage]
    _create_document_annotation,  # pyright: ignore[reportPrivateUsage]
    _create_span_annotation,  # pyright: ignore[reportPrivateUsage]
    _validate_document_annotations_dataframe,  # pyright: ignore[reportPrivateUsage]
    _validate_span_annotations_dataframe,  # pyright: ignore[reportPrivateUsage]
)

if TYPE_CHECKING:
    import pandas as pd

from phoenix.client.__generated__ import v1
from phoenix.client.exceptions import DuplicateSpanInfo, InvalidSpanInfo, SpanCreationError
from phoenix.client.helpers.spans import dataframe_to_spans as _dataframe_to_spans
from phoenix.client.types.spans import SpanQuery
from phoenix.client.utils.id_handling import is_node_id

logger = logging.getLogger(__name__)

# Re-export generated types
AnnotateSpanDocumentsRequestBody = v1.AnnotateSpanDocumentsRequestBody
AnnotateSpanDocumentsResponseBody = v1.AnnotateSpanDocumentsResponseBody
AnnotateSpansRequestBody = v1.AnnotateSpansRequestBody
AnnotateSpansResponseBody = v1.AnnotateSpansResponseBody
CreateSpanNoteRequestBody = v1.CreateSpanNoteRequestBody
CreateSpanNoteResponseBody = v1.CreateSpanNoteResponseBody
CreateSpansResponseBody = v1.CreateSpansResponseBody
InsertedSpanAnnotation = v1.InsertedSpanAnnotation
InsertedSpanDocumentAnnotation = v1.InsertedSpanDocumentAnnotation
Span = v1.Span
SpanAnnotation = v1.SpanAnnotation
SpanAnnotationData = v1.SpanAnnotationData
SpanAnnotationResult = v1.AnnotationResult
SpanAnnotationsResponseBody = v1.SpanAnnotationsResponseBody
SpanDocumentAnnotationData = v1.SpanDocumentAnnotationData
SpanDocumentAnnotationResult = v1.AnnotationResult
SpanNoteData = v1.SpanNoteData

DEFAULT_TIMEOUT_IN_SECONDS = 5
_LOCAL_TIMEZONE = datetime.now(timezone.utc).astimezone().tzinfo
_MAX_SPAN_IDS_PER_REQUEST = 100

_AnnotatorKind: TypeAlias = Literal["LLM", "CODE", "HUMAN"]


class Spans:
    """Provides methods for interacting with span resources.

    This class offers both regular and DataFrame-based methods for retrieving,
    logging, and managing spans and their annotations.

    Examples:
        Non-DataFrame methods::

            from phoenix.client import Client
            client = Client()

            # Get spans as list
            spans = client.spans.get_spans(
                project_identifier="my-project",
                limit=100
            )

            # Get span annotations as list
            annotations = client.spans.get_span_annotations(
                span_ids=["span1", "span2"],
                project_identifier="my-project"
            )

            # Log spans
            spans = [
                {
                    "id": "1",
                    "name": "test",
                    "context": {"trace_id": "123", "span_id": "456"},
                }
            ]
            result = client.spans.log_spans(
                project_identifier="my-project",
                spans=spans
            )
            print(f"Queued {result['total_queued']} spans")

        DataFrame methods::

            from phoenix.client.types.spans import SpanQuery

            # Get spans as DataFrame
            query = SpanQuery().select(annotations["relevance"])
            df = client.spans.get_spans_dataframe(query=query)

            # Get span annotations as DataFrame
            annotations_df = client.spans.get_span_annotations_dataframe(
                span_ids=["span1", "span2"],
                project_identifier="my-project"
            )

            # Delete a span
            client.spans.delete(span_identifier="abc123def456")
    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def get_spans_dataframe(
        self,
        *,
        query: Optional[SpanQuery] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000,
        root_spans_only: Optional[bool] = None,
        project_identifier: Optional[str] = None,
        project_name: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """Retrieves spans based on the provided filter conditions.

        Args:
            query (Optional[SpanQuery]): A SpanQuery object defining the query criteria.
            start_time (Optional[datetime]): Optional start time for filtering.
            end_time (Optional[datetime]): Optional end time for filtering.
            limit (int): Maximum number of spans to return. Defaults to 1000.
            root_spans_only (Optional[bool]): Whether to return only root spans.
            project_name (Optional[str]): Optional project name to filter by. Deprecated,
                use `project_identifier` to also specify by the project id.
            project_identifier (Optional[str]): Optional project identifier (name or id)
                to filter by.
            timeout (Optional[int]): Optional request timeout in seconds.

        Returns:
            pd.DataFrame: A pandas DataFrame containing the retrieved spans.

        Raises:
            ImportError: If pandas is not installed.
        """
        project_name = project_name
        query = query if query else SpanQuery()
        normalized_start_time = _normalize_datetime(start_time)
        normalized_end_time = _normalize_datetime(end_time)

        request_body = {
            "queries": [query.to_dict()],
            "start_time": _to_iso_format(normalized_start_time),
            "end_time": _to_iso_format(normalized_end_time),
            "limit": limit,
            "root_spans_only": root_spans_only,
        }

        try:
            import pandas as pd

            _ = pd  # Prevent unused symbol error

            if project_identifier and project_name:
                raise ValueError("Provide only one of 'project_identifier' or 'project_name'.")
            elif project_identifier and not project_name:
                if is_node_id(project_identifier, node_type="Project"):
                    project_response = self._client.get(
                        url=f"v1/projects/{project_identifier}",
                        headers={"accept": "application/json"},
                        timeout=timeout,
                    )
                    project_response.raise_for_status()
                    project = project_response.json()
                    project_name = project["data"]["name"]
                else:
                    project_name = project_identifier

            response = self._client.post(
                url="v1/spans",
                headers={"accept": "application/json"},
                params={"project_name": project_name} if project_name else None,
                json=request_body,
                timeout=timeout,
            )
            return _process_span_dataframe(response)
        except ImportError:
            raise ImportError(
                "pandas is required to use get_spans_dataframe. "
                "Install it with 'pip install pandas'"
            )

    def get_span_annotations_dataframe(
        self,
        *,
        spans_dataframe: Optional["pd.DataFrame"] = None,
        span_ids: Optional[Iterable[str]] = None,
        spans: Optional[Iterable[v1.Span]] = None,
        project_identifier: str = "default",
        include_annotation_names: Optional[Sequence[str]] = None,
        exclude_annotation_names: Optional[Sequence[str]] = None,
        limit: int = 1000,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """Fetches span annotations and returns them as a pandas DataFrame.

        Exactly one of *spans_dataframe*, *span_ids*, or *spans* should be provided.

        Args:
            spans_dataframe (Optional[pd.DataFrame]): A DataFrame (typically returned by
                `get_spans_dataframe`) with a `context.span_id` or `span_id` column.
            span_ids (Optional[Iterable[str]]): An iterable of span IDs.
            spans (Optional[Iterable[v1.Span]]): A list of Span objects (typically
                returned by `get_spans`).
            project_identifier (str): The project identifier (name or ID) used in the
                API path. Defaults to "default".
            include_annotation_names (Optional[Sequence[str]]): Optional list of
                annotation names to include. If provided, only annotations with these
                names will be returned.
            exclude_annotation_names (Optional[Sequence[str]]): Optional list of
                annotation names to exclude from results. Defaults to ["note"] to
                exclude note annotations, which are reserved for notes added via the UI.
            limit (int): Maximum number of annotations returned per request page.
                Defaults to 1000.
            timeout (Optional[int]): Optional request timeout in seconds.

        Returns:
            pd.DataFrame: A DataFrame where each row corresponds to a single span annotation.

        Raises:
            ValueError: If not exactly one of *spans_dataframe*, *span_ids*, or *spans*
                is provided, or if the `context.span_id` or `span_id` column is missing
                from *spans_dataframe*.
            ImportError: If pandas is not installed.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        if exclude_annotation_names is None:
            exclude_annotation_names = ["note"]

        try:
            import pandas as pd
        except ImportError:  # pragma: no cover
            raise ImportError(
                "pandas is required to use get_span_annotations_dataframe. "
                "Install it with 'pip install pandas'"
            )

        # Validate input parameters
        provided_params = sum(
            [
                spans_dataframe is not None,
                span_ids is not None,
                spans is not None,
            ]
        )
        if provided_params != 1:
            raise ValueError("Provide exactly one of 'spans_dataframe', 'span_ids', or 'spans'.")

        if spans_dataframe is not None:
            span_ids_raw: list[str] = cast(
                list[str],
                spans_dataframe["context.span_id"].dropna().tolist(),  # pyright: ignore[reportUnknownMemberType]
            )
            span_ids_list = list({*span_ids_raw})
        elif span_ids is not None:
            span_ids_list = list({*span_ids})
        else:
            assert spans is not None
            _span_ids = [
                span["context"]["span_id"]
                for span in spans
                if span.get("context", {}).get("span_id")
            ]
            span_ids_list = list(set(s for s in _span_ids if s))

        if not span_ids_list:
            return pd.DataFrame()

        annotations: list[SpanAnnotation] = []
        path = f"v1/projects/{project_identifier}/span_annotations"

        for i in range(0, len(span_ids_list), _MAX_SPAN_IDS_PER_REQUEST):
            batch_ids = span_ids_list[i : i + _MAX_SPAN_IDS_PER_REQUEST]
            cursor: Optional[str] = None
            while True:
                params: dict[str, Union[int, str, Sequence[str]]] = {
                    "span_ids": batch_ids,
                    "limit": limit,
                }
                if include_annotation_names is not None:
                    params["include_annotation_names"] = include_annotation_names
                if exclude_annotation_names:
                    params["exclude_annotation_names"] = exclude_annotation_names
                if cursor:
                    params["cursor"] = cursor

                response = self._client.get(
                    url=path,
                    params=params,
                    headers={"accept": "application/json"},
                    timeout=timeout,
                )
                response.raise_for_status()
                payload = response.json()
                payload = cast(SpanAnnotationsResponseBody, payload)
                batch = cast(list[SpanAnnotation], payload.get("data", []))
                annotations.extend(batch)
                cursor = payload.get("next_cursor")
                if not cursor:
                    break  # finished paginating this batch

        df = pd.DataFrame(annotations)
        df = _flatten_nested_column(df, "result")
        df.rename(columns={"name": "annotation_name"}, inplace=True)  # pyright: ignore[reportUnknownMemberType]
        if not df.empty:
            df.set_index("span_id", inplace=True)  # type: ignore[unused-ignore]
        return df

    def get_span_annotations(
        self,
        *,
        span_ids: Optional[Iterable[str]] = None,
        spans: Optional[Iterable[v1.Span]] = None,
        project_identifier: str,
        include_annotation_names: Optional[Sequence[str]] = None,
        exclude_annotation_names: Optional[Sequence[str]] = None,
        limit: int = 1000,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[SpanAnnotation]:
        """Fetches span annotations and returns them as a list of SpanAnnotation objects.

        Exactly one of *span_ids* or *spans* should be provided.

        Args:
            span_ids (Optional[Iterable[str]]): An iterable of span IDs.
            spans (Optional[Iterable[v1.Span]]): A list of Span objects (typically
                returned by `get_spans`).
            project_identifier (str): The project identifier (name or ID) used in the
                API path.
            include_annotation_names (Optional[Sequence[str]]): Optional list of
                annotation names to include. If provided, only annotations with these
                names will be returned.
            exclude_annotation_names (Optional[Sequence[str]]): Optional list of
                annotation names to exclude from results. Defaults to ["note"] to
                exclude note annotations, which are reserved for notes added via the UI.
            limit (int): Maximum number of annotations returned per request page.
                Defaults to 1000.
            timeout (Optional[int]): Optional request timeout in seconds.

        Returns:
            list[SpanAnnotation]: A list of SpanAnnotation objects.

        Raises:
            ValueError: If not exactly one of *span_ids* or *spans* is provided.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        if exclude_annotation_names is None:
            exclude_annotation_names = ["note"]

        # Validate input parameters
        provided_params = sum(
            [
                span_ids is not None,
                spans is not None,
            ]
        )
        if provided_params != 1:
            raise ValueError("Provide exactly one of 'span_ids' or 'spans'.")

        if span_ids is not None:
            span_ids_list = list({*span_ids})
        else:  # spans is not None
            assert spans is not None
            _span_ids = [
                span["context"]["span_id"]
                for span in spans
                if span.get("context", {}).get("span_id")
            ]
            span_ids_list = list(set(s for s in _span_ids if s))

        if not span_ids_list:
            return []

        annotations: list[SpanAnnotation] = []
        path = f"v1/projects/{project_identifier}/span_annotations"

        for i in range(0, len(span_ids_list), _MAX_SPAN_IDS_PER_REQUEST):
            batch_ids = span_ids_list[i : i + _MAX_SPAN_IDS_PER_REQUEST]
            cursor: Optional[str] = None
            while True:
                params: dict[str, Union[int, str, Sequence[str]]] = {
                    "span_ids": batch_ids,
                    "limit": limit,
                }
                if include_annotation_names is not None:
                    params["include_annotation_names"] = include_annotation_names
                if exclude_annotation_names:
                    params["exclude_annotation_names"] = exclude_annotation_names
                if cursor:
                    params["cursor"] = cursor

                response = self._client.get(
                    url=path,
                    params=params,
                    headers={"accept": "application/json"},
                    timeout=timeout,
                )
                response.raise_for_status()
                payload = response.json()
                payload = cast(SpanAnnotationsResponseBody, payload)
                batch = cast(list[SpanAnnotation], payload.get("data", []))
                annotations.extend(batch)
                cursor = payload.get("next_cursor")
                if not cursor:
                    break

        return annotations

    def get_spans(
        self,
        *,
        project_identifier: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[v1.Span]:
        """Retrieves spans with simple filtering options.

        Args:
            project_identifier (str): The project identifier (name or ID) used in the
                API path.
            start_time (Optional[datetime]): Optional start time for filtering
                (inclusive lower bound).
            end_time (Optional[datetime]): Optional end time for filtering
                (exclusive upper bound).
            limit (int): Maximum number of spans to return. Defaults to 100.
            timeout (Optional[int]): Optional request timeout in seconds.

        Returns:
            list[v1.Span]: A list of Span objects.

        Raises:
            httpx.HTTPStatusError: If the API returns an error response.
        """
        all_spans: list[v1.Span] = []
        cursor: Optional[str] = None
        page_size = min(100, limit)

        while len(all_spans) < limit:
            remaining = limit - len(all_spans)
            current_page_size = min(page_size, remaining)

            params: dict[str, Union[int, str, Sequence[str]]] = {
                "limit": current_page_size,
            }

            if start_time:
                params["start_time"] = start_time.isoformat()
            if end_time:
                params["end_time"] = end_time.isoformat()
            if cursor:
                params["cursor"] = cursor

            response = self._client.get(
                url=f"v1/projects/{project_identifier}/spans",
                params=params,
                headers={"accept": "application/json"},
                timeout=timeout,
            )
            response.raise_for_status()
            payload = response.json()
            payload = cast(v1.SpansResponseBody, payload)

            spans = payload["data"]
            all_spans.extend(spans)

            cursor = payload.get("next_cursor")
            if not cursor or not spans:
                break

        return all_spans[:limit]

    def log_spans(
        self,
        *,
        project_identifier: str,
        spans: Sequence[v1.Span],
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.CreateSpansResponseBody:
        """Logs spans to a project.

        If any spans are invalid or duplicates, no spans will be logged and a
        SpanCreationError will be raised with details about the failed spans.

        Args:
            project_identifier (str): The project identifier (name or ID) used in the
                API path.
            spans (Sequence[v1.Span]): A sequence of Span objects to log.
            timeout (Optional[int]): Optional request timeout in seconds.

        Returns:
            v1.CreateSpansResponseBody: A CreateSpansResponseBody with statistics about
                the operation. When successful, total_queued will equal total_received.

        Raises:
            SpanCreationError: If any spans failed validation (invalid or duplicates).
            httpx.HTTPStatusError: If the API returns an unexpected error response.
            httpx.TimeoutException: If the request times out.
        """
        request_body = v1.CreateSpansRequestBody(data=list(spans))

        response = self._client.post(
            url=f"v1/projects/{project_identifier}/spans",
            json=request_body,
            headers={"accept": "application/json"},
            timeout=timeout,
        )

        if response.status_code not in (400, 422):
            response.raise_for_status()

        result = _parse_log_spans_response(response, spans)
        return result

    def log_spans_dataframe(
        self,
        *,
        project_identifier: str,
        spans_dataframe: "pd.DataFrame",
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.CreateSpansResponseBody:
        """Logs spans to a project from a pandas DataFrame.

        If any spans are invalid or duplicates, no spans will be logged and a
        SpanCreationError will be raised with details about the failed spans.

        Args:
            project_identifier (str): The project identifier (name or ID) used in the
                API path.
            spans_dataframe (pd.DataFrame): A pandas DataFrame with a `context.span_id`
                or `span_id` column.
            timeout (Optional[int]): Optional request timeout in seconds.

        Returns:
            v1.CreateSpansResponseBody: A CreateSpansResponseBody with statistics about
                the operation. When successful, total_queued will equal total_received.

        Raises:
            SpanCreationError: If any spans failed validation (invalid or duplicates).
            httpx.HTTPStatusError: If the API returns an unexpected error response.
            httpx.TimeoutException: If the request times out.
        """
        spans = _dataframe_to_spans(spans_dataframe)
        return self.log_spans(project_identifier=project_identifier, spans=spans, timeout=timeout)

    def delete(
        self,
        *,
        span_identifier: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> None:
        """Deletes a single span by identifier.

        **Important**: This operation deletes ONLY the specified span itself and does NOT
        delete its descendants/children. All child spans will remain in the trace and
        become orphaned (their parent_id will point to a non-existent span).

        Behavior:
            - Deletes only the target span (preserves all descendant spans)
            - If this was the last span in the trace, the trace record is also deleted
            - If the deleted span had a parent, its cumulative metrics (error count, token counts)
              are subtracted from all ancestor spans in the chain

        Note:
            This operation is irreversible and may create orphaned spans.

        Args:
            span_identifier (str): The span identifier: either a relay GlobalID or
                OpenTelemetry span_id.
            timeout (Optional[int]): Optional request timeout in seconds.

        Raises:
            httpx.HTTPStatusError: If the span is not found (404) or other API errors.
            httpx.TimeoutException: If the request times out.

        Example::

            from phoenix.client import Client
            client = Client()

            # Delete by OpenTelemetry span_id
            client.spans.delete_span(span_identifier="051581bf3cb55c13")

            # Delete by Phoenix Global ID
            client.spans.delete(span_identifier="U3BhbjoxMjM=")
        """
        response = self._client.delete(
            url=f"v1/spans/{span_identifier}",
            timeout=timeout,
        )
        response.raise_for_status()

    @overload
    def add_span_annotation(
        self,
        *,
        span_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: Literal[True],
    ) -> InsertedSpanAnnotation: ...

    @overload
    def add_span_annotation(
        self,
        *,
        span_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    def add_span_annotation(
        self,
        *,
        span_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: bool,
    ) -> Optional[InsertedSpanAnnotation]: ...

    def add_span_annotation(
        self,
        *,
        span_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: bool = False,
    ) -> Optional[InsertedSpanAnnotation]:
        """Add a single span annotation.

        Args:
            span_id (str): The ID of the span to annotate.
            annotation_name (str): The name of the annotation.
            annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator used for
                the annotation. Must be one of "LLM", "CODE", or "HUMAN". Defaults to "HUMAN".
            label (Optional[str]): The label assigned by the annotation.
            score (Optional[float]): The score assigned by the annotation.
            explanation (Optional[str]): Explanation of the annotation result.
            metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.
            identifier (Optional[str]): An optional identifier for the annotation. Each
                annotation is uniquely identified by the combination of name, span_id, and
                identifier (where a null identifier is equivalent to an empty string).
                If an annotation with the same name, span_id, and identifier already exists,
                it will be updated. Using a non-empty identifier allows you to have multiple
                annotations with the same name and span_id. Most of the time, you can leave
                this as None - it will also update the record with identifier="" if it exists.
            sync (bool): If True, the request will be fulfilled synchronously and the response
                will contain the inserted annotation ID. If False, the request will be
                processed asynchronously. Defaults to False.

        Returns:
            Optional[InsertedSpanAnnotation]: If sync is True, the inserted span annotation
                containing an ID. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if at least one of label, score, or
                explanation is not provided.

        Example::

            from phoenix.client import Client
            client = Client()

            # Add a single annotation with sync response
            annotation = client.spans.add_span_annotation(
                span_id="abc123",
                annotation_name="sentiment",
                label="positive",
                score=0.9,
                explanation="The text expresses a positive sentiment.",
                sync=True,
            )
        """  # noqa: E501
        anno = _create_span_annotation(
            span_id=span_id,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
            label=label,
            score=score,
            explanation=explanation,
            metadata=metadata,
            identifier=identifier,
        )
        if res := self.log_span_annotations(span_annotations=[anno], sync=sync):
            return res[0]
        return None

    def add_span_note(
        self,
        *,
        span_id: str,
        note: str,
    ) -> InsertedSpanAnnotation:
        """Add a note to a span.

        Notes are a special type of annotation that allow multiple entries per span
        (unlike regular annotations which are unique by name and identifier). Each note
        gets a unique timestamp-based identifier automatically.

        Args:
            span_id (str): The OpenTelemetry span ID of the span to add the note to.
            note (str): The text content of the note.

        Returns:
            InsertedSpanAnnotation: The inserted span annotation containing the ID.

        Raises:
            ValueError: If span_id or note is empty (after stripping whitespace).
            httpx.HTTPStatusError: If the span is not found (404) or other API errors.
            httpx.HTTPError: If the request fails.

        Example::

            from phoenix.client import Client
            client = Client()

            # Add a note to a span
            result = client.spans.add_span_note(
                span_id="abc123def456",
                note="This span shows interesting behavior.",
            )
            print(f"Note created with ID: {result['id']}")
        """
        span_id = span_id.strip()
        if not span_id:
            raise ValueError("Span ID cannot be empty")
        note = note.strip()
        if not note:
            raise ValueError("Note cannot be empty")
        url = "v1/span_notes"
        json_: CreateSpanNoteRequestBody = {
            "data": {
                "span_id": span_id,
                "note": note,
            }
        }
        response = self._client.post(url=url, json=json_)
        response.raise_for_status()
        return cast(CreateSpanNoteResponseBody, response.json())["data"]

    @overload
    def log_span_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        annotation_name: Optional[str] = None,
        sync: Literal[True],
    ) -> list[InsertedSpanAnnotation]: ...

    @overload
    def log_span_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        annotation_name: Optional[str] = None,
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    def log_span_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        annotation_name: Optional[str] = None,
        sync: bool,
    ) -> Optional[list[InsertedSpanAnnotation]]: ...

    def log_span_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        annotation_name: Optional[str] = None,
        sync: bool = False,
    ) -> Optional[list[InsertedSpanAnnotation]]:
        """Log multiple span annotations from a pandas DataFrame.

        This method allows you to create multiple span annotations at once by providing the data
        in a pandas DataFrame. The DataFrame can either include `name` or `annotation_name` columns
        (but not both) and `annotator_kind` column, or you can specify global values for all rows.
        The data is processed in chunks of 100 rows for efficient batch processing.

        Args:
            dataframe (pd.DataFrame): A pandas DataFrame containing the annotation data. Must include
                either a "name" or "annotation_name" column (but not both) or provide a global
                annotation_name parameter. Similarly, must include an "annotator_kind" column or
                provide a global annotator_kind. The `span_id` can be either a column in the
                DataFrame or will be taken from the DataFrame index. Optional columns include:
                "label", "score", "explanation", "metadata", and "identifier".
            annotator_kind (Optional[Literal["LLM", "CODE", "HUMAN"]]): The kind of annotator used
                for all annotations. If provided, this value will be used for all rows and the
                DataFrame does not need to include an "annotator_kind" column. Must be one of
                "LLM", "CODE", or "HUMAN".
            annotation_name (Optional[str]): The name to use for all annotations. If provided, this
                value will be used for all rows and the DataFrame does not need to include a "name"
                or "annotation_name" column.
            sync (bool): If True, the request will be fulfilled synchronously and the response will
                contain the inserted annotation IDs. If False, the request will be processed
                asynchronously. Defaults to False.

        Returns:
            Optional[list[InsertedSpanAnnotation]]: If sync is True, a list of all inserted span
                annotations. If sync is False, None.

        Raises:
            ImportError: If pandas is not installed.
            ValueError: If the DataFrame is missing required columns, if both "name" and
                "annotation_name" columns are present, or if no valid annotation data is provided.

        Example::

            import pandas as pd
            from phoenix.client import Client
            client = Client()

            # Using name and annotator_kind from DataFrame with span_id column
            df1 = pd.DataFrame({
                "name": ["sentiment", "toxicity"],
                "span_id": ["span_123", "span_456"],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["positive", "low"],
                "score": [0.9, 0.1]
            })
            client.spans.log_span_annotations_dataframe(dataframe=df1)

            # Using annotation_name and annotator_kind from DataFrame
            df2 = pd.DataFrame({
                "annotation_name": ["sentiment", "toxicity"],
                "span_id": ["span_789", "span_012"],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["positive", "low"],
                "score": [0.9, 0.1]
            })
            client.spans.log_span_annotations_dataframe(dataframe=df2)

            # Using global name and annotator_kind with span_id from index
            df3 = pd.DataFrame({
                "label": ["positive", "low"]
            }, index=["span_345", "span_678"])
            client.spans.log_span_annotations_dataframe(
                dataframe=df3,
                annotation_name="sentiment",  # applies to all rows
                annotator_kind="HUMAN"  # applies to all rows
            )
        """  # noqa: E501
        # Validate DataFrame first
        _validate_span_annotations_dataframe(dataframe=dataframe)

        # Process DataFrame chunks using iterator
        all_responses: list[InsertedSpanAnnotation] = []
        for chunk in _chunk_span_annotations_dataframe(
            dataframe=dataframe,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
        ):
            # Delegate to log_span_annotations
            response = self.log_span_annotations(span_annotations=chunk, sync=sync)
            if sync and response:
                all_responses.extend(response)

        return all_responses if sync else None

    @overload
    def log_span_annotations(
        self,
        *,
        span_annotations: Iterable[SpanAnnotationData],
        sync: Literal[True],
    ) -> list[InsertedSpanAnnotation]: ...

    @overload
    def log_span_annotations(
        self,
        *,
        span_annotations: Iterable[SpanAnnotationData],
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    def log_span_annotations(
        self,
        *,
        span_annotations: Iterable[SpanAnnotationData],
        sync: bool,
    ) -> Optional[list[InsertedSpanAnnotation]]: ...

    def log_span_annotations(
        self,
        *,
        span_annotations: Iterable[SpanAnnotationData],
        sync: bool = False,
    ) -> Optional[list[InsertedSpanAnnotation]]:
        """Log multiple span annotations.

        Args:
            span_annotations (Iterable[SpanAnnotationData]): An iterable of span annotation data to log. Each annotation must include
                at least a span_id, name, and annotator_kind, and at least one of label, score, or explanation.
            sync (bool): If True, the request will be fulfilled synchronously and the response will contain
                the inserted annotation IDs. If False, the request will be processed asynchronously.
                Defaults to False.

        Returns:
            Optional[list[InsertedSpanAnnotation]]: If sync is True, a list of inserted span annotations, each containing an ID. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if the input is invalid.
        """  # noqa: E501
        # Convert to list and validate input
        annotations_list = list(span_annotations)
        if not annotations_list:
            raise ValueError("span_annotations cannot be empty")

        url = "v1/span_annotations"
        params = {"sync": sync} if sync else {}
        json_ = AnnotateSpansRequestBody(data=annotations_list)
        response = self._client.post(url=url, json=json_, params=params)
        response.raise_for_status()
        if not sync:
            return None
        return list(cast(AnnotateSpansResponseBody, response.json())["data"])

    @overload
    def add_document_annotation(
        self,
        *,
        span_id: str,
        document_position: int,
        annotation_name: str,
        annotator_kind: _AnnotatorKind = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        sync: Literal[True],
    ) -> InsertedSpanDocumentAnnotation: ...

    @overload
    def add_document_annotation(
        self,
        *,
        span_id: str,
        document_position: int,
        annotation_name: str,
        annotator_kind: _AnnotatorKind = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    def add_document_annotation(
        self,
        *,
        span_id: str,
        document_position: int,
        annotation_name: str,
        annotator_kind: _AnnotatorKind = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        sync: bool,
    ) -> Optional[InsertedSpanDocumentAnnotation]: ...

    def add_document_annotation(
        self,
        *,
        span_id: str,
        document_position: int,
        annotation_name: str,
        annotator_kind: _AnnotatorKind = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        sync: bool = False,
    ) -> Optional[InsertedSpanDocumentAnnotation]:
        """Add a single span document annotation.

        Args:
            span_id (str): The ID of the span to annotate.
            document_position (int): The 0-based index of the document within the span.
            annotation_name (str): The name of the annotation.
            annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator used for
                the annotation. Must be one of "LLM", "CODE", or "HUMAN". Defaults to "HUMAN".
            label (Optional[str]): The label assigned by the annotation.
            score (Optional[float]): The score assigned by the annotation.
            explanation (Optional[str]): Explanation of the annotation result.
            metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.

            sync (bool): If True, the request will be fulfilled synchronously and the response
                will contain the inserted annotation ID. If False, the request will be
                processed asynchronously. Defaults to False.

        Returns:
            Optional[InsertedSpanDocumentAnnotation]: If sync is True, the inserted span document
                annotation containing an ID. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if at least one of label, score, or
                explanation is not provided.

        Example::

            from phoenix.client import Client
            client = Client()

            # Add a single document annotation with sync response
            annotation = client.spans.add_document_annotation(
                span_id="abc123",
                document_position=0,
                annotation_name="relevance",
                label="relevant",
                score=0.9,
                explanation="The document is relevant to the query.",
                sync=True,
            )
        """  # noqa: E501

        anno = _create_document_annotation(
            span_id=span_id,
            document_position=document_position,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
            label=label,
            score=score,
            explanation=explanation,
            metadata=metadata,
        )

        url = "v1/document_annotations"
        params = {"sync": sync} if sync else {}
        json_ = {"data": [anno]}
        response = self._client.post(url=url, json=json_, params=params)
        response.raise_for_status()
        if not sync:
            return None
        return list(cast(AnnotateSpanDocumentsResponseBody, response.json())["data"])[0]

    @overload
    def log_document_annotations(
        self,
        *,
        document_annotations: list[SpanDocumentAnnotationData],
        sync: Literal[True],
    ) -> list[InsertedSpanDocumentAnnotation]: ...

    @overload
    def log_document_annotations(
        self,
        *,
        document_annotations: list[SpanDocumentAnnotationData],
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    def log_document_annotations(
        self,
        *,
        document_annotations: list[SpanDocumentAnnotationData],
        sync: bool,
    ) -> Optional[list[InsertedSpanDocumentAnnotation]]: ...

    def log_document_annotations(
        self,
        *,
        document_annotations: list[SpanDocumentAnnotationData],
        sync: bool = False,
    ) -> Optional[list[InsertedSpanDocumentAnnotation]]:
        """Log multiple span document annotations.

        Args:
            document_annotations (list[SpanDocumentAnnotationData]): A list of span document
                annotation data objects.
            sync (bool): If True, the request will be fulfilled synchronously and the response
                will contain the inserted annotation IDs. If False, the request will be
                processed asynchronously. Defaults to False.

        Returns:
            Optional[list[InsertedSpanDocumentAnnotation]]: If sync is True, a list of inserted
                span document annotations containing IDs. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If span_document_annotations is empty.

        Example::

            from phoenix.client import Client
            from phoenix.client.resources.spans import SpanDocumentAnnotationData
            client = Client()

            # Log multiple document annotations
            annotations = [
                SpanDocumentAnnotationData(
                    name="relevance",
                    span_id="span-123",
                    document_position=0,
                    annotator_kind="HUMAN",
                    result={"label": "relevant", "score": 0.9}
                ),
                SpanDocumentAnnotationData(
                    name="accuracy",
                    span_id="span-123",
                    document_position=1,
                    annotator_kind="LLM",
                    result={"label": "accurate", "score": 0.8}
                ),
            ]
            client.spans.log_document_annotations(
                span_document_annotations=annotations
            )
        """  # noqa: E501
        annotations_list: list[SpanDocumentAnnotationData] = list(document_annotations)
        if not annotations_list:
            raise ValueError("span_document_annotations cannot be empty")

        url = "v1/document_annotations"
        params = {"sync": sync} if sync else {}
        json_ = {"data": annotations_list}
        response = self._client.post(url=url, json=json_, params=params)
        response.raise_for_status()
        if not sync:
            return None
        return list(cast(AnnotateSpanDocumentsResponseBody, response.json())["data"])

    @overload
    def log_document_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[_AnnotatorKind] = None,
        sync: Literal[True],
    ) -> list[InsertedSpanDocumentAnnotation]: ...

    @overload
    def log_document_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[_AnnotatorKind] = None,
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    def log_document_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[_AnnotatorKind] = None,
        sync: bool,
    ) -> Optional[list[InsertedSpanDocumentAnnotation]]: ...

    def log_document_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[_AnnotatorKind] = None,
        sync: bool = False,
    ) -> Optional[list[InsertedSpanDocumentAnnotation]]:
        """Log multiple span document annotations from a pandas DataFrame.

        This method allows you to create multiple span document annotations at once by providing
        the data in a pandas DataFrame. The DataFrame can either include `name` or
        `annotation_name` columns (but not both) and `annotator_kind` column, or you can
        specify global values for all rows. The data is processed in chunks of 100 rows for
        efficient batch processing.

        Args:
            dataframe (pd.DataFrame): A pandas DataFrame containing the annotation data. Must
                include either a "name" or "annotation_name" column (but not both) or provide a
                global annotation_name parameter. Similarly, must include an "annotator_kind"
                column or provide a global annotator_kind. The `span_id` and `document_position`
                can be either columns in the DataFrame or `span_id` will be taken from the
                DataFrame index. Optional columns include: "label", "score", "explanation",
                and "metadata".
            annotation_name (Optional[str]): The name to use for all annotations. If provided,
                this name will be used for all rows in the DataFrame. Cannot be used if the
                DataFrame contains a "name" or "annotation_name" column.
            annotator_kind (Optional[Literal["LLM", "CODE", "HUMAN"]]): The annotator kind to
                use for all annotations. If provided, this kind will be used for all rows in the
                DataFrame. Cannot be used if the DataFrame contains an "annotator_kind" column.
            sync (bool): If True, the request will be fulfilled synchronously and the response
                will contain the inserted annotation IDs. If False, the request will be
                processed asynchronously. Defaults to False.

        Returns:
            Optional[list[InsertedSpanDocumentAnnotation]]: If sync is True, a list of inserted
                span document annotations containing IDs. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the DataFrame is invalid or empty.

        Example::

            import pandas as pd
            from phoenix.client import Client
            client = Client()

            # Log document annotations from DataFrame
            df = pd.DataFrame({
                "name": ["relevance", "accuracy"],
                "span_id": ["span_123", "span_456"],
                "document_position": [0, 1],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["relevant", "accurate"],
                "score": [0.9, 0.8]
            })
            client.spans.log_document_annotations_dataframe(dataframe=df)
        """  # noqa: E501
        # Validate the DataFrame
        _validate_document_annotations_dataframe(
            dataframe=dataframe,
            annotation_name_required=annotation_name is None,
            annotator_kind_required=annotator_kind is None,
        )

        # Process DataFrame in chunks
        all_responses: list[InsertedSpanDocumentAnnotation] = []
        for chunk in _chunk_document_annotations_dataframe(
            dataframe=dataframe,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
        ):
            response = self.log_document_annotations(document_annotations=chunk, sync=sync)
            if sync and response:
                all_responses.extend(response)

        return all_responses if sync else None


class AsyncSpans:
    """Provides async methods for interacting with span resources.

    This class offers both regular and DataFrame-based async methods for retrieving,
    logging, and managing spans and their annotations.

    Examples:
        Non-DataFrame methods::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            # Get spans as list
            spans = await client.spans.get_spans(
                project_identifier="my-project",
                limit=100
            )

            # Get span annotations as list
            annotations = await client.spans.get_span_annotations(
                span_ids=["span1", "span2"],
                project_identifier="my-project"
            )

            # Log spans
            spans = [
                {
                    "id": "1",
                    "name": "test",
                    "context": {"trace_id": "123", "span_id": "456"},
                }
            ]
            result = await client.spans.log_spans(
                project_identifier="my-project",
                spans=spans
            )
            print(f"Queued {result['total_queued']} spans")

        DataFrame methods::

            from phoenix.client.types.spans import SpanQuery

            # Get spans as DataFrame
            query = SpanQuery().select(annotations["relevance"])
            df = await client.spans.get_spans_dataframe(query=query)

            # Get span annotations as DataFrame
            annotations_df = await client.spans.get_span_annotations_dataframe(
                span_ids=["span1", "span2"],
                project_identifier="my-project"
            )

            # Delete a span
            await client.spans.delete(span_identifier="abc123def456")
    """

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def get_spans_dataframe(
        self,
        *,
        query: Optional[SpanQuery] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000,
        root_spans_only: Optional[bool] = None,
        project_name: Optional[str] = None,
        project_identifier: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """Retrieves spans based on the provided filter conditions.

        Args:
            query (Optional[SpanQuery]): A SpanQuery object defining the query criteria.
            start_time (Optional[datetime]): Optional start time for filtering.
            end_time (Optional[datetime]): Optional end time for filtering.
            limit (int): Maximum number of spans to return. Defaults to 1000.
            root_spans_only (Optional[bool]): Whether to return only root spans.
            project_name (Optional[str]): Optional project name to filter by. Deprecated,
                use `project_identifier` to also specify by the project id.
            project_identifier (Optional[str]): Optional project identifier (name or id)
                to filter by.
            timeout (Optional[int]): Optional request timeout in seconds.


        Returns:
            pd.DataFrame: A pandas DataFrame containing the retrieved spans.

        Raises:
            ImportError: If pandas is not installed.
        """
        project_name = project_name
        query = query if query else SpanQuery()
        normalized_start_time = _normalize_datetime(start_time)
        normalized_end_time = _normalize_datetime(end_time)

        request_body = {
            "queries": [query.to_dict()],
            "start_time": _to_iso_format(normalized_start_time),
            "end_time": _to_iso_format(normalized_end_time),
            "limit": limit,
            "root_spans_only": root_spans_only,
        }

        try:
            import pandas as pd

            _ = pd  # Prevent unused symbol error

            if project_identifier and project_name:
                raise ValueError("Provide only one of 'project_identifier' or 'project_name'.")
            elif project_identifier and not project_name:
                if is_node_id(project_identifier, node_type="Project"):
                    project_response = await self._client.get(
                        url=f"v1/projects/{project_identifier}",
                        headers={"accept": "application/json"},
                        timeout=timeout,
                    )
                    project_response.raise_for_status()
                    project = project_response.json()
                    project_name = project["data"]["name"]
                else:
                    project_name = project_identifier

            response = await self._client.post(
                url="v1/spans",
                headers={"accept": "application/json"},
                params={"project_name": project_name} if project_name else None,
                json=request_body,
                timeout=timeout,
            )
            await response.aread()
            return _process_span_dataframe(response)
        except ImportError:
            raise ImportError(
                "pandas is required to use get_spans_dataframe. "
                "Install it with 'pip install pandas'"
            )

    async def get_span_annotations_dataframe(
        self,
        *,
        spans_dataframe: Optional["pd.DataFrame"] = None,
        span_ids: Optional[Iterable[str]] = None,
        spans: Optional[Iterable[v1.Span]] = None,
        project_identifier: str,
        include_annotation_names: Optional[Sequence[str]] = None,
        exclude_annotation_names: Optional[Sequence[str]] = None,
        limit: int = 1000,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """Fetches span annotations and returns them as a pandas DataFrame.

        Exactly one of *spans_dataframe*, *span_ids*, or *spans* should be provided.

        Args:
            spans_dataframe (Optional[pd.DataFrame]): A DataFrame (typically returned by
                `get_spans_dataframe`) with a `context.span_id` or `span_id` column.
            span_ids (Optional[Iterable[str]]): An iterable of span IDs.
            spans (Optional[Iterable[v1.Span]]): A list of Span objects (typically
                returned by `get_spans`).
            project_identifier (str): The project identifier (name or ID) used in the
                API path.
            include_annotation_names (Optional[Sequence[str]]): Optional list of
                annotation names to include. If provided, only annotations with these
                names will be returned.
            exclude_annotation_names (Optional[Sequence[str]]): Optional list of
                annotation names to exclude from results. Defaults to ["note"] to
                exclude note annotations, which are reserved for notes added via the UI.
            limit (int): Maximum number of annotations returned per request page.
                Defaults to 1000.
            timeout (Optional[int]): Optional request timeout in seconds.

        Returns:
            pd.DataFrame: A DataFrame where each row corresponds to a single span annotation.

        Raises:
            ValueError: If not exactly one of *spans_dataframe*, *span_ids*, or *spans*
                is provided, or if the `context.span_id` or `span_id` column is missing
                from *spans_dataframe*.
            ImportError: If pandas is not installed.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        if exclude_annotation_names is None:
            exclude_annotation_names = ["note"]

        try:
            import pandas as pd
        except ImportError:  # pragma: no cover
            raise ImportError(
                "pandas is required to use get_span_annotations_dataframe. "
                "Install it with 'pip install pandas'"
            )

        # Validate input parameters
        provided_params = sum(
            [
                spans_dataframe is not None,
                span_ids is not None,
                spans is not None,
            ]
        )
        if provided_params != 1:
            raise ValueError("Provide exactly one of 'spans_dataframe', 'span_ids', or 'spans'.")

        if spans_dataframe is not None:
            span_ids_raw: list[str] = cast(
                list[str],
                spans_dataframe["context.span_id"].dropna().tolist(),  # pyright: ignore[reportUnknownMemberType]
            )
            span_ids_list = list({*span_ids_raw})
        elif span_ids is not None:
            span_ids_list = list({*span_ids})
        else:
            assert spans is not None
            _span_ids = [
                span["context"]["span_id"]
                for span in spans
                if span.get("context", {}).get("span_id")
            ]
            span_ids_list = list(set(s for s in _span_ids if s))

        if not span_ids_list:
            return pd.DataFrame()

        annotations: list[SpanAnnotation] = []
        path = f"v1/projects/{project_identifier}/span_annotations"

        for i in range(0, len(span_ids_list), _MAX_SPAN_IDS_PER_REQUEST):
            batch_ids = span_ids_list[i : i + _MAX_SPAN_IDS_PER_REQUEST]
            cursor: Optional[str] = None
            while True:
                params: dict[str, Union[int, str, Sequence[str]]] = {
                    "span_ids": batch_ids,
                    "limit": limit,
                }
                if include_annotation_names is not None:
                    params["include_annotation_names"] = include_annotation_names
                if exclude_annotation_names:
                    params["exclude_annotation_names"] = exclude_annotation_names
                if cursor:
                    params["cursor"] = cursor

                response = await self._client.get(
                    url=path,
                    params=params,
                    headers={"accept": "application/json"},
                    timeout=timeout,
                )
                response.raise_for_status()
                payload = response.json()
                payload = cast(SpanAnnotationsResponseBody, payload)
                batch = cast(list[SpanAnnotation], payload.get("data", []))
                annotations.extend(batch)
                cursor = payload.get("next_cursor")
                if not cursor:
                    break  # finished paginating this batch

        df = pd.DataFrame(annotations)
        df = _flatten_nested_column(df, "result")
        df.rename(columns={"name": "annotation_name"}, inplace=True)  # pyright: ignore[reportUnknownMemberType]
        if not df.empty:
            df.set_index("span_id", inplace=True)  # type: ignore[unused-ignore]
        return df

    async def get_span_annotations(
        self,
        *,
        span_ids: Optional[Iterable[str]] = None,
        spans: Optional[Iterable[v1.Span]] = None,
        project_identifier: str,
        include_annotation_names: Optional[Sequence[str]] = None,
        exclude_annotation_names: Optional[Sequence[str]] = None,
        limit: int = 1000,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[SpanAnnotation]:
        """Fetches span annotations and returns them as a list of SpanAnnotation objects.

        Exactly one of *span_ids* or *spans* should be provided.

        Args:
            span_ids (Optional[Iterable[str]]): An iterable of span IDs.
            spans (Optional[Iterable[v1.Span]]): A list of Span objects (typically
                returned by `get_spans`).
            project_identifier (str): The project identifier (name or ID) used in the
                API path.
            include_annotation_names (Optional[Sequence[str]]): Optional list of
                annotation names to include. If provided, only annotations with these
                names will be returned.
            exclude_annotation_names (Optional[Sequence[str]]): Optional list of
                annotation names to exclude from results. Defaults to ["note"] to
                exclude note annotations, which are reserved for notes added via the UI.
            limit (int): Maximum number of annotations returned per request page.
                Defaults to 1000.
            timeout (Optional[int]): Optional request timeout in seconds.

        Returns:
            list[SpanAnnotation]: A list of SpanAnnotation objects.

        Raises:
            ValueError: If not exactly one of *span_ids* or *spans* is provided.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        if exclude_annotation_names is None:
            exclude_annotation_names = ["note"]

        # Validate input parameters
        provided_params = sum(
            [
                span_ids is not None,
                spans is not None,
            ]
        )
        if provided_params != 1:
            raise ValueError("Provide exactly one of 'span_ids' or 'spans'.")

        if span_ids is not None:
            span_ids_list = list({*span_ids})
        else:  # spans is not None
            assert spans is not None
            _span_ids = [
                span["context"]["span_id"]
                for span in spans
                if span.get("context", {}).get("span_id")
            ]
            span_ids_list = list(set(s for s in _span_ids if s))

        if not span_ids_list:
            return []

        annotations: list[SpanAnnotation] = []
        path = f"v1/projects/{project_identifier}/span_annotations"

        for i in range(0, len(span_ids_list), _MAX_SPAN_IDS_PER_REQUEST):
            batch_ids = span_ids_list[i : i + _MAX_SPAN_IDS_PER_REQUEST]
            cursor: Optional[str] = None
            while True:
                params: dict[str, Union[int, str, Sequence[str]]] = {
                    "span_ids": batch_ids,
                    "limit": limit,
                }
                if include_annotation_names is not None:
                    params["include_annotation_names"] = include_annotation_names
                if exclude_annotation_names:
                    params["exclude_annotation_names"] = exclude_annotation_names
                if cursor:
                    params["cursor"] = cursor

                response = await self._client.get(
                    url=path,
                    params=params,
                    headers={"accept": "application/json"},
                    timeout=timeout,
                )
                response.raise_for_status()
                payload = response.json()
                payload = cast(SpanAnnotationsResponseBody, payload)
                batch = cast(list[SpanAnnotation], payload.get("data", []))
                annotations.extend(batch)
                cursor = payload.get("next_cursor")
                if not cursor:
                    break

        return annotations

    async def get_spans(
        self,
        *,
        project_identifier: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[v1.Span]:
        """Retrieves spans with simple filtering options.

        Args:
            project_identifier (str): The project identifier (name or ID) used in the
                API path.
            start_time (Optional[datetime]): Optional start time for filtering
                (inclusive lower bound).
            end_time (Optional[datetime]): Optional end time for filtering
                (exclusive upper bound).
            limit (int): Maximum number of spans to return. Defaults to 100.
            timeout (Optional[int]): Optional request timeout in seconds.

        Returns:
            list[v1.Span]: A list of Span objects.

        Raises:
            httpx.HTTPStatusError: If the API returns an error response.
        """
        all_spans: list[v1.Span] = []
        cursor: Optional[str] = None
        page_size = min(100, limit)

        while len(all_spans) < limit:
            remaining = limit - len(all_spans)
            current_page_size = min(page_size, remaining)

            params: dict[str, Union[int, str, Sequence[str]]] = {
                "limit": current_page_size,
            }

            if start_time:
                params["start_time"] = start_time.isoformat()
            if end_time:
                params["end_time"] = end_time.isoformat()
            if cursor:
                params["cursor"] = cursor

            response = await self._client.get(
                url=f"v1/projects/{project_identifier}/spans",
                params=params,
                headers={"accept": "application/json"},
                timeout=timeout,
            )
            response.raise_for_status()
            payload = response.json()
            payload = cast(v1.SpansResponseBody, payload)

            spans = payload["data"]
            all_spans.extend(spans)

            cursor = payload.get("next_cursor")
            if not cursor or not spans:
                break

        return all_spans[:limit]

    async def log_spans(
        self,
        *,
        project_identifier: str,
        spans: Sequence[v1.Span],
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.CreateSpansResponseBody:
        """Logs spans to a project.

        If any spans are invalid or duplicates, no spans will be logged and a
        SpanCreationError will be raised with details about the failed spans.

        Args:
            project_identifier (str): The project identifier (name or ID) used in the
                API path.
            spans (Sequence[v1.Span]): A sequence of Span objects to log.
            timeout (Optional[int]): Optional request timeout in seconds.

        Returns:
            v1.CreateSpansResponseBody: A CreateSpansResponseBody with statistics about
                the operation. When successful, total_queued will equal total_received.

        Raises:
            SpanCreationError: If any spans failed validation (invalid or duplicates).
            httpx.HTTPStatusError: If the API returns an unexpected error response.
            httpx.TimeoutException: If the request times out.
        """
        request_body = v1.CreateSpansRequestBody(data=list(spans))

        response = await self._client.post(
            url=f"v1/projects/{project_identifier}/spans",
            json=request_body,
            headers={"accept": "application/json"},
            timeout=timeout,
        )
        if response.status_code not in (400, 422):
            response.raise_for_status()
        result = _parse_log_spans_response(response, spans)

        return result

    async def log_spans_dataframe(
        self,
        *,
        project_identifier: str,
        spans_dataframe: "pd.DataFrame",
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.CreateSpansResponseBody:
        """Logs spans to a project from a pandas DataFrame.

        If any spans are invalid or duplicates, no spans will be logged and a
        SpanCreationError will be raised with details about the failed spans.

        Args:
            project_identifier (str): The project identifier (name or ID) used in the
                API path.
            spans_dataframe (pd.DataFrame): A pandas DataFrame with a `context.span_id`
                or `span_id` column.
            timeout (Optional[int]): Optional request timeout in seconds.

        Returns:
            v1.CreateSpansResponseBody: A CreateSpansResponseBody with statistics about
                the operation. When successful, total_queued will equal total_received.

        Raises:
            SpanCreationError: If any spans failed validation (invalid or duplicates).
            httpx.HTTPStatusError: If the API returns an unexpected error response.
            httpx.TimeoutException: If the request times out.
        """

        spans = _dataframe_to_spans(spans_dataframe)
        return await self.log_spans(
            project_identifier=project_identifier, spans=spans, timeout=timeout
        )

    async def delete(
        self,
        *,
        span_identifier: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> None:
        """Deletes a single span by identifier.

        **Important**: This operation deletes ONLY the specified span itself and does NOT
        delete its descendants/children. All child spans will remain in the trace and
        become orphaned (their parent_id will point to a non-existent span).

        Behavior:
            - Deletes only the target span (preserves all descendant spans)
            - If this was the last span in the trace, the trace record is also deleted
            - If the deleted span had a parent, its cumulative metrics (error count, token counts)
              are subtracted from all ancestor spans in the chain

        Note:
            This operation is irreversible and may create orphaned spans.

        Args:
            span_identifier (str): The span identifier: either a relay GlobalID or
                OpenTelemetry span_id.
            timeout (Optional[int]): Optional request timeout in seconds.

        Raises:
            httpx.HTTPStatusError: If the span is not found (404) or other API errors.
            httpx.TimeoutException: If the request times out.

        Examples::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            # Delete by OpenTelemetry span_id
            await client.spans.delete(span_identifier="abc123def456")

            # Delete by Phoenix Global ID
            await client.spans.delete(span_identifier="U3BhbjoxMjM=")
        """
        response = await self._client.delete(
            url=f"v1/spans/{span_identifier}",
            timeout=timeout,
        )
        response.raise_for_status()

    @overload
    async def add_span_annotation(
        self,
        *,
        span_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: Literal[True],
    ) -> InsertedSpanAnnotation: ...

    @overload
    async def add_span_annotation(
        self,
        *,
        span_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    async def add_span_annotation(
        self,
        *,
        span_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: bool,
    ) -> Optional[InsertedSpanAnnotation]: ...

    async def add_span_annotation(
        self,
        *,
        span_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: bool = False,
    ) -> Optional[InsertedSpanAnnotation]:
        """Add a single span annotation asynchronously.

        Args:
            span_id (str): The ID of the span to annotate.
            annotation_name (str): The name of the annotation.
            annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator used for the annotation. Must be one of "LLM", "CODE", or "HUMAN".
                Defaults to "HUMAN".
            label (Optional[str]): The label assigned by the annotation.
            score (Optional[float]): The score assigned by the annotation.
            explanation (Optional[str]): Explanation of the annotation result.
            metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.
            identifier (Optional[str]): An optional identifier for the annotation. Each annotation is uniquely identified by the combination
                of name, span_id, and identifier (where a null identifier is equivalent to an empty string).
                If an annotation with the same name, span_id, and identifier already exists, it will be updated.
                Using a non-empty identifier allows you to have multiple annotations with the same name and span_id.
                Most of the time, you can leave this as None - it will also update the record with identifier="" if it exists.
            sync (bool): If True, the request will be fulfilled synchronously and the response will contain
                the inserted annotation ID. If False, the request will be processed asynchronously.
                Defaults to False.

        Returns:
            Optional[InsertedSpanAnnotation]: If sync is True, the inserted span annotation containing an ID. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if at least one of label, score, or explanation
                is not provided.

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # Add a single annotation with sync response
            annotation = await async_client.spans.add_span_annotation(
                span_id="abc123",
                annotation_name="sentiment",
                label="positive",
                score=0.9,
                explanation="The text expresses a positive sentiment.",
                sync=True,
            )
        """  # noqa: E501
        anno = _create_span_annotation(
            span_id=span_id,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
            label=label,
            score=score,
            explanation=explanation,
            metadata=metadata,
            identifier=identifier,
        )
        if res := await self.log_span_annotations(span_annotations=[anno], sync=sync):
            return res[0]
        return None

    async def add_span_note(
        self,
        *,
        span_id: str,
        note: str,
    ) -> InsertedSpanAnnotation:
        """Add a note to a span asynchronously.

        Notes are a special type of annotation that allow multiple entries per span
        (unlike regular annotations which are unique by name and identifier). Each note
        gets a unique timestamp-based identifier automatically.

        Args:
            span_id (str): The OpenTelemetry span ID of the span to add the note to.
            note (str): The text content of the note.

        Returns:
            InsertedSpanAnnotation: The inserted span annotation containing the ID.

        Raises:
            ValueError: If span_id or note is empty (after stripping whitespace).
            httpx.HTTPStatusError: If the span is not found (404) or other API errors.
            httpx.HTTPError: If the request fails.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            # Add a note to a span
            result = await client.spans.add_span_note(
                span_id="abc123def456",
                note="This span shows interesting behavior.",
            )
            print(f"Note created with ID: {result['id']}")
        """
        span_id = span_id.strip()
        if not span_id:
            raise ValueError("Span ID cannot be empty")
        note = note.strip()
        if not note:
            raise ValueError("Note cannot be empty")
        url = "v1/span_notes"
        json_: CreateSpanNoteRequestBody = {
            "data": {
                "span_id": span_id,
                "note": note,
            }
        }
        response = await self._client.post(url=url, json=json_)
        response.raise_for_status()
        return cast(CreateSpanNoteResponseBody, response.json())["data"]

    @overload
    async def log_span_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: Literal[True],
    ) -> list[InsertedSpanAnnotation]: ...

    @overload
    async def log_span_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    async def log_span_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool,
    ) -> Optional[list[InsertedSpanAnnotation]]: ...

    async def log_span_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool = False,
    ) -> Optional[list[InsertedSpanAnnotation]]:
        """Log multiple span annotations from a pandas DataFrame asynchronously.

        This method allows you to create multiple span annotations at once by providing the data
        in a pandas DataFrame. The DataFrame can either include `name` or `annotation_name` columns
        (but not both) and `annotator_kind` column, or you can specify global values for all rows.
        The data is processed in chunks of 100 rows for efficient batch processing.

        Args:
            dataframe (pd.DataFrame): A pandas DataFrame containing the annotation data. Must include
                either a "name" or "annotation_name" column (but not both) or provide a global
                annotation_name parameter. Similarly, must include an "annotator_kind" column or
                provide a global annotator_kind. The `span_id` can be either a column in the
                DataFrame or will be taken from the DataFrame index. Optional columns include:
                "label", "score", "explanation", "metadata", and "identifier".
            annotation_name (Optional[str]): The name to use for all annotations. If provided, this
                value will be used for all rows and the DataFrame does not need to include a "name"
                or "annotation_name" column.
            annotator_kind (Optional[Literal["LLM", "CODE", "HUMAN"]]): The kind of annotator used
                for all annotations. If provided, this value will be used for all rows and the
                DataFrame does not need to include an "annotator_kind" column. Must be one of
                "LLM", "CODE", or "HUMAN".
            sync (bool): If True, the request will be fulfilled synchronously and the response will
                contain the inserted annotation IDs. If False, the request will be processed
                asynchronously. Defaults to False.

        Returns:
            Optional[list[dict]]: If sync is True, a list of all inserted span annotations. If sync is False, None.

        Raises:
            ImportError: If pandas is not installed.
            ValueError: If the DataFrame is missing required columns or if no valid annotation data is provided.

        Example::

            import pandas as pd
            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # Using name and annotator_kind from DataFrame with span_id column
            df1 = pd.DataFrame({
                "name": ["sentiment", "toxicity"],
                "span_id": ["span_123", "span_456"],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["positive", "low"],
                "score": [0.9, 0.1]
            })
            await async_client.spans.log_span_annotations_dataframe(dataframe=df1)

            # Using global name and annotator_kind with span_id from index
            df2 = pd.DataFrame({
                "label": ["positive", "low"]
            }, index=["span_345", "span_678"])
            await async_client.spans.log_span_annotations_dataframe(
                dataframe=df2,
                annotation_name="sentiment",  # applies to all rows
                annotator_kind="HUMAN"  # applies to all rows
            )
        """  # noqa: E501
        # Validate DataFrame first
        _validate_span_annotations_dataframe(dataframe=dataframe)

        # Process DataFrame chunks using iterator
        all_responses: list[InsertedSpanAnnotation] = []
        for chunk in _chunk_span_annotations_dataframe(
            dataframe=dataframe,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
        ):
            # Delegate to log_span_annotations
            response = await self.log_span_annotations(span_annotations=chunk, sync=sync)
            if sync and response:
                all_responses.extend(response)

        return all_responses if sync else None

    @overload
    async def log_span_annotations(
        self,
        *,
        span_annotations: Iterable[SpanAnnotationData],
        sync: Literal[True],
    ) -> list[InsertedSpanAnnotation]: ...

    @overload
    async def log_span_annotations(
        self,
        *,
        span_annotations: Iterable[SpanAnnotationData],
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    async def log_span_annotations(
        self,
        *,
        span_annotations: Iterable[SpanAnnotationData],
        sync: bool,
    ) -> Optional[list[InsertedSpanAnnotation]]: ...

    async def log_span_annotations(
        self,
        *,
        span_annotations: Iterable[SpanAnnotationData],
        sync: bool = False,
    ) -> Optional[list[InsertedSpanAnnotation]]:
        """Log multiple span annotations asynchronously.

        Args:
            span_annotations (Iterable[SpanAnnotationData]): An iterable of span annotation data to log. Each annotation must include
                at least a span_id, name, and annotator_kind, and at least one of label, score, or explanation.
            sync (bool): If True, the request will be fulfilled synchronously and the response will contain
                the inserted annotation IDs. If False, the request will be processed asynchronously.
                Defaults to False.

        Returns:
            Optional[list[InsertedSpanAnnotation]]: If sync is True, a list of inserted span annotations, each containing an ID. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if the input is invalid.

        Example::

            from phoenix.client import AsyncClient
            from phoenix.client.resources.spans import SpanAnnotationData
            async_client = AsyncClient()

            # Create span annotation data objects using dictionaries
            annotation1 =  SpanAnnotationData(
                name="sentiment",
                span_id="72dda197b0e1b3ef",
                annotator_kind="HUMAN",
                result={"label": "positive", "score": 0.9},
            )

            annotation2 =  SpanAnnotationData(
                name="sentiment",
                span_id="72dda197b0e1b3ef",
                annotator_kind="HUMAN",
                result={"label": "negative", "score": 0.1},
            )

            # Log multiple annotations at once
            await async_client.spans.log_span_annotations(
                span_annotations=[annotation1, annotation2],
            )
        """  # noqa: E501
        # Convert to list and validate input
        annotations_list: list[SpanAnnotationData] = list(span_annotations)
        if not annotations_list:
            raise ValueError("span_annotations cannot be empty")

        url = "v1/span_annotations"
        params = {"sync": sync} if sync else {}
        json_ = AnnotateSpansRequestBody(data=annotations_list)
        response = await self._client.post(url=url, json=json_, params=params)
        response.raise_for_status()
        if not sync:
            return None
        return list(cast(AnnotateSpansResponseBody, response.json())["data"])

    @overload
    async def add_document_annotation(
        self,
        *,
        span_id: str,
        document_position: int,
        annotation_name: str,
        annotator_kind: _AnnotatorKind = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        sync: Literal[True],
    ) -> InsertedSpanDocumentAnnotation: ...

    @overload
    async def add_document_annotation(
        self,
        *,
        span_id: str,
        document_position: int,
        annotation_name: str,
        annotator_kind: _AnnotatorKind = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    async def add_document_annotation(
        self,
        *,
        span_id: str,
        document_position: int,
        annotation_name: str,
        annotator_kind: _AnnotatorKind = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        sync: bool,
    ) -> Optional[InsertedSpanDocumentAnnotation]: ...

    async def add_document_annotation(
        self,
        *,
        span_id: str,
        document_position: int,
        annotation_name: str,
        annotator_kind: _AnnotatorKind = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        sync: bool = False,
    ) -> Optional[InsertedSpanDocumentAnnotation]:
        """Add a single span document annotation asynchronously.

        Args:
            span_id (str): The ID of the span to annotate.
            document_position (int): The 0-based index of the document within the span.
            annotation_name (str): The name of the annotation.
            annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator used for the
                annotation. Must be one of "LLM", "CODE", or "HUMAN". Defaults to "HUMAN".
            label (Optional[str]): The label assigned by the annotation.
            score (Optional[float]): The score assigned by the annotation.
            explanation (Optional[str]): Explanation of the annotation result.
            metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.

            sync (bool): If True, the request will be fulfilled synchronously and the response
                will contain the inserted annotation ID. If False, the request will be processed
                asynchronously. Defaults to False.

        Returns:
            Optional[InsertedSpanDocumentAnnotation]: If sync is True, the inserted span document
                annotation containing an ID. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if at least one of label, score, or
                explanation is not provided.

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # Add a single document annotation with sync response
            annotation = await async_client.spans.add_document_annotation(
                span_id="abc123",
                document_position=0,
                annotation_name="relevance",
                label="relevant",
                score=0.9,
                explanation="The document is relevant to the query.",
                sync=True,
            )
        """  # noqa: E501
        anno = _create_document_annotation(
            span_id=span_id,
            document_position=document_position,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
            label=label,
            score=score,
            explanation=explanation,
            metadata=metadata,
        )

        url = "v1/document_annotations"
        params = {"sync": sync} if sync else {}
        json_ = {"data": [anno]}
        response = await self._client.post(url=url, json=json_, params=params)
        response.raise_for_status()
        if not sync:
            return None
        return list(cast(v1.AnnotateSpanDocumentsResponseBody, response.json())["data"])[0]

    @overload
    async def log_document_annotations(
        self,
        *,
        document_annotations: list[SpanDocumentAnnotationData],
        sync: Literal[True],
    ) -> list[InsertedSpanDocumentAnnotation]: ...

    @overload
    async def log_document_annotations(
        self,
        *,
        document_annotations: list[SpanDocumentAnnotationData],
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    async def log_document_annotations(
        self,
        *,
        document_annotations: list[SpanDocumentAnnotationData],
        sync: bool,
    ) -> Optional[list[InsertedSpanDocumentAnnotation]]: ...

    async def log_document_annotations(
        self,
        *,
        document_annotations: list[SpanDocumentAnnotationData],
        sync: bool = False,
    ) -> Optional[list[InsertedSpanDocumentAnnotation]]:
        """Log multiple span document annotations asynchronously.

        Args:
            document_annotations (list[SpanDocumentAnnotationData]): A list of span document
                annotation data objects.
            sync (bool): If True, the request will be fulfilled synchronously and the response
                will contain the inserted annotation IDs. If False, the request will be
                processed asynchronously. Defaults to False.

        Returns:
            Optional[list[InsertedSpanDocumentAnnotation]]: If sync is True, a list of inserted
                span document annotations containing IDs. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If span_document_annotations is empty.

        Example::

            from phoenix.client import AsyncClient
            from phoenix.client.resources.annotations import SpanDocumentAnnotationData
            async_client = AsyncClient()

            # Log multiple document annotations
            annotations = [
                SpanDocumentAnnotationData(
                    name="relevance",
                    span_id="span-123",
                    document_position=0,
                    annotator_kind="HUMAN",
                    result={"label": "relevant", "score": 0.9}
                ),
                SpanDocumentAnnotationData(
                    name="accuracy",
                    span_id="span-123",
                    document_position=1,
                    annotator_kind="LLM",
                    result={"label": "accurate", "score": 0.8}
                ),
            ]
            await async_client.spans.log_document_annotations(
                span_document_annotations=annotations
            )
        """  # noqa: E501
        annotations_list: list[SpanDocumentAnnotationData] = list(document_annotations)
        if not annotations_list:
            raise ValueError("span_document_annotations cannot be empty")

        url = "v1/document_annotations"
        params = {"sync": sync} if sync else {}
        json_ = {"data": annotations_list}
        response = await self._client.post(url=url, json=json_, params=params)
        response.raise_for_status()
        if not sync:
            return None
        return list(cast(v1.AnnotateSpanDocumentsResponseBody, response.json())["data"])

    @overload
    async def log_document_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: Literal[True],
    ) -> list[InsertedSpanDocumentAnnotation]: ...

    @overload
    async def log_document_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    async def log_document_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool,
    ) -> Optional[list[InsertedSpanDocumentAnnotation]]: ...

    async def log_document_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool = False,
    ) -> Optional[list[InsertedSpanDocumentAnnotation]]:
        """Log multiple span document annotations from a pandas DataFrame asynchronously.

        This method allows you to create multiple span document annotations at once by providing
        the data in a pandas DataFrame. The DataFrame can either include `name` or
        `annotation_name` columns (but not both) and `annotator_kind` column, or you can
        specify global values for all rows. The data is processed in chunks of 100 rows for
        efficient batch processing.

        Args:
            dataframe (pd.DataFrame): A pandas DataFrame containing the annotation data. Must
                include either a "name" or "annotation_name" column (but not both) or provide a
                global annotation_name parameter. Similarly, must include an "annotator_kind"
                column or provide a global annotator_kind. The `span_id` and `document_position`
                can be either columns in the DataFrame or `span_id` will be taken from the
                DataFrame index. Optional columns include: "label", "score", "explanation",
                "metadata", and "identifier".
            annotation_name (Optional[str]): The name to use for all annotations. If provided,
                this name will be used for all rows in the DataFrame. Cannot be used if the
                DataFrame contains a "name" or "annotation_name" column.
            annotator_kind (Optional[Literal["LLM", "CODE", "HUMAN"]]): The annotator kind to
                use for all annotations. If provided, this kind will be used for all rows in the
                DataFrame. Cannot be used if the DataFrame contains an "annotator_kind" column.
            sync (bool): If True, the request will be fulfilled synchronously and the response
                will contain the inserted annotation IDs. If False, the request will be
                processed asynchronously. Defaults to False.

        Returns:
            Optional[list[InsertedSpanDocumentAnnotation]]: If sync is True, a list of inserted
                span document annotations containing IDs. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the DataFrame is invalid or empty.

        Example::

            import pandas as pd
            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # Log document annotations from DataFrame
            df = pd.DataFrame({
                "name": ["relevance", "accuracy"],
                "span_id": ["span_123", "span_456"],
                "document_position": [0, 1],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["relevant", "accurate"],
                "score": [0.9, 0.8]
            })
            await async_client.spans.log_document_annotations_dataframe(dataframe=df)
        """  # noqa: E501
        # Validate the DataFrame
        _validate_document_annotations_dataframe(
            dataframe=dataframe,
            annotation_name_required=annotation_name is None,
            annotator_kind_required=annotator_kind is None,
        )

        # Process DataFrame in chunks
        all_responses: list[InsertedSpanDocumentAnnotation] = []
        for chunk in _chunk_document_annotations_dataframe(
            dataframe=dataframe,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
        ):
            response = await self.log_document_annotations(document_annotations=chunk, sync=sync)
            if sync and response:
                all_responses.extend(response)

        return all_responses if sync else None


def _to_iso_format(value: Optional[datetime]) -> Optional[str]:
    """Convert a datetime to ISO format string.

    Args:
        value (Optional[datetime]): The datetime value to convert.

    Returns:
        Optional[str]: ISO format string if value is provided, None otherwise.
    """
    return value.isoformat() if value else None


def _decode_df_from_json_string(obj: str) -> "pd.DataFrame":
    """Decode a JSON string into a pandas DataFrame using table schema.

    Args:
        obj (str): JSON string containing DataFrame data in table schema format.

    Returns:
        pd.DataFrame: The decoded pandas DataFrame with cleaned index and column names.
    """
    import pandas as pd
    from pandas.io.json._table_schema import parse_table_schema  # type: ignore

    df = cast(pd.DataFrame, parse_table_schema(StringIO(obj).read(), False))
    df.index.names = [x.split("_", 1)[1] or None for x in df.index.names]  # type: ignore
    return df.set_axis([x.split("_", 1)[1] for x in df.columns], axis=1)  # type: ignore[override,unused-ignore]


def _normalize_datetime(
    dt: Optional[datetime],
    tz: Optional[tzinfo] = None,
) -> Optional[datetime]:
    """Normalize a datetime to UTC timezone.

    If the input datetime is timezone-naive, it is localized as local timezone
    unless tzinfo is specified.

    Args:
        dt (Optional[datetime]): The datetime to normalize.
        tz (Optional[tzinfo]): Optional timezone to use for naive datetimes.
            Defaults to local timezone if not provided.

    Returns:
        Optional[datetime]: The normalized datetime in UTC, or None if input is None.
    """
    if not isinstance(dt, datetime):
        return None
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        dt = dt.replace(tzinfo=tz if tz else _LOCAL_TIMEZONE)
    return dt.astimezone(timezone.utc)


def _process_span_dataframe(response: httpx.Response) -> "pd.DataFrame":
    """Processes the httpx response to extract a pandas DataFrame, handling multipart responses.

    Args:
        response (httpx.Response): The HTTP response containing DataFrame data.

    Returns:
        pd.DataFrame: The extracted pandas DataFrame, or empty DataFrame if no data.

    Raises:
        ValueError: If boundary not found in Content-Type header for multipart response.
    """
    import pandas as pd

    content_type = response.headers.get("Content-Type")
    dfs: list["pd.DataFrame"] = []
    if isinstance(content_type, str) and "multipart/mixed" in content_type:
        if "boundary=" in content_type:
            boundary_token = content_type.split("boundary=")[1].split(";", 1)[0]
        else:
            raise ValueError(
                "Boundary not found in Content-Type header for multipart/mixed response"
            )
        boundary = f"--{boundary_token}"
        text = response.text
        while boundary in text:
            part, text = text.split(boundary, 1)
            if "Content-Type: application/json" in part:
                json_string = part.split("\r\n\r\n", 1)[1].strip()
                df = _decode_df_from_json_string(json_string)
                dfs.append(df)
    else:
        response.raise_for_status()
        logger.warning("Received non-multipart response when expecting dataframe.")

    if dfs:
        return dfs[0]  # only passing in one query
    else:
        return pd.DataFrame()


def _flatten_nested_column(df: "pd.DataFrame", column_name: str) -> "pd.DataFrame":
    """Flatten a nested dictionary column in a DataFrame.

    Args:
        df (pd.DataFrame): The DataFrame containing the nested column.
        column_name (str): The name of the column to flatten.

    Returns:
        pd.DataFrame: DataFrame with the nested column flattened and prefixed.
    """
    import pandas as pd

    if column_name in df.columns:
        # Flatten the nested dictionary column and prefix each resulting column with
        # the original column name (e.g., "result.label").
        nested_df = pd.json_normalize(df[column_name]).rename(  # type: ignore[arg-type]
            columns=lambda col: f"{column_name}.{col}"  # pyright: ignore[reportUnknownLambdaType]
        )
        df = pd.concat([df.drop(columns=[column_name]), nested_df], axis=1)  # pyright: ignore[reportUnknownMemberType]
    return df


def _format_log_spans_error_message(
    *,
    total_invalid: int,
    total_duplicates: int,
    invalid_spans: Sequence[InvalidSpanInfo],
    duplicate_spans: Sequence[DuplicateSpanInfo],
) -> str:
    """Format error message for span logging failures.

    Args:
        total_invalid (int): Total number of invalid spans.
        total_duplicates (int): Total number of duplicate spans.
        invalid_spans (Sequence[InvalidSpanInfo]): List of invalid span information.
        duplicate_spans (Sequence[DuplicateSpanInfo]): List of duplicate span information.

    Returns:
        str: Formatted error message describing the failures.
    """
    MAX_ERRORS_TO_SHOW = 5
    error_parts: list[str] = []

    if total_invalid > 0:
        error_parts.append(f"Failed to queue {total_invalid} invalid spans:")
        for invalid_span in invalid_spans[:MAX_ERRORS_TO_SHOW]:
            span_id = invalid_span.get("span_id", "unknown")
            error = invalid_span.get("error", "unknown error")
            error_parts.append(f"  - Span {span_id}: {error}")
        if len(invalid_spans) > MAX_ERRORS_TO_SHOW:
            error_parts.append(
                f"  ... and {len(invalid_spans) - MAX_ERRORS_TO_SHOW} more invalid spans"
            )

    if total_duplicates > 0:
        if error_parts:
            error_parts.append("")  # Add blank line
        error_parts.append(f"Found {total_duplicates} duplicate spans:")
        for dup_span in duplicate_spans[:MAX_ERRORS_TO_SHOW]:
            span_id = dup_span.get("span_id", "unknown")
            error_parts.append(f"  - Span {span_id}")
        if len(duplicate_spans) > MAX_ERRORS_TO_SHOW:
            error_parts.append(
                f"  ... and {len(duplicate_spans) - MAX_ERRORS_TO_SHOW} more duplicates"
            )

    return "\n".join(error_parts)


def _parse_log_spans_response(
    response: httpx.Response,
    spans: Sequence[v1.Span],
) -> v1.CreateSpansResponseBody:
    """Parse the response from log spans request.

    Args:
        response (httpx.Response): The HTTP response from the log spans request.
        spans (Sequence[v1.Span]): The original spans that were sent in the request.

    Returns:
        v1.CreateSpansResponseBody: Parsed response body with span creation statistics.

    Raises:
        SpanCreationError: If the response indicates validation errors or duplicates.
    """
    response_data = response.json()

    if response.status_code == 422 and "detail" in response_data:
        error_response = _parse_log_spans_validation_error(response_data, spans)
        _raise_log_spans_error(error_response)

    if response.status_code == 400:
        if "detail" in response_data:
            detail = response_data["detail"]
            # For 400 errors, the server now returns properly formatted JSON in the detail field
            parsed_detail = json.loads(detail)
            _raise_log_spans_error(parsed_detail)
        elif "error" in response_data:
            # Handle case where error data is returned directly (not wrapped in detail)
            _raise_log_spans_error(response_data)

    return cast(v1.CreateSpansResponseBody, response_data)


def _parse_log_spans_validation_error(
    response_data: dict[str, Any],
    spans: Sequence[v1.Span],
) -> v1.CreateSpansResponseBody:
    """Convert FastAPI validation errors to our expected format.

    Args:
        response_data (dict[str, Any]): The response data containing validation errors.
        spans (Sequence[v1.Span]): The original spans that were sent in the request.

    Returns:
        v1.CreateSpansResponseBody: Formatted response body with invalid span information.
    """
    invalid_spans: list[InvalidSpanInfo] = []

    for error in response_data.get("detail", []):
        invalid_span = _extract_invalid_span_from_log_spans_error(error, spans)
        if invalid_span:
            invalid_spans.append(invalid_span)

    return cast(
        v1.CreateSpansResponseBody,
        {
            "total_received": len(spans),
            "total_queued": len(spans) - len(invalid_spans),
            "total_duplicates": 0,
            "total_invalid": len(invalid_spans),
            "duplicate_spans": [],
            "invalid_spans": invalid_spans,
        },
    )


def _extract_invalid_span_from_log_spans_error(
    error: dict[str, Any],
    spans: Sequence[v1.Span],
) -> Optional[InvalidSpanInfo]:
    """Extract invalid span info from a validation error.

    Args:
        error (dict[str, Any]): The validation error dictionary.
        spans (Sequence[v1.Span]): The original spans that were sent in the request.

    Returns:
        Optional[InvalidSpanInfo]: Invalid span information if extractable, None otherwise.
    """
    loc_raw = error.get("loc", [])
    if not isinstance(loc_raw, list):
        return None

    loc: list[Any] = loc_raw
    if not (len(loc) >= 3 and loc[0] == "body" and loc[1] == "data" and isinstance(loc[2], int)):
        return None

    span_index = loc[2]
    if span_index >= len(spans):
        return None

    span: Any = spans[span_index]
    span_dict = cast(dict[str, Any], span)
    return {
        "span_id": span_dict.get("context", {}).get("span_id", "unknown"),
        "trace_id": span_dict.get("context", {}).get("trace_id", "unknown"),
        "error": error.get("msg", "Validation error"),
    }


def _raise_log_spans_error(
    error_data: Union[dict[str, Any], CreateSpansResponseBody],
) -> None:
    """Raise SpanCreationError from error response data.

    Args:
        error_data (Union[dict[str, Any], v1.CreateSpansResponseBody]): Error data
            from the API response.

    Raises:
        SpanCreationError: Always raised with details about the span creation failures.
    """
    total_received = error_data.get("total_received", 0)
    total_queued = error_data.get("total_queued", 0)
    total_invalid = cast(int, error_data.get("total_invalid", 0))
    total_duplicates = cast(int, error_data.get("total_duplicates", 0))
    invalid_spans = cast(list[InvalidSpanInfo], error_data.get("invalid_spans", []))
    duplicate_spans = cast(list[DuplicateSpanInfo], error_data.get("duplicate_spans", []))

    error_msg = _format_log_spans_error_message(
        total_invalid=total_invalid,
        total_duplicates=total_duplicates,
        invalid_spans=invalid_spans,
        duplicate_spans=duplicate_spans,
    )
    raise SpanCreationError(
        message=error_msg,
        invalid_spans=list(invalid_spans),
        duplicate_spans=list(duplicate_spans),
        total_received=total_received,
        total_queued=total_queued,
        total_invalid=total_invalid,
        total_duplicates=total_duplicates,
    )
