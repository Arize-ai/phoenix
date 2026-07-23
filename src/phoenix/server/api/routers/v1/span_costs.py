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
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Span import Span as SpanNodeType
from phoenix.server.authorization import is_not_locked

from .models import V1RoutesBaseModel
from .utils import add_errors_to_responses, get_project_by_identifier

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
        "driven from a client script so that each request stays bounded and limits its impact on "
        "live ingestion."
    ),
    responses=add_errors_to_responses([404, 422, 507]),
    response_description="Per-batch backfill counts and the cursor for the next batch.",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
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
        default=100,
        gt=0,
        le=1000,
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
        normalized_start_time = (
            normalize_datetime(start_time, timezone.utc) if start_time is not None else None
        )
        normalized_end_time = (
            normalize_datetime(end_time, timezone.utc) if end_time is not None else None
        )
        if (
            normalized_start_time is not None
            and normalized_end_time is not None
            and normalized_start_time >= normalized_end_time
        ):
            raise HTTPException(status_code=422, detail="start_time must be earlier than end_time")
        stmt = (
            select(models.Span)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == project.id)
            .where(models.Span.span_kind == _LLM)
            .order_by(models.Span.id.asc())
        )
        if normalized_start_time is not None:
            stmt = stmt.where(models.Span.start_time >= normalized_start_time)
        if normalized_end_time is not None:
            stmt = stmt.where(models.Span.start_time < normalized_end_time)
        if cursor is not None:
            try:
                cursor_rowid = from_global_id_with_expected_type(
                    GlobalID.from_id(cursor), SpanNodeType.__name__
                )
            except (ValueError, TypeError):
                raise HTTPException(status_code=422, detail=f"Invalid cursor format: {cursor}")
            stmt = stmt.where(models.Span.id > cursor_rowid)
        # Page all LLM span IDs before checking costs. This bounds work even when most spans
        # already have costs, while also avoiding large attributes in the candidate sort.
        candidate_ids = stmt.with_only_columns(models.Span.id).limit(limit + 1).subquery()
        rows = list(
            (
                await session.execute(
                    select(models.Span, models.SpanCost.id)
                    .join(candidate_ids, models.Span.id == candidate_ids.c.id)
                    .outerjoin(models.SpanCost, models.SpanCost.span_rowid == models.Span.id)
                    .order_by(models.Span.id.asc())
                )
            ).tuples()
        )

    # Drop the peeked row: the cursor is anchored on the last *processed* span so
    # that the strict `id > cursor` filter above resumes exactly where we stopped,
    # without skipping or re-processing any span.
    has_more = len(rows) == limit + 1
    if has_more:
        rows = rows[:limit]
    spans = [span for span, cost_id in rows if cost_id is None]

    costs: list[models.SpanCost] = []
    for span in spans:
        # Apply the same gate as live ingestion so backfilled and live cost stay consistent.
        if not should_calculate_span_cost(span.attributes):
            continue
        cost = calculator.calculate_cost(span.start_time, span.attributes)
        if cost is None or cost.model_id is None or cost.total_cost is None:
            continue
        cost.span_rowid = span.id
        cost.trace_rowid = span.trace_rowid
        costs.append(cost)

    if costs:
        async with db() as session:
            session.add_all(costs)

    next_cursor: Optional[str] = None
    if has_more and rows:
        next_cursor = str(GlobalID(SpanNodeType.__name__, str(rows[-1][0].id)))

    scanned = len(spans)
    return BackfillSpanCostsResponseBody(
        data=BackfillSpanCostsData(
            spans_scanned=scanned,
            costs_inserted=len(costs),
            spans_skipped=scanned - len(costs),
        ),
        next_cursor=next_cursor,
    )
