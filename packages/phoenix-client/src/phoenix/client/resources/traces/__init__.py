from typing import (
    TYPE_CHECKING,
    Any,
    Iterable,
    Literal,
    Optional,
    cast,
    overload,
)

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.utils.annotation_helpers import (
    _chunk_trace_annotations_dataframe,  # pyright: ignore[reportPrivateUsage]
    _create_trace_annotation,  # pyright: ignore[reportPrivateUsage]
    _validate_trace_annotations_dataframe,  # pyright: ignore[reportPrivateUsage]
)

if TYPE_CHECKING:
    import pandas as pd

# Re-export generated types
InsertedTraceAnnotation = v1.InsertedTraceAnnotation
TraceAnnotationData = v1.TraceAnnotationData
AnnotateTracesRequestBody = v1.AnnotateTracesRequestBody
AnnotateTracesResponseBody = v1.AnnotateTracesResponseBody


class Traces:
    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    @overload
    def add_trace_annotation(
        self,
        *,
        trace_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: Literal[True],
    ) -> InsertedTraceAnnotation: ...

    @overload
    def add_trace_annotation(
        self,
        *,
        trace_id: str,
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
    def add_trace_annotation(
        self,
        *,
        trace_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: bool,
    ) -> Optional[InsertedTraceAnnotation]: ...

    def add_trace_annotation(
        self,
        *,
        trace_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: bool = False,
    ) -> Optional[InsertedTraceAnnotation]:
        """Add a single trace annotation.

        Args:
            trace_id (str): The ID of the trace to annotate.
            annotation_name (str): The name of the annotation.
            annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator used for
                the annotation. Must be one of "LLM", "CODE", or "HUMAN". Defaults to "HUMAN".
            label (Optional[str]): The label assigned by the annotation.
            score (Optional[float]): The score assigned by the annotation.
            explanation (Optional[str]): Explanation of the annotation result.
            metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.
            identifier (Optional[str]): An optional identifier for the annotation. Each
                annotation is uniquely identified by the combination of name, trace_id, and
                identifier (where a null identifier is equivalent to an empty string).
                If an annotation with the same name, trace_id, and identifier already exists,
                it will be updated. Using a non-empty identifier allows you to have multiple
                annotations with the same name and trace_id. Most of the time, you can leave
                this as None - it will also update the record with identifier="" if it exists.
            sync (bool): If True, the request will be fulfilled synchronously and the response
                will contain the inserted annotation ID. If False, the request will be
                processed asynchronously. Defaults to False.

        Returns:
            Optional[InsertedTraceAnnotation]: If sync is True, the inserted trace annotation
                containing an ID. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if at least one of label, score, or
                explanation is not provided.

        Example::

            from phoenix.client import Client
            client = Client()

            # Add a single annotation with sync response
            annotation = client.traces.add_trace_annotation(
                trace_id="abc123",
                annotation_name="correctness",
                label="correct",
                score=0.9,
                explanation="The trace produces the correct answer.",
                sync=True,
            )
        """  # noqa: E501
        anno = _create_trace_annotation(
            trace_id=trace_id,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
            label=label,
            score=score,
            explanation=explanation,
            metadata=metadata,
            identifier=identifier,
        )
        if res := self.log_trace_annotations(trace_annotations=[anno], sync=sync):
            return res[0]
        return None

    @overload
    def log_trace_annotations(
        self,
        *,
        trace_annotations: Iterable[TraceAnnotationData],
        sync: Literal[True],
    ) -> list[InsertedTraceAnnotation]: ...

    @overload
    def log_trace_annotations(
        self,
        *,
        trace_annotations: Iterable[TraceAnnotationData],
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    def log_trace_annotations(
        self,
        *,
        trace_annotations: Iterable[TraceAnnotationData],
        sync: bool,
    ) -> Optional[list[InsertedTraceAnnotation]]: ...

    def log_trace_annotations(
        self,
        *,
        trace_annotations: Iterable[TraceAnnotationData],
        sync: bool = False,
    ) -> Optional[list[InsertedTraceAnnotation]]:
        """Log multiple trace annotations.

        Args:
            trace_annotations (Iterable[TraceAnnotationData]): An iterable of trace annotation data to log. Each annotation must include
                at least a trace_id, name, and annotator_kind, and at least one of label, score, or explanation.
            sync (bool): If True, the request will be fulfilled synchronously and the response will contain
                the inserted annotation IDs. If False, the request will be processed asynchronously.
                Defaults to False.

        Returns:
            Optional[list[InsertedTraceAnnotation]]: If sync is True, a list of inserted trace annotations, each containing an ID. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if the input is invalid.
        """  # noqa: E501
        # Convert to list and validate input
        annotations_list = list(trace_annotations)
        if not annotations_list:
            raise ValueError("trace_annotations cannot be empty")

        url = "v1/trace_annotations"
        params = {"sync": sync} if sync else {}
        json_ = AnnotateTracesRequestBody(data=annotations_list)
        response = self._client.post(url=url, json=json_, params=params)
        response.raise_for_status()
        if not sync:
            return None
        return list(cast(AnnotateTracesResponseBody, response.json())["data"])

    @overload
    def log_trace_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: Literal[True],
    ) -> list[InsertedTraceAnnotation]: ...

    @overload
    def log_trace_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    def log_trace_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool,
    ) -> Optional[list[InsertedTraceAnnotation]]: ...

    def log_trace_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool = False,
    ) -> Optional[list[InsertedTraceAnnotation]]:
        """Log multiple trace annotations from a pandas DataFrame.

        This method allows you to create multiple trace annotations at once by providing the data
        in a pandas DataFrame. The DataFrame can either include `name` or `annotation_name` columns
        (but not both) and `annotator_kind` column, or you can specify global values for all rows.
        The data is processed in chunks of 100 rows for efficient batch processing.

        Args:
            dataframe (pd.DataFrame): A pandas DataFrame containing the annotation data. Must include
                either a "name" or "annotation_name" column (but not both) or provide a global
                annotation_name parameter. Similarly, must include an "annotator_kind" column or
                provide a global annotator_kind. The `trace_id` can be either a column in the
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
            Optional[list[InsertedTraceAnnotation]]: If sync is True, a list of all inserted trace
                annotations. If sync is False, None.

        Raises:
            ImportError: If pandas is not installed.
            ValueError: If the DataFrame is missing required columns or if no valid annotation data is provided.

        Example::

            import pandas as pd
            from phoenix.client import Client
            client = Client()

            # Using name and annotator_kind from DataFrame with trace_id column
            df1 = pd.DataFrame({
                "name": ["sentiment", "toxicity"],
                "trace_id": ["trace_123", "trace_456"],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["positive", "low"],
                "score": [0.9, 0.1]
            })
            client.traces.log_trace_annotations_dataframe(dataframe=df1)

            # Using global name and annotator_kind with trace_id from index
            df2 = pd.DataFrame({
                "label": ["positive", "low"]
            }, index=["trace_345", "trace_678"])
            client.traces.log_trace_annotations_dataframe(
                dataframe=df2,
                annotation_name="sentiment",  # applies to all rows
                annotator_kind="HUMAN"  # applies to all rows
            )
        """  # noqa: E501
        # Validate DataFrame first
        _validate_trace_annotations_dataframe(dataframe=dataframe)

        # Process DataFrame chunks using iterator
        all_responses: list[InsertedTraceAnnotation] = []
        for chunk in _chunk_trace_annotations_dataframe(
            dataframe=dataframe,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
        ):
            # Delegate to log_trace_annotations
            response = self.log_trace_annotations(trace_annotations=chunk, sync=sync)
            if sync and response:
                all_responses.extend(response)

        return all_responses if sync else None


