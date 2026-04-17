"""Integration test: DB secret row → get_or_create_backend → adapter build_backend.

Validates the full chain: encrypt → DB write → session/decrypt → merge into
config → build_backend receives resolved value → cache invalidation on rotation.
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
    get_or_create_backend,
    invalidate_backend_cache,
)
from phoenix.server.sandbox.types import ProviderCredentialSpec, SandboxAdapter, SandboxBackend
from phoenix.server.types import DbSessionFactory

_BACKEND_TYPE = "INTEG_TEST_BACKEND"
_CRED_KEY = "INTEG_TEST_API_KEY"


class _CapturingAdapter(SandboxAdapter):
    key = _BACKEND_TYPE
    display_name = "Integration Test Backend"
    language = "PYTHON"
    credential_specs = [
        ProviderCredentialSpec(key=_CRED_KEY, display_name="Integration Test Credential")
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


@pytest.fixture(autouse=True)
def _clean_state() -> Any:
    yield
    _SANDBOX_ADAPTERS.pop(_BACKEND_TYPE, None)
    for k in [k for k in _BACKEND_CACHE if k[0] == _BACKEND_TYPE]:
        _BACKEND_CACHE.pop(k, None)


class TestEndToEndCredentialResolution:
    @pytest.mark.asyncio
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
            session.add(models.Secret(key=_CRED_KEY, value=encrypted))

        adapter = _CapturingAdapter()
        with patch.dict(_SANDBOX_ADAPTERS, {_BACKEND_TYPE: adapter}):
            async with db() as session:
                backend = await get_or_create_backend(
                    _BACKEND_TYPE,
                    config={},
                    session=session,
                    decrypt=enc.decrypt,
                )

        assert backend is not None
        assert len(adapter.received_configs) == 1
        assert adapter.received_configs[0].get(_CRED_KEY) == "my-api-key-value"

    @pytest.mark.asyncio
    async def test_credential_rotation_produces_new_backend(
        self,
        db: DbSessionFactory,
    ) -> None:
        """After cache invalidation, get_or_create_backend uses the new credential."""
        from starlette.datastructures import Secret as StarletteSecret

        from phoenix.server.encryption import EncryptionService

        enc = EncryptionService(StarletteSecret("test-secret-key-integration"))

        async with db() as session:
            session.add(models.Secret(key=_CRED_KEY, value=enc.encrypt(b"first-key")))

        adapter = _CapturingAdapter()
        with patch.dict(_SANDBOX_ADAPTERS, {_BACKEND_TYPE: adapter}):
            # First call — builds and caches
            async with db() as session:
                backend1 = await get_or_create_backend(
                    _BACKEND_TYPE, config={}, session=session, decrypt=enc.decrypt
                )

            # Rotate credential
            async with db() as session:
                await session.execute(
                    sa.update(models.Secret)
                    .where(models.Secret.key == _CRED_KEY)
                    .values(value=enc.encrypt(b"second-key"))
                )

            await invalidate_backend_cache(_BACKEND_TYPE)

            # Second call — cache miss, new backend built with new credential
            async with db() as session:
                backend2 = await get_or_create_backend(
                    _BACKEND_TYPE, config={}, session=session, decrypt=enc.decrypt
                )

        assert backend1 is not backend2
        assert len(adapter.received_configs) == 2
        assert adapter.received_configs[0].get(_CRED_KEY) == "first-key"
        assert adapter.received_configs[1].get(_CRED_KEY) == "second-key"

    @pytest.mark.asyncio
    async def test_secret_ref_env_var_hydrates_into_user_env(
        self,
        db: DbSessionFactory,
    ) -> None:
        """Positive happy-path: admin Secret → env_var secret_ref → build_backend sees plaintext.

        Sequence:
        1. Admin writes an encrypted Secret row (simulates upsertOrDeleteSecrets result).
        2. Admin/user authors a SandboxConfig whose env_vars includes a
           secret_ref pointing at that Secret key.
        3. get_or_create_backend resolves the secret_ref via _resolve_user_env
           and passes the plaintext in user_env (NOT merged into config) to
           adapter.build_backend.

        Guards: (a) user-facing env var name differs from the Secret key name
        (secret_ref decouples the two), and (b) the resolved plaintext must
        appear in user_env, not in config, per the isolation contract.
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
        with patch.dict(_SANDBOX_ADAPTERS, {_BACKEND_TYPE: adapter}):
            async with db() as session:
                backend = await get_or_create_backend(
                    _BACKEND_TYPE,
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
        # Isolation contract: plaintext must not leak into config, only user_env.
        assert env_var_name not in adapter.received_configs[0]
        assert shared_secret_key not in adapter.received_configs[0]
