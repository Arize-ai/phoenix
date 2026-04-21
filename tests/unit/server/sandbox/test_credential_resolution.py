"""Direct unit tests for `_resolve_sandbox_credentials` precedence and omission.

Full DB → get_or_create_backend → build_backend integration is covered by the
mutation-layer cache-invalidation suite via `gql_client`; this file keeps only
the two direct-call invariants the helper itself owns:

- DB-stored credential wins over an env-var of the same key.
- A spec key with no DB row and no env-var is omitted from the result, not
  surfaced as `None`.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from phoenix.server.sandbox import _resolve_sandbox_credentials
from phoenix.server.sandbox.types import ProviderCredentialSpec


def _make_session(secrets: dict[str, bytes]) -> Any:
    """AsyncSession mock pre-loaded with key→encrypted_value rows."""
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
        result = await _resolve_sandbox_credentials(session, _identity_decrypt, [_SPEC_A])
        assert result == {"CRED_A": "db-value"}

    @pytest.mark.asyncio
    async def test_missing_key_omitted_not_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """A spec key with neither a DB row nor an env var is absent from the result.

        Returning `None` would let downstream `dict.get()` checks treat absent
        credentials as configured-with-empty-value — the omission is the contract.
        """
        monkeypatch.delenv("CRED_A", raising=False)
        session = _make_session({})
        result = await _resolve_sandbox_credentials(session, _identity_decrypt, [_SPEC_A])
        assert result == {}
        assert "CRED_A" not in result
