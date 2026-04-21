"""Unit tests for env var resolution in get_or_create_backend / _resolve_user_env.

Covers:
- Literal-only env var resolution (no DB access needed)
- secret_ref resolution via decrypt stub
- Mixed literal + secret_ref resolution
- Missing secret key raises MissingSecretError
- user_env is never merged into config (passed as sibling arg)
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from phoenix.server.sandbox import (
    MissingSecretError,
    _resolve_user_env,
    get_or_create_backend,
    is_reserved_credential_name,
)
from phoenix.server.sandbox.e2b_backend import E2BAdapter
from phoenix.server.sandbox.types import SandboxAdapter, SandboxBackend


def _raise_decrypt_error(data: bytes) -> bytes:
    """Decrypt stub that always raises, simulating a corrupted key or bad ciphertext."""
    raise RuntimeError("decrypt failed")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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
    """Decrypt stub that returns the input unchanged (plaintext == ciphertext in tests)."""
    return data


def _make_adapter(received: dict[str, Any]) -> SandboxAdapter:
    """Return a minimal adapter that records the user_env it receives."""

    class _RecordingAdapter(SandboxAdapter):
        key = "TEST"
        display_name = "Test"
        language = "PYTHON"

        def build_backend(
            self,
            config: dict[str, Any],
            user_env: dict[str, str] | None = None,
        ) -> SandboxBackend:
            received["user_env"] = user_env
            received["config"] = config
            return MagicMock(spec=SandboxBackend)

    return _RecordingAdapter()


# ---------------------------------------------------------------------------
# _resolve_user_env: literal-only
# ---------------------------------------------------------------------------


class TestResolveUserEnvLiterals:
    @pytest.mark.asyncio
    async def test_literal_entries_resolved_without_db(self) -> None:
        raw = [{"kind": "literal", "name": "FOO", "value": "bar"}]
        session = _make_session({})
        result = await _resolve_user_env(raw, session, _identity_decrypt)
        assert result == {"FOO": "bar"}
        session.scalars.assert_not_called()

    @pytest.mark.asyncio
    async def test_multiple_literals(self) -> None:
        raw = [
            {"kind": "literal", "name": "A", "value": "1"},
            {"kind": "literal", "name": "B", "value": "2"},
        ]
        session = _make_session({})
        result = await _resolve_user_env(raw, session, _identity_decrypt)
        assert result == {"A": "1", "B": "2"}

    @pytest.mark.asyncio
    async def test_empty_list_returns_empty_dict(self) -> None:
        result = await _resolve_user_env([], _make_session({}), _identity_decrypt)
        assert result == {}


# ---------------------------------------------------------------------------
# _resolve_user_env: secret_ref
# ---------------------------------------------------------------------------


class TestResolveUserEnvSecretRef:
    @pytest.mark.asyncio
    async def test_secret_ref_resolved_via_decrypt(self) -> None:
        raw = [{"kind": "secret_ref", "name": "API_KEY", "secret_key": "prod-api-key"}]
        session = _make_session({"prod-api-key": b"supersecret"})
        result = await _resolve_user_env(raw, session, _identity_decrypt)
        assert result == {"API_KEY": "supersecret"}

    @pytest.mark.asyncio
    async def test_missing_secret_key_raises_missing_secret_error(self) -> None:
        raw = [{"kind": "secret_ref", "name": "API_KEY", "secret_key": "nonexistent"}]
        session = _make_session({})  # no secrets in DB
        with pytest.raises(MissingSecretError, match="nonexistent"):
            await _resolve_user_env(raw, session, _identity_decrypt)

    @pytest.mark.asyncio
    async def test_deduplicated_secret_keys_single_query(self) -> None:
        """Two refs to the same secret_key result in one DB row, not a duplicate query."""
        raw = [
            {"kind": "secret_ref", "name": "X", "secret_key": "shared-key"},
            {"kind": "secret_ref", "name": "Y", "secret_key": "shared-key"},
        ]
        session = _make_session({"shared-key": b"value"})
        result = await _resolve_user_env(raw, session, _identity_decrypt)
        assert result == {"X": "value", "Y": "value"}


# ---------------------------------------------------------------------------
# _resolve_user_env: mixed literal + secret_ref
# ---------------------------------------------------------------------------


class TestResolveUserEnvMixed:
    @pytest.mark.asyncio
    async def test_mixed_literal_and_secret_ref(self) -> None:
        raw = [
            {"kind": "literal", "name": "PLAIN", "value": "hello"},
            {"kind": "secret_ref", "name": "SECRET", "secret_key": "my-key"},
        ]
        session = _make_session({"my-key": b"world"})
        result = await _resolve_user_env(raw, session, _identity_decrypt)
        assert result == {"PLAIN": "hello", "SECRET": "world"}

    @pytest.mark.asyncio
    async def test_missing_one_of_multiple_secret_refs_raises(self) -> None:
        raw = [
            {"kind": "secret_ref", "name": "A", "secret_key": "exists"},
            {"kind": "secret_ref", "name": "B", "secret_key": "missing"},
        ]
        session = _make_session({"exists": b"ok"})
        with pytest.raises(MissingSecretError):
            await _resolve_user_env(raw, session, _identity_decrypt)


# ---------------------------------------------------------------------------
# get_or_create_backend: user_env not merged into config
# ---------------------------------------------------------------------------


class TestGetOrCreateBackendUserEnvIsolation:
    @pytest.mark.asyncio
    async def test_user_env_passed_as_sibling_not_merged_into_config(self) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received)

        config = {
            "template": "base",
            "env_vars": [{"kind": "literal", "name": "MY_VAR", "value": "my_val"}],
        }
        session = _make_session({})

        with patch.dict("phoenix.server.sandbox._SANDBOX_ADAPTERS", {"TEST": adapter}):
            await get_or_create_backend(
                "TEST", config=config, session=session, decrypt=_identity_decrypt
            )

        assert received["user_env"] == {"MY_VAR": "my_val"}
        # env_vars key is still in config — not stripped, not user_env values merged in
        assert "MY_VAR" not in received["config"]
        assert "env_vars" in received["config"]

    @pytest.mark.asyncio
    async def test_user_env_is_none_when_no_env_vars_in_config(self) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received)

        config = {"template": "base"}
        session = _make_session({})

        with patch.dict("phoenix.server.sandbox._SANDBOX_ADAPTERS", {"TEST": adapter}):
            await get_or_create_backend(
                "TEST", config=config, session=session, decrypt=_identity_decrypt
            )

        assert received["user_env"] is None

    @pytest.mark.asyncio
    async def test_literals_resolved_when_session_not_provided(self) -> None:
        """Literal env_vars resolve unconditionally — no DB context required.

        Regression guard for the silent-drop gate: previously `if session is
        not None and decrypt is not None` stripped ALL env_vars (including
        literals) when either arg was None. Now literals always pass through.
        """
        received: dict[str, Any] = {}
        adapter = _make_adapter(received)

        config = {"env_vars": [{"kind": "literal", "name": "X", "value": "1"}]}

        with patch.dict("phoenix.server.sandbox._SANDBOX_ADAPTERS", {"TEST": adapter}):
            await get_or_create_backend(
                "TEST", config=config, session=None, decrypt=_identity_decrypt
            )

        assert received["user_env"] == {"X": "1"}

    @pytest.mark.asyncio
    async def test_secret_refs_raise_when_session_not_provided(self) -> None:
        """secret_ref entries fail-closed when no DB context is available.

        Previously silently dropped. Now raises MissingSecretError so the
        caller can surface a diagnostic — the alternative (silent-drop) would
        leave the user-intended env absent at execute() time with no signal.
        """
        received: dict[str, Any] = {}
        adapter = _make_adapter(received)

        config = {"env_vars": [{"kind": "secret_ref", "name": "K", "secret_key": "needs-db"}]}

        with patch.dict("phoenix.server.sandbox._SANDBOX_ADAPTERS", {"TEST": adapter}):
            with pytest.raises(MissingSecretError, match="needs-db"):
                await get_or_create_backend(
                    "TEST", config=config, session=None, decrypt=_identity_decrypt
                )

    @pytest.mark.asyncio
    async def test_secret_refs_raise_when_decrypt_not_provided(self) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received)

        config = {"env_vars": [{"kind": "secret_ref", "name": "K", "secret_key": "needs-decrypt"}]}
        session = _make_session({})

        with patch.dict("phoenix.server.sandbox._SANDBOX_ADAPTERS", {"TEST": adapter}):
            with pytest.raises(MissingSecretError, match="needs-decrypt"):
                await get_or_create_backend("TEST", config=config, session=session, decrypt=None)

    @pytest.mark.asyncio
    async def test_missing_secret_raises_propagates_from_get_or_create(self) -> None:
        received: dict[str, Any] = {}
        adapter = _make_adapter(received)

        config = {"env_vars": [{"kind": "secret_ref", "name": "KEY", "secret_key": "absent"}]}
        session = _make_session({})

        with patch.dict("phoenix.server.sandbox._SANDBOX_ADAPTERS", {"TEST": adapter}):
            with pytest.raises(MissingSecretError):
                await get_or_create_backend(
                    "TEST", config=config, session=session, decrypt=_identity_decrypt
                )


# ---------------------------------------------------------------------------
# _resolve_user_env: decrypt failure raises typed MissingSecretError
# ---------------------------------------------------------------------------


class TestResolveUserEnvDecryptFailure:
    @pytest.mark.asyncio
    async def test_decrypt_raising_callable_surfaces_as_missing_secret_error(self) -> None:
        """Decrypt failure must raise MissingSecretError, not leak the raw exception.

        The Secret row exists, but the decrypt callable fails (e.g. corrupted
        ciphertext or wrong key). `_resolve_user_env` catches and rewraps so
        callers handle one typed error for every secret_ref failure mode
        (missing key, decrypt failure, missing DB context).
        """
        raw = [{"kind": "secret_ref", "name": "API_KEY", "secret_key": "corrupted-key"}]
        session = _make_session({"corrupted-key": b"encrypted-but-broken"})
        with pytest.raises(MissingSecretError, match="corrupted-key"):
            await _resolve_user_env(raw, session, _raise_decrypt_error)


# ---------------------------------------------------------------------------
# validate_config: reject duplicate env_var names
# ---------------------------------------------------------------------------


class TestValidateConfigRejectsDuplicateEnvVarNames:
    def test_duplicate_literal_names_raises_validation_error(self) -> None:
        adapter = E2BAdapter()
        config = {
            "env_vars": [
                {"kind": "literal", "name": "FOO", "value": "first"},
                {"kind": "literal", "name": "FOO", "value": "second"},
            ],
        }
        with pytest.raises(ValidationError, match="FOO"):
            adapter.validate_config(config)

    def test_duplicate_name_across_kinds_raises_validation_error(self) -> None:
        """A literal and a secret_ref with the same name is also rejected.

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


