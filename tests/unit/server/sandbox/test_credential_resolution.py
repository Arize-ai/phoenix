"""Unit tests for _resolve_sandbox_credentials().

Covers:
- DB secret wins over env var
- Env var fallback when no DB secret
- Missing key omitted (no empty-string entries)
- Mixed: some from DB, some from env, some missing
- Empty env_var_specs returns {}
- session/decrypt=None falls back to env-only
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from phoenix.server.sandbox import _resolve_sandbox_credentials
from phoenix.server.sandbox.types import EnvVarSpec


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


_SPEC_A = EnvVarSpec(key="CRED_A", display_name="Cred A")
_SPEC_B = EnvVarSpec(key="CRED_B", display_name="Cred B")
_SPEC_C = EnvVarSpec(key="CRED_C", display_name="Cred C")


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
