import logging
from abc import ABC, abstractmethod
from asyncio import create_task, gather, sleep
from collections.abc import Callable, Coroutine
from copy import deepcopy
from dataclasses import replace
from datetime import datetime, timezone
from functools import cached_property, singledispatchmethod
from typing import Any, Generic, Optional, TypeVar

from authlib.jose import jwt
from authlib.jose.errors import JoseError
from sqlalchemy import Select, delete, select
from starlette.datastructures import Secret

from phoenix.auth import (
    JWT_ALGORITHM,
    ClaimSet,
    Token,
)
from phoenix.config import get_env_enable_prometheus
from phoenix.db import models
from phoenix.db.models import UserRoleName
from phoenix.server.types import (
    AccessToken,
    AccessTokenAttributes,
    AccessTokenClaims,
    AccessTokenId,
    ApiKey,
    ApiKeyAttributes,
    ApiKeyClaims,
    ApiKeyId,
    DaemonTask,
    DbSessionFactory,
    PasswordResetToken,
    PasswordResetTokenAttributes,
    PasswordResetTokenClaims,
    PasswordResetTokenId,
    RefreshToken,
    RefreshTokenAttributes,
    RefreshTokenClaims,
    RefreshTokenId,
    TokenId,
    UserId,
)

logger = logging.getLogger(__name__)


class JwtStore:
    def __init__(
        self,
        db: DbSessionFactory,
        secret: Secret,
        algorithm: str = JWT_ALGORITHM,
        sleep_seconds: int = 10,
        **kwargs: Any,
    ) -> None:
        assert secret
        super().__init__(**kwargs)
        self._db = db
        self._secret = secret
        args = (db, secret, algorithm, sleep_seconds)
        self._password_reset_token_store = _PasswordResetTokenStore(*args, **kwargs)
        self._access_token_store = _AccessTokenStore(*args, **kwargs)
        self._refresh_token_store = _RefreshTokenStore(*args, **kwargs)
        self._api_key_store = _ApiKeyStore(*args, **kwargs)

    @cached_property
    def _stores(self) -> tuple[DaemonTask, ...]:
        return tuple(dt for dt in self.__dict__.values() if isinstance(dt, _Store))

    async def __aenter__(self) -> None:
        await gather(*(s.__aenter__() for s in self._stores))

    async def __aexit__(self, *args: Any, **kwargs: Any) -> None:
        await gather(*(s.__aexit__(*args, **kwargs) for s in self._stores))

    async def read(self, token: Token) -> Optional[ClaimSet]:
        try:
            payload = jwt.decode(
                s=token,
                key=str(self._secret),
            )
        except JoseError:
            return None
        if (jti := payload.get("jti")) is None:
            return None
        if (token_id := TokenId.parse(jti)) is None:
            return None
        return await self._get(token_id)

    @singledispatchmethod
    async def _get(self, _: TokenId) -> Optional[ClaimSet]:
        return None

    @_get.register
    async def _(self, token_id: PasswordResetTokenId) -> Optional[ClaimSet]:
        return await self._password_reset_token_store.get(token_id)

    @_get.register
    async def _(self, token_id: AccessTokenId) -> Optional[ClaimSet]:
        return await self._access_token_store.get(token_id)

    @_get.register
    async def _(self, token_id: RefreshTokenId) -> Optional[ClaimSet]:
        return await self._refresh_token_store.get(token_id)

    @_get.register
    async def _(self, token_id: ApiKeyId) -> Optional[ClaimSet]:
        return await self._api_key_store.get(token_id)

    @singledispatchmethod
    async def _evict(self, _: TokenId) -> Optional[ClaimSet]:
        return None

    @_evict.register
    async def _(self, token_id: PasswordResetTokenId) -> Optional[ClaimSet]:
        return await self._password_reset_token_store.evict(token_id)

    @_evict.register
    async def _(self, token_id: AccessTokenId) -> Optional[ClaimSet]:
        return await self._access_token_store.evict(token_id)

    @_evict.register
    async def _(self, token_id: RefreshTokenId) -> Optional[ClaimSet]:
        return await self._refresh_token_store.evict(token_id)

    @_evict.register
    async def _(self, token_id: ApiKeyId) -> Optional[ClaimSet]:
        return await self._api_key_store.evict(token_id)

    async def create_password_reset_token(
        self,
        claim: PasswordResetTokenClaims,
    ) -> tuple[PasswordResetToken, PasswordResetTokenId]:
        return await self._password_reset_token_store.create(claim)

    async def create_access_token(
        self,
        claim: AccessTokenClaims,
    ) -> tuple[AccessToken, AccessTokenId]:
        return await self._access_token_store.create(claim)

    async def create_refresh_token(
        self,
        claim: RefreshTokenClaims,
    ) -> tuple[RefreshToken, RefreshTokenId]:
        return await self._refresh_token_store.create(claim)

    async def create_api_key(
        self,
        claim: ApiKeyClaims,
    ) -> tuple[ApiKey, ApiKeyId]:
        return await self._api_key_store.create(claim)

    async def revoke(self, *token_ids: TokenId) -> None:
        if not token_ids:
            return
        password_reset_token_ids: list[PasswordResetTokenId] = []
        access_token_ids: list[AccessTokenId] = []
        refresh_token_ids: list[RefreshTokenId] = []
        api_key_ids: list[ApiKeyId] = []
        for token_id in token_ids:
            if isinstance(token_id, PasswordResetTokenId):
                password_reset_token_ids.append(token_id)
            if isinstance(token_id, AccessTokenId):
                access_token_ids.append(token_id)
            elif isinstance(token_id, RefreshTokenId):
                refresh_token_ids.append(token_id)
            elif isinstance(token_id, ApiKeyId):
                api_key_ids.append(token_id)
        coroutines: list[Coroutine[None, None, None]] = []
        if password_reset_token_ids:
            coroutines.append(self._password_reset_token_store.revoke(*password_reset_token_ids))
        if access_token_ids:
            coroutines.append(self._access_token_store.revoke(*access_token_ids))
        if refresh_token_ids:
            coroutines.append(self._refresh_token_store.revoke(*refresh_token_ids))
        if api_key_ids:
            coroutines.append(self._api_key_store.revoke(*api_key_ids))
        await gather(*coroutines)

    async def log_out(self, user_id: UserId) -> None:
        for cls in (AccessTokenId, RefreshTokenId):
            table = cls.table
            stmt = delete(table).where(table.user_id == int(user_id)).returning(table.id)
            async with self._db() as session:
                async for id_ in await session.stream_scalars(stmt):
                    await self._evict(cls(id_))


