"""Batch model token-detail summaries by project and time range."""

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy import Select, func, select
from sqlalchemy.sql.functions import coalesce
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.dataloaders.types import (
    CostBreakdown,
    SpanCostDetailSummaryEntry,
)
from phoenix.server.types import DbSessionFactory


@dataclass(frozen=True)
class _CostDetailSummaryScope:
    project_id: Optional[int]
    start_time: Optional[datetime]
    end_time: Optional[datetime]


@dataclass(frozen=True)
class GenerativeModelCostDetailSummaryKey:
    """Identifies one model's token details within optional project and time filters."""

    model_id: int
    project_id: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    @property
    def scope(self) -> _CostDetailSummaryScope:
        return _CostDetailSummaryScope(
            project_id=self.project_id,
            start_time=self.start_time,
            end_time=self.end_time,
        )


CostDetailSummaryEntries: TypeAlias = list[SpanCostDetailSummaryEntry]


class SpanCostDetailSummaryEntriesByModelAndScopeDataLoader(
    DataLoader[GenerativeModelCostDetailSummaryKey, CostDetailSummaryEntries]
):
    """Loads model token details with one aggregate query per unique scope."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(
        self, keys: list[GenerativeModelCostDetailSummaryKey]
    ) -> list[CostDetailSummaryEntries]:
        summaries_by_key: defaultdict[
            GenerativeModelCostDetailSummaryKey, CostDetailSummaryEntries
        ] = defaultdict(list)
        model_ids_by_scope = _group_model_ids_by_scope(keys)

        async with self._db.read() as session:
            for scope, model_ids in model_ids_by_scope.items():
                rows = await session.stream(
                    _build_cost_detail_summary_statement(model_ids=model_ids, scope=scope)
                )
                async for model_id, token_type, is_prompt, cost, tokens in rows:
                    result_key = GenerativeModelCostDetailSummaryKey(
                        model_id=model_id,
                        project_id=scope.project_id,
                        start_time=scope.start_time,
                        end_time=scope.end_time,
                    )
                    summaries_by_key[result_key].append(
                        SpanCostDetailSummaryEntry(
                            token_type=token_type,
                            is_prompt=is_prompt,
                            value=CostBreakdown(tokens=tokens, cost=cost),
                        )
                    )

        return [summaries_by_key[key] for key in keys]


def _group_model_ids_by_scope(
    keys: list[GenerativeModelCostDetailSummaryKey],
) -> dict[_CostDetailSummaryScope, set[int]]:
    model_ids_by_scope: defaultdict[_CostDetailSummaryScope, set[int]] = defaultdict(set)
    for key in keys:
        model_ids_by_scope[key.scope].add(key.model_id)
    return model_ids_by_scope


def _build_cost_detail_summary_statement(
    *,
    model_ids: set[int],
    scope: _CostDetailSummaryScope,
) -> Select[tuple[Optional[int], str, bool, Optional[float], Optional[float]]]:
    """Aggregate token counts and costs by model, token type, and prompt kind."""
    statement = (
        select(
            models.SpanCost.model_id,
            models.SpanCostDetail.token_type,
            models.SpanCostDetail.is_prompt,
            coalesce(func.sum(models.SpanCostDetail.cost), 0).label("cost"),
            coalesce(func.sum(models.SpanCostDetail.tokens), 0).label("tokens"),
        )
        .select_from(models.SpanCostDetail)
        .join(
            models.SpanCost,
            models.SpanCostDetail.span_cost_id == models.SpanCost.id,
        )
        .where(models.SpanCost.model_id.in_(model_ids))
        .group_by(
            models.SpanCost.model_id,
            models.SpanCostDetail.token_type,
            models.SpanCostDetail.is_prompt,
        )
    )
    if scope.project_id is not None:
        statement = statement.join(
            models.Trace,
            models.SpanCost.trace_rowid == models.Trace.id,
        ).where(models.Trace.project_rowid == scope.project_id)
    if scope.start_time is not None:
        statement = statement.where(models.SpanCost.span_start_time >= scope.start_time)
    if scope.end_time is not None:
        statement = statement.where(models.SpanCost.span_start_time < scope.end_time)
    return statement
