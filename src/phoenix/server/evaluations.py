from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional, cast

from phoenix.db import models
from phoenix.db.insertion.types import Precursors
from phoenix.trace.span_evaluations import (
    DocumentEvaluations,
    Evaluations,
    SpanEvaluations,
    TraceEvaluations,
)

if TYPE_CHECKING:
    import pandas as pd

_EnqueueAnnotations = Callable[..., Awaitable[None]]


async def enqueue_annotations_from_evaluations(
    enqueue_annotations: _EnqueueAnnotations,
    evaluations: Evaluations,
    *,
    source: str = "API",
) -> None:
    dataframe = evaluations.dataframe
    eval_name = evaluations.eval_name

    if isinstance(evaluations, DocumentEvaluations):
        for index, row in dataframe.iterrows():
            span_id, document_position = cast(tuple[str, int], index)
            score, label, explanation = _get_annotation_result(row)
            await enqueue_annotations(
                Precursors.DocumentAnnotation(
                    datetime.now(timezone.utc),
                    span_id=str(span_id),
                    document_position=int(document_position),
                    obj=models.DocumentAnnotation(
                        document_position=int(document_position),
                        name=eval_name,
                        identifier="",
                        source=source,
                        annotator_kind="LLM",
                        score=score,
                        label=label,
                        explanation=explanation,
                        metadata_={},
                    ),
                )
            )
        return

    if isinstance(evaluations, SpanEvaluations):
        for index, row in dataframe.iterrows():
            score, label, explanation = _get_annotation_result(row)
            await enqueue_annotations(
                Precursors.SpanAnnotation(
                    datetime.now(timezone.utc),
                    span_id=str(index),
                    obj=models.SpanAnnotation(
                        name=eval_name,
                        identifier="",
                        source=source,
                        annotator_kind="LLM",
                        score=score,
                        label=label,
                        explanation=explanation,
                        metadata_={},
                    ),
                )
            )
        return

    if isinstance(evaluations, TraceEvaluations):
        for index, row in dataframe.iterrows():
            score, label, explanation = _get_annotation_result(row)
            await enqueue_annotations(
                Precursors.TraceAnnotation(
                    datetime.now(timezone.utc),
                    trace_id=str(index),
                    obj=models.TraceAnnotation(
                        name=eval_name,
                        identifier="",
                        source=source,
                        annotator_kind="LLM",
                        score=score,
                        label=label,
                        explanation=explanation,
                        metadata_={},
                    ),
                )
            )
        return

    raise TypeError(f"Unsupported evaluations type: {type(evaluations)!r}")


def _get_annotation_result(
    row: "pd.Series[str]",
) -> tuple[Optional[float], Optional[str], Optional[str]]:
    return (
        cast(Optional[float], row.get("score")),
        cast(Optional[str], row.get("label")),
        cast(Optional[str], row.get("explanation")),
    )
