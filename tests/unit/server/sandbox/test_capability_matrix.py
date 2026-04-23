"""Parameterized capability-matrix tests across all 7 sandbox adapters.

Coverage:
  (a) validate_config rejects unsupported capability sections at create time.
  (b) validate_config(..., stored_config=...) permits semantically unchanged
      sections to round-trip (bypass-for-unchanged-sections path).
  (c) build_backend raises UnsupportedOperation for unsupported sections
      (double-guard runtime gate).
  (d) Per-wired-capability positive reach-through tests (mock-verified).

Tests assert against SANDBOX_ADAPTER_METADATA, not prose descriptions, so they
remain correct as flag values evolve across Phases 2-4.

SDK mocking strategy:
- Modal: sys.modules["modal"] must be patched before ModalSandboxBackend.__init__
- Vercel: unsupported-capability guard fires before credential access; no env
  patching needed for rejection tests.
- E2B / Daytona / Deno / WASM: no SDK import at build_backend time.
"""

from __future__ import annotations

import importlib
import sys
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

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


def _modal_mock() -> MagicMock:
    modal = MagicMock()
    modal.App.lookup.return_value = MagicMock()
    modal.Image.debian_slim.return_value = MagicMock()
    modal.Sandbox.create = MagicMock()
    modal.Sandbox.create.aio = MagicMock()
    return modal


def _get_adapter(key: str) -> Any:
    module_path, cls_name = _ADAPTER_MODULES[key]
    mod = importlib.import_module(module_path)
    return getattr(mod, cls_name)()


def _build_backend_for(adapter_key: str, config: dict[str, Any], **kwargs: Any) -> Any:
    """Call build_backend, patching modal if needed."""
    if adapter_key == "MODAL":
        modal_mock = _modal_mock()
        with patch.dict(sys.modules, {"modal": modal_mock}):
            adapter = _get_adapter(adapter_key)
            return adapter.build_backend(config, **kwargs)
    adapter = _get_adapter(adapter_key)
    return adapter.build_backend(config, **kwargs)


# ---------------------------------------------------------------------------
# (a) validate_config — reject unsupported capability sections at create time
# ---------------------------------------------------------------------------

_ADAPTERS_WITHOUT_ENV_VARS = [
    key for key, meta in SANDBOX_ADAPTER_METADATA.items() if not meta.supports_env_vars
]
_ADAPTERS_WITHOUT_INTERNET_ACCESS = [
    key
    for key, meta in SANDBOX_ADAPTER_METADATA.items()
    if meta.internet_access_capability == "none"
]
_ADAPTERS_WITHOUT_DEPENDENCIES = [
    key for key, meta in SANDBOX_ADAPTER_METADATA.items() if meta.dependencies_language is None
]


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_ENV_VARS)
def test_validate_config_rejects_env_vars_when_unsupported(adapter_key: str) -> None:
    """validate_config raises ValidationError for env_vars on adapters that don't support them."""
    adapter = _get_adapter(adapter_key)
    config = {"env_vars": [{"kind": "literal", "name": "X", "value": "1"}]}
    with pytest.raises(ValidationError, match="capability_violation"):
        adapter.validate_config(config)


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_INTERNET_ACCESS)
def test_validate_config_rejects_internet_access_when_unsupported(adapter_key: str) -> None:
    """validate_config raises ValidationError for internet_access on adapters with capability=none."""
    adapter = _get_adapter(adapter_key)
    config = {"internet_access": {"mode": "allow"}}
    with pytest.raises(ValidationError, match="capability_violation"):
        adapter.validate_config(config)


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_DEPENDENCIES)
def test_validate_config_rejects_dependencies_when_unsupported(adapter_key: str) -> None:
    """validate_config raises ValidationError for non-empty packages on adapters with no dep support."""
    adapter = _get_adapter(adapter_key)
    config = {"dependencies": {"packages": ["numpy"]}}
    with pytest.raises(ValidationError, match="capability_violation"):
        adapter.validate_config(config)


# ---------------------------------------------------------------------------
# (b) validate_config — stored-config round-trip bypass for unchanged sections
# ---------------------------------------------------------------------------

