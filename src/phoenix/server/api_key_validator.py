from asyncio import create_task, sleep
from typing import Any, Dict, cast

import jwt
from jwt import InvalidTokenError
from sqlalchemy import and_, select

from phoenix.auth import JwtPayload
from phoenix.config import PHOENIX_SECRET
from phoenix.db import models
from phoenix.server.types import DaemonTask, DbSessionFactory


class ApiKeyValidator(DaemonTask):
    def __init__(
        self,
        db: DbSessionFactory,
        sleep_seconds: int = 1,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._db = db
        self._seconds = sleep_seconds
        self._cache: Dict[int, models.APIKey] = {}

    def __call__(self, token: str) -> bool:
        try:
            payload = cast(JwtPayload, jwt.decode(token, PHOENIX_SECRET, algorithms=["HS256"]))
        except InvalidTokenError:
            return False
        return (
            (id_ := payload.get("id_")) is not None
            and (key := self._cache.get(id_)) is not None
            and key.name == payload.get("name")
            and key.description == payload.get("description")
            and key.created_at.timestamp() == payload.get("iat")
            and (int(key.expires_at.timestamp()) if key.expires_at else None) == payload.get("exp")
        )

    async def _update_cache(self) -> None:
        async with self._db() as session:
            keys = [
                key
                async for key in await session.stream_scalars(
                    select(models.APIKey)
                    .outerjoin(
                        models.AuditAPIKey,
                        and_(
                            models.APIKey.id == models.AuditAPIKey.api_key_id,
                            models.AuditAPIKey.action == "DELETE",
                        ),
                    )
                    .where(models.AuditAPIKey.id.is_(None))
                )
            ]
        self._cache = {key.id: key for key in keys}

    async def _run(self) -> None:
        while self._running:
            self._tasks.append(create_task(self._update_cache()))
            await self._tasks[-1]
            self._tasks.pop()
            self._tasks.append(create_task(sleep(self._seconds)))
            await self._tasks[-1]
            self._tasks.pop()
