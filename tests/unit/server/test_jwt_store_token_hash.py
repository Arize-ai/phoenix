"""Issuance hashes prevent token forgery with a seed-derived signing key."""

from __future__ import annotations

import base64
import contextlib
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from pathlib import Path
from secrets import token_hex

import httpx
import pytest
from asgi_lifespan import LifespanManager
from joserfc import jwt
from joserfc.jwk import OctKey
from pydantic import SecretStr
from sqlalchemy import select, update

from phoenix.auth import DEFAULT_ADMIN_EMAIL, TOKEN_RANDOM_CLAIM, Token, compute_token_hash
from phoenix.config import get_env_app_auth_kwargs
from phoenix.db import models
from phoenix.db.engines import create_engine
from phoenix.server.app import _db, create_app
from phoenix.server.deployment_secret import (
    TOKEN_SIGNING_KEY_PURPOSE,
    derive_deployment_key,
    load_deployment_seed,
)
from phoenix.server.jwt_store import JwtStore
from phoenix.server.types import (
    ApiKeyAttributes,
    ApiKeyClaims,
    ApiKeyId,
    DbSessionFactory,
    RefreshTokenAttributes,
    RefreshTokenClaims,
    UserId,
)
from phoenix.settings import Settings
from tests.unit.conftest import (
    TestBulkInserter,
    patch_dml_event_handler,
    patch_grpc_server,
    patch_online_eval_daemons,
)

_SEED = b"\x11" * 32


async def _create_user(db: DbSessionFactory) -> UserId:
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
        return UserId(user.id)


def _api_key_claims(user_id: UserId) -> ApiKeyClaims:
    now = datetime.now(timezone.utc)
    return ApiKeyClaims(
        subject=user_id,
        issued_at=now,
        expiration_time=now + timedelta(days=1),
        attributes=ApiKeyAttributes(user_role="ADMIN", name="key"),
    )


def _derived_key(seed: bytes = _SEED) -> bytes:
    return derive_deployment_key(
        seed=seed,
        secret=SecretStr(""),
        purpose=TOKEN_SIGNING_KEY_PURPOSE,
    )


def _store(db: DbSessionFactory, key: str | bytes, *, require_stored_hash: bool) -> JwtStore:
    store = JwtStore(db)
    store.set_signing_key(key, require_stored_hash=require_stored_hash)
    return store


def _derived_store(db: DbSessionFactory, seed: bytes = _SEED) -> JwtStore:
    return _store(db, _derived_key(seed), require_stored_hash=True)


def _sign(key: str | bytes, payload: dict[str, object]) -> Token:
    return Token(jwt.encode({"alg": "HS256"}, payload, OctKey.import_key(key)))


def _random_claim(key: str | bytes, token: Token) -> str:
    value = jwt.decode(str(token), OctKey.import_key(key)).claims[TOKEN_RANDOM_CLAIM]
    assert isinstance(value, str)
    return value


