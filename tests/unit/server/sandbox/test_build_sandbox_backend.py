"""Unit tests for build_sandbox_backend() credential resolution behavior.

build_sandbox_backend() does NOT cache — every call returns a fresh
SandboxBackend. These tests assert the credential resolution +
typed-credentials handoff contract; do not add tests here that depend on
instance reuse for the same provider kind / config pair.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import TYPE_CHECKING, Any, Mapping, Optional, cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import BaseModel, ConfigDict, SecretStr

from phoenix.db import models
from phoenix.db.models import LanguageName, SandboxProviderKind
from phoenix.server.sandbox import (
    _SANDBOX_ADAPTERS,
    SecretsContext,
    build_sandbox_backend,
)
from phoenix.server.sandbox.daytona_backend import DaytonaAdapter
from phoenix.server.sandbox.types import (
    NoDeployment,
    SandboxAdapter,
    SandboxBackend,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


def _row(
    *,
    kind: SandboxProviderKind = "WASM",
    language: LanguageName = "PYTHON",
    config: Optional[Mapping[str, Any]] = None,
) -> models.SandboxConfig:
    """Minimal SandboxConfig-shaped duck — ``build_sandbox_backend`` only reads
    ``provider_kind`` / ``language`` / ``config`` off it, so a SimpleNamespace
    suffices and avoids the DB / pydantic Identifier round-trip."""
    return SimpleNamespace(  # type: ignore[return-value]
        provider_kind=kind,
        language=language,
        config=dict(config) if config is not None else {},
    )


class _StubConfig(BaseModel):
    model_config = ConfigDict(extra="allow")


class _StubCreds(BaseModel):
    """Single-field credentials model used by stub adapters in these tests."""

    model_config = ConfigDict(extra="forbid")

    CRED_X: SecretStr


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
    # The factory also loads SandboxProvider.config via session.scalar(...)/get to
    # validate the typed deployment kwarg. These tests don't model a provider
    # row, so return None (the factory falls back to an empty deployment).
    session.scalar = AsyncMock(return_value=None)
    session.get = AsyncMock(return_value=None)
    return session


def _empty_secrets() -> SecretsContext:
    """A ``SecretsContext`` whose DB lookups all resolve to "nothing".

    Used by tests that exercise the env-fallback / unregistered-adapter /
    allowlist-deny paths — production callers always pass a real
    ``SecretsContext``, so the prior "secrets=_empty_secrets()" shorthand was only ever
    a way to skip the DB. With ``SecretsContext`` now required, we still
    skip the DB by handing back empty results from the mock.
    """
    return SecretsContext(
        session=cast("AsyncSession", _make_session({})),
        decrypt=_identity_decrypt,
    )


def _identity_decrypt(data: bytes) -> bytes:
    return data


def _make_adapter(
    received: dict[str, Any],
) -> Any:
    """Create a stub adapter that records the typed credentials + config it receives."""

    class _StubAdapter(SandboxAdapter):  # type: ignore[type-arg]
        """Temporarily overlays the real WASM registration for these tests."""

        kind = "WASM"
        display_name = "Stub"
        config_model = _StubConfig
        credentials_model = _StubCreds
        deployment_config_model = NoDeployment

        def build_backend(
            self,
            config: BaseModel,
            *,
            credentials: _StubCreds,
            deployment: NoDeployment,
            user_env: Optional[Mapping[str, str]] = None,
        ) -> SandboxBackend:
            received["config"] = config.model_dump()
            received["credentials"] = credentials
            received["deployment"] = deployment
            received["user_env"] = user_env
            return MagicMock(spec=SandboxBackend)

    return _StubAdapter()


@pytest.fixture(autouse=True)
def _suppress_wasm_optional_import_errors() -> Any:
    """Tests patch WASM with a lightweight stub adapter."""
    yield


class TestBuildSandboxBackendCredentialResolution:
    """Credentials flow through a separate typed kwarg, NOT merged into config."""

    @pytest.mark.asyncio
    async def test_db_credential_flows_through_typed_kwarg(self) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received)
        session = _make_session({"CRED_X": b"db-val"})

        with patch.dict(_SANDBOX_ADAPTERS, {"WASM": adapter}):
            await build_sandbox_backend(
                _row(),
                secrets=SecretsContext(session=session, decrypt=_identity_decrypt),
            )

        assert received["credentials"].CRED_X.get_secret_value() == "db-val"
        assert "CRED_X" not in received["config"]

    @pytest.mark.asyncio
    async def test_env_credential_fallback(self, monkeypatch: pytest.MonkeyPatch) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received)
        monkeypatch.setenv("CRED_X", "env-val")
        session = _make_session({})

        with patch.dict(_SANDBOX_ADAPTERS, {"WASM": adapter}):
            await build_sandbox_backend(
                _row(),
                secrets=SecretsContext(session=session, decrypt=_identity_decrypt),
            )

        assert received["credentials"].CRED_X.get_secret_value() == "env-val"

    @pytest.mark.asyncio
    async def test_no_session_resolves_from_env_only(self, monkeypatch: pytest.MonkeyPatch) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received)
        monkeypatch.setenv("CRED_X", "env-only")

        with patch.dict(_SANDBOX_ADAPTERS, {"WASM": adapter}):
            await build_sandbox_backend(_row(), secrets=_empty_secrets())

        assert received["credentials"].CRED_X.get_secret_value() == "env-only"


class TestBuildSandboxBackendAdapterLookup:
    @pytest.mark.asyncio
    async def test_unregistered_backend_returns_none(self) -> None:
        # Negative test: invalid kind exercises the unregistered path.
        result = await build_sandbox_backend(
            _row(kind="NONEXISTENT"),  # type: ignore[arg-type]
            secrets=_empty_secrets(),
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_disallowed_backend_returns_none_without_building(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received)
        monkeypatch.setenv("PHOENIX_ALLOWED_SANDBOX_PROVIDERS", "NONE")

        with patch.dict(_SANDBOX_ADAPTERS, {"WASM": adapter}):
            result = await build_sandbox_backend(_row(), secrets=_empty_secrets())

        assert result is None
        assert received == {}


class TestSSRFBlocked:
    """Non-capability keys must be rejected by validate_config inside
    build_sandbox_backend(), blocking the SSRF vector."""

    @pytest.mark.asyncio
    async def test_daytona_server_url_raises_before_build_backend(self) -> None:
        adapter = DaytonaAdapter()
        session = _make_session({})

        with (
            patch.dict(_SANDBOX_ADAPTERS, {"DAYTONA": adapter}),
            pytest.raises(ValueError, match="Extra inputs are not permitted"),
        ):
            await build_sandbox_backend(
                _row(
                    kind="DAYTONA",
                    config={"server_url": "https://attacker.example.com"},
                ),
                secrets=SecretsContext(session=session, decrypt=_identity_decrypt),
            )