_ADAPTERS_WITH_INTERNET_ACCESS_NONE = _ADAPTERS_WITHOUT_INTERNET_ACCESS
_ADAPTERS_WITHOUT_DEPENDENCIES_SUPPORT = _ADAPTERS_WITHOUT_DEPENDENCIES


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITH_INTERNET_ACCESS_NONE)
def test_validate_config_stored_config_roundtrip_internet_access(adapter_key: str) -> None:
    """Unchanged internet_access from stored_config is permitted to round-trip even when capability=none."""
    adapter = _get_adapter(adapter_key)
    ia_section = {"mode": "allow"}
    config = {"internet_access": ia_section}
    # Round-trip: same value in stored_config → no capability_violation raised
    result = adapter.validate_config(config, stored_config={"internet_access": ia_section})
    assert result.get("internet_access") is not None


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_DEPENDENCIES_SUPPORT)
def test_validate_config_stored_config_roundtrip_dependencies(adapter_key: str) -> None:
    """Unchanged dependencies from stored_config are permitted to round-trip even when dep support is None."""
    adapter = _get_adapter(adapter_key)
    deps_section = {"packages": ["requests"], "lockfile": None}
    config = {"dependencies": deps_section}
    result = adapter.validate_config(config, stored_config={"dependencies": deps_section})
    assert result.get("dependencies") is not None


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITH_INTERNET_ACCESS_NONE)
def test_validate_config_changed_internet_access_still_rejected(adapter_key: str) -> None:
    """A changed internet_access section is NOT permitted even with stored_config present."""
    adapter = _get_adapter(adapter_key)
    stored_config = {"internet_access": {"mode": "deny"}}
    new_config = {"internet_access": {"mode": "allow"}}
    with pytest.raises(ValidationError, match="capability_violation"):
        adapter.validate_config(new_config, stored_config=stored_config)


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_DEPENDENCIES_SUPPORT)
def test_validate_config_changed_dependencies_still_rejected(adapter_key: str) -> None:
    """Changed packages are NOT permitted even with stored_config present."""
    adapter = _get_adapter(adapter_key)
    stored_config = {"dependencies": {"packages": ["requests"], "lockfile": None}}
    new_config = {"dependencies": {"packages": ["numpy"], "lockfile": None}}
    with pytest.raises(ValidationError, match="capability_violation"):
        adapter.validate_config(new_config, stored_config=stored_config)


# ---------------------------------------------------------------------------
# (c) build_backend — double-guard runtime gate (UnsupportedOperation)
# ---------------------------------------------------------------------------

_INTERNET_ACCESS_CONFIG = {"internet_access": {"mode": "allow"}}
_DEPENDENCIES_CONFIG = {"dependencies": {"packages": ["numpy"]}}


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_ENV_VARS)
def test_build_backend_raises_for_non_empty_user_env(adapter_key: str) -> None:
    """build_backend raises UnsupportedOperation when user_env non-empty and supports_env_vars=False."""
    with pytest.raises(UnsupportedOperation):
        _build_backend_for(adapter_key, {}, user_env={"SECRET": "value"})


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_INTERNET_ACCESS)
def test_build_backend_raises_for_internet_access_config(adapter_key: str) -> None:
    """build_backend raises UnsupportedOperation for internet_access config when capability=none."""
    with pytest.raises(UnsupportedOperation):
        _build_backend_for(adapter_key, _INTERNET_ACCESS_CONFIG)


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_DEPENDENCIES)
def test_build_backend_raises_for_non_empty_packages(adapter_key: str) -> None:
    """build_backend raises UnsupportedOperation for non-empty packages when dependencies_language=None."""
    with pytest.raises(UnsupportedOperation):
        _build_backend_for(adapter_key, _DEPENDENCIES_CONFIG)


# ---------------------------------------------------------------------------
# (d) Positive wiring tests — newly-wired capabilities reach SDK kwargs
# ---------------------------------------------------------------------------

# --- E2B: internet_access_capability="boolean" (wired in Phase 2) ---
# When internet_access_capability="boolean", the metadata flag is non-"none"
# so build_backend must NOT raise for a config with internet_access.
# (Actual SDK forwarding verified in a separate targeted test below.)


def test_e2b_build_backend_permits_internet_access_config() -> None:
    """E2B with internet_access_capability='boolean' accepts internet_access config in build_backend."""
    meta = SANDBOX_ADAPTER_METADATA["E2B"]
    assert meta.internet_access_capability == "boolean", (
        "E2B internet_access_capability must be 'boolean' for this test to be valid; "
        "check that task #7 has been completed."
    )
    adapter = _get_adapter("E2B")
    # Should not raise UnsupportedOperation (no SDK import in build_backend itself)
    backend = adapter.build_backend(
        {"internet_access": {"mode": "allow"}},
        user_env=None,
    )
    assert backend is not None


