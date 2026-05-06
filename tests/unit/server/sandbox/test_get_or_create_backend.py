"""Unit tests for get_or_create_backend() credential merge and cache behavior."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import BaseModel, ConfigDict

from phoenix.server.sandbox import (
    _BACKEND_CACHE,
    _SANDBOX_ADAPTERS,
    get_or_create_backend,
    invalidate_backend_cache,
)
from phoenix.server.sandbox.daytona_backend import DaytonaPythonAdapter
from phoenix.server.sandbox.types import (
    ProviderCredentialSpec,
    SandboxAdapter,
    SandboxBackend,
)


class _StubConfig(BaseModel):
    model_config = ConfigDict(extra="allow")


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
        family = "WASM"  # any canonical family — gate doesn't filter for these tests
        display_name = "Stub"
        language = "PYTHON"
        config_model = _StubConfig
        credential_specs = [ProviderCredentialSpec(key=cred_key, display_name="Cred X")]

        def build_backend(
            self,
            config: dict[str, Any],
            user_env: dict[str, str] | None = None,
        ) -> SandboxBackend:
            received["config"] = dict(config)
            received["user_env"] = user_env
            return MagicMock(spec=SandboxBackend)

        def runtime_fingerprint(self, config: dict[str, Any]) -> str:
            return "STUB@1.0"

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
        """Non-credential user config keys pass through untouched.
        Credential keys supplied by the user are stripped before validate_config
        and replaced only by the resolved value (empty string when unresolved)."""
        received: dict[str, Any] = {}
        adapter = _make_adapter(received, "CRED_X")
        monkeypatch.delenv("CRED_X", raising=False)
        session = _make_session({})

        with patch.dict(_SANDBOX_ADAPTERS, {"STUB": adapter}):
            await get_or_create_backend(
                "STUB",
                config={"custom_key": "some-value", "CRED_X": "user-fallback"},
                session=session,
                decrypt=_identity_decrypt,
            )

        # Non-credential key passes through from user config untouched.
        assert received["config"].get("custom_key") == "some-value"
        # Credential key is stripped from user config before validate_config;
        # when neither DB nor env resolves it, it is absent from effective_config.
        assert "CRED_X" not in received["config"]

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
                "STUB", config={"region": "us-east-1"}, session=session, decrypt=_identity_decrypt
            )
            b2 = await get_or_create_backend(
                "STUB", config={"region": "eu-west-1"}, session=session, decrypt=_identity_decrypt
            )

        assert b1 is not b2

    @pytest.mark.asyncio
    async def test_unregistered_backend_returns_none(self) -> None:
        result = await get_or_create_backend("NONEXISTENT", config={}, session=None, decrypt=None)
        assert result is None

    @pytest.mark.asyncio
    async def test_disallowed_backend_returns_none_without_building(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received, "CRED_X")
        monkeypatch.setenv("PHOENIX_ALLOWED_SANDBOX_PROVIDERS", "NONE")

        with patch.dict(_SANDBOX_ADAPTERS, {"STUB": adapter}):
            result = await get_or_create_backend("STUB", config={}, session=None, decrypt=None)

        assert result is None
        assert received == {}


class TestProviderMergeSSRFBlocked:
    """Provider-level non-capability keys must be rejected by validate_config
    inside get_or_create_backend, blocking the SSRF vector.

    The evaluators.py merge shape is:
        merged = {**sandbox_config.config, **sandbox_provider.config}
        get_or_create_backend(backend_type, config=merged, ...)

    Provider config wins on key collision (admin-authored). Before Phase 5,
    a poisoned provider config with server_url would flow into
    Daytona(server_url=...) unchecked. After Phase 5, validate_config raises
    ValueError (extra=forbid) before any Daytona client is constructed.
    """

    @pytest.mark.asyncio
    async def test_daytona_provider_server_url_raises_before_build_backend(self) -> None:
        """A sandbox_provider.config with server_url must not reach build_backend.

        Simulates the evaluators.py merge where provider config wins over user
        config. validate_config (called at line 536 of sandbox/__init__.py) must
        raise ValueError so the evaluator layer converts it to BadRequest.
        """
        adapter = DaytonaPythonAdapter()
        session = _make_session({})

        merged_config = {
            "server_url": "https://attacker.example.com",
        }

        with (
            patch.dict(_SANDBOX_ADAPTERS, {"DAYTONA_PYTHON": adapter}),
            pytest.raises(ValueError, match="Extra inputs are not permitted"),
        ):
            await get_or_create_backend(
                "DAYTONA_PYTHON",
                config=merged_config,
                session=session,
                decrypt=_identity_decrypt,
            )
