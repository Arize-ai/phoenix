import logging
from abc import abstractmethod
from asyncio import create_task, gather, sleep
from copy import deepcopy
from dataclasses import replace
from datetime import datetime, timezone
from functools import cached_property
from typing import Any, Dict, Generic, List, Optional, Tuple, TypeVar

import jwt
from sqlalchemy import and_, delete, insert, literal, select

from phoenix.auth import (
    JWT_ALGORITHM,
    ClaimSet,
    Token,
)
from phoenix.db import enums, models
from phoenix.db.session import DbSessionFactory
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
    RefreshToken,
    RefreshTokenAttributes,
    RefreshTokenClaims,
    RefreshTokenId,
    TokenId,
)

logger = logging.getLogger(__name__)


class JwtStore:
    def __init__(
        self,
        db: DbSessionFactory,
        secret: str,
        algorithm: str = JWT_ALGORITHM,
        sleep_seconds: int = 10,
        **kwargs: Any,
    ) -> None:
        assert secret
        super().__init__(**kwargs)
        self._secret = secret
        args = (db, secret, algorithm, sleep_seconds)
        self._access_token_store = AccessTokenStore(*args, **kwargs)
        self._refresh_token_store = RefreshTokenStore(*args, **kwargs)
        self._api_key_store = ApiKeyStore(*args, **kwargs)

    @cached_property
    def _stores(self) -> Tuple[DaemonTask, ...]:
        return tuple(dt for dt in self.__dict__.values() if isinstance(dt, _Store))

    async def __aenter__(self) -> None:
        await gather(*(s.__aenter__() for s in self._stores))

    async def __aexit__(self, *args: Any, **kwargs: Any) -> None:
        await gather(*(s.__aexit__(*args, **kwargs) for s in self._stores))

    async def read(self, token: Token) -> Optional[ClaimSet]:
        try:
            payload = jwt.decode(
                token,
                self._secret,
                algorithms=[JWT_ALGORITHM],
                options={"verify_exp": False},
            )
        except jwt.DecodeError:
            return None
        if (jti := payload.get("jti")) is None:
            return None
        if (token_id := TokenId.parse(jti)) is None:
            return None
        if isinstance(token_id, AccessTokenId):
            return await self._access_token_store.get(token_id)
        if isinstance(token_id, RefreshTokenId):
            return await self._refresh_token_store.get(token_id)
        if isinstance(token_id, ApiKeyId):
            return await self._api_key_store.get(token_id)
        return None

    async def create_access_token(
        self,
        claim: AccessTokenClaims,
    ) -> Tuple[AccessToken, AccessTokenId]:
        return await self._access_token_store.create(claim)

    async def create_refresh_token(
        self,
        claim: RefreshTokenClaims,
    ) -> Tuple[RefreshToken, RefreshTokenId]:
        return await self._refresh_token_store.create(claim)

    async def create_api_key(
        self,
        claim: ApiKeyClaims,
    ) -> Tuple[ApiKey, ApiKeyId]:
        return await self._api_key_store.create(claim)

    async def revoke(self, *token_ids: TokenId) -> None:
        if not token_ids:
            return
        access_token_ids: List[AccessTokenId] = []
        refresh_token_ids: List[RefreshTokenId] = []
        api_key_ids: List[ApiKeyId] = []
        for token_id in token_ids:
            if isinstance(token_id, AccessTokenId):
                access_token_ids.append(token_id)
            elif isinstance(token_id, RefreshTokenId):
                refresh_token_ids.append(token_id)
            elif isinstance(token_id, ApiKeyId):
                api_key_ids.append(token_id)
        await gather(
            self._access_token_store.revoke(*access_token_ids),
            self._refresh_token_store.revoke(*refresh_token_ids),
            self._api_key_store.revoke(*api_key_ids),
        )


_TokenT = TypeVar("_TokenT", bound=Token)
_TokenIdT = TypeVar("_TokenIdT", bound=TokenId)
_ClaimSetT = TypeVar("_ClaimSetT", bound=ClaimSet)


class _Claims(Generic[_TokenIdT, _ClaimSetT]):
    def __init__(self) -> None:
        self._cache: Dict[_TokenIdT, _ClaimSetT] = {}

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


