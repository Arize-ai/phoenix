"""Unit tests for pydantic config model validation in sandbox adapters.

Tests cover:
- Valid configs accepted and returned
- Unknown keys preserved (D9: extra="allow")
- Type coercion (pydantic coerces compatible types)
- Invalid values raise ValueError via validate_config()
- Defaults filled in for missing optional fields
"""

from __future__ import annotations

import pytest

from phoenix.server.sandbox.types import (
    DaytonaPythonConfig,
    DenoConfig,
    E2BConfig,
    ModalConfig,
    SandboxAdapter,
    VercelPythonConfig,
    VercelTypescriptConfig,
    WASMConfig,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_adapter(config_model_cls: type) -> SandboxAdapter:
    """Create a minimal SandboxAdapter with the given config_model."""
    from typing import Any

    class _ConcreteAdapter(SandboxAdapter):
        key = "TEST"
        display_name = "Test"
        language = "PYTHON"
        config_model = config_model_cls

        def build_backend(self, config: dict[str, Any]) -> Any:
            return None

    return _ConcreteAdapter()


# ---------------------------------------------------------------------------
# E2BConfig
# ---------------------------------------------------------------------------


class TestE2BConfigValidation:
    def test_empty_config_returns_defaults(self) -> None:
        result = E2BConfig.model_validate({})
        assert result.template == "base"
        assert result.cwd is None
        assert result.metadata is None

    def test_valid_full_config(self) -> None:
        result = E2BConfig.model_validate(
            {"template": "custom-tmpl", "cwd": "/workspace", "metadata": "my-run"}
        )
        assert result.template == "custom-tmpl"
        assert result.cwd == "/workspace"
        assert result.metadata == "my-run"

    def test_unknown_keys_preserved(self) -> None:
        result = E2BConfig.model_validate({"unknown_key": "preserved"})
        dumped = result.model_dump()
        assert dumped["unknown_key"] == "preserved"

    def test_validate_config_returns_dict(self) -> None:
        adapter = _make_adapter(E2BConfig)
        out = adapter.validate_config({"template": "t1", "cwd": "/tmp"})
        assert isinstance(out, dict)
        assert out["template"] == "t1"

    def test_validate_config_preserves_unknown_keys(self) -> None:
        adapter = _make_adapter(E2BConfig)
        out = adapter.validate_config({"extra_key": "extra_val"})
        assert out["extra_key"] == "extra_val"

    def test_validate_config_fills_defaults(self) -> None:
        adapter = _make_adapter(E2BConfig)
        out = adapter.validate_config({})
        assert out["template"] == "base"
        assert out["cwd"] is None
        assert out["metadata"] is None


# ---------------------------------------------------------------------------
# DaytonaPythonConfig
# ---------------------------------------------------------------------------


class TestDaytonaPythonConfigValidation:
    def test_empty_config_returns_defaults(self) -> None:
        result = DaytonaPythonConfig.model_validate({})
        assert result.server_url == ""

    def test_valid_server_url(self) -> None:
        result = DaytonaPythonConfig.model_validate({"server_url": "https://daytona.example.com"})
        assert result.server_url == "https://daytona.example.com"

    def test_unknown_keys_preserved(self) -> None:
        result = DaytonaPythonConfig.model_validate({"server_url": "https://x.com", "extra": "val"})
        dumped = result.model_dump()
        assert dumped["extra"] == "val"

    def test_validate_config_returns_dict_with_defaults(self) -> None:
        adapter = _make_adapter(DaytonaPythonConfig)
        out = adapter.validate_config({})
        assert out["server_url"] == ""


# ---------------------------------------------------------------------------
# DenoConfig / VercelConfig / WASMConfig (no declared fields, extra="allow")
# ---------------------------------------------------------------------------


class TestDenoConfigValidation:
    def test_empty_config_accepted(self) -> None:
        result = DenoConfig.model_validate({})
        assert result.model_dump() == {}

    def test_unknown_keys_preserved(self) -> None:
        result = DenoConfig.model_validate({"custom_flag": True})
        assert result.model_dump()["custom_flag"] is True

    def test_validate_config_returns_unknown_keys(self) -> None:
        adapter = _make_adapter(DenoConfig)
        out = adapter.validate_config({"deno_path": "/usr/local/bin/deno"})
        assert out["deno_path"] == "/usr/local/bin/deno"


class TestVercelPythonConfigValidation:
    def test_empty_config_accepted(self) -> None:
        result = VercelPythonConfig.model_validate({})
        assert result.model_dump() == {}

    def test_unknown_keys_preserved(self) -> None:
        result = VercelPythonConfig.model_validate({"region": "iad1"})
        assert result.model_dump()["region"] == "iad1"


class TestVercelTypescriptConfigValidation:
    def test_empty_config_accepted(self) -> None:
        result = VercelTypescriptConfig.model_validate({})
        assert result.model_dump() == {}

    def test_unknown_keys_preserved(self) -> None:
        result = VercelTypescriptConfig.model_validate({"region": "iad1"})
        assert result.model_dump()["region"] == "iad1"


class TestWASMConfigValidation:
    def test_empty_config_accepted(self) -> None:
        result = WASMConfig.model_validate({})
        assert result.model_dump() == {}

    def test_unknown_keys_preserved(self) -> None:
        result = WASMConfig.model_validate({"binary_path": "/custom/cpython.wasm"})
        assert result.model_dump()["binary_path"] == "/custom/cpython.wasm"


class TestModalConfigValidation:
    def test_empty_config_returns_defaults(self) -> None:
        result = ModalConfig.model_validate({})
        assert result.app_name == "phoenix-sandbox"
        assert result.timeout == 600
        assert result.idle_timeout == 300

    def test_valid_full_config(self) -> None:
        result = ModalConfig.model_validate(
            {"app_name": "custom-app", "timeout": 120, "idle_timeout": 60}
        )
        assert result.app_name == "custom-app"
        assert result.timeout == 120
        assert result.idle_timeout == 60

    def test_unknown_keys_preserved(self) -> None:
        result = ModalConfig.model_validate({"app_name": "x", "region": "us-east-1"})
        assert result.model_dump()["region"] == "us-east-1"

    def test_validate_config_returns_dict_with_defaults(self) -> None:
        adapter = _make_adapter(ModalConfig)
        out = adapter.validate_config({})
        assert out["app_name"] == "phoenix-sandbox"
        assert out["timeout"] == 600
        assert out["idle_timeout"] == 300


# ---------------------------------------------------------------------------
# validate_config() error path via SandboxAdapter
# ---------------------------------------------------------------------------


class TestValidateConfigErrorPath:
    def test_invalid_type_raises_value_error(self) -> None:
        """A pydantic ValidationError is surfaced as ValueError."""
        from pydantic import BaseModel, ConfigDict

        class StrictModel(BaseModel):
            model_config = ConfigDict(extra="allow")
            count: int

        adapter = _make_adapter(StrictModel)
        with pytest.raises(ValueError):
            adapter.validate_config({"count": "not-an-int"})

    def test_missing_required_field_raises_value_error(self) -> None:
        from pydantic import BaseModel, ConfigDict

        class RequiredFieldModel(BaseModel):
            model_config = ConfigDict(extra="allow")
            required_field: str  # no default → required

        adapter = _make_adapter(RequiredFieldModel)
        with pytest.raises(ValueError, match="required_field"):
            adapter.validate_config({})

    def test_valid_required_field_passes(self) -> None:
        from pydantic import BaseModel, ConfigDict

        class RequiredFieldModel(BaseModel):
            model_config = ConfigDict(extra="allow")
            required_field: str

        adapter = _make_adapter(RequiredFieldModel)
        out = adapter.validate_config({"required_field": "present"})
        assert out["required_field"] == "present"
