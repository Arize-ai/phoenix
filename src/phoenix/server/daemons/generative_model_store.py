from __future__ import annotations

import logging
from asyncio import sleep
from datetime import datetime
from typing import Any, Mapping, Optional

import sqlalchemy as sa
from sqlalchemy.orm import joinedload

from phoenix.db import models
from phoenix.server.cost_tracking.cost_model_lookup import CostModelLookup
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)


class GenerativeModelStore(DaemonTask):
    def __init__(
        self,
        db: DbSessionFactory,
    ) -> None:
        super().__init__()
        self._db = db
        self._lookup = CostModelLookup()

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
            await sleep(5)  # Refresh every 5 seconds

    async def _fetch_models(self) -> None:
        stmt = (
            sa.select(models.GenerativeModel)
            .where(models.GenerativeModel.deleted_at.is_(None))
            .options(joinedload(models.GenerativeModel.token_prices))
            .order_by(models.GenerativeModel.name)
        )
        async with self._db() as session:
            result = await session.scalars(stmt)
        self._lookup = CostModelLookup(result.unique())
