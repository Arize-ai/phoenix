"""Parametrized contract tests for the unified sandbox adapter config contract.

Iterates over every key in SANDBOX_ADAPTER_METADATA and asserts that each
adapter's build_backend() enforces the flag/runtime agreement declared in the
metadata:

- supports_env_vars=False  → build_backend(user_env={..}) raises UnsupportedOperation
- internet_access="none"   → build_backend(config={"internet_access": {"mode": "allow"}})
                             raises UnsupportedOperation
- dependencies_language=None → build_backend(config={"dependencies": {"packages": ["x"]}})
                               raises UnsupportedOperation

Adapters that declare a capability as supported are NOT tested for rejection here
(the accept path is covered by test_user_env_forwarding.py and the per-adapter tests).

SDK mocking strategy:
- Modal: sys.modules["modal"] must be patched before ModalSandboxBackend.__init__
- Vercel: VERCEL_OIDC_TOKEN env var patches to allow backend construction to proceed
  past the credential check when testing non-internet_access/non-dependencies paths.
  For the rejection tests the guard fires before credential access so no mock needed.
- Deno/Daytona/E2B/WASM: construct without external SDKs.
"""

from __future__ import annotations

import sys
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA
from phoenix.server.sandbox.types import UnsupportedOperation

# ---------------------------------------------------------------------------
# Adapter instantiation helpers
# ---------------------------------------------------------------------------

_ADAPTER_MODULES = {
    "WASM": ("phoenix.server.sandbox.wasm_backend", "WASMAdapter"),
    "E2B": ("phoenix.server.sandbox.e2b_backend", "E2BAdapter"),
    "DAYTONA_PYTHON": ("phoenix.server.sandbox.daytona_backend", "DaytonaPythonAdapter"),
    "VERCEL_PYTHON": ("phoenix.server.sandbox.vercel_backend", "VercelPythonAdapter"),
    "VERCEL_TYPESCRIPT": ("phoenix.server.sandbox.vercel_backend", "VercelTypescriptAdapter"),
    "DENO": ("phoenix.server.sandbox.deno_backend", "DenoAdapter"),
    "MODAL": ("phoenix.server.sandbox.modal_backend", "ModalAdapter"),
}


def _get_adapter(key: str) -> Any:
    module_path, cls_name = _ADAPTER_MODULES[key]
    import importlib

    mod = importlib.import_module(module_path)
    return getattr(mod, cls_name)()


def _modal_mock() -> MagicMock:
    modal = MagicMock()
    modal.App.lookup.return_value = MagicMock()
    modal.Image.debian_slim.return_value = MagicMock()
    modal.Sandbox.create = MagicMock()
    modal.Sandbox.create.aio = MagicMock()
    return modal


# ---------------------------------------------------------------------------
# Contract test: supports_env_vars=False → reject non-empty user_env
# ---------------------------------------------------------------------------

_ADAPTERS_WITHOUT_ENV_VARS = [
    key for key, meta in SANDBOX_ADAPTER_METADATA.items() if not meta.supports_env_vars
]


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_ENV_VARS)
def test_env_vars_false_raises_for_non_empty_user_env(adapter_key: str) -> None:
    adapter = _get_adapter(adapter_key)
    with pytest.raises(UnsupportedOperation):
        adapter.build_backend({}, user_env={"SECRET": "value"})


# ---------------------------------------------------------------------------
# Contract test: internet_access="none" → reject non-"none" internet_access config
# ---------------------------------------------------------------------------

_ADAPTERS_WITHOUT_INTERNET_ACCESS = [
    key
    for key, meta in SANDBOX_ADAPTER_METADATA.items()
    if meta.internet_access_capability == "none"
]

_INTERNET_ACCESS_CONFIG = {"internet_access": {"mode": "allow"}}


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_INTERNET_ACCESS)
def test_internet_access_none_raises_for_non_none_config(adapter_key: str) -> None:
    if adapter_key == "MODAL":
        modal_mock = _modal_mock()
        with patch.dict(sys.modules, {"modal": modal_mock}):
            adapter = _get_adapter(adapter_key)
            with pytest.raises(UnsupportedOperation):
                adapter.build_backend(_INTERNET_ACCESS_CONFIG)
    elif adapter_key in ("VERCEL_PYTHON", "VERCEL_TYPESCRIPT"):
        # Guard fires before credential check; no env patching needed.
        adapter = _get_adapter(adapter_key)
        with pytest.raises(UnsupportedOperation):
            adapter.build_backend(_INTERNET_ACCESS_CONFIG)
    else:
        adapter = _get_adapter(adapter_key)
        with pytest.raises(UnsupportedOperation):
            adapter.build_backend(_INTERNET_ACCESS_CONFIG)


# ---------------------------------------------------------------------------
# Contract test: dependencies_language=None → reject non-empty packages
# ---------------------------------------------------------------------------

_ADAPTERS_WITHOUT_DEPENDENCIES = [
    key for key, meta in SANDBOX_ADAPTER_METADATA.items() if meta.dependencies_language is None
]

_DEPENDENCIES_CONFIG = {"dependencies": {"packages": ["numpy"]}}


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_DEPENDENCIES)
def test_dependencies_none_raises_for_non_empty_packages(adapter_key: str) -> None:
    if adapter_key == "MODAL":
        modal_mock = _modal_mock()
        with patch.dict(sys.modules, {"modal": modal_mock}):
            adapter = _get_adapter(adapter_key)
            with pytest.raises(UnsupportedOperation):
                adapter.build_backend(_DEPENDENCIES_CONFIG)
    elif adapter_key in ("VERCEL_PYTHON", "VERCEL_TYPESCRIPT"):
        # Guard fires before credential check.
        adapter = _get_adapter(adapter_key)
        with pytest.raises(UnsupportedOperation):
            adapter.build_backend(_DEPENDENCIES_CONFIG)
    else:
        adapter = _get_adapter(adapter_key)
        with pytest.raises(UnsupportedOperation):
            adapter.build_backend(_DEPENDENCIES_CONFIG)


# ---------------------------------------------------------------------------
# Metadata structural contract: every key in SANDBOX_ADAPTER_METADATA must
# have a registered adapter module entry so the runtime tests above cover it.
# ---------------------------------------------------------------------------


def test_all_metadata_keys_have_adapter_module_entry() -> None:
    missing = set(SANDBOX_ADAPTER_METADATA.keys()) - set(_ADAPTER_MODULES.keys())
    assert not missing, (
        f"Adapters in SANDBOX_ADAPTER_METADATA have no entry in _ADAPTER_MODULES: {missing}. "
        "Add an entry to _ADAPTER_MODULES in this test file."
    )
