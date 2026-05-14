"""Unit tests for build_sandbox_backend() credential merge behavior.

build_sandbox_backend() does NOT cache — every call returns a fresh
SandboxBackend. These tests assert the credential resolution + merge
contract only; do not add tests here that depend on instance reuse for
the same (backend_type, config).
"""

from __future__ import annotations

from typing import Any, Mapping, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import BaseModel, ConfigDict

from phoenix.server.sandbox import (
    _SANDBOX_ADAPTERS,
    build_sandbox_backend,
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
            config: Mapping[str, Any],
            user_env: Optional[Mapping[str, str]] = None,
        ) -> SandboxBackend:
            received["config"] = dict(config)
            received["user_env"] = user_env
            # secret_values is now a class-level attribute on SandboxBackend
            # (default frozenset()), so a spec'd Mock inherits it automatically —
            # no per-mock setup needed.
            return MagicMock(spec=SandboxBackend)

    return _StubAdapter()


@pytest.fixture(autouse=True)
def _clean_sandbox_state() -> Any:
    """Remove STUB adapter after each test."""
    yield
    _SANDBOX_ADAPTERS.pop("STUB", None)


class TestBuildSandboxBackendCredentialMerge:
    @pytest.mark.asyncio
    async def test_db_credential_injected_into_config(self) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received, "CRED_X")
        session = _make_session({"CRED_X": b"db-val"})

        with patch.dict(_SANDBOX_ADAPTERS, {"STUB": adapter}):
            await build_sandbox_backend(
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
            await build_sandbox_backend(
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
            await build_sandbox_backend(
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
            await build_sandbox_backend(
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
            await build_sandbox_backend(
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
            await build_sandbox_backend("STUB", config={}, session=None, decrypt=None)

        assert received["config"].get("CRED_X") == "env-only"


class TestBuildSandboxBackendAdapterLookup:
    @pytest.mark.asyncio
    async def test_unregistered_backend_returns_none(self) -> None:
        result = await build_sandbox_backend("NONEXISTENT", config={}, session=None, decrypt=None)
        assert result is None

    @pytest.mark.asyncio
    async def test_disallowed_backend_returns_none_without_building(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received, "CRED_X")
        monkeypatch.setenv("PHOENIX_ALLOWED_SANDBOX_PROVIDERS", "NONE")

        with patch.dict(_SANDBOX_ADAPTERS, {"STUB": adapter}):
            result = await build_sandbox_backend("STUB", config={}, session=None, decrypt=None)

        assert result is None
        assert received == {}


class TestSSRFBlocked:
    """Non-capability keys must be rejected by validate_config inside
    build_sandbox_backend(), blocking the SSRF vector.

    A poisoned config with ``server_url`` would otherwise flow into
    Daytona(server_url=...) unchecked. validate_config raises ValueError
    (extra=forbid) before any Daytona client is constructed.
    """

    @pytest.mark.asyncio
    async def test_daytona_server_url_raises_before_build_backend(self) -> None:
        """A SandboxConfig.config carrying ``server_url`` must not reach
        build_backend — validate_config raises ValueError so the evaluator
        layer converts it to BadRequest.
        """
        adapter = DaytonaPythonAdapter()
        session = _make_session({})

        poisoned_config = {
            "server_url": "https://attacker.example.com",
        }

        with (
            patch.dict(_SANDBOX_ADAPTERS, {"DAYTONA_PYTHON": adapter}),
            pytest.raises(ValueError, match="Extra inputs are not permitted"),
        ):
            await build_sandbox_backend(
                "DAYTONA_PYTHON",
                config=poisoned_config,
                session=session,
                decrypt=_identity_decrypt,
            )
