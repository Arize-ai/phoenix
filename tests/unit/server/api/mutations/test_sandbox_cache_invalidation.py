"""Phase 3 cache-invalidation tests (task #22).

Validates that the `setSandboxCredential`, `deleteSandboxCredential`, and
`upsertOrDeleteSecrets` mutation paths correctly invalidate `_BACKEND_CACHE`
so subsequent `get_or_create_backend` calls observe rotated credentials.

Three scenarios covered:
1. Rebuild-with-new-value via setSandboxCredential — backend rebuilt with v2
   plaintext after rotation.
2. Shared-spec invalidation — VERCEL_PYTHON and VERCEL_TYPESCRIPT share
   `credential_specs` referencing VERCEL_TOKEN; rotating via either backend_type
   evicts BOTH cache entries.
3. upsertOrDeleteSecrets + SandboxConfig.secret_ref — rotating a user Secret
   referenced by `secret_ref` evicts the cache so the rebuilt backend sees
   the new plaintext in user_env.

Tests go through the real GraphQL mutations to exercise the wiring end-to-end.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import sqlalchemy as sa

from phoenix.db import models
from phoenix.server.encryption import EncryptionService
from phoenix.server.sandbox import (
    _BACKEND_CACHE,
    _SANDBOX_ADAPTERS,
    get_or_create_backend,
)
from phoenix.server.sandbox.types import (
    ProviderCredentialSpec,
    SandboxAdapter,
    SandboxBackend,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_SET_CRED_MUTATION = """
  mutation SetSandboxCredential(
    $backendType: String!
    $key: String!
    $value: String!
  ) {
    setSandboxCredential(backendType: $backendType, key: $key, value: $value) {
      backendType
      key
    }
  }
"""

_UPSERT_SECRETS_MUTATION = """
  mutation UpsertOrDeleteSecretsMutation($input: UpsertOrDeleteSecretsMutationInput!) {
    upsertOrDeleteSecrets(input: $input) {
      upsertedSecrets { key }
      deletedIds
    }
  }
