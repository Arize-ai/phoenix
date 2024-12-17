from __future__ import annotations

from abc import ABC, abstractmethod
from asyncio import Task, create_task, sleep
from collections import defaultdict
from collections.abc import Callable, Iterator
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Generic, Optional, Protocol, TypeVar, final

from cachetools import LRUCache
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.auth import CanReadToken, ClaimSet, Token, TokenAttributes
from phoenix.db import enums, models
from phoenix.db.helpers import SupportedSQLDialect


class CanSetLastUpdatedAt(Protocol):
    def set(self, table: type[models.Base], id_: int) -> None: ...


class CanGetLastUpdatedAt(Protocol):
    def get(self, table: type[models.Base], id_: Optional[int] = None) -> Optional[datetime]: ...


class DbSessionFactory:
    def __init__(
        self,
        db: Callable[[], AbstractAsyncContextManager[AsyncSession]],
        dialect: str,
    ):
        self._db = db
        self.dialect = SupportedSQLDialect(dialect)

    def __call__(self) -> AbstractAsyncContextManager[AsyncSession]:
        return self._db()


_AnyT = TypeVar("_AnyT")
_ItemT_contra = TypeVar("_ItemT_contra", contravariant=True)


class CanPutItem(Protocol[_ItemT_contra]):
    def put(self, item: _ItemT_contra) -> None: ...


class _Batch(CanPutItem[_AnyT], Protocol[_AnyT]):
    @property
    def empty(self) -> bool: ...
    def clear(self) -> None: ...
    def __iter__(self) -> Iterator[_AnyT]: ...


class _HasBatch(Generic[_ItemT_contra], ABC):
    _batch_factory: Callable[[], _Batch[_ItemT_contra]]

    def __init__(self) -> None:
        self._batch = self._batch_factory()

    def put(self, item: _ItemT_contra) -> None:
        self._batch.put(item)


class DaemonTask(ABC):
    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._running = False
        self._tasks: list[Task[None]] = []

    async def start(self) -> None:
        self._running = True
        if not self._tasks:
            self._tasks.append(create_task(self._run()))

    async def stop(self) -> None:
        self._running = False
        for task in reversed(self._tasks):
            if not task.done():
                task.cancel()
        self._tasks.clear()

    async def __aenter__(self) -> None:
        await self.start()

    async def __aexit__(self, *args: Any, **kwargs: Any) -> None:
        await self.stop()

    @abstractmethod
    async def _run(self) -> None: ...


class BatchedCaller(DaemonTask, _HasBatch[_AnyT], Generic[_AnyT], ABC):
    def __init__(self, *, sleep_seconds: float = 0.1, **kwargs: Any) -> None:
        assert sleep_seconds > 0
        super().__init__(**kwargs)
        self._seconds = sleep_seconds

    @abstractmethod
    async def __call__(self) -> None: ...

    async def _run(self) -> None:
        while self._running:
            self._tasks.append(create_task(sleep(self._seconds)))
            await self._tasks[-1]
            self._tasks.pop()
            if self._batch.empty:
                continue
            self._tasks.append(create_task(self()))
            await self._tasks[-1]
            self._tasks.pop()
            self._batch.clear()


class LastUpdatedAt:
    def __init__(self) -> None:
        self._cache: defaultdict[
            type[models.Base],
            LRUCache[int, datetime],
        ] = defaultdict(lambda: LRUCache(maxsize=100))

    def get(self, table: type[models.Base], id_: Optional[int] = None) -> Optional[datetime]:
        if not (cache := self._cache.get(table)):
            return None
        if id_ is None:
            return max(filter(bool, cache.values()), default=None)
        return cache.get(id_)

    def set(self, table: type[models.Base], id_: int) -> None:
        self._cache[table][id_] = datetime.now(timezone.utc)


class PasswordResetToken(Token): ...


class AccessToken(Token): ...


class RefreshToken(Token): ...


class ApiKey(Token): ...


@dataclass(frozen=True)
class UserTokenAttributes(TokenAttributes):
    user_role: enums.UserRole


@dataclass(frozen=True)
class RefreshTokenAttributes(UserTokenAttributes): ...


@dataclass(frozen=True)
class PasswordResetTokenAttributes(UserTokenAttributes): ...


@dataclass(frozen=True)
class AccessTokenAttributes(UserTokenAttributes):
    refresh_token_id: RefreshTokenId


@dataclass(frozen=True)
class ApiKeyAttributes(UserTokenAttributes):
    name: str
    description: Optional[str] = None


class _DbId(str, ABC):
    table: type[models.Base]

    def __new__(cls, id_: int) -> _DbId:
        assert isinstance(id_, int)
        return super().__new__(cls, f"{cls.table.__name__}:{id_}")

    def __int__(self) -> int:
        return int(self.split(":")[1])

    def __deepcopy__(self, memo: Any) -> _DbId:
        return self


class TokenId(_DbId, ABC):
    @classmethod
    def parse(cls, value: str) -> Optional[TokenId]:
        table_name, _, id_ = value.partition(":")
        if not id_.isnumeric():
            return None
        for sub in cls.__subclasses__():
            if sub.table.__name__ == table_name:
                return sub(int(id_))
        return None


@final
class PasswordResetTokenId(TokenId):
    table = models.PasswordResetToken


@final
class AccessTokenId(TokenId):
    table = models.AccessToken


@final
class RefreshTokenId(TokenId):
    table = models.RefreshToken


@final
class ApiKeyId(TokenId):
    table = models.ApiKey


@final
class UserId(_DbId):
    table = models.User


@dataclass(frozen=True)
class UserClaimSet(ClaimSet):  # type: ignore[override,unused-ignore]
    subject: Optional[UserId] = None
    attributes: Optional[UserTokenAttributes] = None


@dataclass(frozen=True)
class PasswordResetTokenClaims(UserClaimSet):  # type: ignore[override,unused-ignore]
    token_id: Optional[PasswordResetTokenId] = None
    attributes: Optional[PasswordResetTokenAttributes] = None


@dataclass(frozen=True)
class AccessTokenClaims(UserClaimSet):  # type: ignore[override,unused-ignore]
    token_id: Optional[AccessTokenId] = None
    attributes: Optional[AccessTokenAttributes] = None


@dataclass(frozen=True)
class RefreshTokenClaims(UserClaimSet):  # type: ignore[override,unused-ignore]
    token_id: Optional[RefreshTokenId] = None
    attributes: Optional[RefreshTokenAttributes] = None


@dataclass(frozen=True)
class ApiKeyClaims(UserClaimSet):  # type: ignore[override,unused-ignore]
    token_id: Optional[ApiKeyId] = None
    attributes: Optional[ApiKeyAttributes] = None


class CanRevokeTokens(Protocol):
    async def revoke(self, *token_ids: TokenId) -> None: ...


class CanLogOutUser(Protocol):
    async def log_out(self, user_id: UserId) -> None: ...


class TokenStore(CanReadToken, CanRevokeTokens, CanLogOutUser, Protocol):
    async def create_password_reset_token(
        self,
        claims: PasswordResetTokenClaims,
    ) -> tuple[PasswordResetToken, PasswordResetTokenId]: ...
    async def create_access_token(
        self,
        claims: AccessTokenClaims,
    ) -> tuple[AccessToken, AccessTokenId]: ...
    async def create_refresh_token(
        self,
        claims: RefreshTokenClaims,
    ) -> tuple[RefreshToken, RefreshTokenId]: ...
    async def create_api_key(
        self,
        claims: ApiKeyClaims,
    ) -> tuple[ApiKey, ApiKeyId]: ...
