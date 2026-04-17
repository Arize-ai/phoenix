"""Unit tests for get_or_create_backend() credential merge and cache behavior."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from phoenix.server.sandbox import (
    _BACKEND_CACHE,
    _SANDBOX_ADAPTERS,
    get_or_create_backend,
    invalidate_backend_cache,
)
from phoenix.server.sandbox.types import ProviderCredentialSpec, SandboxAdapter, SandboxBackend


def _make_session(secrets: dict[str, bytes]) -> Any:
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


def _make_adapter(received: dict[str, Any], cred_key: str = "CRED_X") -> SandboxAdapter:
    class _StubAdapter(SandboxAdapter):
        key = "STUB"
        display_name = "Stub"
        language = "PYTHON"
        credential_specs = [ProviderCredentialSpec(key=cred_key, display_name="Cred X")]

        def build_backend(
            self,
            config: dict[str, Any],
            user_env: dict[str, str] | None = None,
        ) -> SandboxBackend:
            received["config"] = dict(config)
            received["user_env"] = user_env
            return MagicMock(spec=SandboxBackend)

    return _StubAdapter()


@pytest.fixture(autouse=True)
def _clean_sandbox_state() -> Any:
    """Remove STUB adapter and its cache entries after each test."""
    yield
    _SANDBOX_ADAPTERS.pop("STUB", None)
    for k in [k for k in _BACKEND_CACHE if k[0] == "STUB"]:
        _BACKEND_CACHE.pop(k, None)


class TestGetOrCreateBackendCredentialMerge:
    @pytest.mark.asyncio
    async def test_db_credential_injected_into_config(self) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received, "CRED_X")
        session = _make_session({"CRED_X": b"db-val"})

        with patch.dict(_SANDBOX_ADAPTERS, {"STUB": adapter}):
            await get_or_create_backend(
                "STUB", config={}, session=session, decrypt=_identity_decrypt
            )

        assert received["config"].get("CRED_X") == "db-val"

    @pytest.mark.asyncio
    async def test_env_credential_fallback(self, monkeypatch: pytest.MonkeyPatch) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received, "CRED_X")
        monkeypatch.setenv("CRED_X", "env-val")
        session = _make_session({})

        with patch.dict(_SANDBOX_ADAPTERS, {"STUB": adapter}):
            await get_or_create_backend(
                "STUB", config={}, session=session, decrypt=_identity_decrypt
            )

        assert received["config"].get("CRED_X") == "env-val"

    @pytest.mark.asyncio
    async def test_resolved_db_credential_wins_over_user_config(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Defense-in-depth: a user-supplied config key with a reserved
        credential name MUST be overridden by the server-resolved DB secret.
        Reserved-name enforcement at the mutation boundary is the primary
        defense; the factory merge order is the backstop."""
        received: dict[str, Any] = {}
        adapter = _make_adapter(received, "CRED_X")
        session = _make_session({"CRED_X": b"db-val"})

        with patch.dict(_SANDBOX_ADAPTERS, {"STUB": adapter}):
            await get_or_create_backend(
                "STUB",
                config={"CRED_X": "attacker-val"},
                session=session,
                decrypt=_identity_decrypt,
            )

        assert received["config"].get("CRED_X") == "db-val"

    @pytest.mark.asyncio
    async def test_resolved_env_credential_wins_over_user_config(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Env-var-resolved credential also wins over user config (no DB secret)."""
        received: dict[str, Any] = {}
        adapter = _make_adapter(received, "CRED_X")
        monkeypatch.setenv("CRED_X", "env-val")
        session = _make_session({})

        with patch.dict(_SANDBOX_ADAPTERS, {"STUB": adapter}):
            await get_or_create_backend(
                "STUB",
                config={"CRED_X": "attacker-val"},
                session=session,
                decrypt=_identity_decrypt,
            )

        assert received["config"].get("CRED_X") == "env-val"

    @pytest.mark.asyncio
    async def test_user_config_preserved_when_key_unresolved(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Non-credential user config keys pass through untouched."""
        received: dict[str, Any] = {}
        adapter = _make_adapter(received, "CRED_X")
        monkeypatch.delenv("CRED_X", raising=False)
        session = _make_session({})

        with patch.dict(_SANDBOX_ADAPTERS, {"STUB": adapter}):
            await get_or_create_backend(
                "STUB",
                config={"template": "python", "CRED_X": "user-fallback"},
                session=session,
                decrypt=_identity_decrypt,
            )

        # When no DB/env value resolves, user-supplied key remains.
        # (Reserved-name enforcement at mutation time prevents this for
        # actual reserved credential keys; this is just shape-agnostic behavior.)
        assert received["config"].get("template") == "python"
        assert received["config"].get("CRED_X") == "user-fallback"

    @pytest.mark.asyncio
    async def test_no_session_resolves_from_env_only(self, monkeypatch: pytest.MonkeyPatch) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received, "CRED_X")
        monkeypatch.setenv("CRED_X", "env-only")

        with patch.dict(_SANDBOX_ADAPTERS, {"STUB": adapter}):
            await get_or_create_backend("STUB", config={}, session=None, decrypt=None)

        assert received["config"].get("CRED_X") == "env-only"


class TestGetOrCreateBackendCache:
    @pytest.mark.asyncio
    async def test_same_effective_config_returns_cached_instance(self) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received, "CRED_X")
        session = _make_session({"CRED_X": b"db-val"})

        with patch.dict(_SANDBOX_ADAPTERS, {"STUB": adapter}):
            b1 = await get_or_create_backend(
                "STUB", config={}, session=session, decrypt=_identity_decrypt
            )
            b2 = await get_or_create_backend(
                "STUB", config={}, session=session, decrypt=_identity_decrypt
            )

        assert b1 is b2

    @pytest.mark.asyncio
    async def test_invalidate_cache_produces_fresh_instance(self) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received, "CRED_X")
        session1 = _make_session({"CRED_X": b"val-1"})

        with patch.dict(_SANDBOX_ADAPTERS, {"STUB": adapter}):
            b1 = await get_or_create_backend(
                "STUB", config={}, session=session1, decrypt=_identity_decrypt
            )
            await invalidate_backend_cache("STUB")
            session2 = _make_session({"CRED_X": b"val-2"})
            b2 = await get_or_create_backend(
                "STUB", config={}, session=session2, decrypt=_identity_decrypt
            )

        assert b1 is not b2

    @pytest.mark.asyncio
    async def test_different_config_hash_separate_cache_entries(self) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received, "CRED_X")
        session = _make_session({"CRED_X": b"db-val"})

        with patch.dict(_SANDBOX_ADAPTERS, {"STUB": adapter}):
            b1 = await get_or_create_backend(
                "STUB", config={"template": "a"}, session=session, decrypt=_identity_decrypt
            )
            b2 = await get_or_create_backend(
                "STUB", config={"template": "b"}, session=session, decrypt=_identity_decrypt
            )

        assert b1 is not b2

    @pytest.mark.asyncio
    async def test_unregistered_backend_returns_none(self) -> None:
        result = await get_or_create_backend("NONEXISTENT", config={}, session=None, decrypt=None)
        assert result is None
