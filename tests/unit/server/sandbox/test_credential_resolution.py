"""Tests for credential resolution — unit-level and integration-level.

Unit tests (TestResolveSandboxCredentials): cover _resolve_sandbox_credentials() directly
with mock sessions.

Integration tests (TestCredentialResolutionIntegration): cover the full
encrypt → DB write → get_or_create_backend → build_backend chain using a real DB session
and real encryption, including cache invalidation on credential rotation and secret_ref
hydration into user_env.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import sqlalchemy as sa

from phoenix.db import models
from phoenix.server.sandbox import (
    _BACKEND_CACHE,
    _SANDBOX_ADAPTERS,
    _resolve_sandbox_credentials,
    get_or_create_backend,
    invalidate_backend_cache,
)
from phoenix.server.sandbox.types import ProviderCredentialSpec, SandboxAdapter, SandboxBackend
from phoenix.server.types import DbSessionFactory


def _make_session(secrets: dict[str, bytes]) -> Any:
    """Return an AsyncSession mock pre-loaded with the given key→encrypted_value map."""
    rows = []
    for key, value in secrets.items():
        row = MagicMock()
        row.key = key
        row.value = value
        rows.append(row)

    scalars_mock = MagicMock()
    scalars_mock.all.return_value = rows

    session = MagicMock()
    session.scalars = AsyncMock(return_value=scalars_mock)
    return session


def _identity_decrypt(data: bytes) -> bytes:
    return data


_SPEC_A = ProviderCredentialSpec(key="CRED_A", display_name="Cred A")
_SPEC_B = ProviderCredentialSpec(key="CRED_B", display_name="Cred B")
_SPEC_C = ProviderCredentialSpec(key="CRED_C", display_name="Cred C")


class TestResolveSandboxCredentials:
    @pytest.mark.asyncio
    async def test_empty_specs_returns_empty(self) -> None:
        session = _make_session({})
        result = await _resolve_sandbox_credentials(session, _identity_decrypt, [])
        assert result == {}

    @pytest.mark.asyncio
    async def test_db_wins_over_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("CRED_A", "env-value")
        session = _make_session({"CRED_A": b"db-value"})
        result = await _resolve_sandbox_credentials(session, _identity_decrypt, [_SPEC_A])
        assert result == {"CRED_A": "db-value"}

    @pytest.mark.asyncio
    async def test_env_fallback_when_no_db_secret(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("CRED_A", "env-value")
        session = _make_session({})
        result = await _resolve_sandbox_credentials(session, _identity_decrypt, [_SPEC_A])
        assert result == {"CRED_A": "env-value"}

    @pytest.mark.asyncio
    async def test_missing_key_omitted(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("CRED_A", raising=False)
        session = _make_session({})
        result = await _resolve_sandbox_credentials(session, _identity_decrypt, [_SPEC_A])
        assert result == {}
        assert "CRED_A" not in result

    @pytest.mark.asyncio
    async def test_mixed_db_env_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("CRED_B", "env-b")
        monkeypatch.delenv("CRED_C", raising=False)
        session = _make_session({"CRED_A": b"db-a"})
        result = await _resolve_sandbox_credentials(
            session, _identity_decrypt, [_SPEC_A, _SPEC_B, _SPEC_C]
        )
        assert result == {"CRED_A": "db-a", "CRED_B": "env-b"}
        assert "CRED_C" not in result

    @pytest.mark.asyncio
    async def test_none_session_falls_back_to_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("CRED_A", "env-only")
        result = await _resolve_sandbox_credentials(None, None, [_SPEC_A])
        assert result == {"CRED_A": "env-only"}

    @pytest.mark.asyncio
    async def test_none_session_omits_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("CRED_A", raising=False)
        result = await _resolve_sandbox_credentials(None, None, [_SPEC_A])
        assert result == {}

    @pytest.mark.asyncio
    async def test_decrypt_failure_logs_warning_and_falls_back_to_env(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("CRED_A", "env-fallback")
        session = _make_session({"CRED_A": b"bad-ciphertext"})

        def _failing_decrypt(data: bytes) -> bytes:
            raise ValueError("bad token")

        result = await _resolve_sandbox_credentials(session, _failing_decrypt, [_SPEC_A])
        # Decrypt failure is logged and the key is omitted from db_secrets;
        # env fallback then supplies the value.
        assert result == {"CRED_A": "env-fallback"}


_INTEG_BACKEND_TYPE = "INTEG_TEST_BACKEND"
_INTEG_CRED_KEY = "INTEG_TEST_API_KEY"


class _CapturingAdapter(SandboxAdapter):
    key = _INTEG_BACKEND_TYPE
    display_name = "Integration Test Backend"
    language = "PYTHON"
    credential_specs = [
        ProviderCredentialSpec(key=_INTEG_CRED_KEY, display_name="Integration Test Credential")
    ]

    def __init__(self) -> None:
        self.received_configs: list[dict[str, Any]] = []
        self.received_user_envs: list[dict[str, str] | None] = []

    def build_backend(
        self,
        config: dict[str, Any],
        user_env: dict[str, str] | None = None,
    ) -> SandboxBackend:
        self.received_configs.append(dict(config))
        self.received_user_envs.append(dict(user_env) if user_env is not None else None)
        backend = MagicMock(spec=SandboxBackend)
        backend.close = AsyncMock()
        return backend


@pytest.fixture(autouse=False)
def _clean_integ_state() -> Any:
    yield
    _SANDBOX_ADAPTERS.pop(_INTEG_BACKEND_TYPE, None)
    for k in [k for k in _BACKEND_CACHE if k[0] == _INTEG_BACKEND_TYPE]:
        _BACKEND_CACHE.pop(k, None)


class TestCredentialResolutionIntegration:
    """Full-chain integration: DB secret → get_or_create_backend → adapter build_backend."""

    @pytest.mark.asyncio
    @pytest.mark.usefixtures("_clean_integ_state")
    async def test_db_secret_reaches_build_backend(
        self,
        db: DbSessionFactory,
    ) -> None:
        """Secret stored in DB is decrypted and passed to build_backend via config."""
        from starlette.datastructures import Secret as StarletteSecret

        from phoenix.server.encryption import EncryptionService

        enc = EncryptionService(StarletteSecret("test-secret-key-integration"))
        encrypted = enc.encrypt(b"my-api-key-value")

        async with db() as session:
            session.add(models.Secret(key=_INTEG_CRED_KEY, value=encrypted))

        adapter = _CapturingAdapter()
        with patch.dict(_SANDBOX_ADAPTERS, {_INTEG_BACKEND_TYPE: adapter}):
            async with db() as session:
                backend = await get_or_create_backend(
                    _INTEG_BACKEND_TYPE,
                    config={},
                    session=session,
                    decrypt=enc.decrypt,
                )

        assert backend is not None
        assert len(adapter.received_configs) == 1
        assert adapter.received_configs[0].get(_INTEG_CRED_KEY) == "my-api-key-value"

    @pytest.mark.asyncio
    @pytest.mark.usefixtures("_clean_integ_state")
    async def test_credential_rotation_produces_new_backend(
        self,
        db: DbSessionFactory,
    ) -> None:
        """After cache invalidation, get_or_create_backend uses the new credential."""
        from starlette.datastructures import Secret as StarletteSecret

        from phoenix.server.encryption import EncryptionService

        enc = EncryptionService(StarletteSecret("test-secret-key-integration"))

        async with db() as session:
            session.add(models.Secret(key=_INTEG_CRED_KEY, value=enc.encrypt(b"first-key")))

        adapter = _CapturingAdapter()
        with patch.dict(_SANDBOX_ADAPTERS, {_INTEG_BACKEND_TYPE: adapter}):
            async with db() as session:
                backend1 = await get_or_create_backend(
                    _INTEG_BACKEND_TYPE, config={}, session=session, decrypt=enc.decrypt
                )

            async with db() as session:
                await session.execute(
                    sa.update(models.Secret)
                    .where(models.Secret.key == _INTEG_CRED_KEY)
                    .values(value=enc.encrypt(b"second-key"))
                )

            await invalidate_backend_cache(_INTEG_BACKEND_TYPE)

            async with db() as session:
                backend2 = await get_or_create_backend(
                    _INTEG_BACKEND_TYPE, config={}, session=session, decrypt=enc.decrypt
                )

        assert backend1 is not backend2
        assert len(adapter.received_configs) == 2
        assert adapter.received_configs[0].get(_INTEG_CRED_KEY) == "first-key"
        assert adapter.received_configs[1].get(_INTEG_CRED_KEY) == "second-key"

    @pytest.mark.asyncio
    @pytest.mark.usefixtures("_clean_integ_state")
    async def test_secret_ref_env_var_hydrates_into_user_env(
        self,
        db: DbSessionFactory,
    ) -> None:
        """secret_ref in env_vars is resolved from DB and passed to build_backend as user_env.

        Guards: (a) user-facing env var name differs from the Secret key (secret_ref decouples
        them), and (b) plaintext appears in user_env, NOT in config, per the isolation contract.
        """
        from starlette.datastructures import Secret as StarletteSecret

        from phoenix.server.encryption import EncryptionService

        enc = EncryptionService(StarletteSecret("test-secret-key-integration"))
        shared_secret_key = "SHARED_OPENAI_KEY"
        env_var_name = "OPENAI_KEY"
        secret_plaintext = b"sk-abc123-resolved-via-secret-ref"

        async with db() as session:
            session.add(models.Secret(key=shared_secret_key, value=enc.encrypt(secret_plaintext)))

        adapter = _CapturingAdapter()
        with patch.dict(_SANDBOX_ADAPTERS, {_INTEG_BACKEND_TYPE: adapter}):
            async with db() as session:
                backend = await get_or_create_backend(
                    _INTEG_BACKEND_TYPE,
                    config={
                        "env_vars": [
                            {
                                "kind": "secret_ref",
                                "name": env_var_name,
                                "secret_key": shared_secret_key,
                            }
                        ]
                    },
                    session=session,
                    decrypt=enc.decrypt,
                )

        assert backend is not None
        assert len(adapter.received_user_envs) == 1
        user_env = adapter.received_user_envs[0]
        assert user_env == {env_var_name: secret_plaintext.decode("utf-8")}, (
            f"secret_ref did not hydrate correctly; user_env={user_env!r}"
        )
        assert env_var_name not in adapter.received_configs[0]
        assert shared_secret_key not in adapter.received_configs[0]
