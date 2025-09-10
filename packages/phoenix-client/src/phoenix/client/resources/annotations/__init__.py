# ruff: noqa: E501
from typing import TYPE_CHECKING, Any, Iterable, Literal, Optional

from typing_extensions import deprecated

from phoenix.client.resources.spans import (
    AsyncSpans,
    InsertedSpanAnnotation,
    SpanAnnotationData,
    Spans,
)

if TYPE_CHECKING:
    import pandas as pd


class Annotations:
    """Client for interacting with the Annotations API endpoints.

    .. deprecated:: 1.17.0
        This class is deprecated. Use ``client.spans`` methods instead.
    """  # noqa: E501

    def __init__(self, spans: Spans) -> None:
        """Initialize the deprecated Annotations client."""
        self._spans = spans

    @deprecated(
        "client.annotations.add_span_annotation() is deprecated. "
        "Use client.spans.add_span_annotation() instead.",
        stacklevel=2,
    )
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

        .. deprecated:: 1.17.0
            This method is deprecated. Use ``client.spans.add_span_annotation()`` instead.

        Args:
            span_id (str): The ID of the span to annotate.
            annotation_name (str): The name of the annotation.
            annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator. Defaults to "HUMAN".
            label (Optional[str]): The label assigned by the annotation.
            score (Optional[float]): The score assigned by the annotation.
            explanation (Optional[str]): Explanation of the annotation result.
            metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.
            identifier (Optional[str]): An optional identifier for the annotation.
            sync (bool): If True, returns the inserted annotation. Defaults to False.

        Returns:
            Optional[InsertedSpanAnnotation]: The inserted span annotation if sync is True, None otherwise.
        """
        return self._spans.add_span_annotation(
            span_id=span_id,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
            label=label,
            score=score,
            explanation=explanation,
            metadata=metadata,
            identifier=identifier,
            sync=sync,
        )

    @deprecated(
        "client.annotations.log_span_annotations_dataframe() is deprecated. "
        "Use client.spans.log_span_annotations_dataframe() instead.",
        stacklevel=2,
    )
    def log_span_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        annotation_name: Optional[str] = None,
        sync: bool = False,
    ) -> Optional[list[InsertedSpanAnnotation]]:
        """Log multiple span annotations from a pandas DataFrame.

        .. deprecated:: 1.17.0
            This method is deprecated. Use ``client.spans.log_span_annotations_dataframe()`` instead.

        Args:
            dataframe (pd.DataFrame): A pandas DataFrame containing the annotation data.
            annotator_kind (Optional[Literal["LLM", "CODE", "HUMAN"]]): The kind of annotator for all annotations.
            annotation_name (Optional[str]): The name to use for all annotations.
            sync (bool): If True, returns the inserted annotations. Defaults to False.

        Returns:
            Optional[list[InsertedSpanAnnotation]]: List of inserted annotations if sync is True, None otherwise.
        """
        return self._spans.log_span_annotations_dataframe(
            dataframe=dataframe,
            annotator_kind=annotator_kind,
            annotation_name=annotation_name,
            sync=sync,
        )

    @deprecated(
        "client.annotations.log_span_annotations() is deprecated. "
        "Use client.spans.log_span_annotations() instead.",
        stacklevel=2,
    )
    def log_span_annotations(
        self,
        *,
        span_annotations: Iterable[SpanAnnotationData],
        sync: bool = False,
    ) -> Optional[list[InsertedSpanAnnotation]]:
        """Log multiple span annotations.

        .. deprecated:: 1.17.0
            This method is deprecated. Use ``client.spans.log_span_annotations()`` instead.

        Args:
            span_annotations (Iterable[SpanAnnotationData]): An iterable of span annotation data to log.
            sync (bool): If True, returns the inserted annotations. Defaults to False.

        Returns:
            Optional[list[InsertedSpanAnnotation]]: List of inserted annotations if sync is True, None otherwise.
        """
        return self._spans.log_span_annotations(
            span_annotations=span_annotations,
            sync=sync,
        )


class AsyncAnnotations:
    """Asynchronous client for interacting with the Annotations API endpoints.

    .. deprecated:: 1.17.0
        This class is deprecated. Use ``client.spans`` methods instead.
    """

    def __init__(self, spans: AsyncSpans) -> None:
        """Initialize the deprecated AsyncAnnotations client."""
        self._spans = spans

    @deprecated(
        "client.annotations.add_span_annotation() is deprecated. "
        "Use client.spans.add_span_annotation() instead.",
        stacklevel=2,
    )
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

        .. deprecated:: 1.17.0
            This method is deprecated. Use ``client.spans.add_span_annotation()`` instead.

        Args:
            span_id (str): The ID of the span to annotate.
            annotation_name (str): The name of the annotation.
            annotator_kind (Literal["LLM", "CODE", "HUMAN"]): The kind of annotator. Defaults to "HUMAN".
            label (Optional[str]): The label assigned by the annotation.
            score (Optional[float]): The score assigned by the annotation.
            explanation (Optional[str]): Explanation of the annotation result.
            metadata (Optional[dict[str, Any]]): Additional metadata for the annotation.
            identifier (Optional[str]): An optional identifier for the annotation.
            sync (bool): If True, returns the inserted annotation. Defaults to False.

        Returns:
            Optional[InsertedSpanAnnotation]: The inserted span annotation if sync is True, None otherwise.
        """
        return await self._spans.add_span_annotation(
            span_id=span_id,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
            label=label,
            score=score,
            explanation=explanation,
            metadata=metadata,
            identifier=identifier,
            sync=sync,
        )

    @deprecated(
        "client.annotations.log_span_annotations_dataframe() is deprecated. "
        "Use client.spans.log_span_annotations_dataframe() instead.",
        stacklevel=2,
    )
    async def log_span_annotations_dataframe(
        self,
        *,
        dataframe: "pd.DataFrame",
        annotation_name: Optional[str] = None,
        annotator_kind: Optional[Literal["LLM", "CODE", "HUMAN"]] = None,
        sync: bool = False,
    ) -> Optional[list[InsertedSpanAnnotation]]:
        """Log multiple span annotations from a pandas DataFrame asynchronously.

        .. deprecated:: 1.17.0
            This method is deprecated. Use ``client.spans.log_span_annotations_dataframe()`` instead.

        Args:
            dataframe (pd.DataFrame): A pandas DataFrame containing the annotation data.
            annotation_name (Optional[str]): The name to use for all annotations.
            annotator_kind (Optional[Literal["LLM", "CODE", "HUMAN"]]): The kind of annotator for all annotations.
            sync (bool): If True, returns the inserted annotations. Defaults to False.

        Returns:
            Optional[list[InsertedSpanAnnotation]]: List of inserted annotations if sync is True, None otherwise.
        """
        return await self._spans.log_span_annotations_dataframe(
            dataframe=dataframe,
            annotation_name=annotation_name,
            annotator_kind=annotator_kind,
            sync=sync,
        )

    @deprecated(
        "client.annotations.log_span_annotations() is deprecated. "
        "Use client.spans.log_span_annotations() instead.",
        stacklevel=2,
    )
    async def log_span_annotations(
        self,
        *,
        span_annotations: Iterable[SpanAnnotationData],
        sync: bool = False,
    ) -> Optional[list[InsertedSpanAnnotation]]:
        """Log multiple span annotations asynchronously.

        .. deprecated:: 1.17.0
            This method is deprecated. Use ``client.spans.log_span_annotations()`` instead.

        Args:
            span_annotations (Iterable[SpanAnnotationData]): An iterable of span annotation data to log.
            sync (bool): If True, returns the inserted annotations. Defaults to False.

        Returns:
            Optional[list[InsertedSpanAnnotation]]: List of inserted annotations if sync is True, None otherwise.
        """
        return await self._spans.log_span_annotations(
            span_annotations=span_annotations,
            sync=sync,
        )
