"""Path-inserted well-known aliases for root-path deployments.

Under PHOENIX_HOST_ROOT_PATH the issuer carries a path component, and RFC 8414
§3 / RFC 9728 §3.1 discovery inserts the well-known segment between host and
path — URLs at the host root, outside the root path. Phoenix registers those
aliases so discovery works for any reverse proxy that forwards /.well-known/*
unmodified.
"""

from __future__ import annotations

import contextlib
from typing import AsyncIterator

import httpx
import pytest
from asgi_lifespan import LifespanManager
from pydantic import SecretStr
from starlette.types import ASGIApp

from phoenix.server.app import create_app
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import TestBulkInserter, patch_grpc_server

_ROOT = "/phoenix"


@contextlib.asynccontextmanager
async def _rooted_auth_app(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    *,
    authorization_server: bool = True,
) -> AsyncIterator[ASGIApp]:
    monkeypatch.setenv("PHOENIX_HOST_ROOT_PATH", _ROOT)
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=True,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
            secret=SecretStr("test-secret-at-least-32-chars-long!!"),
        )
        app.state.oauth2_authorization_server_enabled = authorization_server
        manager = await stack.enter_async_context(LifespanManager(app))
        yield manager.app


def _client(app: ASGIApp) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


@pytest.mark.parametrize(
    "alias",
    [
        f"/.well-known/oauth-authorization-server{_ROOT}",
        f"/.well-known/openid-configuration{_ROOT}",
    ],
)
async def test_path_inserted_as_metadata_matches_issuer_derivation(
    alias: str,
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The alias serves the same document, and its URL is exactly what a client
    derives by path-inserting the well-known segment into the issuer."""
    async with _rooted_auth_app(db, monkeypatch) as app:
        client = _client(app)
        aliased = await client.get(alias)
        # In-process the scope has no root_path, so the canonical route is the
        # plain path; its document already reflects the configured root path.
        appended = await client.get("/.well-known/oauth-authorization-server")
    assert aliased.status_code == 200
    metadata = aliased.json()
    assert metadata["issuer"] == f"http://test{_ROOT}"
    assert metadata == appended.json()


async def test_path_inserted_prm_describes_the_rooted_resource(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with _rooted_auth_app(db, monkeypatch) as app:
        resp = await _client(app).get(f"/.well-known/oauth-protected-resource{_ROOT}")
    assert resp.status_code == 200
    metadata = resp.json()
    assert metadata["resource"] == f"http://test{_ROOT}"
    assert metadata["authorization_servers"] == [f"http://test{_ROOT}"]


@pytest.mark.parametrize(
    "alias",
    [
        f"/.well-known/oauth-authorization-server{_ROOT}",
        f"/.well-known/openid-configuration{_ROOT}",
    ],
)
async def test_as_aliases_honor_the_authorization_server_flag(
    alias: str,
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with _rooted_auth_app(db, monkeypatch, authorization_server=False) as app:
        resp = await _client(app).get(alias)
    assert resp.status_code == 404


async def test_no_aliases_without_a_root_path(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With no root path the path-inserted form IS the plain form; nothing extra
    is registered, so a suffixed URL stays a 404."""
    monkeypatch.delenv("PHOENIX_HOST_ROOT_PATH", raising=False)
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=True,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
            secret=SecretStr("test-secret-at-least-32-chars-long!!"),
        )
        manager = await stack.enter_async_context(LifespanManager(app))
        resp = await _client(manager.app).get(f"/.well-known/oauth-authorization-server{_ROOT}")
    assert resp.status_code == 404


async def test_path_inserted_mcp_prm_describes_the_mcp_resource(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("phoenix.server.app.get_env_enable_mcp_server", lambda: True)
    async with _rooted_auth_app(db, monkeypatch) as app:
        resp = await _client(app).get(f"/.well-known/oauth-protected-resource{_ROOT}/mcp")
    assert resp.status_code == 200
    metadata = resp.json()
    assert metadata["resource"] == f"http://test{_ROOT}/mcp"
    assert metadata["authorization_servers"] == [f"http://test{_ROOT}"]


async def test_path_inserted_mcp_prm_is_404_when_the_mount_is_disabled(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("phoenix.server.app.get_env_enable_mcp_server", lambda: False)
    async with _rooted_auth_app(db, monkeypatch) as app:
        resp = await _client(app).get(f"/.well-known/oauth-protected-resource{_ROOT}/mcp")
    assert resp.status_code == 404