_TokenT = TypeVar("_TokenT", bound=Token)
_TokenIdT = TypeVar("_TokenIdT", bound=TokenId)
_ClaimSetT = TypeVar("_ClaimSetT", bound=ClaimSet)
_RecordT = TypeVar(
    "_RecordT",
    models.PasswordResetToken,
    models.AccessToken,
    models.RefreshToken,
    models.ApiKey,
)


class _Claims(Generic[_TokenIdT, _ClaimSetT]):
    def __init__(self) -> None:
        self._cache: dict[_TokenIdT, _ClaimSetT] = {}

    def __getitem__(self, token_id: _TokenIdT) -> Optional[_ClaimSetT]:
        claim = self._cache.get(token_id)
        return deepcopy(claim) if claim else None

    def __setitem__(self, token_id: _TokenIdT, claim: _ClaimSetT) -> None:
        self._cache[token_id] = deepcopy(claim)

    def get(self, token_id: _TokenIdT) -> Optional[_ClaimSetT]:
        claim = self._cache.get(token_id)
        return deepcopy(claim) if claim else None

    def pop(
        self, token_id: _TokenIdT, default: Optional[_ClaimSetT] = None
    ) -> Optional[_ClaimSetT]:
        claim = self._cache.pop(token_id, default)
        return deepcopy(claim) if claim else None