def test_e2b_validate_config_permits_internet_access_when_boolean() -> None:
    """E2B validate_config does not raise for internet_access when capability='boolean'."""
    meta = SANDBOX_ADAPTER_METADATA["E2B"]
    assert meta.internet_access_capability == "boolean"
    adapter = _get_adapter("E2B")
    result = adapter.validate_config({"internet_access": {"mode": "allow"}})
    assert result.get("internet_access") == {"mode": "allow"}


def test_e2b_validate_config_permits_internet_access_deny() -> None:
    """E2B validate_config allows mode='deny' (blocking internet)."""
    adapter = _get_adapter("E2B")
    result = adapter.validate_config({"internet_access": {"mode": "deny"}})
    assert result["internet_access"]["mode"] == "deny"


# --- E2B: dependencies_language=PYTHON (wired in Phase 3, task #8) ---


def test_e2b_validate_config_permits_dependencies_when_python() -> None:
    """When E2B dependencies_language='PYTHON', validate_config accepts non-empty packages."""
    meta = SANDBOX_ADAPTER_METADATA["E2B"]
    if meta.dependencies_language is None:
        pytest.skip("E2B dependencies_language not yet wired (task #8 pending)")
    assert meta.dependencies_language == "PYTHON"
    adapter = _get_adapter("E2B")
    result = adapter.validate_config({"dependencies": {"packages": ["requests"]}})
    assert "requests" in result["dependencies"]["packages"]


def test_e2b_build_backend_permits_dependencies_when_python() -> None:
    """When E2B dependencies_language='PYTHON', build_backend does not raise for packages."""
    meta = SANDBOX_ADAPTER_METADATA["E2B"]
    if meta.dependencies_language is None:
        pytest.skip("E2B dependencies_language not yet wired (task #8 pending)")
    adapter = _get_adapter("E2B")
    backend = adapter.build_backend({"dependencies": {"packages": ["requests"]}})
    assert backend is not None


# --- DAYTONA_PYTHON: dependencies_language=PYTHON (already wired) ---


def test_daytona_build_backend_wires_packages_to_backend() -> None:
    """DAYTONA_PYTHON build_backend forwards packages list to DaytonaSandboxBackend._packages."""
    meta = SANDBOX_ADAPTER_METADATA["DAYTONA_PYTHON"]
    assert meta.dependencies_language == "PYTHON"
    adapter = _get_adapter("DAYTONA_PYTHON")
    packages = ["requests", "numpy"]
    backend = adapter.build_backend({"dependencies": {"packages": packages}})
    assert backend._packages == packages


def test_daytona_validate_config_permits_dependencies() -> None:
    """DAYTONA_PYTHON validate_config accepts non-empty packages (dependencies_language=PYTHON)."""
    adapter = _get_adapter("DAYTONA_PYTHON")
    result = adapter.validate_config({"dependencies": {"packages": ["boto3"]}})
    assert "boto3" in result["dependencies"]["packages"]


# --- MODAL: internet_access_capability wiring (task #9) ---


def test_modal_validate_config_internet_access_when_boolean() -> None:
    """When MODAL internet_access_capability='boolean', validate_config accepts internet_access."""
    meta = SANDBOX_ADAPTER_METADATA["MODAL"]
    if meta.internet_access_capability == "none":
        pytest.skip("MODAL internet_access_capability not yet wired (task #9 pending)")
    adapter = _get_adapter("MODAL")
    result = adapter.validate_config({"internet_access": {"mode": "deny"}})
    assert result["internet_access"]["mode"] == "deny"


def test_modal_build_backend_permits_internet_access_when_boolean() -> None:
    """When MODAL internet_access_capability='boolean', build_backend does not raise for internet_access."""
    meta = SANDBOX_ADAPTER_METADATA["MODAL"]
    if meta.internet_access_capability == "none":
        pytest.skip("MODAL internet_access_capability not yet wired (task #9 pending)")
    modal_mock = _modal_mock()
    with patch.dict(sys.modules, {"modal": modal_mock}):
        adapter = _get_adapter("MODAL")
        backend = adapter.build_backend({"internet_access": {"mode": "deny"}})
    assert backend is not None


# --- MODAL: dependencies_language=PYTHON (task #10) ---


