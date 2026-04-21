"""Unit tests for env var resolution — reserved-name defense and helper contracts.

Scope is the authored invariants only:
- `_resolve_user_env` rejects reserved provider-credential names in both
  `secret_ref.secret_key` and `literal.name` positions, before any DB query.
- `is_reserved_credential_name` helper contract.
- `_enforce_unique_env_var_names` validator contract.
- One minimal happy-path that `_resolve_user_env` returns the expected
  literal+secret_ref shape.

Per-kind/per-scenario resolution walks and end-to-end forwarding through
adapter SDK mocks live in the mutation-layer suite (`gql_client` cache
invalidation + secret_ref hydration tests), not here.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from phoenix.server.sandbox import (
    MissingSecretError,
    _resolve_user_env,
    is_reserved_credential_name,
)
from phoenix.server.sandbox.e2b_backend import E2BAdapter


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


class TestResolveUserEnvShape:
    @pytest.mark.asyncio
    async def test_literal_and_secret_ref_resolve_into_expected_shape(self) -> None:
        """Minimal happy path: a mixed literal + secret_ref pair resolves to {name: value}."""
        raw = [
            {"kind": "literal", "name": "PLAIN", "value": "hello"},
            {"kind": "secret_ref", "name": "SECRET", "secret_key": "my-key"},
        ]
        session = _make_session({"my-key": b"world"})
        result = await _resolve_user_env(raw, session, _identity_decrypt)
        assert result == {"PLAIN": "hello", "SECRET": "world"}


class TestResolveUserEnvReservedSecretKey:
    @pytest.mark.asyncio
    async def test_reserved_secret_key_raises_before_db_lookup(self) -> None:
        """secret_ref whose `secret_key` matches a reserved provider-credential
        name raises MissingSecretError before any DB query — fail-closed
        defense-in-depth for rows persisted before the mutation-layer guard."""
        raw = [{"kind": "secret_ref", "name": "MY_TOKEN", "secret_key": "VERCEL_TOKEN"}]
        session = _make_session({"VERCEL_TOKEN": b"should-not-reach-here"})
        with pytest.raises(MissingSecretError, match="VERCEL_TOKEN"):
            await _resolve_user_env(raw, session, _identity_decrypt)
        session.scalars.assert_not_called()

    @pytest.mark.asyncio
    async def test_reserved_literal_name_raises_before_db_lookup(self) -> None:
        """An EnvVarLiteral whose `name` matches a reserved provider-credential name
        raises MissingSecretError — pre-mutation-guard rows with reserved literal
        names must not pass resolution at runtime (asymmetry-bug closure)."""
        raw = [{"kind": "literal", "name": "VERCEL_TOKEN", "value": "x"}]
        session = _make_session({})
        with pytest.raises(MissingSecretError, match="VERCEL_TOKEN"):
            await _resolve_user_env(raw, session, _identity_decrypt)
        session.scalars.assert_not_called()

    @pytest.mark.asyncio
    async def test_reserved_check_is_case_insensitive(self) -> None:
        """Reserved-name comparison is case-insensitive in both positions."""
        raw = [{"kind": "secret_ref", "name": "MY_TOKEN", "secret_key": "vercel_token"}]
        session = _make_session({"vercel_token": b"should-not-reach-here"})
        with pytest.raises(MissingSecretError):
            await _resolve_user_env(raw, session, _identity_decrypt)
        session.scalars.assert_not_called()

    @pytest.mark.asyncio
    async def test_non_reserved_names_resolve_normally(self) -> None:
        """A non-reserved secret_key resolves from the DB; a non-reserved literal name passes."""
        raw = [
            {"kind": "secret_ref", "name": "API_KEY", "secret_key": "my-custom-key"},
            {"kind": "literal", "name": "MY_CUSTOM_VAR", "value": "hello"},
        ]
        session = _make_session({"my-custom-key": b"plaintext"})
        result = await _resolve_user_env(raw, session, _identity_decrypt)
        assert result == {"API_KEY": "plaintext", "MY_CUSTOM_VAR": "hello"}


class TestReservedCredentialNameHelper:
    @pytest.mark.parametrize(
        "name",
        [
            "MODAL_TOKEN_ID",
            "MODAL_TOKEN_SECRET",
            "modal_token_id",
            "modal_token_secret",
        ],
    )
    def test_modal_token_keys_are_reserved(self, name: str) -> None:
        assert is_reserved_credential_name(name)

    def test_non_modal_reserved_names_still_reserved(self) -> None:
        assert is_reserved_credential_name("PHOENIX_SANDBOX_TOKEN")
        assert is_reserved_credential_name("PHOENIX_SANDBOX_API_KEY")
        assert is_reserved_credential_name("phoenix_sandbox_token")


class TestValidateConfigRejectsDuplicateEnvVarNames:
    def test_duplicate_name_across_kinds_raises_validation_error(self) -> None:
        """A literal and a secret_ref with the same name is rejected.

        Otherwise the resolver would arbitrarily pick one kind over the other
        at execute time, hiding a real user-intent conflict.
        """
        adapter = E2BAdapter()
        config = {
            "env_vars": [
                {"kind": "literal", "name": "API_KEY", "value": "literal-val"},
                {"kind": "secret_ref", "name": "API_KEY", "secret_key": "k"},
            ],
        }
        with pytest.raises(ValidationError, match="API_KEY"):
            adapter.validate_config(config)

    def test_unique_env_var_names_pass(self) -> None:
        adapter = E2BAdapter()
        config = {
            "env_vars": [
                {"kind": "literal", "name": "A", "value": "1"},
                {"kind": "literal", "name": "B", "value": "2"},
            ],
        }
        result = adapter.validate_config(config)
        assert len(result["env_vars"]) == 2