class _Store(DaemonTask, Generic[_ClaimSetT, _TokenT, _TokenIdT, _RecordT], ABC):
    _table: type[_RecordT]
    _token_id: Callable[[int], _TokenIdT]
    _token: Callable[[str], _TokenT]

    def __init__(
        self,
        db: DbSessionFactory,
        secret: Secret,
        algorithm: str = JWT_ALGORITHM,
        sleep_seconds: int = 10,
        **kwargs: Any,
    ) -> None:
        assert secret
        super().__init__(**kwargs)
        self._db = db
        self._seconds = sleep_seconds
        self._claims: _Claims[_TokenIdT, _ClaimSetT] = _Claims()
        self._secret = secret
        self._algorithm = algorithm

    def _encode(self, claim: ClaimSet) -> str:
        payload: dict[str, Any] = dict(jti=claim.token_id)
        header = {"alg": self._algorithm}
        jwt_bytes: bytes = jwt.encode(header=header, payload=payload, key=str(self._secret))
        return jwt_bytes.decode()

    async def get(self, token_id: _TokenIdT) -> Optional[_ClaimSetT]:
        if claims := self._claims.get(token_id):
            return claims
        stmt = self._update_stmt.where(self._table.id == int(token_id))
        async with self._db() as session:
            record = (await session.execute(stmt)).first()
        if not record:
            return None
        token, role = record
        _, claims = self._from_db(token, role)
        self._claims[token_id] = claims
        return claims

    async def evict(self, token_id: _TokenIdT) -> Optional[_ClaimSetT]:
        return self._claims.pop(token_id, None)

    async def revoke(self, *token_ids: _TokenIdT) -> None:
        if not token_ids:
            return
        for token_id in token_ids:
            await self.evict(token_id)
        stmt = delete(self._table).where(self._table.id.in_(map(int, token_ids)))
        async with self._db() as session:
            await session.execute(stmt)

    @abstractmethod
    def _from_db(self, record: _RecordT, role: UserRoleName) -> tuple[_TokenIdT, _ClaimSetT]: ...

    @abstractmethod
    def _to_db(self, claims: _ClaimSetT) -> _RecordT: ...

    async def create(self, claim: _ClaimSetT) -> tuple[_TokenT, _TokenIdT]:
        record = self._to_db(claim)
        async with self._db() as session:
            session.add(record)
            await session.flush()
        token_id = self._token_id(record.id)
        claim = replace(claim, token_id=token_id)
        self._claims[token_id] = claim
        token = self._token(self._encode(claim))
        return token, token_id

    async def _update(self) -> None:
        claims: _Claims[_TokenIdT, _ClaimSetT] = _Claims()
        async with self._db() as session:
            async with session.begin_nested():
                await self._delete_expired_tokens(session)
            async with session.begin_nested():
                async for record, role in await session.stream(self._update_stmt):
                    token_id, claim_set = self._from_db(record, role)
                    claims[token_id] = claim_set
        self._claims = claims

    @cached_property
    def _update_stmt(self) -> Select[tuple[_RecordT, UserRoleName]]:
        return (
            select(self._table, models.UserRole.name)
            .join_from(self._table, models.User)
            .join_from(models.User, models.UserRole)
        )

    async def _delete_expired_tokens(self, session: Any) -> None:
        now = datetime.now(timezone.utc)
        await session.execute(delete(self._table).where(self._table.expires_at < now))

    async def _run(self) -> None:
        while self._running:
            self._tasks.append(create_task(self._update()))
            await self._tasks[-1]
            self._tasks.pop()
            self._tasks.append(create_task(sleep(self._seconds)))
            await self._tasks[-1]
            self._tasks.pop()


class _PasswordResetTokenStore(
    _Store[
        PasswordResetTokenClaims,
        PasswordResetToken,
        PasswordResetTokenId,
        models.PasswordResetToken,
    ]
):
    _table = models.PasswordResetToken
    _token_id = PasswordResetTokenId
    _token = PasswordResetToken

    def _from_db(
        self,
        record: models.PasswordResetToken,
        user_role: UserRoleName,
    ) -> tuple[PasswordResetTokenId, PasswordResetTokenClaims]:
        token_id = PasswordResetTokenId(record.id)
        return token_id, PasswordResetTokenClaims(
            token_id=token_id,
            subject=UserId(record.user_id),
            issued_at=record.created_at,
            expiration_time=record.expires_at,
            attributes=PasswordResetTokenAttributes(
                user_role=user_role,
            ),
        )

    def _to_db(self, claim: PasswordResetTokenClaims) -> models.PasswordResetToken:
        assert claim.expiration_time
        assert claim.subject
        user_id = int(claim.subject)
        return models.PasswordResetToken(
            user_id=user_id,
            created_at=claim.issued_at,
            expires_at=claim.expiration_time,
        )