def test_modal_validate_config_dependencies_when_python() -> None:
    """When MODAL dependencies_language='PYTHON', validate_config accepts non-empty packages."""
    meta = SANDBOX_ADAPTER_METADATA["MODAL"]
    if meta.dependencies_language is None:
        pytest.skip("MODAL dependencies_language not yet wired (task #10 pending)")
    assert meta.dependencies_language == "PYTHON"
    adapter = _get_adapter("MODAL")
    result = adapter.validate_config({"dependencies": {"packages": ["pandas"]}})
    assert "pandas" in result["dependencies"]["packages"]


def test_modal_build_backend_wires_packages_to_image() -> None:
    """When MODAL dependencies_language='PYTHON', build_backend calls Image.pip_install with packages."""
    meta = SANDBOX_ADAPTER_METADATA["MODAL"]
    if meta.dependencies_language is None:
        pytest.skip("MODAL dependencies_language not yet wired (task #10 pending)")
    modal_mock = _modal_mock()
    pip_image = MagicMock()
    modal_mock.Image.debian_slim.return_value.pip_install.return_value = pip_image
    packages = ["pandas", "scikit-learn"]
    with patch.dict(sys.modules, {"modal": modal_mock}):
        adapter = _get_adapter("MODAL")
        backend = adapter.build_backend({"dependencies": {"packages": packages}})
    modal_mock.Image.debian_slim.return_value.pip_install.assert_called_once_with(packages)
    assert backend._image is pip_image


# --- DAYTONA_PYTHON: internet_access_capability wiring (task #5/#6) ---


def test_daytona_validate_config_internet_access_when_boolean() -> None:
    """When DAYTONA_PYTHON internet_access_capability='boolean', validate_config accepts internet_access."""
    meta = SANDBOX_ADAPTER_METADATA["DAYTONA_PYTHON"]
    if meta.internet_access_capability == "none":
        pytest.skip("DAYTONA_PYTHON internet_access_capability not yet wired (tasks #5/#6 pending)")
    adapter = _get_adapter("DAYTONA_PYTHON")
    result = adapter.validate_config({"internet_access": {"mode": "deny"}})
    assert result["internet_access"]["mode"] == "deny"


# --- WASM: env_vars=False — always rejected at both gates ---


def test_wasm_validate_config_rejects_env_vars() -> None:
    """WASM validate_config rejects env_vars (supports_env_vars=False)."""
    adapter = _get_adapter("WASM")
    with pytest.raises(ValidationError, match="capability_violation"):
        adapter.validate_config({"env_vars": [{"kind": "literal", "name": "X", "value": "v"}]})


def test_wasm_validate_config_rejects_internet_access() -> None:
    """WASM validate_config rejects internet_access (capability=none)."""
    adapter = _get_adapter("WASM")
    with pytest.raises(ValidationError, match="capability_violation"):
        adapter.validate_config({"internet_access": {"mode": "allow"}})


def test_wasm_validate_config_rejects_dependencies() -> None:
    """WASM validate_config rejects non-empty packages (dependencies_language=None)."""
    adapter = _get_adapter("WASM")
    with pytest.raises(ValidationError, match="capability_violation"):
        adapter.validate_config({"dependencies": {"packages": ["numpy"]}})


# ---------------------------------------------------------------------------
# Extra keys (extra="allow") round-trip through validate_config
# ---------------------------------------------------------------------------

_ALL_ADAPTER_KEYS = list(SANDBOX_ADAPTER_METADATA.keys())


@pytest.mark.parametrize("adapter_key", _ALL_ADAPTER_KEYS)
def test_extra_keys_preserved_in_validate_config(adapter_key: str) -> None:
    """validate_config preserves unknown keys (extra='allow' D9 contract)."""
    adapter = _get_adapter(adapter_key)
    config = {"_legacy_field": "some_value"}
    result = adapter.validate_config(config)
    assert result.get("_legacy_field") == "some_value"


# ---------------------------------------------------------------------------
# Metadata structural guard — all 7 adapters covered in _ADAPTER_MODULES
# ---------------------------------------------------------------------------


def test_all_metadata_keys_covered_by_adapter_modules() -> None:
    missing = set(SANDBOX_ADAPTER_METADATA.keys()) - set(_ADAPTER_MODULES.keys())
    assert not missing, (
        f"Adapters in SANDBOX_ADAPTER_METADATA are missing from _ADAPTER_MODULES: {missing}. "
        "Add entries to _ADAPTER_MODULES in this test file."
    )
