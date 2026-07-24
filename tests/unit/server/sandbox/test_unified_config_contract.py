from __future__ import annotations

import importlib
from typing import Any, cast

import pytest

from phoenix.db.models import LanguageName, SandboxBackendType
from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA
from phoenix.server.sandbox.types import _RuntimePackageInstallation

_ADAPTER_MODULES: dict[SandboxBackendType, tuple[str, str]] = {
    "WASM": ("phoenix.server.sandbox.wasm_backend", "WASMAdapter"),
    "E2B": ("phoenix.server.sandbox.e2b_backend", "E2BAdapter"),
    "DAYTONA": ("phoenix.server.sandbox.daytona_backend", "DaytonaAdapter"),
    "VERCEL": ("phoenix.server.sandbox.vercel_backend", "VercelAdapter"),
    "DENO": ("phoenix.server.sandbox.deno_backend", "DenoAdapter"),
    "MODAL": ("phoenix.server.sandbox.modal_backend", "ModalAdapter"),
    "MONTY": ("phoenix.server.sandbox.monty_backend", "MontyAdapter"),
}


def _default_language(backend_type: str) -> LanguageName:
    meta = SANDBOX_ADAPTER_METADATA[cast(SandboxBackendType, backend_type)]
    return sorted(meta.supported_languages)[0]


def _get_adapter(key: str) -> Any:
    module_path, cls_name = _ADAPTER_MODULES[cast(SandboxBackendType, key)]
    mod = importlib.import_module(module_path)
    return getattr(mod, cls_name)()


_ADAPTERS_WITHOUT_ENV_VARS = [
    key for key, meta in SANDBOX_ADAPTER_METADATA.items() if not meta.supports_env_vars
]


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_ENV_VARS)
def test_env_vars_false_rejects_non_empty_env_vars(adapter_key: str) -> None:
    adapter = _get_adapter(adapter_key)
    with pytest.raises(ValueError):
        adapter.config_model.model_validate(
            {
                "env_vars": {"X": {"secret_key": "secret-v"}},
                "language": _default_language(adapter_key),
            },
        )


_ADAPTERS_WITHOUT_INTERNET_ACCESS = [
    key
    for key, meta in SANDBOX_ADAPTER_METADATA.items()
    if meta.internet_access_capability == "none"
]

_INTERNET_ACCESS_CONFIG = {"internet_access": {"mode": "allow"}}


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_INTERNET_ACCESS)
def test_internet_access_none_rejects_non_none_config(adapter_key: str) -> None:
    adapter = _get_adapter(adapter_key)
    with pytest.raises(ValueError):
        adapter.config_model.model_validate(
            {**_INTERNET_ACCESS_CONFIG, "language": _default_language(adapter_key)}
        )


_ADAPTERS_WITHOUT_DEPENDENCIES = [
    key for key, meta in SANDBOX_ADAPTER_METADATA.items() if not meta.supports_dependencies
]

_DEPENDENCIES_CONFIG = {"dependencies": {"packages": ["numpy"]}}


@pytest.mark.parametrize("adapter_key", _ADAPTERS_WITHOUT_DEPENDENCIES)
def test_dependencies_none_rejects_non_empty_packages(adapter_key: str) -> None:
    adapter = _get_adapter(adapter_key)
    with pytest.raises(ValueError):
        adapter.config_model.model_validate(
            {**_DEPENDENCIES_CONFIG, "language": _default_language(adapter_key)}
        )


def _composes_runtime_package_installation(adapter_key: str) -> bool:
    adapter = _get_adapter(adapter_key)
    return issubclass(adapter.config_model, _RuntimePackageInstallation)


_RUNTIME_INSTALL_ADAPTERS = [
    key for key in SANDBOX_ADAPTER_METADATA if _composes_runtime_package_installation(key)
]

_DENY_PLUS_PACKAGES_CONFIG = {
    "internet_access": {"mode": "deny"},
    "dependencies": {"packages": ["numpy"]},
}


@pytest.mark.parametrize("adapter_key", _RUNTIME_INSTALL_ADAPTERS)
def test_runtime_install_validate_config_rejects_deny_plus_packages(adapter_key: str) -> None:
    adapter = _get_adapter(adapter_key)
    with pytest.raises(ValueError):
        adapter.config_model.model_validate(
            {**_DENY_PLUS_PACKAGES_CONFIG, "language": _default_language(adapter_key)}
        )


def test_all_metadata_keys_have_adapter_module_entry() -> None:
    meta_keys = set(SANDBOX_ADAPTER_METADATA.keys())
    module_keys = set(_ADAPTER_MODULES.keys())
    missing = meta_keys - module_keys
    assert not missing, (
        f"Adapters in SANDBOX_ADAPTER_METADATA have no entry in _ADAPTER_MODULES: {missing}. "
        "Add an entry to _ADAPTER_MODULES in this test file."
    )


@pytest.mark.parametrize("adapter_key", list(SANDBOX_ADAPTER_METADATA.keys()))
def test_extra_keys_rejected_in_validate_config(adapter_key: str) -> None:
    adapter = _get_adapter(adapter_key)
    with pytest.raises(ValueError):
        adapter.config_model.model_validate(
            {"_unknown_field": "some_value", "language": _default_language(adapter_key)}
        )


# Pinned regression: each entry documents a field that used to live on a
# per-adapter config and was removed; this guard catches accidental reintroduction.
_REMOVED_FIELD_CASES = [
    ("E2B", "template", "custom-template"),
    ("E2B", "cwd", "/workspace"),
    ("E2B", "metadata", "some-metadata"),
    ("DAYTONA", "server_url", "https://example.com"),
    ("MODAL", "app_name", "my-app"),
    ("MODAL", "timeout", 300),
    ("MODAL", "idle_timeout", 120),
]


@pytest.mark.parametrize("adapter_key,field,value", _REMOVED_FIELD_CASES)
def test_removed_scalar_fields_rejected_by_validate_config(
    adapter_key: str, field: str, value: object
) -> None:
    adapter = _get_adapter(adapter_key)
    with pytest.raises(ValueError):
        adapter.config_model.model_validate(
            {field: value, "language": _default_language(adapter_key)}
        )
