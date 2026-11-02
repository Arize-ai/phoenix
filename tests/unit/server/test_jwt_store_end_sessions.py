"""Which credentials end_sessions and end_browser_sessions end, and which they keep."""

from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Literal, Union

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.jwt_store import end_browser_sessions, end_sessions
from phoenix.server.types import DbSessionFactory

_CredentialTable: TypeAlias = Union[
    models.AccessToken,
    models.RefreshToken,
    models.OAuth2AuthorizationCode,
    models.OAuth2Grant,
    models.ApiKey,
    models.PasswordResetToken,
]
_Outcome = Literal["deleted", "revoked", "kept"]
_EXPIRES_AT = datetime.now(timezone.utc) + timedelta(days=1)
_REVOKED_AT = datetime(2026, 1, 1, tzinfo=timezone.utc)


async def _client_id(session: AsyncSession) -> int:
    client = models.OAuth2Client(
        client_id=token_hex(8),
        name="client",
        redirect_uris=["http://127.0.0.1/callback"],
        grant_types=["authorization_code", "refresh_token"],
        token_endpoint_auth_method="none",
    )
    session.add(client)
    await session.flush()
    return client.id


async def _add_password_reset_token(session: AsyncSession, user_id: int) -> None:
    session.add(models.PasswordResetToken(user_id=user_id, expires_at=_EXPIRES_AT))


async def _add_access_and_refresh_token(session: AsyncSession, user_id: int) -> None:
    refresh_token = models.RefreshToken(user_id=user_id, expires_at=_EXPIRES_AT)
    session.add(refresh_token)
    await session.flush()
    session.add(
        models.AccessToken(
            user_id=user_id, expires_at=_EXPIRES_AT, refresh_token_id=refresh_token.id
        )
    )


async def _add_api_key(session: AsyncSession, user_id: int) -> None:
    session.add(models.ApiKey(user_id=user_id, name="key", expires_at=_EXPIRES_AT))


async def _add_oauth2_grants(session: AsyncSession, user_id: int) -> None:
    client_id = await _client_id(session)
    session.add(models.OAuth2Grant(user_id=user_id, oauth2_client_id=client_id))
    session.add(
        models.OAuth2Grant(user_id=user_id, oauth2_client_id=client_id, revoked_at=_REVOKED_AT)
    )


async def _add_oauth2_authorization_code(session: AsyncSession, user_id: int) -> None:
    session.add(
        models.OAuth2AuthorizationCode(
            code_hash=token_hex(16),
            user_id=user_id,
            oauth2_client_id=await _client_id(session),
            redirect_uri="http://127.0.0.1/callback",
            code_challenge=token_hex(16),
            code_challenge_method="S256",
            expires_at=_EXPIRES_AT,
        )
    )


# Every table that holds a credential for a user, with what end_sessions does to it. A
# credential table is one with a foreign key to users and an expires_at column. Adding such a
# table fails test_every_credential_table_is_classified until it is classified here.
_CREDENTIAL_TABLES: dict[
    type[_CredentialTable],
    tuple[_Outcome, Callable[[AsyncSession, int], Awaitable[None]]],
] = {
    models.AccessToken: ("deleted", _add_access_and_refresh_token),
    models.RefreshToken: ("deleted", _add_access_and_refresh_token),
    models.OAuth2AuthorizationCode: ("deleted", _add_oauth2_authorization_code),
    models.OAuth2Grant: ("revoked", _add_oauth2_grants),
    # An API key is a credential the user manages separately from signing in.
    models.ApiKey: ("kept", _add_api_key),
    # A password reset token does not grant access by itself.
    models.PasswordResetToken: ("kept", _add_password_reset_token),
}


def test_every_credential_table_is_classified() -> None:
    credential_tables = {
        mapper.class_
        for mapper in models.Base.registry.mappers
        if mapper.local_table is not None
        and "expires_at" in mapper.local_table.columns
        and any(
            foreign_key.column.table.name == models.User.__tablename__
            for column in mapper.local_table.columns
            for foreign_key in column.foreign_keys
        )
    }
    assert credential_tables == set(_CREDENTIAL_TABLES)