# ---------------------------------------------------------------------------
# _resolve_user_env: reserved secret_key pre-check (Phase 5)
# ---------------------------------------------------------------------------


class TestResolveUserEnvReservedSecretKey:
    @pytest.mark.asyncio
    async def test_reserved_secret_key_raises_before_db_lookup(self) -> None:
        """A secret_ref whose secret_key matches a reserved provider-credential
        name must raise MissingSecretError before any DB query — fail-closed
        defense-in-depth for rows persisted before the mutation-layer guard."""
        raw = [{"kind": "secret_ref", "name": "MY_TOKEN", "secret_key": "VERCEL_TOKEN"}]
        session = _make_session({"VERCEL_TOKEN": b"should-not-reach-here"})
        with pytest.raises(MissingSecretError, match="VERCEL_TOKEN"):
            await _resolve_user_env(raw, session, _identity_decrypt)
        # DB was never queried — the reserved check fires before secret lookup
        session.scalars.assert_not_called()

    @pytest.mark.asyncio
    async def test_reserved_secret_key_case_insensitive(self) -> None:
        """Reserved-key comparison is case-insensitive — lowercase variant is
        also rejected without hitting the DB."""
        raw = [{"kind": "secret_ref", "name": "MY_TOKEN", "secret_key": "vercel_token"}]
        session = _make_session({"vercel_token": b"should-not-reach-here"})
        with pytest.raises(MissingSecretError):
            await _resolve_user_env(raw, session, _identity_decrypt)
        session.scalars.assert_not_called()

    @pytest.mark.asyncio
    async def test_reserved_modal_token_id_rejected(self) -> None:
        """Modal token keys (added in task #6) must also be rejected."""
        raw = [{"kind": "secret_ref", "name": "MY_VAR", "secret_key": "MODAL_TOKEN_ID"}]
        session = _make_session({})
        with pytest.raises(MissingSecretError, match="MODAL_TOKEN_ID"):
            await _resolve_user_env(raw, session, _identity_decrypt)

    @pytest.mark.asyncio
    async def test_reserved_modal_token_secret_rejected(self) -> None:
        """Modal token secret (added in task #6) must also be rejected."""
        raw = [{"kind": "secret_ref", "name": "MY_VAR", "secret_key": "MODAL_TOKEN_SECRET"}]
        session = _make_session({})
        with pytest.raises(MissingSecretError, match="MODAL_TOKEN_SECRET"):
            await _resolve_user_env(raw, session, _identity_decrypt)

    @pytest.mark.asyncio
    async def test_non_reserved_secret_key_resolves_normally(self) -> None:
        """A non-reserved secret_key must continue to resolve from the DB."""
        raw = [{"kind": "secret_ref", "name": "API_KEY", "secret_key": "my-custom-key"}]
        session = _make_session({"my-custom-key": b"plaintext"})
        result = await _resolve_user_env(raw, session, _identity_decrypt)
        assert result == {"API_KEY": "plaintext"}

    @pytest.mark.asyncio
    async def test_reserved_literal_name_raises_before_db_lookup(self) -> None:
        """An EnvVarLiteral whose name matches a reserved provider-credential name
        must raise MissingSecretError — pre-mutation-guard rows with reserved literal
        names must not pass resolution at runtime (asymmetry bug D3 closes)."""
        raw = [{"kind": "literal", "name": "VERCEL_TOKEN", "value": "x"}]
        session = _make_session({})
        with pytest.raises(MissingSecretError, match="VERCEL_TOKEN"):
            await _resolve_user_env(raw, session, _identity_decrypt)
        session.scalars.assert_not_called()

    @pytest.mark.asyncio
    async def test_reserved_literal_name_case_insensitive(self) -> None:
        """Reserved literal-name check is case-insensitive, same as secret_key check."""
        raw = [{"kind": "literal", "name": "vercel_token", "value": "x"}]
        session = _make_session({})
        with pytest.raises(MissingSecretError):
            await _resolve_user_env(raw, session, _identity_decrypt)

    @pytest.mark.asyncio
    async def test_non_reserved_literal_name_resolves_normally(self) -> None:
        """A non-reserved literal name must continue to resolve without error."""
        raw = [{"kind": "literal", "name": "MY_CUSTOM_VAR", "value": "hello"}]
        result = await _resolve_user_env(raw, None, None)
        assert result == {"MY_CUSTOM_VAR": "hello"}