def _decode_random_claim(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _hmac_key(key: str | bytes) -> bytes:
    return key.encode("utf-8") if isinstance(key, str) else key


def _sign_bytes(key: str | bytes, payload: bytes) -> Token:
    header = base64.urlsafe_b64encode(b'{"alg":"HS256"}').rstrip(b"=")
    body = base64.urlsafe_b64encode(payload).rstrip(b"=")
    signing_input = header + b"." + body
    signature = hmac.new(_hmac_key(key), signing_input, hashlib.sha256).digest()
    encoded = base64.urlsafe_b64encode(signature).rstrip(b"=")
    return Token((signing_input + b"." + encoded).decode("ascii"))


class TestDerivedSigningKey:
    async def test_issued_token_is_accepted(self, db: DbSessionFactory) -> None:
        store = _derived_store(db)
        token, token_id = await store.create_api_key(_api_key_claims(await _create_user(db)))
        claims = await store.read(token)
        assert claims is not None and claims.token_id == token_id
        replica = _derived_store(db)
        replica_claims = await replica.read(token)
        assert replica_claims is not None and replica_claims.token_id == token_id
        assert jwt.decode(str(token), OctKey.import_key(_derived_key())).claims["jti"] == str(
            token_id
        )

    async def test_issued_token_carries_random_claim_and_stored_hash(
        self, db: DbSessionFactory
    ) -> None:
        key = _derived_key()
        store = _derived_store(db)
        user_id = await _create_user(db)
        token, token_id = await store.create_api_key(_api_key_claims(user_id))
        other, _ = await store.create_api_key(_api_key_claims(user_id))
        random_value = _random_claim(key, token)
        other_value = _random_claim(key, other)
        # 32 random bytes encode to 43 unpadded base64url characters.
        assert len(random_value) == 43
        assert random_value != other_value
        assert len(_decode_random_claim(random_value)) == 32
        assert len(_decode_random_claim(other_value)) == 32
        async with db() as session:
            stored = await session.scalar(
                select(models.ApiKey.token_hash).where(
                    models.ApiKey.id == int(token_id.split(":")[1])
                )
            )
        assert stored == compute_token_hash(str(token))

    async def test_forged_token_for_existing_row_is_refused(self, db: DbSessionFactory) -> None:
        store = _derived_store(db)
        _, token_id = await store.create_api_key(_api_key_claims(await _create_user(db)))
        forged = _sign(_derived_key(), {"jti": str(token_id), TOKEN_RANDOM_CLAIM: "guess"})
        assert await store.read(forged) is None

    async def test_forged_token_without_random_claim_is_refused(self, db: DbSessionFactory) -> None:
        store = _derived_store(db)
        _, token_id = await store.create_api_key(_api_key_claims(await _create_user(db)))
        assert await store.read(_sign(_derived_key(), {"jti": str(token_id)})) is None

    async def test_token_signed_with_another_key_is_rejected(self, db: DbSessionFactory) -> None:
        store = _derived_store(db)
        _, token_id = await store.create_api_key(_api_key_claims(await _create_user(db)))
        forged = _sign(token_hex(32), {"jti": str(token_id)})
        assert await store.read(forged) is None

    async def test_row_without_hash_is_refused(self, db: DbSessionFactory) -> None:
        store = _derived_store(db)
        token, token_id = await store.create_api_key(_api_key_claims(await _create_user(db)))
        row_id = int(token_id.split(":")[1])
        async with db() as session:
            await session.execute(
                update(models.ApiKey).where(models.ApiKey.id == row_id).values(token_hash=None)
            )
        assert await _derived_store(db).read(token) is None

    async def test_store_accepts_nothing_before_the_signing_key_is_supplied(
        self, db: DbSessionFactory
    ) -> None:
        store = JwtStore(db)
        issued, _ = await _derived_store(db).create_api_key(_api_key_claims(await _create_user(db)))
        assert await store.read(issued) is None
        assert await store.read(Token("not-a-token")) is None
        assert await store.read(_sign(_derived_key(), {"jti": "ApiKey:1"})) is None

    async def test_consumed_grant_reports_only_the_issued_token(self, db: DbSessionFactory) -> None:
        store = _derived_store(db)
        user_id = await _create_user(db)
        async with db() as session:
            client = models.OAuth2Client(
                client_id=token_hex(8),
                name="client",
                redirect_uris=["https://example.com/callback"],
                grant_types=["authorization_code", "refresh_token"],
                token_endpoint_auth_method="none",
            )
            session.add(client)
            await session.flush()
            grant = models.OAuth2Grant(
                user_id=int(user_id),
                oauth2_client_id=client.id,
                scopes=["read"],
            )
            session.add(grant)
            await session.flush()
            grant_id = grant.id
        now = datetime.now(timezone.utc)
        token, token_id = await store.create_refresh_token(
            RefreshTokenClaims(
                subject=user_id,
                issued_at=now,
                expiration_time=now + timedelta(days=1),
                attributes=RefreshTokenAttributes(
                    user_role="ADMIN",
                    grant_id=grant_id,
                    scopes=("read",),
                ),
            )
        )
        assert await store.consume_refresh_token(token_id)
        assert await store.consumed_refresh_token_grant_id(token) == grant_id
        forged = _sign(_derived_key(), {"jti": str(token_id), TOKEN_RANDOM_CLAIM: "guess"})
        assert await store.consumed_refresh_token_grant_id(forged) is None

    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param({}, id="missing"),
            pytest.param({"jti": ["ApiKey:1"]}, id="list"),
            pytest.param({"jti": 1}, id="integer"),
            pytest.param({"jti": "ApiKey:"}, id="empty_id"),
            pytest.param({"jti": "ApiKey:²"}, id="non_ascii_digit"),
            pytest.param({"jti": "ApiKey:-1"}, id="negative"),
            pytest.param({"jti": "ApiKey:99999999999999999999"}, id="overflow"),
            pytest.param({"jti": "NotATable:1"}, id="unknown_table"),
        ],
    )
    async def test_malformed_jti_is_rejected(
        self, db: DbSessionFactory, payload: dict[str, object]
    ) -> None:
        assert await _derived_store(db).read(_sign(_derived_key(), payload)) is None

    async def test_oversized_jti_is_rejected(self, db: DbSessionFactory) -> None:
        token = _sign(_derived_key(), {"jti": "ApiKey:" + "1" * 5000})
        assert await _derived_store(db).read(token) is None

    async def test_deeply_nested_payload_is_rejected(self, db: DbSessionFactory) -> None:
        payload = b"[" * 2000 + b"]" * 2000
        assert await _derived_store(db).read(_sign_bytes(_derived_key(), payload)) is None