async def _create_user(session: AsyncSession) -> int:
    role_id = await session.scalar(select(models.UserRole.id).limit(1))
    assert role_id is not None
    user = models.LocalUser(
        email=f"{token_hex(8)}@example.com",
        username=token_hex(8),
        user_role_id=role_id,
        reset_password=False,
        password_hash=b"hash",
        password_salt=b"salt",
    )
    session.add(user)
    await session.flush()
    return user.id


async def test_end_sessions_follows_the_classification(db: DbSessionFactory) -> None:
    async with db() as session:
        user_id = await _create_user(session)
        other_user_id = await _create_user(session)
        for add in {add for _, add in _CREDENTIAL_TABLES.values()}:
            await add(session, user_id)
            await add(session, other_user_id)
    async with db() as session:
        access_token_ids, refresh_token_ids = await end_sessions(session, user_id)
    assert len(access_token_ids) == 1 and len(refresh_token_ids) == 1
    async with db() as session:
        for table, (outcome, _) in _CREDENTIAL_TABLES.items():
            rows = (await session.scalars(select(table).where(table.user_id == user_id))).all()
            other_rows = (
                await session.scalars(select(table).where(table.user_id == other_user_id))
            ).all()
            assert other_rows, f"{table.__name__}: another user's rows must be untouched"
            if outcome == "deleted":
                assert rows == [], table.__name__
            elif outcome == "kept":
                assert rows, table.__name__
            else:
                revoked_ats = {
                    row.revoked_at for row in rows if isinstance(row, models.OAuth2Grant)
                }
                # The active grant is revoked now; the revoked grant keeps its original time.
                assert None not in revoked_ats and _REVOKED_AT in revoked_ats
                assert None in {
                    row.revoked_at for row in other_rows if isinstance(row, models.OAuth2Grant)
                }


async def test_end_browser_sessions_keeps_oauth2_sessions(db: DbSessionFactory) -> None:
    async with db() as session:
        user_id = await _create_user(session)
        other_user_id = await _create_user(session)
        for owner_id in (user_id, other_user_id):
            await _add_access_and_refresh_token(session, owner_id)
            await _add_oauth2_authorization_code(session, owner_id)
            grant = models.OAuth2Grant(user_id=owner_id, oauth2_client_id=await _client_id(session))
            session.add(grant)
            await session.flush()
            grant_refresh_token = models.RefreshToken(
                user_id=owner_id, expires_at=_EXPIRES_AT, oauth2_grant_id=grant.id
            )
            session.add(grant_refresh_token)
            await session.flush()
            session.add(
                models.AccessToken(
                    user_id=owner_id,
                    expires_at=_EXPIRES_AT,
                    refresh_token_id=grant_refresh_token.id,
                )
            )
    async with db() as session:
        access_token_ids, refresh_token_ids = await end_browser_sessions(session, user_id)
    assert len(access_token_ids) == 1 and len(refresh_token_ids) == 1
    async with db() as session:
        refresh_tokens = (
            await session.scalars(
                select(models.RefreshToken).where(models.RefreshToken.user_id == user_id)
            )
        ).all()
        access_tokens = (
            await session.scalars(
                select(models.AccessToken).where(models.AccessToken.user_id == user_id)
            )
        ).all()
        grants = (
            await session.scalars(
                select(models.OAuth2Grant).where(models.OAuth2Grant.user_id == user_id)
            )
        ).all()
        codes = (
            await session.scalars(
                select(models.OAuth2AuthorizationCode).where(
                    models.OAuth2AuthorizationCode.user_id == user_id
                )
            )
        ).all()
        other_refresh_tokens = (
            await session.scalars(
                select(models.RefreshToken).where(models.RefreshToken.user_id == other_user_id)
            )
        ).all()
    # Only the grant's tokens remain, and the grant and the pending code are untouched.
    assert [token.oauth2_grant_id for token in refresh_tokens] == [grants[0].id]
    assert [token.refresh_token_id for token in access_tokens] == [refresh_tokens[0].id]
    assert [grant.revoked_at for grant in grants] == [None]
    assert len(codes) == 1
    assert len(other_refresh_tokens) == 2
