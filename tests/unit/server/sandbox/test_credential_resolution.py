from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from phoenix.server.sandbox import SecretsContext
from phoenix.server.sandbox.types import ProviderCredentialSpec


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


_SPEC_A = ProviderCredentialSpec(key="CRED_A", display_name="Cred A")


class TestResolveSandboxCredentials:
    @pytest.mark.asyncio
    async def test_db_wins_over_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("CRED_A", "env-value")
        session = _make_session({"CRED_A": b"db-value"})
        secrets = SecretsContext(session=session, decrypt=_identity_decrypt)
        result = await secrets.resolve_credentials([_SPEC_A])
        assert result == {"CRED_A": "db-value"}

    @pytest.mark.asyncio
    async def test_missing_key_omitted_not_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("CRED_A", raising=False)
        session = _make_session({})
        secrets = SecretsContext(session=session, decrypt=_identity_decrypt)
        result = await secrets.resolve_credentials([_SPEC_A])
        assert result == {}
        assert "CRED_A" not in result
