"""Tests for setSandboxCredential / deleteSandboxCredential mutations."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
import sqlalchemy as sa

from phoenix.db import models
from phoenix.server.sandbox import _BACKEND_CACHE, _SANDBOX_ADAPTERS
from phoenix.server.sandbox.types import ProviderCredentialSpec, SandboxAdapter, SandboxBackend
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_SET_MUTATION = """
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

_DELETE_MUTATION = """
  mutation DeleteSandboxCredential($backendType: String!, $key: String!) {
    deleteSandboxCredential(backendType: $backendType, key: $key) {
      backendType
      key
    }
  }
"""

_TEST_BACKEND = "TEST_CRED_BACKEND"
_TEST_KEY = "TEST_CRED_KEY"


class _TestCredAdapter(SandboxAdapter):
    key = _TEST_BACKEND
    display_name = "Test Cred Backend"
    language = "PYTHON"
    credential_specs = [ProviderCredentialSpec(key=_TEST_KEY, display_name="Test Credential")]

    def build_backend(
        self,
        config: dict,  # type: ignore[type-arg]
        user_env: dict | None = None,  # type: ignore[type-arg]
    ) -> SandboxBackend:
        return MagicMock(spec=SandboxBackend)


@pytest.fixture(autouse=True)
def _register_test_adapter() -> Any:
    _SANDBOX_ADAPTERS[_TEST_BACKEND] = _TestCredAdapter()
    yield
    _SANDBOX_ADAPTERS.pop(_TEST_BACKEND, None)
    for k in [k for k in _BACKEND_CACHE if k[0] == _TEST_BACKEND]:
        _BACKEND_CACHE.pop(k, None)


class TestSetSandboxCredential:
    async def test_happy_path_upserts_secret(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            query=_SET_MUTATION,
            variables={"backendType": _TEST_BACKEND, "key": _TEST_KEY, "value": "my-secret"},
            operation_name="SetSandboxCredential",
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["setSandboxCredential"]["backendType"] == _TEST_BACKEND
        assert result.data["setSandboxCredential"]["key"] == _TEST_KEY

        async with db() as session:
            row = await session.scalar(
                sa.select(models.Secret).where(models.Secret.key == _TEST_KEY)
            )
        assert row is not None

    async def test_upsert_updates_existing_value(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        for value in ("first-value", "second-value"):
            result = await gql_client.execute(
                query=_SET_MUTATION,
                variables={"backendType": _TEST_BACKEND, "key": _TEST_KEY, "value": value},
                operation_name="SetSandboxCredential",
            )
            assert not result.errors

        async with db() as session:
            rows = (
                await session.scalars(
                    sa.select(models.Secret).where(models.Secret.key == _TEST_KEY)
                )
            ).all()
        assert len(rows) == 1

    async def test_unknown_backend_type_raises(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            query=_SET_MUTATION,
            variables={"backendType": "NONEXISTENT", "key": _TEST_KEY, "value": "v"},
            operation_name="SetSandboxCredential",
        )
        assert result.errors

    async def test_invalid_key_raises(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            query=_SET_MUTATION,
            variables={"backendType": _TEST_BACKEND, "key": "WRONG_KEY", "value": "v"},
            operation_name="SetSandboxCredential",
        )
        assert result.errors

    async def test_empty_value_raises(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            query=_SET_MUTATION,
            variables={"backendType": _TEST_BACKEND, "key": _TEST_KEY, "value": "   "},
            operation_name="SetSandboxCredential",
        )
        assert result.errors

    async def test_cache_invalidated_on_set(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        fake_backend = MagicMock(spec=SandboxBackend)
        fake_backend.close = MagicMock(return_value=None)
        _BACKEND_CACHE[(_TEST_BACKEND, "some-hash")] = fake_backend

        await gql_client.execute(
            query=_SET_MUTATION,
            variables={"backendType": _TEST_BACKEND, "key": _TEST_KEY, "value": "new-val"},
            operation_name="SetSandboxCredential",
        )

        assert not any(k[0] == _TEST_BACKEND for k in _BACKEND_CACHE)


class TestDeleteSandboxCredential:
    async def test_deletes_existing_row(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        await gql_client.execute(
            query=_SET_MUTATION,
            variables={"backendType": _TEST_BACKEND, "key": _TEST_KEY, "value": "to-delete"},
            operation_name="SetSandboxCredential",
        )

        result = await gql_client.execute(
            query=_DELETE_MUTATION,
            variables={"backendType": _TEST_BACKEND, "key": _TEST_KEY},
            operation_name="DeleteSandboxCredential",
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["deleteSandboxCredential"]["key"] == _TEST_KEY

        async with db() as session:
            row = await session.scalar(
                sa.select(models.Secret).where(models.Secret.key == _TEST_KEY)
            )
        assert row is None

    async def test_delete_nonexistent_is_idempotent(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            query=_DELETE_MUTATION,
            variables={"backendType": _TEST_BACKEND, "key": _TEST_KEY},
            operation_name="DeleteSandboxCredential",
        )
        assert not result.errors

    async def test_cache_invalidated_on_delete(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        fake_backend = MagicMock(spec=SandboxBackend)
        fake_backend.close = MagicMock(return_value=None)
        _BACKEND_CACHE[(_TEST_BACKEND, "some-hash")] = fake_backend

        await gql_client.execute(
            query=_DELETE_MUTATION,
            variables={"backendType": _TEST_BACKEND, "key": _TEST_KEY},
            operation_name="DeleteSandboxCredential",
        )

        assert not any(k[0] == _TEST_BACKEND for k in _BACKEND_CACHE)

    async def test_unknown_backend_type_raises(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            query=_DELETE_MUTATION,
            variables={"backendType": "NONEXISTENT", "key": _TEST_KEY},
            operation_name="DeleteSandboxCredential",
        )
        assert result.errors

    async def test_invalid_key_raises(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await gql_client.execute(
            query=_DELETE_MUTATION,
            variables={"backendType": _TEST_BACKEND, "key": "WRONG_KEY"},
            operation_name="DeleteSandboxCredential",
        )
        assert result.errors