# ---------------------------------------------------------------------------
# is_reserved_credential_name helper
# ---------------------------------------------------------------------------


class TestReservedCredentialNameHelper:
    @pytest.mark.parametrize(
        "name",
        [
            "MODAL_TOKEN_ID",
            "MODAL_TOKEN_SECRET",
            "modal_token_id",
            "modal_token_secret",
            "Modal_Token_Id",
            "Modal_Token_Secret",
        ],
    )
    def test_modal_token_keys_are_reserved(self, name: str) -> None:
        assert is_reserved_credential_name(name)

    def test_non_modal_reserved_names_still_reserved(self) -> None:
        assert is_reserved_credential_name("PHOENIX_SANDBOX_TOKEN")
        assert is_reserved_credential_name("PHOENIX_SANDBOX_API_KEY")
        assert is_reserved_credential_name("phoenix_sandbox_token")


# ---------------------------------------------------------------------------
# End-to-end: env vars reach execute() call site
# ---------------------------------------------------------------------------


async def _build_e2b_backend(config: dict[str, Any], session: Any) -> Any:
    """Call get_or_create_backend for E2B and return the E2BSandboxBackend instance."""
    from phoenix.server.sandbox.e2b_backend import E2BSandboxBackend

    adapter = E2BAdapter()
    with patch.dict("phoenix.server.sandbox._SANDBOX_ADAPTERS", {"E2B": adapter}):
        with patch.dict("os.environ", {"PHOENIX_SANDBOX_E2B_API_KEY": "test-key"}):
            backend = await get_or_create_backend(
                "E2B",
                config=config,
                session=session,
                decrypt=_identity_decrypt,
            )
    assert backend is not None
    assert isinstance(backend, E2BSandboxBackend)
    return backend