class _AccessTokenStore(
    _Store[
        AccessTokenClaims,
        AccessToken,
        AccessTokenId,
        models.AccessToken,
    ]
):
    _table = models.AccessToken
    _token_id = AccessTokenId
    _token = AccessToken

    def _from_db(
        self,
        record: models.AccessToken,
        user_role: UserRoleName,
    ) -> tuple[AccessTokenId, AccessTokenClaims]:
        token_id = AccessTokenId(record.id)
        refresh_token_id = RefreshTokenId(record.refresh_token_id)
        return token_id, AccessTokenClaims(
            token_id=token_id,
            subject=UserId(record.user_id),
            issued_at=record.created_at,
            expiration_time=record.expires_at,
            attributes=AccessTokenAttributes(
                user_role=user_role,
                refresh_token_id=refresh_token_id,
            ),
        )

    def _to_db(self, claim: AccessTokenClaims) -> models.AccessToken:
        assert claim.expiration_time
        assert claim.subject
        user_id = int(claim.subject)
        assert claim.attributes
        refresh_token_id = int(claim.attributes.refresh_token_id)
        return models.AccessToken(
            user_id=user_id,
            created_at=claim.issued_at,
            expires_at=claim.expiration_time,
            refresh_token_id=refresh_token_id,
        )


class _RefreshTokenStore(
    _Store[
        RefreshTokenClaims,
        RefreshToken,
        RefreshTokenId,
        models.RefreshToken,
    ]
):
    _table = models.RefreshToken
    _token_id = RefreshTokenId
    _token = RefreshToken

    def _from_db(
        self,
        record: models.RefreshToken,
        user_role: UserRoleName,
    ) -> tuple[RefreshTokenId, RefreshTokenClaims]:
        token_id = RefreshTokenId(record.id)
        return token_id, RefreshTokenClaims(
            token_id=token_id,
            subject=UserId(record.user_id),
            issued_at=record.created_at,
            expiration_time=record.expires_at,
            attributes=RefreshTokenAttributes(
                user_role=user_role,
            ),
        )

    def _to_db(self, claims: RefreshTokenClaims) -> models.RefreshToken:
        assert claims.expiration_time
        assert claims.subject
        user_id = int(claims.subject)
        return models.RefreshToken(
            user_id=user_id,
            created_at=claims.issued_at,
            expires_at=claims.expiration_time,
        )

    async def _update(self) -> None:
        await super()._update()
        if get_env_enable_prometheus():
            from phoenix.server.prometheus import JWT_STORE_TOKENS_ACTIVE

            JWT_STORE_TOKENS_ACTIVE.set(len(self._claims._cache))


class _ApiKeyStore(
    _Store[
        ApiKeyClaims,
        ApiKey,
        ApiKeyId,
        models.ApiKey,
    ]
):
    _table = models.ApiKey
    _token_id = ApiKeyId
    _token = ApiKey

    def _from_db(
        self,
        record: models.ApiKey,
        user_role: UserRoleName,
    ) -> tuple[ApiKeyId, ApiKeyClaims]:
        token_id = ApiKeyId(record.id)
        return token_id, ApiKeyClaims(
            token_id=token_id,
            subject=UserId(record.user_id),
            issued_at=record.created_at,
            expiration_time=record.expires_at,
            attributes=ApiKeyAttributes(
                user_role=user_role,
                name=record.name,
                description=record.description,
            ),
        )

    def _to_db(self, claims: ApiKeyClaims) -> models.ApiKey:
        assert claims.attributes
        assert claims.attributes.name
        assert claims.subject
        user_id = int(claims.subject)
        return models.ApiKey(
            user_id=user_id,
            name=claims.attributes.name,
            description=claims.attributes.description or None,
            created_at=claims.issued_at,
            expires_at=claims.expiration_time or None,
        )

    async def _update(self) -> None:
        await super()._update()
        if get_env_enable_prometheus():
            from phoenix.server.prometheus import JWT_STORE_API_KEYS_ACTIVE

            JWT_STORE_API_KEYS_ACTIVE.set(len(self._claims._cache))
