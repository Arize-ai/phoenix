import logging
from asyncio import create_task, sleep
from dataclasses import replace
from datetime import datetime, timezone
from typing import Any, Dict, Tuple, Union

import jwt
from sqlalchemy import ScalarSelect, delete, func, insert, literal, select
from typing_extensions import assert_never

from phoenix.auth import (
    JWT_ALGORITHM,
    ApiKeyAttributes,
    ApiKeyDbId,
    Claim,
    Issuer,
    SessionAttributes,
    SessionTokenDbId,
    Token,
    TokenId,
)
from phoenix.db import models
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)


class JwtTokenStore(DaemonTask):
    def __init__(
        self,
        db: DbSessionFactory,
        secret: str,
        algorithm: str = JWT_ALGORITHM,
        sleep_seconds: int = 1,
        **kwargs: Any,
    ) -> None:
        assert secret
        super().__init__(**kwargs)
        self._db = db
        self._seconds = sleep_seconds
        self._cached_api_keys: Dict[TokenId, Claim] = {}
        self._cached_user_sessions: Dict[TokenId, Claim] = {}
        self._deny_list: Dict[TokenId, Claim] = {}
        self._secret = secret
        self._algorithm = algorithm
        self._system_user_id: ScalarSelect[int] = (
            select(func.min(models.User.id).label("user_id"))
            .join(models.UserRole)
            .where(models.UserRole.name == "SYSTEM")
            .scalar_subquery()
        )

    async def create(self, claim: Claim) -> Tuple[Token, int]:
        assert claim.user_id is not None
        assert claim.issuer is not None
        assert claim.attributes
        assert claim.attributes.user_role is not None
        if isinstance(claim.attributes, ApiKeyAttributes):
            assert claim.issuer is Issuer.API_KEY
            assert claim.attributes.name
            async with self._db() as session:
                api_key = await session.scalar(
                    insert(models.ApiKey)
                    .values(
                        user_id=claim.user_id,
                        name=claim.attributes.name,
                        description=claim.attributes.description or None,
                        expires_at=claim.expiration_time or None,
                    )
                    .returning(models.ApiKey)
                )
            assert api_key
            token_id = _token_id(claim.issuer, api_key.id)
            self._cached_api_keys[token_id] = Claim(
                token_id=token_id,
                user_id=api_key.user_id,
                issuer=Issuer.API_KEY,
                issued_at=api_key.created_at,
                expiration_time=api_key.expires_at,
                attributes=ApiKeyAttributes(
                    user_role=claim.attributes.user_role,
                    name=api_key.name,
                    description=api_key.description,
                ),
            )
            id_attr = api_key.id
        elif isinstance(claim.attributes, SessionAttributes):
            assert claim.issuer is Issuer.SESSION
            async with self._db() as session:
                user_session = await session.scalar(
                    insert(models.UserSession)
                    .values(user_id=claim.user_id)
                    .returning(models.UserSession)
                )
            assert user_session
            token_id = _token_id(claim.issuer, user_session.id)
            self._cached_user_sessions[token_id] = Claim(
                token_id=token_id,
                user_id=user_session.user_id,
                issuer=Issuer.SESSION,
                issued_at=user_session.created_at,
                expiration_time=user_session.expires_at,
                attributes=SessionAttributes(
                    user_role=claim.attributes.user_role,
                ),
            )
            id_attr = user_session.id
        else:
            assert_never(claim.attributes)
        return jwt.encode(dict(jti=token_id), self._secret, algorithm=self._algorithm), id_attr

    async def read(self, token: Token) -> Claim:
        claim = Claim()
        try:
            payload = jwt.decode(token, self._secret, algorithms=[self._algorithm])
        except jwt.DecodeError:
            return claim
        if (jti := payload.get("jti")) is None:
            return claim
        if jti in self._cached_api_keys:
            claim = self._cached_api_keys[jti]
        elif jti in self._cached_user_sessions:
            claim = self._cached_user_sessions[jti]
        if jti in self._deny_list:
            claim = replace(claim, token_id=None)
        return claim

    async def revoke(self, token: Union[Token, ApiKeyDbId, SessionTokenDbId]) -> None:
        if isinstance(token, str):
            claim = await self.read(token)
            if (token_id := claim.token_id) is None:
                return
        elif isinstance(token, ApiKeyDbId):
            token_id, claim = _token_id(Issuer.API_KEY, token.id_), Claim()
        elif isinstance(token, SessionTokenDbId):
            token_id, claim = _token_id(Issuer.SESSION, token.id_), Claim()
        else:
            assert_never(token)
        if (
            token_id in self._cached_user_sessions
            or claim.issuer is Issuer.SESSION
            or isinstance(token, SessionTokenDbId)
        ):
            _, id_ = _parse_token_id(token_id)
            user_id = (
                select(models.UserSession.user_id)
                .where(models.UserSession.id == id_)
                .scalar_subquery()
            )
            async with self._db() as session:
                deleted_sessions = await session.stream_scalars(
                    delete(models.UserSession)
                    .where(models.UserSession.user_id == user_id)
                    .returning(models.UserSession.id)
                )
                async for id_ in deleted_sessions:
                    deleted_token_id = _token_id(Issuer.SESSION, id_)
                    self._cached_user_sessions.pop(deleted_token_id, None)
        elif token_id in self._cached_user_sessions or isinstance(token, ApiKeyDbId):
            _, id_ = _parse_token_id(token_id)
            async with self._db() as session:
                deleted_id = await session.scalar(
                    insert(models.AuditApiKey)
                    .values(dict(api_key_id=id_, user_id=self._system_user_id, action="DELETE"))
                    .returning(models.AuditApiKey.id)
                )
            if deleted_id is not None:
                deleted_token_id = _token_id(Issuer.API_KEY, deleted_id)
                self._cached_user_sessions.pop(deleted_token_id, None)

    async def _update(self) -> None:
        now = datetime.now(timezone.utc)
        async with self._db() as session:
            async with session.begin_nested():
                await session.execute(
                    delete(models.UserSession).where(models.UserSession.expires_at < now)
                )
                cached_user_sessions = {}
                async for user_session, user_role in await session.stream(
                    select(models.UserSession, models.UserRole.name)
                    .join_from(models.UserSession, models.User)
                    .join_from(models.User, models.UserRole)
                ):
                    token_id = _token_id(Issuer.SESSION, user_session.id)
                    cached_user_sessions[token_id] = Claim(
                        token_id=token_id,
                        user_id=user_session.user_id,
                        issuer=Issuer.SESSION,
                        issued_at=user_session.created_at,
                        expiration_time=user_session.expires_at,
                        attributes=SessionAttributes(
                            user_role=user_role,
                        ),
                    )
                self._cached_user_sessions = cached_user_sessions
            async with session.begin_nested():
                await session.execute(
                    insert(models.AuditApiKey).from_select(
                        ["api_key_id", "user_id", "action"],
                        select(
                            models.ApiKey.id.label("api_key_id"),
                            self._system_user_id,
                            literal("DELETE").label("action"),
                        ).where(models.ApiKey.expires_at < now),
                    )
                )
                cached_api_keys = {}
                async for api_key, user_role in await session.stream(
                    select(models.ApiKey, models.UserRole.name)
                    .join_from(models.ApiKey, models.User)
                    .join_from(models.User, models.UserRole)
                    .outerjoin(
                        models.AuditApiKey,
                        models.AuditApiKey.api_key_id == models.ApiKey.id,
                    )
                    .where(models.AuditApiKey.id.is_(None))
                ):
                    token_id = _token_id(Issuer.API_KEY, api_key.id)
                    cached_api_keys[token_id] = Claim(
                        token_id=token_id,
                        user_id=api_key.user_id,
                        issuer=Issuer.API_KEY,
                        issued_at=api_key.created_at,
                        expiration_time=api_key.expires_at,
                        attributes=ApiKeyAttributes(
                            user_role=user_role,
                            name=api_key.name,
                            description=api_key.description,
                        ),
                    )
                self._cached_api_keys = cached_api_keys

    async def _run(self) -> None:
        while self._running:
            self._tasks.append(create_task(self._update()))
            await self._tasks[-1]
            self._tasks.pop()
            self._tasks.append(create_task(sleep(self._seconds)))
            await self._tasks[-1]
            self._tasks.pop()


_SEPARATOR = "~"


def _token_id(issuer: Issuer, id_: int) -> TokenId:
    return f"{issuer.value}{_SEPARATOR}{id_}"


def _parse_token_id(token_id: TokenId) -> Tuple[Issuer, int]:
    issuer, _, id_ = token_id.partition(_SEPARATOR)
    return Issuer(int(issuer)), int(id_)