class TestEndToEndResolution:
    @pytest.mark.asyncio
    async def test_literal_env_var_forwarded_to_execute(self) -> None:
        config = {
            "template": "base",
            "env_vars": [{"kind": "literal", "name": "MY_VAR", "value": "hello_world"}],
        }
        captured: dict[str, Any] = {}

        async def fake_run_code(code: str, **kwargs: Any) -> Any:
            captured["envs"] = kwargs.get("envs")
            result = MagicMock()
            result.logs = MagicMock(stdout=["hello_world"], stderr=[])
            result.error = None
            return result

        backend = await _build_e2b_backend(config, _make_session({}))
        sandbox_mock = MagicMock()
        sandbox_mock.run_code = fake_run_code
        backend._sessions["s1"] = sandbox_mock

        result = await backend.execute("import os; print(os.environ['MY_VAR'])", "s1")
        assert captured["envs"] == {"MY_VAR": "hello_world"}
        assert result.stdout == "hello_world"

    @pytest.mark.asyncio
    async def test_multiple_literal_env_vars_all_forwarded(self) -> None:
        config = {
            "template": "base",
            "env_vars": [
                {"kind": "literal", "name": "A", "value": "1"},
                {"kind": "literal", "name": "B", "value": "2"},
            ],
        }
        captured: dict[str, Any] = {}

        async def fake_run_code(code: str, **kwargs: Any) -> Any:
            captured["envs"] = kwargs.get("envs")
            result = MagicMock()
            result.logs = MagicMock(stdout=[], stderr=[])
            result.error = None
            return result

        backend = await _build_e2b_backend(config, _make_session({}))
        sandbox_mock = MagicMock()
        sandbox_mock.run_code = fake_run_code
        backend._sessions["s1"] = sandbox_mock

        await backend.execute("...", "s1")
        assert captured["envs"] == {"A": "1", "B": "2"}

    @pytest.mark.asyncio
    async def test_secret_ref_resolved_and_forwarded_to_execute(self) -> None:
        config = {
            "template": "base",
            "env_vars": [{"kind": "secret_ref", "name": "API_KEY", "secret_key": "my-secret-key"}],
        }
        session = _make_session({"my-secret-key": b"supersecret_value"})
        captured: dict[str, Any] = {}

        async def fake_run_code(code: str, **kwargs: Any) -> Any:
            captured["envs"] = kwargs.get("envs")
            result = MagicMock()
            result.logs = MagicMock(stdout=["supersecret_value"], stderr=[])
            result.error = None
            return result

        backend = await _build_e2b_backend(config, session)
        sandbox_mock = MagicMock()
        sandbox_mock.run_code = fake_run_code
        backend._sessions["s1"] = sandbox_mock

        result = await backend.execute("import os; print(os.environ['API_KEY'])", "s1")
        assert captured["envs"] == {"API_KEY": "supersecret_value"}
        assert result.stdout == "supersecret_value"

    @pytest.mark.asyncio
    async def test_mixed_literal_and_secret_ref_both_forwarded(self) -> None:
        config = {
            "template": "base",
            "env_vars": [
                {"kind": "literal", "name": "PLAIN", "value": "plain_val"},
                {"kind": "secret_ref", "name": "SECRET", "secret_key": "stored-key"},
            ],
        }
        session = _make_session({"stored-key": b"secret_val"})
        captured: dict[str, Any] = {}

        async def fake_run_code(code: str, **kwargs: Any) -> Any:
            captured["envs"] = kwargs.get("envs")
            result = MagicMock()
            result.logs = MagicMock(stdout=[], stderr=[])
            result.error = None
            return result

        backend = await _build_e2b_backend(config, session)
        sandbox_mock = MagicMock()
        sandbox_mock.run_code = fake_run_code
        backend._sessions["s1"] = sandbox_mock

        await backend.execute("...", "s1")
        assert captured["envs"] == {"PLAIN": "plain_val", "SECRET": "secret_val"}

    @pytest.mark.asyncio
    async def test_raw_env_vars_list_not_leaked_into_execute_envs(self) -> None:
        """The raw env_vars list from config never appears in execute()'s envs kwarg."""
        config = {
            "template": "base",
            "env_vars": [{"kind": "literal", "name": "CLEAN", "value": "yes"}],
        }
        captured: dict[str, Any] = {}

        async def fake_run_code(code: str, **kwargs: Any) -> Any:
            captured["envs"] = kwargs.get("envs")
            result = MagicMock()
            result.logs = MagicMock(stdout=[], stderr=[])
            result.error = None
            return result

        backend = await _build_e2b_backend(config, _make_session({}))
        sandbox_mock = MagicMock()
        sandbox_mock.run_code = fake_run_code
        backend._sessions["s1"] = sandbox_mock

        await backend.execute("...", "s1")
        assert "env_vars" not in (captured.get("envs") or {})
        assert captured["envs"] == {"CLEAN": "yes"}