class AsyncTraces:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    @overload
    async def add_trace_annotation(
        self,
        *,
        trace_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: Literal[True],
    ) -> InsertedTraceAnnotation: ...

    @overload
    async def add_trace_annotation(
        self,
        *,
        trace_id: str,
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
    async def add_trace_annotation(
        self,
        *,
        trace_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: bool,
    ) -> Optional[InsertedTraceAnnotation]: ...

    async def add_trace_annotation(
        self,
        *,
        trace_id: str,
        annotation_name: str,
        annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
        label: Optional[str] = None,
        score: Optional[float] = None,
        explanation: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        identifier: Optional[str] = None,
        sync: bool = False,
    ) -> Optional[InsertedTraceAnnotation]:
        """Add a single trace annotation asynchronously.

        Args:
            trace_id (str): The ID of the trace to annotate.
            annotation_name (str): The name of the annotation.
            annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator used for
                the annotation. Must be one of "LLM", "CODE", or "HUMAN". Defaults to "HUMAN".
            label (Optional[str]): The label assigned by the annotation.
            score (Optional[float]): The score assigned by the annotation.
            explanation (Optional[str]): Explanation of the annotation result.
            metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.
            identifier (Optional[str]): An optional identifier for the annotation. Each
                annotation is uniquely identified by the combination of name, trace_id, and
                identifier (where a null identifier is equivalent to an empty string).
                If an annotation with the same name, trace_id, and identifier already exists,
                it will be updated. Using a non-empty identifier allows you to have multiple
                annotations with the same name and trace_id. Most of the time, you can leave
                this as None - it will also update the record with identifier="" if it exists.
            sync (bool): If True, the request will be fulfilled synchronously and the response
                will contain the inserted annotation ID. If False, the request will be
                processed asynchronously. Defaults to False.

        Returns:
            Optional[InsertedTraceAnnotation]: If sync is True, the inserted trace annotation
                containing an ID. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if at least one of label, score, or
                explanation is not provided.

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # Add a single annotation with sync response
            annotation = await async_client.traces.add_trace_annotation(
                trace_id="abc123",
                annotation_name="correctness",
                label="correct",
                score=0.9,
                explanation="The trace produces the correct answer.",
                sync=True,
            )
        """  # noqa: E501
        anno = _create_trace_annotation(
            trace_id=trace_id,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
            label=label,
            score=score,
            explanation=explanation,
            metadata=metadata,
            identifier=identifier,
        )
        if res := await self.log_trace_annotations(trace_annotations=[anno], sync=sync):
            return res[0]
        return None

    @overload
    async def log_trace_annotations(
        self,
        *,
        trace_annotations: Iterable[TraceAnnotationData],
        sync: Literal[True],
    ) -> list[InsertedTraceAnnotation]: ...

    @overload
    async def log_trace_annotations(
        self,
        *,
        trace_annotations: Iterable[TraceAnnotationData],
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    async def log_trace_annotations(
        self,
        *,
        trace_annotations: Iterable[TraceAnnotationData],
        sync: bool,
    ) -> Optional[list[InsertedTraceAnnotation]]: ...

    async def log_trace_annotations(
        self,
        *,
        trace_annotations: Iterable[TraceAnnotationData],
        sync: bool = False,
    ) -> Optional[list[InsertedTraceAnnotation]]:
        """Log multiple trace annotations asynchronously.

        Args:
            trace_annotations (Iterable[TraceAnnotationData]): An iterable of trace annotation data to log. Each annotation must include
                at least a trace_id, name, and annotator_kind, and at least one of label, score, or explanation.
            sync (bool): If True, the request will be fulfilled synchronously and the response will contain
                the inserted annotation IDs. If False, the request will be processed asynchronously.
                Defaults to False.

        Returns:
            Optional[list[InsertedTraceAnnotation]]: If sync is True, a list of inserted trace annotations, each containing an ID. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if the input is invalid.
        """  # noqa: E501
        # Convert to list and validate input
        annotations_list = list(trace_annotations)
        if not annotations_list:
            raise ValueError("trace_annotations cannot be empty")

        url = "v1/trace_annotations"
        params = {"sync": sync} if sync else {}
        json_ = AnnotateTracesRequestBody(data=annotations_list)
        response = await self._client.post(url=url, json=json_, params=params)
        response.raise_for_status()
        if not sync:
            return None
        return list(cast(AnnotateTracesResponseBody, response.json())["data"])

    @overload
    async def log_trace_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: Literal[True],
    ) -> list[InsertedTraceAnnotation]: ...

    @overload
    async def log_trace_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: Literal[False] = False,
    ) -> None: ...

    @overload
    async def log_trace_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool,
    ) -> Optional[list[InsertedTraceAnnotation]]: ...

    async def log_trace_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool = False,
    ) -> Optional[list[InsertedTraceAnnotation]]:
        """Log multiple trace annotations from a pandas DataFrame asynchronously.

        This method allows you to create multiple trace annotations at once by providing the data
        in a pandas DataFrame. The DataFrame can either include `name` or `annotation_name` columns
        (but not both) and `annotator_kind` column, or you can specify global values for all rows.
        The data is processed in chunks of 100 rows for efficient batch processing.

        Args:
            dataframe (pd.DataFrame): A pandas DataFrame containing the annotation data. Must include
                either a "name" or "annotation_name" column (but not both) or provide a global
                annotation_name parameter. Similarly, must include an "annotator_kind" column or
                provide a global annotator_kind. The `trace_id` can be either a column in the
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
            Optional[list[InsertedTraceAnnotation]]: If sync is True, a list of all inserted trace
                annotations. If sync is False, None.

        Raises:
            ImportError: If pandas is not installed.
            ValueError: If the DataFrame is missing required columns or if no valid annotation data is provided.

        Example::

            import pandas as pd
            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            # Using name and annotator_kind from DataFrame with trace_id column
            df1 = pd.DataFrame({
                "name": ["sentiment", "toxicity"],
                "trace_id": ["trace_123", "trace_456"],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["positive", "low"],
                "score": [0.9, 0.1]
            })
            await async_client.traces.log_trace_annotations_dataframe(dataframe=df1)

            # Using global name and annotator_kind with trace_id from index
            df2 = pd.DataFrame({
                "label": ["positive", "low"]
            }, index=["trace_345", "trace_678"])
            await async_client.traces.log_trace_annotations_dataframe(
                dataframe=df2,
                annotation_name="sentiment",  # applies to all rows
                annotator_kind="HUMAN"  # applies to all rows
            )
        """  # noqa: E501
        # Validate DataFrame first
        _validate_trace_annotations_dataframe(dataframe=dataframe)

        # Process DataFrame chunks using iterator
        all_responses: list[InsertedTraceAnnotation] = []
        for chunk in _chunk_trace_annotations_dataframe(
            dataframe=dataframe,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
        ):
            # Delegate to log_trace_annotations
            response = await self.log_trace_annotations(trace_annotations=chunk, sync=sync)
            if sync and response:
                all_responses.extend(response)

        return all_responses if sync else None