class _Store(DaemonTask, Generic[_ClaimSetT, _TokenT, _TokenIdT]):
    def __init__(
        self,
        db: DbSessionFactory,
        secret: str,
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
        payload: Dict[str, Any] = dict(jti=claim.token_id)
        if claim.expiration_time:
            payload["exp"] = int(claim.expiration_time.timestamp())
        return jwt.encode(payload, self._secret, algorithm=self._algorithm)

    async def get(self, token_id: _TokenIdT) -> Optional[_ClaimSetT]:
        return self._claims.get(token_id)

    @abstractmethod
    async def create(self, claim: _ClaimSetT) -> Tuple[_TokenT, _TokenIdT]: ...
    @abstractmethod
    async def revoke(self, *token_ids: _TokenIdT) -> None: ...
    @abstractmethod
    async def _update(self) -> None: ...
    async def _run(self) -> None:
        while self._running:
            self._tasks.append(create_task(self._update()))
            await self._tasks[-1]
            self._tasks.pop()
            self._tasks.append(create_task(sleep(self._seconds)))
            await self._tasks[-1]
            self._tasks.pop()


class AccessTokenStore(_Store[AccessTokenClaims, AccessToken, AccessTokenId]):
    async def create(
        self,
        claim: AccessTokenClaims,
    ) -> Tuple[AccessToken, AccessTokenId]:
        assert claim.expiration_time
        assert claim.subject
        user_id = int(claim.subject)
        async with self._db() as session:
            access_token = await session.scalar(
                insert(models.AccessToken)
                .values(
                    user_id=user_id,
                    created_at=claim.issued_at,
                    expires_at=claim.expiration_time,
                )
                .returning(models.AccessToken)
            )
        assert access_token
        token_id = AccessTokenId(access_token.id)
        claim = replace(claim, token_id=token_id)
        self._claims[token_id] = claim
        token = AccessToken(self._encode(claim))
        return token, token_id

    async def revoke(self, *token_ids: AccessTokenId) -> None:
        for token_id in token_ids:
            self._claims.pop(token_id, None)
        stmt = delete(models.AccessToken).where(models.AccessToken.id.in_(map(int, token_ids)))
        async with self._db() as session:
            await session.execute(stmt)

    async def _update(self) -> None:
        access_token_claims: _Claims[AccessTokenId, AccessTokenClaims] = _Claims()
        async with self._db() as session:
            now = datetime.now(timezone.utc)
            async with session.begin_nested():
                await session.execute(
                    delete(models.AccessToken).where(models.AccessToken.expires_at < now)
                )
            async with session.begin_nested():
                async for access_token, user_role in await session.stream(
                    select(models.AccessToken, models.UserRole.name)
                    .join_from(models.AccessToken, models.User)
                    .join_from(models.User, models.UserRole)
                ):
                    access_token_id = AccessTokenId(access_token.id)
                    access_token_claims[access_token_id] = AccessTokenClaims(
                        token_id=access_token_id,
                        subject=access_token.user_id,
                        issued_at=access_token.created_at,
                        expiration_time=access_token.expires_at,
                        attributes=AccessTokenAttributes(
                            user_role=user_role,
                        ),
                    )
        self._claims = access_token_claims


class RefreshTokenStore(_Store[RefreshTokenClaims, RefreshToken, RefreshTokenId]):
    async def create(
        self,
        claim: RefreshTokenClaims,
    ) -> Tuple[RefreshToken, RefreshTokenId]:
        assert claim.expiration_time
        assert claim.subject
        user_id = int(claim.subject)
        async with self._db() as session:
            access_token = await session.scalar(
                insert(models.RefreshToken)
                .values(
                    user_id=user_id,
                    created_at=claim.issued_at,
                    expires_at=claim.expiration_time,
                )
                .returning(models.RefreshToken)
            )
        assert access_token
        token_id = RefreshTokenId(access_token.id)
        claim = replace(claim, token_id=token_id)
        token = RefreshToken(self._encode(claim))
        self._claims[token_id] = claim
        return token, token_id

    async def revoke(self, *token_ids: RefreshTokenId) -> None:
        for token_id in token_ids:
            self._claims.pop(token_id, None)
        stmt = delete(models.RefreshToken).where(models.RefreshToken.id.in_(map(int, token_ids)))
        async with self._db() as session:
            await session.execute(stmt)

    async def _update(self) -> None:
        access_token_claims: _Claims[RefreshTokenId, RefreshTokenClaims] = _Claims()
        async with self._db() as session:
            now = datetime.now(timezone.utc)
            async with session.begin_nested():
                await session.execute(
                    delete(models.RefreshToken).where(models.RefreshToken.expires_at < now)
                )
            async with session.begin_nested():
                async for access_token, user_role in await session.stream(
                    select(models.RefreshToken, models.UserRole.name)
                    .join_from(models.RefreshToken, models.User)
                    .join_from(models.User, models.UserRole)
                ):
                    access_token_id = RefreshTokenId(access_token.id)
                    access_token_claims[access_token_id] = RefreshTokenClaims(
                        token_id=access_token_id,
                        subject=access_token.user_id,
                        issued_at=access_token.created_at,
                        expiration_time=access_token.expires_at,
                        attributes=RefreshTokenAttributes(
                            user_role=user_role,
                        ),
                    )
        self._claims = access_token_claims


class ApiKeyStore(_Store[ApiKeyClaims, ApiKey, ApiKeyId]):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._cached_system_user_id: Optional[int] = None

    async def _system_user_id(self) -> int:
        if self._cached_system_user_id is not None:
            return self._cached_system_user_id
        async with self._db() as session:
            id_ = await session.scalar(
                select(models.User.id)
                .join(models.UserRole)
                .where(models.UserRole.name == enums.UserRole.ADMIN.value)
                .order_by(models.User.id)
                .limit(1)
            )
        assert id_ is not None
        self._cached_system_user_id = id_
        return id_

    async def create(
        self,
        claim: ApiKeyClaims,
    ) -> Tuple[ApiKey, ApiKeyId]:
        assert claim.attributes
        assert claim.attributes.name
        assert claim.subject
        user_id = int(claim.subject)
        async with self._db() as session:
            api_key = await session.scalar(
                insert(models.ApiKey)
                .values(
                    user_id=user_id,
                    name=claim.attributes.name,
                    description=claim.attributes.description or None,
                    created_at=claim.issued_at,
                    expires_at=claim.expiration_time or None,
                )
                .returning(models.ApiKey)
            )
        assert api_key
        token_id = ApiKeyId(api_key.id)
        claim = replace(claim, token_id=token_id)
        token = ApiKey(self._encode(claim))
        self._claims[token_id] = claim
        return token, token_id

    async def revoke(self, *api_key_ids: ApiKeyId) -> None:
        for api_key_id in api_key_ids:
            self._claims.pop(api_key_id, None)
        system_user_id = await self._system_user_id()
        async with self._db() as session:
            stmt = insert(models.AuditApiKey).from_select(
                ["api_key_id", "user_id", "action"],
                select(
                    models.ApiKey.id,
                    literal(system_user_id),
                    literal("DELETE"),
                ).where(models.ApiKey.id.in_(map(int, api_key_ids))),
            )
            async with session.begin_nested():
                await session.execute(stmt)

    async def _update(self) -> None:
        api_key_claims: _Claims[ApiKeyId, ApiKeyClaims] = _Claims()
        system_user_id = await self._system_user_id()
        async with self._db() as session:
            async with session.begin_nested():
                now = datetime.now(timezone.utc)
                await session.execute(
                    insert(models.AuditApiKey).from_select(
                        ["api_key_id", "user_id", "action"],
                        select(
                            models.ApiKey.id,
                            literal(system_user_id),
                            literal("DELETE"),
                        ).where(models.ApiKey.expires_at < now),
                    )
                )
            async with session.begin_nested():
                async for api_key, user_role in await session.stream(
                    select(models.ApiKey, models.UserRole.name)
                    .join_from(models.ApiKey, models.User)
                    .join_from(models.User, models.UserRole)
                    .outerjoin(
                        models.AuditApiKey,
                        and_(
                            models.AuditApiKey.api_key_id == models.ApiKey.id,
                            models.AuditApiKey.action == "DELETE",
                        ),
                    )
                    .where(models.AuditApiKey.id.is_(None))
                ):
                    api_key_id = ApiKeyId(api_key.id)
                    api_key_claims[api_key_id] = ApiKeyClaims(
                        token_id=api_key_id,
                        subject=api_key.user_id,
                        issued_at=api_key.created_at,
                        expiration_time=api_key.expires_at,
                        attributes=ApiKeyAttributes(
                            user_role=user_role,
                            name=api_key.name,
                            description=api_key.description,
                        ),
                    )
        self._claims = api_key_claims
