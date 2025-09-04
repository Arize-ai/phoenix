from typing import TYPE_CHECKING, Any, Iterable, Literal, Optional, cast, overload

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.utils.annotation_helpers import (
    _chunk_session_annotations_dataframe,  # pyright: ignore[reportPrivateUsage]
    _create_session_annotation,  # pyright: ignore[reportPrivateUsage]
    _validate_session_annotations_dataframe,  # pyright: ignore[reportPrivateUsage]
)

if TYPE_CHECKING:
    import pandas as pd

# Re-export generated types
InsertedSessionAnnotation = v1.InsertedSessionAnnotation
SessionAnnotationData = v1.SessionAnnotationData
AnnotateSessionsRequestBody = v1.AnnotateSessionsRequestBody
AnnotateSessionsResponseBody = v1.AnnotateSessionsResponseBody


class Sessions:
    def __init__(self, client: httpx.Client) -> None:
        self._client = client

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
    ) -> list[InsertedSessionAnnotation]: ...

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
    ) -> Optional[list[InsertedSessionAnnotation]]: ...

    def log_session_annotations(
        self,
        *,
        session_annotations: Iterable[SessionAnnotationData],
        sync: bool = False,
    ) -> Optional[list[InsertedSessionAnnotation]]:
        """Log multiple session annotations.

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
    ) -> list[InsertedSessionAnnotation]: ...

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
    ) -> Optional[list[InsertedSessionAnnotation]]: ...

    def log_session_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool = False,
    ) -> Optional[list[InsertedSessionAnnotation]]:
        """Log multiple session annotations from a pandas DataFrame.

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
        # Validate DataFrame first
        _validate_session_annotations_dataframe(dataframe=dataframe)

        # Process DataFrame chunks using iterator
        all_responses: list[InsertedSessionAnnotation] = []
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
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

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
    ) -> list[InsertedSessionAnnotation]: ...

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
    ) -> Optional[list[InsertedSessionAnnotation]]: ...

    async def log_session_annotations(
        self,
        *,
        session_annotations: Iterable[SessionAnnotationData],
        sync: bool = False,
    ) -> Optional[list[InsertedSessionAnnotation]]:
        """Log multiple session annotations asynchronously.

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
    ) -> list[InsertedSessionAnnotation]: ...

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
    ) -> Optional[list[InsertedSessionAnnotation]]: ...

    async def log_session_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool = False,
    ) -> Optional[list[InsertedSessionAnnotation]]:
        """Log multiple session annotations from a pandas DataFrame asynchronously.

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
        # Validate DataFrame first
        _validate_session_annotations_dataframe(dataframe=dataframe)

        # Process DataFrame chunks using iterator
        all_responses: list[InsertedSessionAnnotation] = []
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
