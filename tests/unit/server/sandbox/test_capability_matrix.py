"""Parameterized capability-matrix tests across all 8 sandbox adapters.

Coverage:
  (a) validate_config rejects unsupported capability sections at create time.
  (b) build_backend raises UnsupportedOperation for unsupported sections
      (double-guard runtime gate).
  (c) Per-wired-capability positive reach-through tests (mock-verified).

Tests assert against SANDBOX_ADAPTER_METADATA, not prose descriptions, so they
remain correct as flag values evolve.

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
    "DAYTONA_TYPESCRIPT": (
        "phoenix.server.sandbox.daytona_backend",
        "DaytonaTypescriptAdapter",
    ),
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
    """validate_config rejects env_vars on adapters that don't support them.

    Two rejection paths are acceptable:
    - Adapter declares the field but capability=false → gate raises ValidationError
    - Adapter doesn't declare the field → pydantic extra="forbid" raises, wrapped as ValueError
    """
    adapter = _get_adapter(adapter_key)
    config = {"env_vars": [{"kind": "literal", "name": "X", "value": "1"}]}
    with pytest.raises((ValidationError, ValueError)):
        adapter.validate_config(config)


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_INTERNET_ACCESS)
def test_validate_config_rejects_internet_access_when_unsupported(adapter_key: str) -> None:
    """validate_config rejects internet_access on adapters with capability=none."""
    adapter = _get_adapter(adapter_key)
    config = {"internet_access": {"mode": "allow"}}
    with pytest.raises((ValidationError, ValueError)):
        adapter.validate_config(config)


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_DEPENDENCIES)
def test_validate_config_rejects_dependencies_when_unsupported(adapter_key: str) -> None:
    """validate_config rejects non-empty packages on adapters with no dep support."""
    adapter = _get_adapter(adapter_key)
    config = {"dependencies": {"packages": ["numpy"]}}
    with pytest.raises((ValidationError, ValueError)):
        adapter.validate_config(config)


# ---------------------------------------------------------------------------
# (b) build_backend — double-guard runtime gate (UnsupportedOperation)
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
# (d) Positive: supported capabilities validate + build without raising
# ---------------------------------------------------------------------------

_ADAPTERS_WITH_INTERNET_ACCESS = [
    key
    for key, meta in SANDBOX_ADAPTER_METADATA.items()
    if meta.internet_access_capability != "none"
]
_ADAPTERS_WITH_DEPENDENCIES = [
    key for key, meta in SANDBOX_ADAPTER_METADATA.items() if meta.dependencies_language is not None
]


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITH_INTERNET_ACCESS)
def test_validate_config_permits_internet_access_when_supported(adapter_key: str) -> None:
    adapter = _get_adapter(adapter_key)
    result = adapter.validate_config({"internet_access": {"mode": "allow"}})
    assert result["internet_access"]["mode"] == "allow"


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITH_DEPENDENCIES)
def test_validate_config_permits_dependencies_when_supported(adapter_key: str) -> None:
    adapter = _get_adapter(adapter_key)
    result = adapter.validate_config({"dependencies": {"packages": ["requests"]}})
    assert "requests" in result["dependencies"]["packages"]


# --- SDK-wiring assertions (irreducible — each SDK has different kwarg names) ---


def test_daytona_build_backend_wires_packages_to_backend() -> None:
    """DAYTONA_PYTHON build_backend forwards packages list to DaytonaSandboxBackend._packages."""
    adapter = _get_adapter("DAYTONA_PYTHON")
    packages = ["requests", "numpy"]
    backend = adapter.build_backend(
        {
            "PHOENIX_SANDBOX_DAYTONA_API_KEY": "k",
            "dependencies": {"packages": packages},
        }
    )
    assert backend._packages == packages


@pytest.mark.parametrize("adapter_key", ["VERCEL_PYTHON", "VERCEL_TYPESCRIPT"])
def test_vercel_build_backend_wires_packages_to_backend(adapter_key: str) -> None:
    """VERCEL_* build_backend forwards packages list to VercelSandboxBackend._packages."""
    adapter = _get_adapter(adapter_key)
    packages = ["requests", "numpy"]
    config = {
        "VERCEL_TOKEN": "t",
        "VERCEL_PROJECT_ID": "p",
        "VERCEL_TEAM_ID": "m",
        "dependencies": {"packages": packages},
    }
    backend = adapter.build_backend(config)
    assert backend._packages == packages


def test_modal_build_backend_wires_packages_to_image() -> None:
    """MODAL build_backend calls Image.pip_install with packages."""
    modal_mock = _modal_mock()
    pip_image = MagicMock()
    modal_mock.Image.debian_slim.return_value.pip_install.return_value = pip_image
    packages = ["pandas", "scikit-learn"]
    with patch.dict(sys.modules, {"modal": modal_mock}):
        adapter = _get_adapter("MODAL")
        backend = adapter.build_backend(
            {
                "MODAL_TOKEN_ID": "id",
                "MODAL_TOKEN_SECRET": "secret",
                "dependencies": {"packages": packages},
            }
        )
    modal_mock.Image.debian_slim.return_value.pip_install.assert_called_once_with(packages)
    assert backend._image is pip_image


# ---------------------------------------------------------------------------
# Extra keys (extra="forbid") rejected by validate_config
# ---------------------------------------------------------------------------

_ALL_ADAPTER_KEYS = list(SANDBOX_ADAPTER_METADATA.keys())


@pytest.mark.parametrize("adapter_key", _ALL_ADAPTER_KEYS)
def test_extra_keys_rejected_in_validate_config(adapter_key: str) -> None:
    """validate_config rejects unknown keys (extra='forbid' contract)."""
    adapter = _get_adapter(adapter_key)
    config = {"_unknown_field": "some_value"}
    with pytest.raises(ValueError):
        adapter.validate_config(config)


# ---------------------------------------------------------------------------
# Metadata structural guard — all 7 adapters covered in _ADAPTER_MODULES
# ---------------------------------------------------------------------------


def test_all_metadata_keys_covered_by_adapter_modules() -> None:
    missing = set(SANDBOX_ADAPTER_METADATA.keys()) - set(_ADAPTER_MODULES.keys())
    assert not missing, (
        f"Adapters in SANDBOX_ADAPTER_METADATA are missing from _ADAPTER_MODULES: {missing}. "
        "Add entries to _ADAPTER_MODULES in this test file."
    )


# ---------------------------------------------------------------------------
# Removed scalar fields rejected by validate_config (extra="forbid")
# ---------------------------------------------------------------------------

_REMOVED_FIELD_CASES = [
    ("E2B", "template", "custom-template"),
    ("E2B", "cwd", "/workspace"),
    ("E2B", "metadata", "some-metadata"),
    ("DAYTONA_PYTHON", "server_url", "https://example.com"),
    ("MODAL", "app_name", "my-app"),
    ("MODAL", "timeout", 300),
    ("MODAL", "idle_timeout", 120),
]


@pytest.mark.parametrize("adapter_key,field,value", _REMOVED_FIELD_CASES)
def test_removed_scalar_fields_rejected_by_validate_config(
    adapter_key: str, field: str, value: object
) -> None:
    """Removed non-capability fields are no longer accepted by validate_config."""
    adapter = _get_adapter(adapter_key)
    with pytest.raises(ValueError):
        adapter.validate_config({field: value})