class TestConfiguredSecret:
    @pytest.fixture
    def secret(self) -> str:
        return token_hex(32)

    async def test_issued_token_is_accepted(self, db: DbSessionFactory, secret: str) -> None:
        store = _store(db, secret, require_stored_hash=False)
        token, _ = await store.create_api_key(_api_key_claims(await _create_user(db)))
        assert await store.read(token) is not None

    async def test_row_without_hash_is_still_accepted(
        self, db: DbSessionFactory, secret: str
    ) -> None:
        store = _store(db, secret, require_stored_hash=False)
        token, token_id = await store.create_api_key(_api_key_claims(await _create_user(db)))
        assert isinstance(token_id, ApiKeyId)
        row_id = int(token_id.split(":")[1])
        async with db() as session:
            await session.execute(
                update(models.ApiKey).where(models.ApiKey.id == row_id).values(token_hash=None)
            )
        assert await _store(db, secret, require_stored_hash=False).read(token) is not None

    async def test_hash_mismatch_is_rejected(self, db: DbSessionFactory, secret: str) -> None:
        store = _store(db, secret, require_stored_hash=False)
        token, token_id = await store.create_api_key(_api_key_claims(await _create_user(db)))
        row_id = int(token_id.split(":")[1])
        async with db() as session:
            await session.execute(
                update(models.ApiKey)
                .where(models.ApiKey.id == row_id)
                .values(token_hash=b"\x00" * 32)
            )
        assert await _store(db, secret, require_stored_hash=False).read(token) is None


class TestStoredHashCache:
    async def test_reloaded_cache_honors_the_stored_hash(self, db: DbSessionFactory) -> None:
        store = _derived_store(db)
        token, _ = await store.create_api_key(_api_key_claims(await _create_user(db)))
        await store._api_key_store._update()
        assert await store.read(token) is not None

    async def test_evict_reloads_the_stored_hash(self, db: DbSessionFactory) -> None:
        secret = token_hex(32)
        store = _store(db, secret, require_stored_hash=False)
        token, token_id = await store.create_api_key(_api_key_claims(await _create_user(db)))
        row_id = int(token_id.split(":")[1])
        async with db() as session:
            await session.execute(
                update(models.ApiKey)
                .where(models.ApiKey.id == row_id)
                .values(token_hash=b"\x00" * 32)
            )
        assert await store.read(token) is not None
        await store._api_key_store.evict(token_id)
        assert await store.read(token) is None

    async def test_hash_changed_between_reloads_is_the_hash_used(
        self, db: DbSessionFactory
    ) -> None:
        secret = token_hex(32)
        store = _store(db, secret, require_stored_hash=False)
        token, token_id = await store.create_api_key(_api_key_claims(await _create_user(db)))
        await store._api_key_store._update()
        assert await store.read(token) is not None
        row_id = int(token_id.split(":")[1])
        async with db() as session:
            await session.execute(
                update(models.ApiKey)
                .where(models.ApiKey.id == row_id)
                .values(token_hash=b"\x11" * 32)
            )
        await store._api_key_store._update()
        assert await store.read(token) is None


