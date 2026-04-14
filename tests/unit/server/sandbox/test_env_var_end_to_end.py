"""End-to-end tests for env var injection through the full pipeline.

Tests exercise get_or_create_backend() → _resolve_user_env() → adapter.build_backend()
→ backend.execute() with env vars visible in the executed code's environment.

All tests use mocked SDK calls so they run without real E2B credentials.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from phoenix.server.sandbox import MissingSecretError, get_or_create_backend

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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


async def _build_e2b_backend(config: dict[str, Any], session: Any) -> Any:
    """Call get_or_create_backend for E2B and return the E2BSandboxBackend instance."""
    from phoenix.server.sandbox.e2b_backend import E2BAdapter, E2BSandboxBackend

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


# ---------------------------------------------------------------------------
# E2B: literal env var reaches execute() call
# ---------------------------------------------------------------------------


class TestE2BLiteralEnvVarEndToEnd:
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


# ---------------------------------------------------------------------------
# E2B: secret_ref env var resolves and reaches execute()
# ---------------------------------------------------------------------------


class TestE2BSecretRefEnvVarEndToEnd:
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


# ---------------------------------------------------------------------------
# Missing secret_ref surfaces a structured error
# ---------------------------------------------------------------------------


class TestMissingSecretRefEndToEnd:
    @pytest.mark.asyncio
    async def test_missing_secret_ref_raises_missing_secret_error(self) -> None:
        from phoenix.server.sandbox.e2b_backend import E2BAdapter

        config = {
            "template": "base",
            "env_vars": [
                {"kind": "secret_ref", "name": "MISSING_VAR", "secret_key": "does-not-exist"}
            ],
        }
        adapter = E2BAdapter()
        with patch.dict("phoenix.server.sandbox._SANDBOX_ADAPTERS", {"E2B": adapter}):
            with patch.dict("os.environ", {"PHOENIX_SANDBOX_E2B_API_KEY": "test-key"}):
                with pytest.raises(MissingSecretError, match="does-not-exist"):
                    await get_or_create_backend(
                        "E2B",
                        config=config,
                        session=_make_session({}),
                        decrypt=_identity_decrypt,
                    )

    @pytest.mark.asyncio
    async def test_missing_secret_error_not_silenced_by_broad_except(self) -> None:
        from phoenix.server.sandbox.e2b_backend import E2BAdapter

        config = {"env_vars": [{"kind": "secret_ref", "name": "X", "secret_key": "absent"}]}
        adapter = E2BAdapter()
        with patch.dict("phoenix.server.sandbox._SANDBOX_ADAPTERS", {"E2B": adapter}):
            with patch.dict("os.environ", {"PHOENIX_SANDBOX_E2B_API_KEY": "test-key"}):
                with pytest.raises(MissingSecretError):
                    await get_or_create_backend(
                        "E2B",
                        config=config,
                        session=_make_session({}),
                        decrypt=_identity_decrypt,
                    )

    @pytest.mark.asyncio
    async def test_partial_missing_secret_raises_for_absent_key(self) -> None:
        from phoenix.server.sandbox.e2b_backend import E2BAdapter

        config = {
            "env_vars": [
                {"kind": "secret_ref", "name": "GOOD", "secret_key": "exists"},
                {"kind": "secret_ref", "name": "BAD", "secret_key": "missing"},
            ]
        }
        adapter = E2BAdapter()
        with patch.dict("phoenix.server.sandbox._SANDBOX_ADAPTERS", {"E2B": adapter}):
            with patch.dict("os.environ", {"PHOENIX_SANDBOX_E2B_API_KEY": "test-key"}):
                with pytest.raises(MissingSecretError, match="missing"):
                    await get_or_create_backend(
                        "E2B",
                        config=config,
                        session=_make_session({"exists": b"ok"}),
                        decrypt=_identity_decrypt,
                    )


# ---------------------------------------------------------------------------
# Fail-secure: env vars are never silently dropped
# ---------------------------------------------------------------------------


class TestEnvVarFailSecure:
    @pytest.mark.asyncio
    async def test_no_env_vars_in_config_passes_none_as_user_env(self) -> None:
        """When config has no env_vars, user_env=None → backend stores empty dict."""
        from phoenix.server.sandbox.e2b_backend import E2BSandboxBackend

        backend = await _build_e2b_backend({"template": "base"}, _make_session({}))
        assert isinstance(backend, E2BSandboxBackend)
        assert backend._user_env == {}

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
