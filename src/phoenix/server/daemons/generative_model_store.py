from __future__ import annotations

import logging
from asyncio import sleep
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping, Optional

import sqlalchemy as sa
from sqlalchemy.orm import joinedload

from phoenix.db import models
from phoenix.server.cost_tracking.cost_model_lookup import CostModelLookup
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)


class GenerativeModelStore(DaemonTask):
    """A daemon that periodically fetches generative models and maintains an in-memory cache.

    This daemon periodically fetches generative models and their token prices from the
    database and maintains an in-memory cache for fast lookups. It uses an incremental
    fetch strategy to minimize database egress costs. Instead of fetching all models on
    every refresh, we track the last fetch time and only query for models that have
    changed since then (using updated_at/deleted_at).

    Rationale: Database egress is expensive in cloud environments (especially managed
    databases), and generative models change infrequently (mostly static reference data).
    The cost calculation daemon queries this store frequently (once per span), so trading
    memory for reduced database egress provides significant cost savings.

    Note:
        This strategy relies on GenerativeModel.updated_at being properly maintained. Any
        code that modifies GenerativeModel or TokenPrice records MUST ensure updated_at
        is explicitly set (see model_mutations.py). Relying solely on SQLAlchemy's
        onupdate=func.now() is insufficient because SQLAlchemy may skip the UPDATE if it
        detects no "real" changes to scalar fields (even if child records like TokenPrice
        are modified).
    """

    def __init__(
        self,
        db: DbSessionFactory,
        refresh_interval_seconds: int = 5,
    ) -> None:
        super().__init__()
        self._db = db
        self._lookup = CostModelLookup()
        self._last_fetch_time: Optional[datetime] = None
        self._last_fetch_id: Optional[int] = None
        self._refresh_interval_seconds = refresh_interval_seconds

    def find_model(
        self,
        start_time: datetime,
        attributes: Mapping[str, Any],
    ) -> Optional[models.GenerativeModel]:
        return self._lookup.find_model(start_time, attributes)

    async def _run(self) -> None:
        while self._running:
            try:
                await self._fetch_models()
            except Exception:
                logger.exception("Failed to refresh generative models")
            await sleep(self._refresh_interval_seconds)

    async def _fetch_models(self) -> None:
        """
        Fetch generative models from the database using an incremental strategy.

        On the first run, fetches all models. On subsequent runs, only fetches models
        where updated_at or deleted_at is at or after the last fetch time (with a 2-second
        buffer). Some models may be refetched, but .merge() handles duplicates idempotently.
        """
        # Capture time before query with 2-second buffer for clock skew tolerance
        fetch_start_time = datetime.now(timezone.utc) - timedelta(seconds=2)

        stmt = sa.select(models.GenerativeModel).options(
            joinedload(models.GenerativeModel.token_prices)
        )
        if self._last_fetch_time:
            # Incremental fetch: get models changed since last fetch.
            # Use >= for updated_at/deleted_at to catch models from the buffer window.
            # Include id check as redundant safety check.
            stmt = stmt.where(
                sa.or_(
                    models.GenerativeModel.id > self._last_fetch_id,
                    models.GenerativeModel.updated_at >= self._last_fetch_time,
                    models.GenerativeModel.deleted_at >= self._last_fetch_time,
                )
            )
        async with self._db() as session:
            generative_models = (await session.scalars(stmt)).unique().all()

        # Always update fetch time to avoid unbounded time windows
        self._last_fetch_time = fetch_start_time

        if not generative_models:
            return

        self._lookup.merge(generative_models)

        # Track max id for redundant safety check.
        self._last_fetch_id = max(model.id for model in generative_models)