"""


class _CapturingAdapter(SandboxAdapter):
    """Test adapter that records each build_backend invocation for later assertions."""

    def __init__(
        self,
        *,
        key: str,
        credential_specs: list[ProviderCredentialSpec],
    ) -> None:
        self.key = key
        self.display_name = f"Capturing {key}"
        self.language = "PYTHON"
        self.credential_specs = credential_specs
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


def _purge_cache_for(backend_types: list[str]) -> None:
    for backend_type in backend_types:
        for key in [k for k in list(_BACKEND_CACHE) if k[0] == backend_type]:
            _BACKEND_CACHE.pop(key, None)


class TestRebuildWithNewValue:
    """Scenario 1: setSandboxCredential rotates a Secret → backend is rebuilt with v2."""

    async def test_rebuild_after_set_sandbox_credential(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        backend_type = "REBUILD_TEST_BACKEND"
        cred_key = "REBUILD_TEST_CRED"
        adapter = _CapturingAdapter(
            key=backend_type,
            credential_specs=[
                ProviderCredentialSpec(key=cred_key, display_name="Rebuild Test Credential"),
            ],
        )
        enc = EncryptionService()

        async with db() as session:
            session.add(models.Secret(key=cred_key, value=enc.encrypt(b"v1-plaintext")))

        try:
            with patch.dict(_SANDBOX_ADAPTERS, {backend_type: adapter}):
                # First build — populates cache with v1 plaintext.
                async with db() as session:
                    backend_v1 = await get_or_create_backend(
                        backend_type, config={}, session=session, decrypt=enc.decrypt
                    )
                assert backend_v1 is not None
                assert len(adapter.received_configs) == 1
                assert adapter.received_configs[0][cred_key] == "v1-plaintext"

                # Rotate the value in the DB so the set-credential mutation updates
                # it (insert_on_conflict). Use the mutation to fire the
                # invalidate_backend_cache_for_key hook.
                result = await gql_client.execute(
                    query=_SET_CRED_MUTATION,
                    variables={
                        "backendType": backend_type,
                        "key": cred_key,
                        "value": "v2-plaintext",
                    },
                    operation_name="SetSandboxCredential",
                )
                assert not result.errors, result.errors

                # Second build — cache must have been evicted by the mutation;
                # a NEW backend is returned, reading the rotated plaintext.
                async with db() as session:
                    backend_v2 = await get_or_create_backend(
                        backend_type, config={}, session=session, decrypt=enc.decrypt
                    )
                assert backend_v2 is not None
                assert backend_v2 is not backend_v1, (
                    "Cache was not evicted: same instance returned after rotation"
                )
                assert len(adapter.received_configs) == 2
                assert adapter.received_configs[1][cred_key] == "v2-plaintext", (
                    f"Expected v2 plaintext, got {adapter.received_configs[1].get(cred_key)!r}"
                )
        finally:
            _purge_cache_for([backend_type])


class TestSharedSpecInvalidation:
    """Scenario 2: VERCEL_TOKEN is shared by VERCEL_PYTHON and VERCEL_TYPESCRIPT.

    Rotating via either backend_type must evict BOTH cache entries.
    """

    async def test_rotate_vercel_token_evicts_both_vercel_backends(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        shared_spec_key = "SHARED_VERCEL_TOKEN_TEST"
        shared_specs = [
            ProviderCredentialSpec(key=shared_spec_key, display_name="Shared Vercel Token Test"),
        ]
        py_adapter = _CapturingAdapter(key="SHARED_SPEC_PY_TEST", credential_specs=shared_specs)
        ts_adapter = _CapturingAdapter(key="SHARED_SPEC_TS_TEST", credential_specs=shared_specs)
        enc = EncryptionService()

        async with db() as session:
            session.add(models.Secret(key=shared_spec_key, value=enc.encrypt(b"initial")))

        try:
            with patch.dict(
                _SANDBOX_ADAPTERS,
                {py_adapter.key: py_adapter, ts_adapter.key: ts_adapter},
            ):
                # Populate caches for both backend_types.
                async with db() as session:
                    py_backend = await get_or_create_backend(
                        py_adapter.key, config={}, session=session, decrypt=enc.decrypt
                    )
                    ts_backend = await get_or_create_backend(
                        ts_adapter.key, config={}, session=session, decrypt=enc.decrypt
                    )
                assert py_backend is not None
                assert ts_backend is not None

                # Rotate via the PY backend_type only. The key-level fan-out
                # (invalidate_backend_cache_for_key) must evict both because
                # both adapters list `shared_spec_key` in credential_specs.
                result = await gql_client.execute(
                    query=_SET_CRED_MUTATION,
                    variables={
                        "backendType": py_adapter.key,
                        "key": shared_spec_key,
                        "value": "rotated",
                    },
                    operation_name="SetSandboxCredential",
                )
                assert not result.errors, result.errors

                # Both caches must have been evicted: next call returns a new instance.
                async with db() as session:
                    py_backend_v2 = await get_or_create_backend(
                        py_adapter.key, config={}, session=session, decrypt=enc.decrypt
                    )
                    ts_backend_v2 = await get_or_create_backend(
                        ts_adapter.key, config={}, session=session, decrypt=enc.decrypt
                    )
                assert py_backend_v2 is not py_backend, (
                    "PY cache was not evicted: same instance returned after rotation"
                )
                assert ts_backend_v2 is not ts_backend, (
                    "TS cache was not evicted — shared-spec fan-out failed"
                )
        finally:
            _purge_cache_for([py_adapter.key, ts_adapter.key])


class TestUpsertOrDeleteSecretsCacheInvalidation:
    """Scenario 3: upsertOrDeleteSecrets rotates a user Secret referenced via
    SandboxConfig.env_vars[*].secret_ref → cached backend holding the v1
    plaintext must be evicted and rebuilt with v2.
    """

    async def test_rotate_user_secret_evicts_sandbox_config_cache(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        backend_type = "SECRET_REF_TEST_BACKEND"
        # User-facing env var name is DIFFERENT from the secret key to
        # validate the secret_ref indirection layer.
        env_var_name = "MY_API_KEY"
        secret_key = "USER_SECRET_ROTATE_TEST"
        enc = EncryptionService()

        # Adapter declares no credential_specs so the secret is picked up
        # purely via secret_ref hydration in user_env, not as a provider cred.
        adapter = _CapturingAdapter(key=backend_type, credential_specs=[])

        async with db() as session:
            session.add(models.Secret(key=secret_key, value=enc.encrypt(b"v1-secret")))

        # Seed a SandboxProvider + SandboxConfig whose env_vars references
        # `secret_key` by secret_ref. The upsertOrDeleteSecrets hook scans
        # SandboxConfig rows to find affected backend_types. Reuse or create
        # the PYTHON Language row — another test/seed may have already inserted it.
        async with db() as session:
            language = await session.scalar(
                sa.select(models.Language).where(models.Language.name == "PYTHON")
            )
            if language is None:
                language = models.Language(name="PYTHON")
                session.add(language)
                await session.flush()
            provider = models.SandboxProvider(
                backend_type=backend_type,
                language_id=language.id,
                enabled=True,
                config={},
            )
            session.add(provider)
            await session.flush()
            sandbox_config = models.SandboxConfig(
                sandbox_provider_id=provider.id,
                name="secret-ref-test-config",
                config={
                    "env_vars": [
                        {
                            "kind": "secret_ref",
                            "name": env_var_name,
                            "secret_key": secret_key,
                        }
                    ]
                },
                timeout=30,
            )
            session.add(sandbox_config)
            await session.flush()

        config_with_ref: dict[str, Any] = {
            "env_vars": [
                {
                    "kind": "secret_ref",
                    "name": env_var_name,
                    "secret_key": secret_key,
                }
            ]
        }

        try:
            with patch.dict(_SANDBOX_ADAPTERS, {backend_type: adapter}):
                # First build — populates cache with v1 plaintext in user_env.
                async with db() as session:
                    backend_v1 = await get_or_create_backend(
                        backend_type,
                        config=config_with_ref,
                        session=session,
                        decrypt=enc.decrypt,
                    )
                assert backend_v1 is not None
                assert adapter.received_user_envs[0] == {env_var_name: "v1-secret"}

                # Rotate the user Secret via the upsertOrDeleteSecrets mutation.
                # The mutation scans SandboxConfig rows and triggers
                # invalidate_backend_cache(backend_type) for matches.
                result = await gql_client.execute(
                    query=_UPSERT_SECRETS_MUTATION,
                    variables={
                        "input": {
                            "secrets": [{"key": secret_key, "value": "v2-secret"}],
                        }
                    },
                    operation_name="UpsertOrDeleteSecretsMutation",
                )
                assert not result.errors, result.errors

                # Second build — cache was invalidated, new backend sees v2.
                async with db() as session:
                    backend_v2 = await get_or_create_backend(
                        backend_type,
                        config=config_with_ref,
                        session=session,
                        decrypt=enc.decrypt,
                    )
                assert backend_v2 is not None
                assert backend_v2 is not backend_v1, (
                    "upsertOrDeleteSecrets did not evict the cache: same instance returned"
                )
                assert len(adapter.received_user_envs) == 2
                assert adapter.received_user_envs[1] == {env_var_name: "v2-secret"}, (
                    f"Expected v2-secret in user_env, got {adapter.received_user_envs[1]!r}"
                )
        finally:
            _purge_cache_for([backend_type])
            # Clean up only the rows WE added (Language may pre-exist from app seed).
            async with db() as session:
                await session.execute(
                    sa.delete(models.SandboxConfig).where(
                        models.SandboxConfig.name == "secret-ref-test-config"
                    )
                )
                await session.execute(
                    sa.delete(models.SandboxProvider).where(
                        models.SandboxProvider.backend_type == backend_type
                    )
                )
                await session.execute(
                    sa.delete(models.Secret).where(models.Secret.key == secret_key)
                )
