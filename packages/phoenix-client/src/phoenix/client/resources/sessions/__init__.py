from __future__ import annotations

from typing import (
    TYPE_CHECKING,
    Any,
    Iterable,
    List,
    Literal,
    Mapping,
    Optional,
    cast,
    overload,
)

import httpx
from openinference.semconv.trace import SpanAttributes
from typing_extensions import NotRequired, TypedDict

from phoenix.client.__generated__ import v1
from phoenix.client.constants.server_requirements import (
    ANNOTATE_SESSIONS,
    DELETE_SESSION,
    DELETE_SESSIONS,
    GET_SESSION,
    LIST_PROJECT_SESSIONS,
)
from phoenix.client.utils.annotation_helpers import (
    _chunk_session_annotations_dataframe,  # pyright: ignore[reportPrivateUsage]
    _create_session_annotation,  # pyright: ignore[reportPrivateUsage]
    _validate_session_annotations_dataframe,  # pyright: ignore[reportPrivateUsage]
)
from phoenix.client.utils.encode_path_param import encode_path_param
from phoenix.client.utils.server_requirements import (
    AsyncServerVersionGuard,
    ServerVersionGuard,
)

DEFAULT_TIMEOUT_IN_SECONDS = 5
_MAX_TRACE_IDS_PER_BATCH = 50


class SessionTurnIO(TypedDict):
    """**Experimental** - The input or output payload of a single session turn.

    Extracted from a root span's ``input.value`` / ``output.value`` attributes
    (OpenInference semantic conventions).

    Attributes:
        value: The string content of the input or output.
        mime_type: Optional MIME type such as ``"text/plain"`` or
            ``"application/json"``.  Present only when the span carries the
            corresponding ``input.mime_type`` / ``output.mime_type`` attribute.
    """

    value: str
    mime_type: NotRequired[Optional[str]]


class SessionTurn(TypedDict):
    """**Experimental** - One conversational turn inside a session.

    Each turn corresponds to a single trace.  The ``input`` and ``output``
    fields are extracted from the trace's **root span** attributes
    (``input.value`` / ``output.value`` per OpenInference semantic conventions).
    If the root span is missing or lacks those attributes, the fields will be
    absent.

    Attributes:
        trace_id: The trace ID that produced this turn.
        start_time: ISO-8601 timestamp when the trace started.
        end_time: ISO-8601 timestamp when the trace ended.
        input: The user-facing input for this turn, if available.
        output: The assistant/model output for this turn, if available.
        root_span: The full root span object, if one was found for the trace.
    """

    trace_id: str
    start_time: str
    end_time: str
    input: NotRequired[Optional[SessionTurnIO]]
    output: NotRequired[Optional[SessionTurnIO]]
    root_span: NotRequired[v1.Span]


if TYPE_CHECKING:
    import pandas as pd

    from phoenix.client.resources.spans import AsyncSpans, Spans

# Re-export generated types
InsertedSessionAnnotation = v1.InsertedSessionAnnotation
SessionAnnotationData = v1.SessionAnnotationData
AnnotateSessionsRequestBody = v1.AnnotateSessionsRequestBody
AnnotateSessionsResponseBody = v1.AnnotateSessionsResponseBody
SessionData = v1.SessionData
SessionTraceData = v1.SessionTraceData
GetSessionResponseBody = v1.GetSessionResponseBody
GetSessionsResponseBody = v1.GetSessionsResponseBody


