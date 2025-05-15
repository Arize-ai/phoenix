from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Iterable, Iterator, Literal, Optional, cast, get_args

import httpx
from typing_extensions import TypeAlias

from phoenix.client.__generated__ import v1

if TYPE_CHECKING:
    import pandas as pd

logger = logging.getLogger(__name__)

_AnnotatorKind: TypeAlias = Literal["LLM", "CODE", "HUMAN"]
_VALID_ANNOTATOR_KINDS: frozenset[_AnnotatorKind] = frozenset(get_args(_AnnotatorKind))
_DATAFRAME_CHUNK_SIZE = 100


class Annotations:
    """Client for interacting with the Annotations API endpoints.

    This class provides synchronous methods for creating and managing span annotations.

    Example:
        ```python
        from phoenix.client import Client

        client = Client()
        annotation = client.annotations.add_span_annotation(
            annotation_name="sentiment",
            span_id="abc123",
            label="positive",
            score=0.9,
        )
        ```
    """  # noqa: E501

    def __init__(self, client: httpx.Client) -> None:
        """Initialize the Annotations client.

        Args:
            client: The httpx client to use for making requests.
        """
        self._client = client

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
    ) -> Optional[v1.InsertedSpanAnnotation]:
        """Add a single span annotation.

        Args:
            annotation_name: The name of the annotation.
            span_id: The ID of the span to annotate.
            annotator_kind: The kind of annotator used for the annotation. Must be one of "LLM", "CODE", or "HUMAN".
            label: The label assigned by the annotation.
            score: The score assigned by the annotation.
            explanation: Explanation of the annotation result.
            metadata: Additional metadata for the annotation.
            identifier: An optional identifier for the annotation. Each annotation is uniquely identified by the combination
                of name, span_id, and identifier (where a null identifier is equivalent to an empty string).
                If an annotation with the same name, span_id, and identifier already exists, it will be updated.
                Using a non-empty identifier allows you to have multiple annotations with the same name and span_id.
                Most of the time, you can leave this as None - it will also update the record with identifier="" if it exists.
            sync: If True, the request will be fulfilled synchronously and the response will contain
                the inserted annotation ID. If False, the request will be processed asynchronously.

        Returns:
            If sync is True, the inserted span annotation containing an ID. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if at least one of label, score, or explanation
                is not provided.

        Example:
            ```python
            from phoenix.client import Client

            client = Client()
            client.annotations.add_span_annotation(
                annotation_name="sentiment",
                span_id="abc123",
                label="positive",
                score=0.9,
                explanation="The text expresses a positive sentiment.",
                sync=True,
            )
            ```
        """  # noqa: E501
        anno = _get_span_annotation(
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

    def log_span_annotations_dataframe(
        self,
        *,
        dataframe: pd.DataFrame,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        annotation_name: Optional[str] = None,
        sync: bool = False,
    ) -> Optional[list[v1.InsertedSpanAnnotation]]:
        """Log multiple span annotations from a pandas DataFrame.

        This method allows you to create multiple span annotations at once by providing the data in a pandas DataFrame.
        The DataFrame can either include `name` or `annotation_name` columns (but not both) and `annotator_kind` column,
        or you can specify global values for all rows. The data is processed in chunks of 100 rows for efficient batch processing.

        Args:
            dataframe: A pandas DataFrame containing the annotation data. Must include either a "name" or "annotation_name" column
                (but not both) or provide a global annotation_name parameter. Similarly, must include an "annotator_kind" column
                or provide a global annotator_kind. The `span_id` can be either a column in the DataFrame or will be taken from
                the DataFrame index. Optional columns include: "label", "score", "explanation", "metadata", and "identifier".
            annotator_kind: Optional. The kind of annotator used for all annotations. If provided, this value will be used
                for all rows and the DataFrame does not need to include an "annotator_kind" column.
                Must be one of "LLM", "CODE", or "HUMAN".
            annotation_name: Optional. The name to use for all annotations. If provided, this value will be used
                for all rows and the DataFrame does not need to include a "name" or "annotation_name" column.
            sync: If True, the request will be fulfilled synchronously and the response will contain
                the inserted annotation IDs. If False, the request will be processed asynchronously.

        Returns:
            If sync is True, a list of all inserted span annotations. If sync is False, None.

        Raises:
            ImportError: If pandas is not installed.
            ValueError: If the DataFrame is missing required columns, if both "name" and "annotation_name" columns are present,
                or if no valid annotation data is provided.

        Example:
            ```python
            import pandas as pd

            # Using name and annotator_kind from DataFrame
            df1 = pd.DataFrame({
                "name": ["sentiment", "toxicity"],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["positive", "low"],
                "score": [0.9, 0.1]
            })
            client.annotations.log_span_annotations_dataframe(dataframe=df1)

            # Using annotation_name and annotator_kind from DataFrame
            df2 = pd.DataFrame({
                "annotation_name": ["sentiment", "toxicity"],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["positive", "low"],
                "score": [0.9, 0.1]
            })
            client.annotations.log_span_annotations_dataframe(dataframe=df2)

            # Using global name and annotator_kind
            df3 = pd.DataFrame({
                "label": ["positive", "low"]
            }, index=["span1", "span2"])
            client.annotations.log_span_annotations_dataframe(
                dataframe=df3,
                annotation_name="sentiment",  # applies to all rows
                annotator_kind="HUMAN"  # applies to all rows
            )
            ```
        """  # noqa: E501
        # Process DataFrame chunks using iterator
        all_responses: list[v1.InsertedSpanAnnotation] = []
        for chunk in _chunk_dataframe(
            dataframe=dataframe,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
            chunk_size=_DATAFRAME_CHUNK_SIZE,
        ):
            # Delegate to log_span_annotations
            response = self.log_span_annotations(span_annotations=chunk, sync=sync)
            if sync and response:
                all_responses.extend(response)

        return all_responses if sync else None

    def log_span_annotations(
        self,
        *,
        span_annotations: Iterable[v1.SpanAnnotationData],
        sync: bool = False,
    ) -> Optional[list[v1.InsertedSpanAnnotation]]:
        """Log multiple span annotations.

        Args:
            span_annotations: An iterable of span annotation data to log. Each annotation must include
                at least a span_id, name, and annotator_kind, and at least one of label, score, or explanation.
            sync: If True, the request will be fulfilled synchronously and the response will contain
                the inserted annotation IDs. If False, the request will be processed asynchronously.

        Returns:
            If sync is True, a list of inserted span annotations, each containing an ID. If sync is False, None.

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
        json_ = v1.AnnotateSpansRequestBody(data=annotations_list)
        response = self._client.post(url=url, json=json_, params=params)
        response.raise_for_status()
        if not sync:
            return None
        return list(cast(v1.AnnotateSpansResponseBody, response.json())["data"])


class AsyncAnnotations:
    """Asynchronous client for interacting with the Annotations API endpoints.

    This class provides asynchronous methods for creating and managing span annotations.

    Example:
        ```python
        from phoenix.client import AsyncClient

        async_client = AsyncClient()
        annotation = await async_client.annotations.add_span_annotation(
            annotation_name="sentiment",
            span_id="abc123",
            label="positive",
            score=0.9,
        )
        ```
    """  # noqa: E501

    def __init__(self, client: httpx.AsyncClient) -> None:
        """Initialize the AsyncAnnotations client.

        Args:
            client: The httpx async client to use for making requests.
        """
        self._client = client

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
    ) -> Optional[v1.InsertedSpanAnnotation]:
        """Add a single span annotation asynchronously.

        Args:
            annotation_name: The name of the annotation.
            span_id: The ID of the span to annotate.
            annotator_kind: The kind of annotator used for the annotation. Must be one of "LLM", "CODE", or "HUMAN".
            label: The label assigned by the annotation.
            score: The score assigned by the annotation.
            explanation: Explanation of the annotation result.
            metadata: Additional metadata for the annotation.
            identifier: An optional identifier for the annotation. Each annotation is uniquely identified by the combination
                of name, span_id, and identifier (where a null identifier is equivalent to an empty string).
                If an annotation with the same name, span_id, and identifier already exists, it will be updated.
                Using a non-empty identifier allows you to have multiple annotations with the same name and span_id.
                Most of the time, you can leave this as None - it will also update the record with identifier="" if it exists.
            sync: If True, the request will be fulfilled synchronously and the response will contain
                the inserted annotation ID. If False, the request will be processed asynchronously.

        Returns:
            If sync is True, the inserted span annotation containing an ID. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid or if at least one of label, score, or explanation
                is not provided.

        Example:
            ```python
            from phoenix.client import AsyncClient

            async_client = AsyncClient()
            await async_client.annotations.add_span_annotation(
                annotation_name="sentiment",
                span_id="abc123",
                label="positive",
                score=0.9,
                explanation="The text expresses a positive sentiment.",
                sync=True,
            )
            ```
        """  # noqa: E501
        anno = _get_span_annotation(
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

    async def log_span_annotations_dataframe(
        self,
        *,
        dataframe: pd.DataFrame,
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool = False,
    ) -> Optional[list[v1.InsertedSpanAnnotation]]:
        """Log multiple span annotations from a pandas DataFrame asynchronously.

        This method allows you to create multiple span annotations at once by providing the data in a pandas DataFrame.
        The DataFrame can either include `name` and `annotator_kind` columns or you can specify global values for all rows.
        The data is processed in chunks of 100 rows for efficient batch processing.

        Args:
            dataframe: A pandas DataFrame containing the annotation data. Must include either a "name" column or provide
                a global name parameter. Similarly, must include an "annotator_kind" column or provide a global annotator_kind.
                The `span_id` can be either a column in the DataFrame or will be taken from the DataFrame index.
                Optional columns include: "label", "score", "explanation", "metadata", and "identifier".
            annotator_kind: Optional. The kind of annotator used for all annotations. If provided, this value will be used
                for all rows and the DataFrame does not need to include an "annotator_kind" column.
                Must be one of "LLM", "CODE", or "HUMAN".
            annotation_name: Optional. The name to use for all annotations. If provided, this value will be used
                for all rows and the DataFrame does not need to include a "name" column.
            sync: If True, the request will be fulfilled synchronously and the response will contain
                the inserted annotation IDs. If False, the request will be processed asynchronously.

        Returns:
            If sync is True, a list of all inserted span annotations. If sync is False, None.

        Raises:
            ImportError: If pandas is not installed.
            ValueError: If the DataFrame is missing required columns or if no valid annotation data is provided.

        Example:
            ```python
            import pandas as pd

            # Using name and annotator_kind from DataFrame
            df1 = pd.DataFrame({
                "name": ["sentiment", "toxicity"],
                "annotator_kind": ["HUMAN", "LLM"],
                "label": ["positive", "low"],
                "score": [0.9, 0.1]
            })
            await async_client.annotations.log_span_annotations_dataframe(dataframe=df1)

            # Using global name and annotator_kind
            df2 = pd.DataFrame({
                "label": ["positive", "low"]
            }, index=["span1", "span2"])
            await async_client.annotations.log_span_annotations_dataframe(
                dataframe=df2,
                annotation_name="sentiment",  # applies to all rows
                annotator_kind="HUMAN"  # applies to all rows
            )
            ```
        """  # noqa: E501
        # Process DataFrame chunks using iterator
        all_responses: list[v1.InsertedSpanAnnotation] = []
        for chunk in _chunk_dataframe(
            dataframe=dataframe,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
            chunk_size=_DATAFRAME_CHUNK_SIZE,
        ):
            # Delegate to log_span_annotations
            response = await self.log_span_annotations(span_annotations=chunk, sync=sync)
            if sync and response:
                all_responses.extend(response)

        return all_responses if sync else None

    async def log_span_annotations(
        self,
        *,
        span_annotations: Iterable[v1.SpanAnnotationData],
        sync: bool = False,
    ) -> Optional[list[v1.InsertedSpanAnnotation]]:
        """Log multiple span annotations asynchronously.

        Args:
            span_annotations: An iterable of span annotation data to log. Each annotation must include
                at least a span_id, name, and annotator_kind, and at least one of label, score, or explanation.
            sync: If True, the request will be fulfilled synchronously and the response will contain
                the inserted annotation IDs. If False, the request will be processed asynchronously.

        Returns:
            If sync is True, a list of inserted span annotations, each containing an ID. If sync is False, None.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the response is invalid.

        Example:
            ```python
            from phoenix.client import AsyncClient

            async_client = AsyncClient()

            # Create span annotation data objects
            annotation1 = {
                "name": "sentiment",
                "span_id": "span_123",
                "annotator_kind": "HUMAN",
                "result": {
                    "label": "positive",
                    "score": 0.9
                },
                "metadata": {"source": "user_feedback"}
            }

            annotation2 = {
                "name": "toxicity",
                "span_id": "span_456",
                "annotator_kind": "LLM",
                "result": {
                    "label": "low",
                    "score": 0.1,
                    "explanation": "No harmful content detected"
                }
            }

            # Log multiple annotations at once
            await async_client.annotations.log_span_annotations(
                span_annotations=[annotation1, annotation2],
            )
            ```
        """  # noqa: E501
        url = "v1/span_annotations"
        params = {"sync": sync} if sync else {}
        json_ = v1.AnnotateSpansRequestBody(data=list(span_annotations))
        response = await self._client.post(url=url, json=json_, params=params)
        response.raise_for_status()
        if not sync:
            return None
        return list(cast(v1.AnnotateSpansResponseBody, response.json())["data"])


def _get_span_annotation(
    *,
    span_id: str,
    annotation_name: str,
    annotator_kind: Literal["LLM", "CODE", "HUMAN"] = "HUMAN",
    label: Optional[str] = None,
    score: Optional[float] = None,
    explanation: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    identifier: Optional[str] = None,
) -> v1.SpanAnnotationData:
    """Create a span annotation data object.

    Args:
        annotation_name: The name of the annotation.
        span_id: The ID of the span to annotate.
        annotator_kind: The kind of annotator used for the annotation. Must be one of "LLM", "CODE", or "HUMAN".
        label: The label assigned by the annotation.
        score: The score assigned by the annotation.
        explanation: Explanation of the annotation result.
        metadata: Additional metadata for the annotation.
        identifier: An optional identifier for the annotation. Each annotation is uniquely identified by the combination
            of name, span_id, and identifier (where a null identifier is equivalent to an empty string).
            If an annotation with the same name, span_id, and identifier already exists, it will be updated.
            Using a non-empty identifier allows you to have multiple annotations with the same name and span_id.
            Most of the time, you can leave this as None - it will still update the record if it exists.
            It will also update the record with identifier="" if it exists.

    Returns:
        A span annotation data object that can be used with the Annotations API.

    Raises:
        ValueError: If at least one of label, score, or explanation is not provided, or if required fields are invalid.
    """  # noqa: E501
    # Validate required fields
    if not span_id or not isinstance(span_id, str):  # pyright: ignore[reportUnnecessaryIsInstance]
        raise ValueError("span_id must be a non-empty string")
    if not annotation_name or not isinstance(annotation_name, str):  # pyright: ignore[reportUnnecessaryIsInstance]
        raise ValueError("annotation_name must be a non-empty string")
    if annotator_kind not in _VALID_ANNOTATOR_KINDS:
        raise ValueError(f"annotator_kind must be one of {_VALID_ANNOTATOR_KINDS}")

    # Validate that at least one of label, score, or explanation is provided
    if not label and score is None and not explanation:
        raise ValueError("At least one of label, score, or explanation must be provided.")

    # Validate score if provided
    if score is not None and not isinstance(score, (int, float)):  # pyright: ignore[reportUnnecessaryIsInstance]
        raise ValueError("score must be a number")

    # Validate metadata if provided
    if metadata is not None and not isinstance(metadata, dict):  # pyright: ignore[reportUnnecessaryIsInstance]
        raise ValueError("metadata must be a dictionary")

    result = v1.SpanAnnotationResult()
    if label:
        result["label"] = label
    if score is not None:
        result["score"] = score
    if explanation:
        result["explanation"] = explanation
    anno = v1.SpanAnnotationData(
        name=annotation_name,
        span_id=span_id,
        annotator_kind=annotator_kind,
        result=result,
    )
    if metadata:
        anno["metadata"] = metadata
    if identifier and identifier.strip():
        anno["identifier"] = identifier.strip()
    return anno


def _validate_dataframe(
    *,
    dataframe: pd.DataFrame,
    annotation_name: Optional[str] = None,
    annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
) -> None:
    """Internal function to validate that the DataFrame has the required columns and data.

    This function performs comprehensive validation of the DataFrame structure and content,
    including type checking, required columns, and value validation.

    Args:
        dataframe: The DataFrame to validate
        annotation_name: Optional global name value. If provided, must be a non-empty string.
        annotator_kind: Optional global annotator_kind value. Must be one of "LLM", "CODE", or "HUMAN".

    Raises:
        ValueError: If the DataFrame is missing required columns, if no valid annotation data is provided,
            or if annotator_kind values are invalid.
        TypeError: If the input is not a pandas DataFrame.
    """  # noqa: E501
    try:
        import pandas as pd
    except ImportError:
        raise ImportError(
            "Pandas is not installed. Please install pandas to use this method: "
            "pip install pandas"
        )

    # Type check for DataFrame
    if not isinstance(dataframe, pd.DataFrame):  # pyright: ignore[reportUnnecessaryIsInstance]
        raise TypeError(f"Expected pandas DataFrame, got {type(dataframe)}")

    # Check if DataFrame is empty
    if dataframe.empty:
        raise ValueError("DataFrame cannot be empty")

    # Validate global name if provided
    if annotation_name is not None:
        if not isinstance(annotation_name, str):  # pyright: ignore[reportUnnecessaryIsInstance]
            raise TypeError(f"Expected string for annotation_name, got {type(annotation_name)}")
        if not annotation_name.strip():
            raise ValueError("Annotation name cannot be empty or whitespace")

    # Check for name/annotation_name columns
    has_name = "name" in dataframe.columns
    has_annotation_name = "annotation_name" in dataframe.columns
    if has_name and has_annotation_name:
        raise ValueError("DataFrame cannot have both 'name' and 'annotation_name' columns")
    if not annotation_name and not has_name and not has_annotation_name:
        raise ValueError(
            "DataFrame must contain either 'name' or 'annotation_name' column, "
            "or provide a global annotation_name parameter"
        )

    # Check for required columns
    required_columns = set()  # pyright: ignore[reportUnknownVariableType]
    if annotator_kind is None:
        required_columns.add("annotator_kind")  # pyright: ignore[reportUnknownMemberType]

    if not required_columns.issubset(dataframe.columns):
        raise ValueError(
            f"DataFrame must contain columns: {required_columns}. "
            f"Found columns: {dataframe.columns.tolist()}"
        )

    # Check for non-null values in required columns
    for col in required_columns:  # pyright: ignore[reportUnknownVariableType]
        if dataframe[col].isna().all():  # pyright: ignore[reportUnknownMemberType]
            raise ValueError(f"Column '{col}' must contain at least one non-null value")

    # Validate name values if no global name is provided
    if annotation_name is None:
        name_column = "annotation_name" if has_annotation_name else "name"
        # Check for null/NaN values
        if dataframe[name_column].isna().any():  # pyright: ignore[reportUnknownMemberType]
            raise ValueError(f"{name_column} values cannot be None")
        # Check for empty or whitespace-only strings
        if (dataframe[name_column].str.strip() == "").any():  # pyright: ignore[reportUnknownMemberType]
            raise ValueError(f"{name_column} values must be non-empty strings")
        # Check for non-string values
        if not all(isinstance(x, str) for x in dataframe[name_column]):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
            raise ValueError(f"{name_column} values must be strings")

    # Check for span_id in either columns or index
    has_span_id = "span_id" in dataframe.columns
    has_context_span_id = "context.span_id" in dataframe.columns
    if has_span_id and has_context_span_id:
        raise ValueError("DataFrame cannot have both 'span_id' and 'context.span_id' columns")
    if (
        not has_span_id
        and not has_context_span_id
        and not all(isinstance(x, str) for x in dataframe.index)  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
    ):
        raise ValueError(
            "DataFrame must have either a 'span_id' or 'context.span_id' column, or a string-based index"  # noqa: E501
        )

    # Validate span_id values if using column
    span_id_column = "context.span_id" if has_context_span_id else "span_id"
    if span_id_column in dataframe.columns:
        # Check for None values
        if dataframe[span_id_column].isna().any():  # pyright: ignore[reportUnknownMemberType]
            raise ValueError(f"{span_id_column} values cannot be None")
        # Check for empty or whitespace-only strings
        if (dataframe[span_id_column].str.strip() == "").any():  # pyright: ignore[reportUnknownMemberType]
            raise ValueError(f"{span_id_column} values must be non-empty strings")
        # Check for non-string values
        if not all(isinstance(x, str) for x in dataframe[span_id_column]):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
            raise ValueError(f"{span_id_column} values must be strings")
    # Validate index values if using index as span_id
    else:
        # Check for empty or whitespace-only strings
        if (pd.Series(dataframe.index).str.strip() == "").any():  # pyright: ignore[reportUnknownMemberType]
            raise ValueError("Index values must be non-empty strings when used as span_id")
        # Check for non-string values
        if not all(isinstance(x, str) for x in dataframe.index):  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
            raise ValueError("Index values must be strings when used as span_id")

    # Check global annotator_kind if provided
    if annotator_kind is not None and annotator_kind not in _VALID_ANNOTATOR_KINDS:
        raise ValueError(
            f"Invalid annotator_kind value: {annotator_kind}. "
            f"Must be one of: {_VALID_ANNOTATOR_KINDS}"
        )

    # Only check row-level annotator_kind values if no global value is provided
    if annotator_kind is None and "annotator_kind" in dataframe.columns:
        invalid_values = set(dataframe["annotator_kind"].dropna().unique()) - _VALID_ANNOTATOR_KINDS  # pyright: ignore[reportUnknownMemberType,reportUnknownArgumentType]
        if invalid_values:
            raise ValueError(
                f"Invalid annotator_kind values found in DataFrame: {invalid_values}. "
                f"Must be one of: {_VALID_ANNOTATOR_KINDS}"
            )


def _chunk_dataframe(
    *,
    dataframe: pd.DataFrame,
    annotation_name: Optional[str] = None,
    annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
    chunk_size: int = _DATAFRAME_CHUNK_SIZE,
) -> Iterator[list[v1.SpanAnnotationData]]:
    """Internal function to split a DataFrame into smaller chunks for batch processing.

    This function processes the DataFrame in chunks of 100 rows for efficient batch processing.
    It handles type conversion and validation of the data before creating span annotations.

    Args:
        dataframe: The DataFrame to split into chunks. Must contain either a 'span_id' column or have a non-empty index.
        annotation_name: Optional. The name to use for all annotations. If provided, this value will be used
            for all rows and the DataFrame does not need to include a "name" column.
        annotator_kind: Optional. The kind of annotator used for all annotations. If provided, this value will be used
            for all rows and the DataFrame does not need to include an "annotator_kind" column.
            Must be one of "LLM", "CODE", or "HUMAN".

    Yields:
        Lists of SpanAnnotationData objects, one chunk at a time.

    Raises:
        ValueError: If the DataFrame is invalid or if required fields are missing.
        TypeError: If score values cannot be converted to float.
    """  # noqa: E501
    # Validate DataFrame upfront
    _validate_dataframe(
        dataframe=dataframe,
        annotation_name=annotation_name,
        annotator_kind=annotator_kind,
    )

    span_annotations = []
    for idx, row in dataframe.iterrows():  # pyright: ignore[reportUnknownVariableType,reportUnknownMemberType]
        try:
            # Get required fields with null checks
            row_name = annotation_name
            if row_name is None:
                if "name" in row and bool(row["name"]):  # pyright: ignore[reportUnknownArgumentType]
                    row_name = str(row["name"])  # pyright: ignore[reportUnknownArgumentType]
                elif "annotation_name" in row and bool(row["annotation_name"]):  # pyright: ignore[reportUnknownArgumentType]
                    row_name = str(row["annotation_name"])  # pyright: ignore[reportUnknownArgumentType]
            assert row_name
            row_annotator_kind = annotator_kind
            if row_annotator_kind is None:
                row_annotator_kind = cast(
                    _AnnotatorKind,
                    str(row["annotator_kind"])  # pyright: ignore[reportUnknownArgumentType]
                    if "annotator_kind" in row and bool(row["annotator_kind"])  # pyright: ignore[reportUnknownArgumentType]
                    else None,
                )

            # Get span_id from either column or index
            span_id = (
                str(row["span_id"])  # pyright: ignore[reportUnknownArgumentType]
                if "span_id" in dataframe.columns and bool(row["span_id"])  # pyright: ignore[reportUnknownArgumentType]
                else str(row["context.span_id"])  # pyright: ignore[reportUnknownArgumentType]
                if "context.span_id" in dataframe.columns and bool(row["context.span_id"])  # pyright: ignore[reportUnknownArgumentType]
                else str(idx)
            )

            # Get optional fields with proper type conversion
            label = str(row["label"]) if "label" in row and bool(row["label"]) else None  # pyright: ignore[reportUnknownArgumentType]
            score = None
            if "score" in row and row["score"] is not None:
                try:
                    score = float(row["score"])  # pyright: ignore[reportUnknownArgumentType,reportArgumentType]
                except (ValueError, TypeError):
                    raise TypeError(f"Score value '{row['score']}' cannot be converted to float")
            explanation = (
                str(row["explanation"]).strip()  # pyright: ignore[reportUnknownArgumentType]
                if "explanation" in row and bool(row["explanation"])  # pyright: ignore[reportUnknownArgumentType]
                else None
            )
            metadata = cast(
                dict[str, Any],
                dict(row["metadata"]) if "metadata" in row and bool(row["metadata"]) else None,  # pyright: ignore[reportUnknownArgumentType]
            )
            identifier = (
                str(row["identifier"]) if "identifier" in row and bool(row["identifier"]) else None  # pyright: ignore[reportUnknownArgumentType]
            )

            annotation = _get_span_annotation(
                span_id=span_id,
                annotation_name=row_name,  # pyright: ignore[reportArgumentType]
                annotator_kind=row_annotator_kind,  # pyright: ignore[reportArgumentType]
                label=label,
                score=score,
                explanation=explanation,
                metadata=metadata,  # pyright: ignore[reportArgumentType]
                identifier=identifier,
            )

            span_annotations.append(annotation)  # pyright: ignore[reportUnknownMemberType]

            # Yield chunk when we reach chunk_size
            if len(span_annotations) >= chunk_size:  # pyright: ignore[reportUnknownArgumentType]
                yield span_annotations
                span_annotations = []

        except Exception as e:
            raise ValueError(f"Error processing row {idx}: {str(e)}")

    # Yield any remaining annotations
    if span_annotations:
        yield span_annotations
