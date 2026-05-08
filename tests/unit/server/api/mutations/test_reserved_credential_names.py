"""Reserved-credential-name collision tests for sandbox GQL mutations.

Covers every enforcement surface exposed by Phase 2:
- ``createSandboxConfig`` rejects reserved names in ``config.env_vars``
- ``createSandboxConfig`` rejects reserved names as top-level ``config`` keys
- ``updateSandboxProvider`` rejects reserved names as top-level ``config`` keys

Parametrized across representative provider-credential names drawn from
multiple adapters (MODAL, VERCEL) so a regression in one adapter's spec
cannot silently narrow the reserved set. Comparison is case-insensitive;
the positive non-reserved case (``OPENAI_API_KEY``) pins the absence of
over-rejection.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server import sandbox as sandbox_module
from phoenix.server.sandbox.e2b_backend import E2BAdapter
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_e2b_adapter = E2BAdapter()

# Reserved names exposed by the MODAL and VERCEL adapters (case-preserved for
# readability; the mutation check is case-insensitive).
_RESERVED_NAMES = [
    "MODAL_TOKEN_SECRET",
    "MODAL_TOKEN_ID",
    "VERCEL_TOKEN",
    "VERCEL_OIDC_TOKEN",
]


_CREATE = """
mutation CreateSandboxConfig($input: CreateSandboxConfigInput!) {
    createSandboxConfig(input: $input) {
        sandboxConfig {
            id
        }
    }
}
"""

_UPDATE_PROVIDER = """
mutation UpdateSandboxProvider($input: UpdateSandboxProviderInput!) {
    updateSandboxProvider(input: $input) {
        sandboxProvider {
            id
        }
    }
}
"""


def _config_global_id(config_id: int) -> str:
    return str(GlobalID("SandboxConfig", str(config_id)))


def _provider_global_id(provider_id: int) -> str:
    return str(GlobalID("SandboxProvider", str(provider_id)))


@pytest.mark.parametrize("reserved_name", _RESERVED_NAMES)
class TestReservedCredentialNamesRejected:
    async def test_create_rejects_reserved_env_var_name(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
        reserved_name: str,
    ) -> None:
        """createSandboxConfig must reject env_vars[].name matching any
        provider-credential key, regardless of which backend the config
        targets — credential-shadowing is a property of the name, not the
        target adapter."""
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": f"e2b-reserved-env-{reserved_name.lower()}",
                        "config": {
                            "env_vars": [
                                {
                                    "kind": "literal",
                                    "name": reserved_name,
                                    "value": "shadow-attempt",
                                }
                            ]
                        },
                    }
                },
            )
        assert result.errors

    async def test_create_rejects_reserved_top_level_config_key(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
        reserved_name: str,
    ) -> None:
        """SandboxConfig.config uses extra="allow" so arbitrary top-level keys
        pass pydantic validation. The mutation-time reserved-key check is the
        only guard against credential-shadowing via config blobs."""
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": f"e2b-reserved-top-{reserved_name.lower()}",
                        "config": {reserved_name: "shadow-attempt"},
                    }
                },
            )
        assert result.errors

    async def test_update_provider_rejects_reserved_top_level_config_key(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
        reserved_name: str,
    ) -> None:
        """updateSandboxProvider writes to SandboxProvider.config; the same
        reserved-key check must apply on that surface too."""
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _UPDATE_PROVIDER,
                variables={
                    "input": {
                        "id": _provider_global_id(provider.id),
                        "config": {reserved_name: "shadow-attempt"},
                    }
                },
            )
        assert result.errors


class TestReservedCredentialNamesCaseInsensitive:
    async def test_lowercase_reserved_name_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """Reserved-name comparison is case-insensitive; a lowercase variant
        must also be rejected so attackers cannot bypass by casing."""
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "e2b-reserved-lower",
                        "config": {
                            "env_vars": [
                                {
                                    "kind": "literal",
                                    "name": "vercel_token",
                                    "value": "shadow-attempt",
                                }
                            ]
                        },
                    }
                },
            )
        assert result.errors


class TestNonReservedNameAccepted:
    async def test_non_reserved_env_var_name_accepted(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        """A name outside the reserved set — here OPENAI_API_KEY, a common
        user credential that does NOT shadow any sandbox provider key — is
        accepted. Guards against over-rejection regressions in the reserved
        check."""
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "sandboxProviderId": _provider_global_id(provider.id),
                        "name": "e2b-non-reserved",
                        "config": {
                            "env_vars": [
                                {
                                    "kind": "literal",
                                    "name": "OPENAI_API_KEY",
                                    "value": "sk-test",
                                }
                            ]
                        },
                    }
                },
            )
        assert result.data and not result.errors