class Sessions:
    def __init__(
        self,
        client: httpx.Client,
        spans: "Spans",
        *,
        _guard: ServerVersionGuard | None = None,
    ) -> None:
        self._client = client
        self._guard = _guard or ServerVersionGuard(client)
        self._spans = spans

    def get(
        self,
        *,
        session_id: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.SessionData:
        """Get a session by ID or session_id string.

        Requires Phoenix server >= 13.5.0.

        Args:
            session_id: The session identifier (GlobalID or user-provided session_id).
            timeout: Optional timeout in seconds for the request.

        Returns:
            The session data.
        """

        self._guard.require(GET_SESSION)
        url = f"v1/sessions/{encode_path_param(session_id)}"
        response = self._client.get(url, timeout=timeout)
        response.raise_for_status()
        return cast(v1.GetSessionResponseBody, response.json())["data"]

    def list(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
        limit: Optional[int] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> List[v1.SessionData]:
        """List sessions for a project.

        Requires Phoenix server >= 13.5.0.

        Args:
            project_id: The ID of the project.
            project_name: The name of the project.
            limit: Maximum number of sessions to return.
            timeout: Optional timeout in seconds for the request.

        Returns:
            A list of session data.
        """

        self._guard.require(LIST_PROJECT_SESSIONS)
        if not project_id and not project_name:
            raise ValueError("Either project_id or project_name must be provided.")
        if project_id and project_name:
            raise ValueError("Only one of project_id or project_name can be provided.")
        project_identifier = project_name if project_name else project_id
        assert project_identifier
        url = f"v1/projects/{encode_path_param(project_identifier)}/sessions"
        all_sessions: List[v1.SessionData] = []
        next_cursor: Optional[str] = None
        while True:
            params: dict[str, Any] = {}
            if next_cursor:
                params["cursor"] = next_cursor
            if limit is not None:
                params["limit"] = min(limit - len(all_sessions), 100)
            response = self._client.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            data = cast(v1.GetSessionsResponseBody, response.json())
            all_sessions.extend(data["data"])
            if limit is not None and len(all_sessions) >= limit:
                all_sessions = all_sessions[:limit]
                break
            if not (next_cursor := data.get("next_cursor")):
                break
        return all_sessions

    def delete(
        self,
        *,
        session_id: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> None:
        """Delete a session by ID or session_id string.

        This will permanently remove the session and all associated traces, spans,
        and annotations via cascade delete.

        Requires Phoenix server >= 13.13.0.

        Args:
            session_id: The session identifier (GlobalID or user-provided session_id).
            timeout: Optional timeout in seconds for the request.
        """

        self._guard.require(DELETE_SESSION)
        url = f"v1/sessions/{encode_path_param(session_id)}"
        response = self._client.delete(url, timeout=timeout)
        response.raise_for_status()

    def bulk_delete(
        self,
        *,
        session_ids: List[str],
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> None:
        """Delete multiple sessions by their identifiers.

        All identifiers must be the same type: either all GlobalIDs or all
        user-provided session_id strings. Non-existent IDs are silently skipped.
        All associated traces, spans, and annotations are cascade deleted.

        Requires Phoenix server >= 13.13.0.

        Args:
            session_ids: List of session identifiers (GlobalIDs or session_id strings).
            timeout: Optional timeout in seconds for the request.
        """

        self._guard.require(DELETE_SESSIONS)
        if not session_ids:
            raise ValueError("session_ids must not be empty")
        json_: v1.DeleteSessionsRequestBody = {"session_identifiers": list(session_ids)}
        response = self._client.post("v1/sessions/delete", json=json_, timeout=timeout)
        response.raise_for_status()

    def get_sessions_dataframe(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
        limit: Optional[int] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """Get sessions as a pandas DataFrame.

        Requires Phoenix server >= 13.5.0.

        Args:
            project_id: The ID of the project.
            project_name: The name of the project.
            limit: Maximum number of sessions to return.
            timeout: Optional timeout in seconds for the request.

        Returns:
            A DataFrame with columns: id, session_id, project_id, start_time, end_time, num_traces.
        """
        import pandas as pd

        sessions = self.list(
            project_id=project_id, project_name=project_name, limit=limit, timeout=timeout
        )
        rows = [
            {
                "id": s["id"],
                "session_id": s["session_id"],
                "project_id": s["project_id"],
                "start_time": s["start_time"],
                "end_time": s["end_time"],
                "num_traces": len(s["traces"]),
            }
            for s in sessions
        ]
        return pd.DataFrame(rows)

    def get_session_turns(
        self,
        *,
        session_id: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> List[SessionTurn]:
        """**Experimental** - Retrieve the ordered conversation turns for a session.

        Requires Phoenix server >= 13.5.0.

        Fetches every trace in the session, locates each trace's root span, and
        extracts the ``input.value`` / ``output.value`` attributes to build a
        chronological list of turns.

        Args:
            session_id: The session to look up.  Accepts either a Phoenix
                GlobalID (e.g. ``"U2Vzc2lvbjox"``) or the user-provided
                ``session_id`` string that was set at trace time.
            timeout: Per-request timeout in seconds.  Applied independently to
                the session fetch and to each batch of span fetches.
                Defaults to ``DEFAULT_TIMEOUT_IN_SECONDS``.

        Returns:
            A list of :class:`SessionTurn` dicts sorted by ``start_time``
            (ascending).  Each entry contains ``trace_id``, ``start_time``,
            ``end_time``, and optionally ``input``, ``output``, and
            ``root_span``.

        Example::

            client = Client()
            turns = client.sessions.get_session_turns(session_id="my-session")
            for turn in turns:
                print(turn.get("input", {}).get("value", "<no input>"))
        """
        session_data = self.get(session_id=session_id, timeout=timeout)
        traces = session_data["traces"]
        if not traces:
            return []

        project_id = session_data["project_id"]
        all_trace_ids = [t["trace_id"] for t in traces]

        # Build trace_id -> trace info lookup
        trace_info: dict[str, v1.SessionTraceData] = {t["trace_id"]: t for t in traces}

        # Fetch root spans in batches
        root_spans_by_trace: dict[str, v1.Span] = {}
        for i in range(0, len(all_trace_ids), _MAX_TRACE_IDS_PER_BATCH):
            batch = all_trace_ids[i : i + _MAX_TRACE_IDS_PER_BATCH]
            spans = self._spans.get_spans(
                project_identifier=project_id,
                trace_ids=batch,
                parent_id="null",
                limit=len(batch),
                timeout=timeout,
            )
            for span in spans:
                tid = span["context"]["trace_id"]
                if tid not in root_spans_by_trace:
                    root_spans_by_trace[tid] = span

        return _build_session_turns(
            all_trace_ids=all_trace_ids,
            trace_info=trace_info,
            root_spans_by_trace=root_spans_by_trace,
        )

    @overload
    def add_session_annotation(
        self,
        *,
        session_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: Literal[True],
    ) -> InsertedSessionAnnotation: ...

    @overload
    def add_session_annotation(
        self,
        *,
        session_id: str,
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
    def add_session_annotation(
        self,
        *,
        session_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: bool,
    ) -> Optional[InsertedSessionAnnotation]: ...

    def add_session_annotation(
        self,
        *,
        session_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: bool = False,
    ) -> Optional[InsertedSessionAnnotation]:
        """Add a single session annotation.

        Requires Phoenix server >= 12.0.0.

        Args:
            session_id (str): The ID of the session to annotate.
            annotation_name (str): The name of the annotation.
            annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator used for the annotation. Must be one of "LLM", "CODE", or "HUMAN".
                Defaults to "HUMAN".
            label (Optional[str]): The label assigned by the annotation.
            score (Optional[float]): The score assigned by the annotation.
            explanation (Optional[str]): Explanation of the annotation result.
            metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.
            identifier (Optional[str]): An optional identifier for the annotation. Each annotation is uniquely identified by the combination
                of name, session_id, and identifier (where a null identifier is equivalent to an empty string).
                If an annotation with the same name, session_id, and identifier already exists, it will be updated.
                Using a non-empty identifier allows you to have multiple annotations with the same name and session_id.
                Most of the time, you can leave this as None - it will still update the record if it exists.
                It will also update the record with identifier="" if it exists.
            sync (bool): If True, the request will be fulfilled synchronously and the response will
                contain the inserted annotation ID. If False, the request will be processed
                asynchronously. Defaults to False.

        Returns:
            Optional[InsertedSessionAnnotation]: If sync is True, the inserted session annotation. If sync is False, None.

        Raises:
            ValueError: If at least one of label, score, or explanation is not provided, or if required fields are invalid.

        Example::

            from phoenix.client import Client
            client = Client()

            # Add a session annotation
            annotation = client.sessions.add_session_annotation(
                session_id="session_123",
                annotation_name="helpfulness",
                annotator_kind="HUMAN",
                label="helpful",
                score=0.9,
                explanation="This session was very helpful",
                sync=True
            )
        """  # noqa: E501

        self._guard.require(ANNOTATE_SESSIONS)
        # Create the annotation using the factory
        anno = _create_session_annotation(
            session_id=session_id,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
            label=label,
            score=score,
            explanation=explanation,
            metadata=metadata,
            identifier=identifier,
        )

        # Use the bulk method to submit a single annotation
        if res := self.log_session_annotations(session_annotations=[anno], sync=sync):
            return res[0]
        return None

    @overload
    def log_session_annotations(
        self,
        *,
        session_annotations: Iterable[SessionAnnotationData],
        sync: Literal[True],
    ) -> List[InsertedSessionAnnotation]: ...

    @overload
    def log_session_annotations(
        self,
        *,
        session_annotations: Iterable[SessionAnnotationData],
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    def log_session_annotations(
        self,
        *,
        session_annotations: Iterable[SessionAnnotationData],
        sync: bool,
    ) -> Optional[List[InsertedSessionAnnotation]]: ...

    def log_session_annotations(
        self,
        *,
        session_annotations: Iterable[SessionAnnotationData],
        sync: bool = False,
    ) -> Optional[List[InsertedSessionAnnotation]]:
        """Log multiple session annotations.

        Requires Phoenix server >= 12.0.0.

        Args:
            session_annotations (Iterable[SessionAnnotationData]): An iterable of session annotation data to log. Each annotation must include
                at least a session_id, name, and annotator_kind, and at least one of label, score, or explanation.
            sync (bool): If True, the request will be fulfilled synchronously and the response will
                contain the inserted annotation IDs. If False, the request will be processed
                asynchronously. Defaults to False.

        Returns:
            Optional[list[InsertedSessionAnnotation]]: If sync is True, a list of all inserted session
                annotations. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if the input is invalid.

        Example::

            from phoenix.client import Client
            client = Client()

            # Log multiple session annotations
            annotations = [
                {
                    "session_id": "session_123",
                    "name": "helpfulness",
                    "annotator_kind": "HUMAN",
                    "result": {"label": "helpful", "score": 0.9}
                },
                {
                    "session_id": "session_456",
                    "name": "relevance",
                    "annotator_kind": "LLM",
                    "result": {"label": "relevant", "score": 0.8}
                }
            ]
            client.sessions.log_session_annotations(session_annotations=annotations)
        """  # noqa: E501

        self._guard.require(ANNOTATE_SESSIONS)
        # Convert to list and validate input
        annotations_list = list(session_annotations)
        if not annotations_list:
            raise ValueError("session_annotations cannot be empty")

        url = "v1/session_annotations"
        params = {"sync": sync} if sync else {}
        json_ = AnnotateSessionsRequestBody(data=annotations_list)
        response = self._client.post(url=url, json=json_, params=params)
        response.raise_for_status()
        if not sync:
            return None
        return list(cast(AnnotateSessionsResponseBody, response.json())["data"])

    @overload
    def log_session_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: Literal[True],
    ) -> List[InsertedSessionAnnotation]: ...

    @overload
    def log_session_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    def log_session_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool,
    ) -> Optional[List[InsertedSessionAnnotation]]: ...

    def log_session_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool = False,
    ) -> Optional[List[InsertedSessionAnnotation]]:
        """Log multiple session annotations from a pandas DataFrame.

        Requires Phoenix server >= 12.0.0.

        This method allows you to create multiple session annotations at once by providing the data
        in a pandas DataFrame. The DataFrame can either include `name` or `annotation_name` columns
        (but not both) and `annotator_kind` column, or you can specify global values for all rows.
        The data is processed in chunks of 100 rows for efficient batch processing.

        Args:
            dataframe (pd.DataFrame): A pandas DataFrame containing the annotation data. Must include
                either a "name" or "annotation_name" column (but not both) or provide a global
                annotation_name parameter. Similarly, must include an "annotator_kind" column or
                provide a global annotator_kind. The `session_id` can be either a column in the
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
            Optional[list[InsertedSessionAnnotation]]: If sync is True, a list of all inserted session
                annotations. If sync is False, None.

        Raises:
            ImportError: If pandas is not installed.
            ValueError: If the DataFrame is missing required columns or if no valid annotation data is provided.

        Example::

            import pandas as pd
            from phoenix.client import Client
            client = Client()

            # Using name and annotator_kind from DataFrame with session_id column
            df1 = pd.DataFrame({
                "name": ["sentiment", "toxicity"],
                "session_id": ["session_123", "session_456"],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["positive", "low"],
                "score": [0.9, 0.1]
            })
            client.sessions.log_session_annotations_dataframe(dataframe=df1)

            # Using global name and annotator_kind with session_id from index
            df2 = pd.DataFrame({
                "label": ["positive", "low"]
            }, index=["session_345", "session_678"])
            client.sessions.log_session_annotations_dataframe(
                dataframe=df2,
                annotation_name="sentiment",  # applies to all rows
                annotator_kind="HUMAN"  # applies to all rows
            )
        """  # noqa: E501

        self._guard.require(ANNOTATE_SESSIONS)
        # Validate DataFrame first
        _validate_session_annotations_dataframe(dataframe=dataframe)

        # Process DataFrame chunks using iterator
        all_responses: List[InsertedSessionAnnotation] = []
        for chunk in _chunk_session_annotations_dataframe(
            dataframe=dataframe,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
        ):
            # Delegate to log_session_annotations
            response = self.log_session_annotations(session_annotations=chunk, sync=sync)
            if sync and response:
                all_responses.extend(response)

        return all_responses if sync else None


class AsyncSessions:
    def __init__(
        self,
        client: httpx.AsyncClient,
        spans: "AsyncSpans",
        *,
        _guard: AsyncServerVersionGuard | None = None,
    ) -> None:
        self._client = client
        self._guard = _guard or AsyncServerVersionGuard(client)
        self._spans = spans

    async def get(
        self,
        *,
        session_id: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.SessionData:
        """Get a session by ID or session_id string.

        Requires Phoenix server >= 13.5.0.

        Args:
            session_id: The session identifier (GlobalID or user-provided session_id).
            timeout: Optional timeout in seconds for the request.

        Returns:
            The session data.
        """

        await self._guard.require(GET_SESSION)
        url = f"v1/sessions/{encode_path_param(session_id)}"
        response = await self._client.get(url, timeout=timeout)
        response.raise_for_status()
        return cast(v1.GetSessionResponseBody, response.json())["data"]

    async def list(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
        limit: Optional[int] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> List[v1.SessionData]:
        """List sessions for a project.

        Requires Phoenix server >= 13.5.0.

        Args:
            project_id: The ID of the project.
            project_name: The name of the project.
            limit: Maximum number of sessions to return.
            timeout: Optional timeout in seconds for the request.

        Returns:
            A list of session data.
        """

        await self._guard.require(LIST_PROJECT_SESSIONS)
        if not project_id and not project_name:
            raise ValueError("Either project_id or project_name must be provided.")
        if project_id and project_name:
            raise ValueError("Only one of project_id or project_name can be provided.")
        project_identifier = project_name if project_name else project_id
        assert project_identifier
        url = f"v1/projects/{encode_path_param(project_identifier)}/sessions"
        all_sessions: List[v1.SessionData] = []
        next_cursor: Optional[str] = None
        while True:
            params: dict[str, Any] = {}
            if next_cursor:
                params["cursor"] = next_cursor
            if limit is not None:
                params["limit"] = min(limit - len(all_sessions), 100)
            response = await self._client.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            data = cast(v1.GetSessionsResponseBody, response.json())
            all_sessions.extend(data["data"])
            if limit is not None and len(all_sessions) >= limit:
                all_sessions = all_sessions[:limit]
                break
            if not (next_cursor := data.get("next_cursor")):
                break
        return all_sessions

    async def delete(
        self,
        *,
        session_id: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> None:
        """Delete a session by ID or session_id string.

        This will permanently remove the session and all associated traces, spans,
        and annotations via cascade delete.

        Requires Phoenix server >= 13.13.0.

        Args:
            session_id: The session identifier (GlobalID or user-provided session_id).
            timeout: Optional timeout in seconds for the request.
        """

        await self._guard.require(DELETE_SESSION)
        url = f"v1/sessions/{encode_path_param(session_id)}"
        response = await self._client.delete(url, timeout=timeout)
        response.raise_for_status()

    async def bulk_delete(
        self,
        *,
        session_ids: List[str],
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> None:
        """Delete multiple sessions by their identifiers.

        All identifiers must be the same type: either all GlobalIDs or all
        user-provided session_id strings. Non-existent IDs are silently skipped.
        All associated traces, spans, and annotations are cascade deleted.

        Requires Phoenix server >= 13.13.0.

        Args:
            session_ids: List of session identifiers (GlobalIDs or session_id strings).
            timeout: Optional timeout in seconds for the request.
        """

        await self._guard.require(DELETE_SESSIONS)
        if not session_ids:
            raise ValueError("session_ids must not be empty")
        json_: v1.DeleteSessionsRequestBody = {"session_identifiers": list(session_ids)}
        response = await self._client.post("v1/sessions/delete", json=json_, timeout=timeout)
        response.raise_for_status()

    async def get_sessions_dataframe(
        self,
        *,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
        limit: Optional[int] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> "pd.DataFrame":
        """Get sessions as a pandas DataFrame.

        Requires Phoenix server >= 13.5.0.

        Args:
            project_id: The ID of the project.
            project_name: The name of the project.
            limit: Maximum number of sessions to return.
            timeout: Optional timeout in seconds for the request.

        Returns:
            A DataFrame with columns: id, session_id, project_id, start_time, end_time, num_traces.
        """
        import pandas as pd

        sessions = await self.list(
            project_id=project_id, project_name=project_name, limit=limit, timeout=timeout
        )
        rows = [
            {
                "id": s["id"],
                "session_id": s["session_id"],
                "project_id": s["project_id"],
                "start_time": s["start_time"],
                "end_time": s["end_time"],
                "num_traces": len(s["traces"]),
            }
            for s in sessions
        ]
        return pd.DataFrame(rows)

    async def get_session_turns(
        self,
        *,
        session_id: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> List[SessionTurn]:
        """**Experimental** - Retrieve the ordered conversation turns for a session.

        Requires Phoenix server >= 13.5.0.

        Async version of :meth:`Sessions.get_session_turns`.  Fetches every
        trace in the session, locates each trace's root span, and extracts the
        ``input.value`` / ``output.value`` attributes to build a chronological
        list of turns.

        Args:
            session_id: The session to look up.  Accepts either a Phoenix
                GlobalID (e.g. ``"U2Vzc2lvbjox"``) or the user-provided
                ``session_id`` string that was set at trace time.
            timeout: Per-request timeout in seconds.  Applied independently to
                the session fetch and to each batch of span fetches.
                Defaults to ``DEFAULT_TIMEOUT_IN_SECONDS``.

        Returns:
            A list of :class:`SessionTurn` dicts sorted by ``start_time``
            (ascending).  Each entry contains ``trace_id``, ``start_time``,
            ``end_time``, and optionally ``input``, ``output``, and
            ``root_span``.

        Example::

            async_client = AsyncClient()
            turns = await async_client.sessions.get_session_turns(
                session_id="my-session",
            )
            for turn in turns:
                print(turn.get("input", {}).get("value", "<no input>"))
        """
        session_data = await self.get(session_id=session_id, timeout=timeout)
        traces = session_data["traces"]
        if not traces:
            return []

        project_id = session_data["project_id"]
        all_trace_ids = [t["trace_id"] for t in traces]

        # Build trace_id -> trace info lookup
        trace_info: dict[str, v1.SessionTraceData] = {t["trace_id"]: t for t in traces}

        # Fetch root spans in batches
        root_spans_by_trace: dict[str, v1.Span] = {}
        for i in range(0, len(all_trace_ids), _MAX_TRACE_IDS_PER_BATCH):
            batch = all_trace_ids[i : i + _MAX_TRACE_IDS_PER_BATCH]
            spans = await self._spans.get_spans(
                project_identifier=project_id,
                trace_ids=batch,
                parent_id="null",
                limit=len(batch),
                timeout=timeout,
            )
            for span in spans:
                tid = span["context"]["trace_id"]
                if tid not in root_spans_by_trace:
                    root_spans_by_trace[tid] = span

        return _build_session_turns(
            all_trace_ids=all_trace_ids,
            trace_info=trace_info,
            root_spans_by_trace=root_spans_by_trace,
        )

    @overload
    async def add_session_annotation(
        self,
        *,
        session_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: Literal[True],
    ) -> InsertedSessionAnnotation: ...

    @overload
    async def add_session_annotation(
        self,
        *,
        session_id: str,
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
    async def add_session_annotation(
        self,
        *,
        session_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: bool,
    ) -> Optional[InsertedSessionAnnotation]: ...

    async def add_session_annotation(
        self,
        *,
        session_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: bool = False,
    ) -> Optional[InsertedSessionAnnotation]:
        """Add a single session annotation.

        Requires Phoenix server >= 12.0.0.

        Args:
            session_id (str): The ID of the session to annotate.
            annotation_name (str): The name of the annotation.
            annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator used for the annotation. Must be one of "LLM", "CODE", or "HUMAN".
                Defaults to "HUMAN".
            label (Optional[str]): The label assigned by the annotation.
            score (Optional[float]): The score assigned by the annotation.
            explanation (Optional[str]): Explanation of the annotation result.
            metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.
            identifier (Optional[str]): An optional identifier for the annotation. Each annotation is uniquely identified by the combination
                of name, session_id, and identifier (where a null identifier is equivalent to an empty string).
                If an annotation with the same name, session_id, and identifier already exists, it will be updated.
                Using a non-empty identifier allows you to have multiple annotations with the same name and session_id.
                Most of the time, you can leave this as None - it will still update the record if it exists.
                It will also update the record with identifier="" if it exists.
            sync (bool): If True, the request will be fulfilled synchronously and the response will
                contain the inserted annotation ID. If False, the request will be processed
                asynchronously. Defaults to False.

        Returns:
            Optional[InsertedSessionAnnotation]: If sync is True, the inserted session annotation. If sync is False, None.

        Raises:
            ValueError: If at least one of label, score, or explanation is not provided, or if required fields are invalid.

        Example::

            from phoenix.client import Client
            async_client = Client(async_client=True)

            # Add a session annotation
            annotation = await async_client.sessions.add_session_annotation(
                session_id="session_123",
                annotation_name="helpfulness",
                annotator_kind="HUMAN",
                label="helpful",
                score=0.9,
                explanation="This session was very helpful",
                sync=True
            )
        """  # noqa: E501

        await self._guard.require(ANNOTATE_SESSIONS)
        # Create the annotation using the factory
        anno = _create_session_annotation(
            session_id=session_id,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
            label=label,
            score=score,
            explanation=explanation,
            metadata=metadata,
            identifier=identifier,
        )

        # Use the bulk method to submit a single annotation
        if res := await self.log_session_annotations(session_annotations=[anno], sync=sync):
            return res[0]
        return None

    @overload
    async def log_session_annotations(
        self,
        *,
        session_annotations: Iterable[SessionAnnotationData],
        sync: Literal[True],
    ) -> List[InsertedSessionAnnotation]: ...

    @overload
    async def log_session_annotations(
        self,
        *,
        session_annotations: Iterable[SessionAnnotationData],
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    async def log_session_annotations(
        self,
        *,
        session_annotations: Iterable[SessionAnnotationData],
        sync: bool,
    ) -> Optional[List[InsertedSessionAnnotation]]: ...

    async def log_session_annotations(
        self,
        *,
        session_annotations: Iterable[SessionAnnotationData],
        sync: bool = False,
    ) -> Optional[List[InsertedSessionAnnotation]]:
        """Log multiple session annotations asynchronously.

        Requires Phoenix server >= 12.0.0.

        Args:
            session_annotations (Iterable[SessionAnnotationData]): An iterable of session annotation data to log. Each annotation must include
                at least a session_id, name, and annotator_kind, and at least one of label, score, or explanation.
            sync (bool): If True, the request will be fulfilled synchronously and the response will
                contain the inserted annotation IDs. If False, the request will be processed
                asynchronously. Defaults to False.

        Returns:
            Optional[list[InsertedSessionAnnotation]]: If sync is True, a list of all inserted session
                annotations. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if the input is invalid.

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # Log multiple session annotations
            annotations = [
                {
                    "session_id": "session_123",
                    "name": "helpfulness",
                    "annotator_kind": "HUMAN",
                    "result": {"label": "helpful", "score": 0.9}
                },
                {
                    "session_id": "session_456",
                    "name": "relevance",
                    "annotator_kind": "LLM",
                    "result": {"label": "relevant", "score": 0.8}
                }
            ]
            await async_client.sessions.log_session_annotations(session_annotations=annotations)
        """  # noqa: E501

        await self._guard.require(ANNOTATE_SESSIONS)
        # Convert to list and validate input
        annotations_list = list(session_annotations)
        if not annotations_list:
            raise ValueError("session_annotations cannot be empty")

        url = "v1/session_annotations"
        params = {"sync": sync} if sync else {}
        json_ = AnnotateSessionsRequestBody(data=annotations_list)
        response = await self._client.post(url=url, json=json_, params=params)
        response.raise_for_status()
        if not sync:
            return None
        return list(cast(AnnotateSessionsResponseBody, response.json())["data"])

    @overload
    async def log_session_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: Literal[True],
    ) -> List[InsertedSessionAnnotation]: ...

    @overload
    async def log_session_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    async def log_session_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool,
    ) -> Optional[List[InsertedSessionAnnotation]]: ...

    async def log_session_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool = False,
    ) -> Optional[List[InsertedSessionAnnotation]]:
        """Log multiple session annotations from a pandas DataFrame asynchronously.

        Requires Phoenix server >= 12.0.0.

        This method allows you to create multiple session annotations at once by providing the data
        in a pandas DataFrame. The DataFrame can either include `name` or `annotation_name` columns
        (but not both) and `annotator_kind` column, or you can specify global values for all rows.
        The data is processed in chunks of 100 rows for efficient batch processing.

        Args:
            dataframe (pd.DataFrame): A pandas DataFrame containing the annotation data. Must include
                either a "name" or "annotation_name" column (but not both) or provide a global
                annotation_name parameter. Similarly, must include an "annotator_kind" column or
                provide a global annotator_kind. The `session_id` can be either a column in the
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
            Optional[list[InsertedSessionAnnotation]]: If sync is True, a list of all inserted session
                annotations. If sync is False, None.

        Raises:
            ImportError: If pandas is not installed.
            ValueError: If the DataFrame is missing required columns or if no valid annotation data is provided.

        Example::

            import pandas as pd
            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # Using name and annotator_kind from DataFrame with session_id column
            df1 = pd.DataFrame({
                "name": ["sentiment", "toxicity"],
                "session_id": ["session_123", "session_456"],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["positive", "low"],
                "score": [0.9, 0.1]
            })
            await async_client.sessions.log_session_annotations_dataframe(dataframe=df1)

            # Using global name and annotator_kind with session_id from index
            df2 = pd.DataFrame({
                "label": ["positive", "low"]
            }, index=["session_345", "session_678"])
            await async_client.sessions.log_session_annotations_dataframe(
                dataframe=df2,
                annotation_name="sentiment",  # applies to all rows
                annotator_kind="HUMAN"  # applies to all rows
            )
        """  # noqa: E501

        await self._guard.require(ANNOTATE_SESSIONS)
        # Validate DataFrame first
        _validate_session_annotations_dataframe(dataframe=dataframe)

        # Process DataFrame chunks using iterator
        all_responses: List[InsertedSessionAnnotation] = []
        for chunk in _chunk_session_annotations_dataframe(
            dataframe=dataframe,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
        ):
            # Delegate to log_session_annotations
            response = await self.log_session_annotations(session_annotations=chunk, sync=sync)
            if sync and response:
                all_responses.extend(response)

        return all_responses if sync else None


def _extract_io(
    *,
    attrs: Mapping[str, Any],
    value_key: str,
    mime_type_key: str,
) -> Optional[SessionTurnIO]:
    """Extract a :class:`SessionTurnIO` from a span's attribute dict.

    Looks up ``value_key`` in *attrs*.  If present, wraps it in a
    ``SessionTurnIO`` and optionally attaches the MIME type found at
    ``mime_type_key``.

    Args:
        attrs: The ``attributes`` dict from a span (string keys, arbitrary
            values).
        value_key: Attribute key for the payload value
            (e.g. ``SpanAttributes.INPUT_VALUE``).
        mime_type_key: Attribute key for the MIME type
            (e.g. ``SpanAttributes.INPUT_MIME_TYPE``).

    Returns:
        A ``SessionTurnIO`` dict if the value attribute is present, otherwise
        ``None``.
    """
    value = attrs.get(value_key)
    if value is None:
        return None
    io = SessionTurnIO(value=str(value))
    mime_type = attrs.get(mime_type_key)
    if mime_type is not None:
        io["mime_type"] = str(mime_type)
    return io


def _build_session_turns(
    *,
    all_trace_ids: List[str],
    trace_info: dict[str, v1.SessionTraceData],
    root_spans_by_trace: dict[str, v1.Span],
) -> List[SessionTurn]:
    """Assemble :class:`SessionTurn` dicts from raw trace and span data.

    Iterates over *all_trace_ids*, pairs each with its root span (if found),
    extracts input/output IO, and returns the turns sorted by ``start_time``.

    Args:
        all_trace_ids: Ordered list of trace IDs belonging to the session.
        trace_info: Mapping from trace ID to the session's trace metadata
            (contains ``start_time``, ``end_time``, etc.).
        root_spans_by_trace: Mapping from trace ID to its root span.  Traces
            without a root span will still produce a turn, but ``input``,
            ``output``, and ``root_span`` will be absent.

    Returns:
        A list of ``SessionTurn`` dicts sorted by ``start_time`` ascending.
    """
    turns: List[SessionTurn] = []
    for trace_id in all_trace_ids:
        info = trace_info[trace_id]
        turn = SessionTurn(
            trace_id=trace_id,
            start_time=info["start_time"],
            end_time=info["end_time"],
        )
        root_span = root_spans_by_trace.get(trace_id)
        if root_span:
            turn["root_span"] = root_span
            attrs = root_span.get("attributes", {})
            input_io = _extract_io(
                attrs=attrs,
                value_key=SpanAttributes.INPUT_VALUE,
                mime_type_key=SpanAttributes.INPUT_MIME_TYPE,
            )
            if input_io is not None:
                turn["input"] = input_io
            output_io = _extract_io(
                attrs=attrs,
                value_key=SpanAttributes.OUTPUT_VALUE,
                mime_type_key=SpanAttributes.OUTPUT_MIME_TYPE,
            )
            if output_io is not None:
                turn["output"] = output_io
        turns.append(turn)
    turns.sort(key=lambda t: t["start_time"])
    return turns
