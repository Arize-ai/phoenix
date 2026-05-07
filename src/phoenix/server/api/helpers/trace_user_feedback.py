from typing import Literal, Optional, cast

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.api.helpers.annotations import (
    USER_FEEDBACK_ANNOTATION_NAME,
    USER_FEEDBACK_LABELS,
    USER_FEEDBACK_SCORE_BY_LABEL,
    get_user_feedback_identifier,
)

TraceUserFeedbackLabel = Literal["positive", "negative"]
TraceUserFeedbackSource = Literal["API", "APP"]


def validate_user_feedback_label(label: str) -> TraceUserFeedbackLabel:
    if label not in USER_FEEDBACK_LABELS:
        raise ValueError("User feedback label must be 'positive' or 'negative'.")
    return cast(TraceUserFeedbackLabel, label)


async def get_trace_rowid_by_identifier(
    session: AsyncSession,
    trace_identifier: str,
) -> Optional[int]:
    return await session.scalar(
        select(models.Trace.id).where(models.Trace.trace_id == trace_identifier)
    )


async def upsert_trace_user_feedback(
    session: AsyncSession,
    *,
    trace_rowid: int,
    label: TraceUserFeedbackLabel,
    source: TraceUserFeedbackSource,
    user_id: Optional[int],
) -> models.TraceAnnotation:
    dialect = SupportedSQLDialect(session.bind.dialect.name)
    values = {
        "trace_rowid": trace_rowid,
        "name": USER_FEEDBACK_ANNOTATION_NAME,
        "label": label,
        "score": USER_FEEDBACK_SCORE_BY_LABEL[label],
        "explanation": None,
        "annotator_kind": "HUMAN",
        "metadata_": {},
        "identifier": get_user_feedback_identifier(user_id),
        "source": source,
        "user_id": user_id,
    }
    return (
        await session.scalars(
            insert_on_conflict(
                values,
                dialect=dialect,
                table=models.TraceAnnotation,
                unique_by=("name", "trace_rowid", "identifier"),
            ).returning(models.TraceAnnotation)
        )
    ).one()


async def delete_trace_user_feedback(
    session: AsyncSession,
    *,
    trace_rowid: int,
    user_id: Optional[int],
) -> Optional[models.TraceAnnotation]:
    return await session.scalar(
        delete(models.TraceAnnotation)
        .where(models.TraceAnnotation.trace_rowid == trace_rowid)
        .where(models.TraceAnnotation.name == USER_FEEDBACK_ANNOTATION_NAME)
        .where(models.TraceAnnotation.identifier == get_user_feedback_identifier(user_id))
        .returning(models.TraceAnnotation)
    )
