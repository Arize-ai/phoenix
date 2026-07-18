import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from openinference.semconv.trace import OpenInferenceSpanKindValues
from pydantic import Field
from sqlalchemy import select
from starlette.requests import Request
from strawberry.relay import GlobalID

from phoenix.datetime_utils import normalize_datetime
from phoenix.db import models
from phoenix.db.insertion.helpers import should_calculate_span_cost
from phoenix.server.api.types.Span import Span as SpanNodeType
from phoenix.server.authorization import is_not_locked

from .models import V1RoutesBaseModel
from .utils import add_errors_to_responses, get_project_by_identifier

logger = logging.getLogger(__name__)

router = APIRouter(tags=["spans"])

_LLM = OpenInferenceSpanKindValues.LLM.value


class BackfillSpanCostsData(V1RoutesBaseModel):
    spans_scanned: int = Field(
        description=(
            "Number of eligible LLM spans (without an existing cost record) examined in this batch."
        ),
    )
    costs_inserted: int = Field(
        description="Number of span cost records created in this batch.",
    )
    spans_skipped: int = Field(
        description=(
            "Number of examined spans for which no cost could be derived (e.g. missing "
            "model name or token counts, or no matching price)."
        ),
    )


class BackfillSpanCostsResponseBody(V1RoutesBaseModel):
    data: BackfillSpanCostsData
    next_cursor: Optional[str] = Field(
        description=(
            "Cursor for the next batch. Pass it back as the `cursor` query parameter to "
            "continue. `null` once the project has been fully processed."
        ),
    )


@router.post(
    "/projects/{project_identifier}/spans/backfill_costs",
    dependencies=[Depends(is_not_locked)],
    operation_id="backfillSpanCosts",
    summary="Backfill token-based cost for historical LLM spans",
    description=(
        "Computes and stores cost records for historical LLM spans in a project that do not "
        "already have one, using the same pricing logic applied during live ingestion. Work is "
        "done one bounded batch per request: call repeatedly, passing back `next_cursor` each "
        "time, until it is `null`. Existing cost records are never modified. Intended to be "
        "driven from a client script so that each request stays short and does not disturb live "
        "ingestion."
    ),
    responses=add_errors_to_responses([404, 422, 507]),
    response_description="Per-batch backfill counts and the cursor for the next batch.",
)
async def backfill_span_costs(
    request: Request,
    project_identifier: str = Path(
        description="The project identifier: either project ID or project name.",
    ),
    start_time: Optional[datetime] = Query(
        default=None,
        description="Inclusive lower bound on span start time (ISO 8601).",
    ),
    end_time: Optional[datetime] = Query(
        default=None,
        description="Exclusive upper bound on span start time (ISO 8601).",
    ),
    limit: int = Query(
        default=1000,
        gt=0,
        le=10000,
        description="Maximum number of spans to process in this batch.",
    ),
    cursor: Optional[str] = Query(
        default=None,
        description="Pagination cursor (Span GlobalID) returned by a previous call.",
    ),
) -> BackfillSpanCostsResponseBody:
    # The `is_not_locked` route dependency already returns 507 when database writes
    # are disabled (e.g. high disk usage), so no explicit guard is needed here.
    db = request.app.state.db
    calculator = request.app.state.span_cost_calculator

    async with db.read() as session:
        project = await get_project_by_identifier(session, project_identifier)
        stmt = (
            select(models.Span)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .outerjoin(models.SpanCost, models.SpanCost.span_rowid == models.Span.id)
            .where(models.Trace.project_rowid == project.id)
            .where(models.Span.span_kind == _LLM)
            .where(models.SpanCost.id.is_(None))
            .order_by(models.Span.id.asc())
        )
        if start_time is not None:
            stmt = stmt.where(
                models.Span.start_time >= normalize_datetime(start_time, timezone.utc)
            )
        if end_time is not None:
            stmt = stmt.where(models.Span.start_time < normalize_datetime(end_time, timezone.utc))
        if cursor is not None:
            try:
                cursor_rowid = int(GlobalID.from_id(cursor).node_id)
            except (ValueError, TypeError):
                raise HTTPException(status_code=422, detail=f"Invalid cursor format: {cursor}")
            stmt = stmt.where(models.Span.id > cursor_rowid)
        # Fetch one extra row to detect whether another batch remains.
        stmt = stmt.limit(limit + 1)
        spans = list((await session.scalars(stmt)).all())

    # Drop the peeked row: the cursor is anchored on the last *processed* span so
    # that the strict `id > cursor` filter above resumes exactly where we stopped,
    # without skipping or re-processing any span.
    has_more = len(spans) == limit + 1
    if has_more:
        spans = spans[:limit]

    costs: list[models.SpanCost] = []
    for span in spans:
        # Apply the same gate as live ingestion so backfilled and live cost stay consistent.
        if not should_calculate_span_cost(span.attributes):
            continue
        try:
            cost = calculator.calculate_cost(span.start_time, span.attributes)
        except Exception:
            logger.exception(f"Failed to calculate cost for span with id={span.id}")
            continue
        if cost is None:
            continue
        cost.span_rowid = span.id
        cost.trace_rowid = span.trace_rowid
        costs.append(cost)

    if costs:
        async with db() as session:
            session.add_all(costs)

    next_cursor: Optional[str] = None
    if has_more and spans:
        next_cursor = str(GlobalID(SpanNodeType.__name__, str(spans[-1].id)))

    scanned = len(spans)
    return BackfillSpanCostsResponseBody(
        data=BackfillSpanCostsData(
            spans_scanned=scanned,
            costs_inserted=len(costs),
            spans_skipped=scanned - len(costs),
        ),
        next_cursor=next_cursor,
    )