class TestLegacyRowThroughStartup:
    @pytest.mark.parametrize("mode", ["private_secret", "derived_key"])
    async def test_row_without_hash_follows_the_installed_policy(
        self,
        mode: str,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        secret = token_hex(16)
        monkeypatch.setenv("PHOENIX_ENABLE_AUTH", "true")
        monkeypatch.setenv("PHOENIX_HOST", "127.0.0.1")
        monkeypatch.setenv("PHOENIX_DISABLE_RATE_LIMIT", "true")
        monkeypatch.delenv("PHOENIX_DISABLE_BASIC_AUTH", raising=False)
        monkeypatch.delenv("PHOENIX_ADMIN_SECRET", raising=False)
        monkeypatch.delenv("PHOENIX_LDAP_HOST", raising=False)
        if mode == "private_secret":
            monkeypatch.setenv("PHOENIX_SECRET", secret)
        else:
            monkeypatch.delenv("PHOENIX_SECRET", raising=False)

        engine = create_engine(
            connection_str=f"sqlite:///{tmp_path / 'phoenix.db'}",
            migrate=not Settings.disable_migrations,
            log_to_stdout=False,
            log_migrations=False,
        )
        factory = DbSessionFactory(db=_db(engine), dialect="sqlite")
        app = create_app(
            db=factory,
            authentication_enabled=True,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
            shutdown_callbacks=[engine.dispose],
            **get_env_app_auth_kwargs(),
        )
        async with contextlib.AsyncExitStack() as stack:
            await stack.enter_async_context(patch_grpc_server())
            await stack.enter_async_context(patch_dml_event_handler())
            await stack.enter_async_context(patch_online_eval_daemons())
            await stack.enter_async_context(LifespanManager(app))
            if mode == "derived_key":
                signing_key: str | bytes = derive_deployment_key(
                    seed=await load_deployment_seed(factory),
                    secret=SecretStr(""),
                    purpose=TOKEN_SIGNING_KEY_PURPOSE,
                )
            else:
                signing_key = secret
            async with factory() as session:
                user_id = await session.scalar(
                    select(models.User.id).where(models.User.email == DEFAULT_ADMIN_EMAIL)
                )
                assert user_id is not None
                row = models.ApiKey(
                    user_id=user_id,
                    name="legacy",
                    description=None,
                    token_hash=None,
                )
                session.add(row)
                await session.flush()
                token = _sign(signing_key, {"jti": f"ApiKey:{row.id}"})
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                response = await client.get(
                    "/v1/user",
                    headers={"Authorization": f"Bearer {token}"},
                )
        if mode == "private_secret":
            assert response.status_code == 200
        else:
            assert response.status_code == 401


class TestSigningKeyChange:
    async def test_token_from_the_other_key_is_rejected(self, db: DbSessionFactory) -> None:
        private = token_hex(32)
        user_id = await _create_user(db)
        claims = _api_key_claims(user_id)
        derived_store = _derived_store(db)
        private_store = _store(db, private, require_stored_hash=False)
        derived_token, _ = await derived_store.create_api_key(claims)
        private_token, _ = await private_store.create_api_key(claims)
        assert await private_store.read(derived_token) is None
        assert await derived_store.read(private_token) is None
