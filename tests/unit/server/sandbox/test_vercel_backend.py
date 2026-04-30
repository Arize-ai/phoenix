"""Unit tests for VercelSandboxBackend.

Scope: Vercel-specific SDK kwarg shapes and OIDC token forwarding.
Cross-adapter capability conformance lives in test_unified_config_contract.py.
"""

from __future__ import annotations

import os
import sys
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from phoenix.server.sandbox.vercel_backend import (
    ENV_VERCEL_OIDC_TOKEN,
    VercelSandboxBackend,
)


def _make_vercel_sdk_mock() -> tuple[MagicMock, list[str | None]]:
    """Return (sdk module mock, list capturing os.environ[VERCEL_OIDC_TOKEN]
    snapshots taken at AsyncSandbox.create() invocation time).

    The captured snapshots let tests assert what the SDK would have read from
    the env synchronously at the top of create() — i.e. whether Phoenix's env
    injection actually took effect at the moment the SDK reads it.
    """
    captured_env: list[str | None] = []

    async def _create(**_: Any) -> Any:
        captured_env.append(os.environ.get(ENV_VERCEL_OIDC_TOKEN))
        sandbox = MagicMock()
        sandbox.stop = AsyncMock()
        sandbox.client = MagicMock()
        sandbox.client.aclose = AsyncMock()
        return sandbox

    sdk = MagicMock()
    sdk.AsyncSandbox = MagicMock()
    sdk.AsyncSandbox.create = _create
    return sdk, captured_env


@pytest.fixture
def patched_vercel_sdk() -> Any:
    """Patch the vercel.sandbox module in sys.modules so the deferred import
    inside _create_sandbox resolves to our mock.
    """
    sdk, captured_env = _make_vercel_sdk_mock()
    parent = MagicMock()
    parent.sandbox = sdk
    with patch.dict(sys.modules, {"vercel": parent, "vercel.sandbox": sdk}):
        yield sdk, captured_env


@pytest.mark.asyncio
async def test_oidc_token_injected_into_env_around_create(
    patched_vercel_sdk: tuple[MagicMock, list[str | None]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When oidc_token is provided, _create_sandbox must place it in
    os.environ[VERCEL_OIDC_TOKEN] BEFORE invoking AsyncSandbox.create().

    Regression guard: previously the adapter passed use_oidc_env=True without
    the token value, leaving _create_sandbox to call AsyncSandbox.create()
    with no auth — the SDK then read an empty VERCEL_OIDC_TOKEN from env when
    the token was sourced from the DB rather than the process environment.
    """
    _, captured_env = patched_vercel_sdk
    monkeypatch.delenv(ENV_VERCEL_OIDC_TOKEN, raising=False)

    backend = VercelSandboxBackend(oidc_token="db-resolved-token", language="PYTHON")
    await backend._create_sandbox()

    assert captured_env == ["db-resolved-token"], (
        "AsyncSandbox.create() must observe the resolved OIDC token in "
        f"os.environ[VERCEL_OIDC_TOKEN]; got {captured_env!r}"
    )


@pytest.mark.asyncio
async def test_oidc_token_env_restored_after_create(
    patched_vercel_sdk: tuple[MagicMock, list[str | None]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """After _create_sandbox returns, os.environ must be restored — set if it
    was set, unset if it was unset. Otherwise per-evaluator OIDC tokens leak
    process-wide.
    """
    monkeypatch.delenv(ENV_VERCEL_OIDC_TOKEN, raising=False)
    backend = VercelSandboxBackend(oidc_token="ephemeral-token", language="PYTHON")
    await backend._create_sandbox()
    assert os.environ.get(ENV_VERCEL_OIDC_TOKEN) is None, (
        "VERCEL_OIDC_TOKEN must be removed from env after create when it was "
        "absent before — Phoenix's resolved token must not leak."
    )


@pytest.mark.asyncio
async def test_preexisting_oidc_env_value_restored_after_create(
    patched_vercel_sdk: tuple[MagicMock, list[str | None]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If VERCEL_OIDC_TOKEN was already set in env (e.g. user-provided),
    _create_sandbox must restore that value after temporarily overriding it.
    """
    monkeypatch.setenv(ENV_VERCEL_OIDC_TOKEN, "user-env-token")
    backend = VercelSandboxBackend(oidc_token="db-token", language="PYTHON")
    _, captured_env = patched_vercel_sdk
    await backend._create_sandbox()
    # SDK saw the DB-sourced token (Phoenix's resolution wins).
    assert captured_env == ["db-token"]
    # Original env value is restored.
    assert os.environ.get(ENV_VERCEL_OIDC_TOKEN) == "user-env-token"


@pytest.mark.asyncio
async def test_access_token_path_does_not_touch_oidc_env(
    patched_vercel_sdk: tuple[MagicMock, list[str | None]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Access-token triple path passes credentials as create() kwargs; it must
    NOT mutate VERCEL_OIDC_TOKEN env even briefly.
    """
    monkeypatch.delenv(ENV_VERCEL_OIDC_TOKEN, raising=False)
    backend = VercelSandboxBackend(token="t", project_id="p", team_id="m", language="PYTHON")
    _, captured_env = patched_vercel_sdk
    await backend._create_sandbox()
    # Env was never set during create.
    assert captured_env == [None]
    assert os.environ.get(ENV_VERCEL_OIDC_TOKEN) is None


def test_constructor_rejects_no_credentials() -> None:
    with pytest.raises(ValueError, match="oidc_token"):
        VercelSandboxBackend(language="PYTHON")
