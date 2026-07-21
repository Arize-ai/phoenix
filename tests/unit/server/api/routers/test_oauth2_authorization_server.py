from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Optional

import pytest
from sqlalchemy import select
from starlette.types import ASGIApp

from phoenix.db import models
from phoenix.server.api.routers import oauth2_authorization_server as auth_server
from phoenix.server.api.routers.oauth2_authorization_server import (
    _cleanup_abandoned_dcr_clients,
)
from phoenix.server.types import DbSessionFactory


class TestCleanupAbandonedDcrClients:
    """Dynamic registration lets any caller create clients, so abandoned ones are swept.

    The sweep narrows to deletion candidates in SQL before inspecting them, which is only
    safe if the narrowing cannot exclude a client the rules would have deleted. These cases
    pin that down from both sides: every client that should die does, and every client that
    should survive does.
    """

    @pytest.fixture(autouse=True)
    async def _reset_cleanup_clock(self) -> None:
        # The sweep runs at most once a day, tracked in module state. Each case needs it to
        # actually run, not to be skipped because an earlier case just ran it.
        auth_server._last_dcr_cleanup_at = None

    async def _user_id(self, db: DbSessionFactory) -> int:
        async with db() as session:
            role_id = await session.scalar(select(models.UserRole.id).limit(1))
            user = models.User(
                email=f"{token_hex(8)}@example.com",
                username=token_hex(8),
                user_role_id=role_id,
                reset_password=False,
                auth_method="LOCAL",
                password_hash=b"hash",
                password_salt=b"salt",
            )
            session.add(user)
            await session.flush()
            return user.id

    async def _add_client(
        self,
        db: DbSessionFactory,
        *,
        client_id: str,
        created_at: datetime,
    ) -> int:
        async with db() as session:
            client = models.OAuth2Client(
                client_id=client_id,
                name="client",
                redirect_uris=["http://127.0.0.1/callback"],
                grant_types=["authorization_code", "refresh_token"],
                token_endpoint_auth_method="none",
                is_first_party=False,
                created_at=created_at,
            )
            session.add(client)
            await session.flush()
            return client.id

    async def _add_grant(
        self,
        db: DbSessionFactory,
        *,
        client_pk: int,
        user_id: int,
        revoked_at: Optional[datetime] = None,
        expires_at: Optional[datetime] = None,
    ) -> None:
        async with db() as session:
            session.add(
                models.OAuth2Grant(
                    user_id=user_id,
                    oauth2_client_id=client_pk,
                    revoked_at=revoked_at,
                    expires_at=expires_at,
                )
            )

    async def test_sweep_deletes_only_abandoned_clients(
        self,
        asgi_app: ASGIApp,
        db: DbSessionFactory,
    ) -> None:
        now = datetime.now(timezone.utc)
        long_ago = now - timedelta(days=100)
        user_id = await self._user_id(db)

        # Registered but never used, and old enough to have timed out.
        stale_unused = await self._add_client(db, client_id="px_dcr_stale", created_at=long_ago)
        # Never used, past the zero-grant deadline but younger than the dead-grant one. This
        # is the case that pins down which cutoff bounds the candidate query: bound it by the
        # earlier of the two and this client is silently excluded and never swept.
        stale_between_cutoffs = await self._add_client(
            db, client_id="px_dcr_between", created_at=now - timedelta(days=10)
        )
        # Registered but never used, still inside its grace period.
        fresh_unused = await self._add_client(
            db, client_id="px_dcr_fresh", created_at=now - timedelta(days=1)
        )
        # Still in active use — the grant never expires and was never revoked.
        live = await self._add_client(db, client_id="px_dcr_live", created_at=long_ago)
        await self._add_grant(db, client_pk=live, user_id=user_id)
        # Its only grant was revoked long ago.
        long_dead = await self._add_client(db, client_id="px_dcr_long_dead", created_at=long_ago)
        await self._add_grant(
            db, client_pk=long_dead, user_id=user_id, revoked_at=now - timedelta(days=60)
        )
        # Its only grant expired long ago, rather than being revoked.
        long_expired = await self._add_client(db, client_id="px_dcr_expired", created_at=long_ago)
        await self._add_grant(
            db, client_pk=long_expired, user_id=user_id, expires_at=now - timedelta(days=60)
        )
        # Recently revoked: dead, but not yet dead long enough.
        just_dead = await self._add_client(db, client_id="px_dcr_just_dead", created_at=long_ago)
        await self._add_grant(
            db, client_pk=just_dead, user_id=user_id, revoked_at=now - timedelta(days=1)
        )
        # One grant is long dead, but another is still live, so the client is still in use.
        mixed = await self._add_client(db, client_id="px_dcr_mixed", created_at=long_ago)
        await self._add_grant(
            db, client_pk=mixed, user_id=user_id, revoked_at=now - timedelta(days=60)
        )
        await self._add_grant(db, client_pk=mixed, user_id=user_id)
        # A client that was not dynamically registered is never swept, however old and
        # unused it looks — only the px_dcr_ population is subject to these rules.
        seeded = await self._add_client(db, client_id="seeded-client", created_at=long_ago)

        async with db() as session:
            await _cleanup_abandoned_dcr_clients(session, now=now)

        async with db() as session:
            surviving = set(await session.scalars(select(models.OAuth2Client.id)))

        assert stale_unused not in surviving
        assert stale_between_cutoffs not in surviving
        assert long_dead not in surviving
        assert long_expired not in surviving
        assert {fresh_unused, live, just_dead, mixed, seeded} <= surviving
