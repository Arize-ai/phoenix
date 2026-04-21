"""Unit tests for pydantic config model validation in sandbox adapters.

Tests cover:
- Our custom validators (unique env_var names, capability gate validators, invalid-value rejection)
- Our schema design contracts (discriminated union, extra="forbid" on leaf models, field constraints)
- validate_config() wrapper: pydantic ValidationError surfaced as ValueError (D3 convention)
- _config_field_specs_from_model: nested-field skip behaviour
- Equality helper correctness (Phase 1 regression tests)
"""

from __future__ import annotations

import pytest

from phoenix.server.sandbox.types import (
    ConfigFieldSpec,
    DaytonaPythonConfig,
    DenoConfig,
    E2BConfig,
    EnvVarEntry,
    EnvVarLiteral,
    EnvVarSecretRef,
    InternetAccessConfig,
    ModalConfig,
    PythonDependenciesConfig,
    SandboxAdapter,
    TypescriptDependenciesConfig,
    VercelPythonConfig,
    VercelTypescriptConfig,
    WASMConfig,
    _env_vars_equal,
    _internet_access_equal,
    _packages_equal,
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

        def build_backend(
            self, config: dict[str, Any], user_env: dict[str, str] | None = None
        ) -> Any:
            return None

    return _ConcreteAdapter()


# ---------------------------------------------------------------------------
# E2BConfig
# ---------------------------------------------------------------------------


class TestE2BConfigValidation:
    def test_valid_full_config(self) -> None:
        result = E2BConfig.model_validate(
            {"template": "custom-tmpl", "cwd": "/workspace", "metadata": "my-run"}
        )
        assert result.template == "custom-tmpl"
        assert result.cwd == "/workspace"
        assert result.metadata == "my-run"

    def test_validate_config_returns_dict(self) -> None:
        adapter = _make_adapter(E2BConfig)
        out = adapter.validate_config({"template": "t1", "cwd": "/tmp"})
        assert isinstance(out, dict)
        assert out["template"] == "t1"


# ---------------------------------------------------------------------------
# DaytonaPythonConfig
# ---------------------------------------------------------------------------


class TestDaytonaPythonConfigValidation:
    def test_valid_server_url(self) -> None:
        result = DaytonaPythonConfig.model_validate({"server_url": "https://daytona.example.com"})
        assert result.server_url == "https://daytona.example.com"

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
        assert result.model_dump()["env_vars"] == []

    def test_validate_config_returns_unknown_keys(self) -> None:
        adapter = _make_adapter(DenoConfig)
        out = adapter.validate_config({"deno_path": "/usr/local/bin/deno"})
        assert out["deno_path"] == "/usr/local/bin/deno"


class TestVercelPythonConfigValidation:
    def test_empty_config_accepted(self) -> None:
        result = VercelPythonConfig.model_validate({})
        dumped = result.model_dump()
        assert dumped["env_vars"] == []
        assert dumped["dependencies"] is None


class TestVercelTypescriptConfigValidation:
    def test_empty_config_accepted(self) -> None:
        result = VercelTypescriptConfig.model_validate({})
        dumped = result.model_dump()
        assert dumped["env_vars"] == []
        assert dumped["dependencies"] is None


class TestWASMConfigValidation:
    def test_empty_config_accepted(self) -> None:
        result = WASMConfig.model_validate({})
        assert result.model_dump() == {}


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


# ---------------------------------------------------------------------------
# Shared config shape round-trip tests (D2, D4, D5, D6)
# ---------------------------------------------------------------------------


class TestEnvVarEntryDiscriminatedUnion:
    def test_literal_round_trip(self) -> None:
        from pydantic import TypeAdapter

        ta: TypeAdapter[EnvVarEntry] = TypeAdapter(EnvVarEntry)
        raw = {"kind": "literal", "name": "FOO", "value": "bar"}
        parsed = ta.validate_python(raw)
        assert isinstance(parsed, EnvVarLiteral)
        assert parsed.name == "FOO"
        assert parsed.value == "bar"
        assert ta.dump_python(parsed) == raw

    def test_secret_ref_round_trip(self) -> None:
        from pydantic import TypeAdapter

        ta: TypeAdapter[EnvVarEntry] = TypeAdapter(EnvVarEntry)
        raw = {"kind": "secret_ref", "name": "BAR", "secret_key": "my-secret"}
        parsed = ta.validate_python(raw)
        assert isinstance(parsed, EnvVarSecretRef)
        assert parsed.name == "BAR"
        assert parsed.secret_key == "my-secret"
        assert ta.dump_python(parsed) == raw

    def test_invalid_kind_raises(self) -> None:
        from pydantic import TypeAdapter, ValidationError

        ta: TypeAdapter[EnvVarEntry] = TypeAdapter(EnvVarEntry)
        with pytest.raises(ValidationError):
            ta.validate_python({"kind": "unknown", "name": "X"})

    def test_literal_forbids_extra_fields(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            EnvVarLiteral.model_validate(
                {"kind": "literal", "name": "X", "value": "v", "extra": "bad"}
            )

    def test_secret_ref_forbids_extra_fields(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            EnvVarSecretRef.model_validate(
                {"kind": "secret_ref", "name": "X", "secret_key": "k", "extra": "bad"}
            )

    def test_secret_ref_does_not_contain_value_field(self) -> None:
        raw = {"kind": "secret_ref", "name": "SECRET_VAR", "secret_key": "prod-api-key"}
        parsed = EnvVarSecretRef.model_validate(raw)
        dumped = parsed.model_dump()
        assert "value" not in dumped


class TestInternetAccessConfig:
    def test_invalid_mode_raises(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            InternetAccessConfig.model_validate({"mode": "allowlist"})

    def test_forbids_extra_fields(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            InternetAccessConfig.model_validate({"mode": "allow", "extra": "bad"})


class TestPythonDependenciesConfig:
    def test_lockfile_round_trip(self) -> None:
        cfg = PythonDependenciesConfig.model_validate(
            {"packages": ["boto3"], "lockfile": "requirements.txt"}
        )
        assert cfg.lockfile == "requirements.txt"

    def test_forbids_extra_fields(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            PythonDependenciesConfig.model_validate({"packages": [], "unknown": "x"})


class TestTypescriptDependenciesConfig:
    def test_forbids_extra_fields(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            TypescriptDependenciesConfig.model_validate({"packages": [], "unknown": "x"})


# ---------------------------------------------------------------------------
# _config_field_specs_from_model — nested-field skip behaviour (task #3)
# ---------------------------------------------------------------------------


class TestConfigFieldSpecsFromModel:
    """Tests for _config_field_specs_from_model() in sandbox/__init__.py."""

    def _derive(self, model_cls: type) -> list[ConfigFieldSpec]:
        from phoenix.server.sandbox import _config_field_specs_from_model

        return _config_field_specs_from_model(model_cls)

    def test_flat_string_field_produces_spec(self) -> None:
        from pydantic import BaseModel, ConfigDict, Field

        class M(BaseModel):
            model_config = ConfigDict(extra="allow")
            name: str = Field(default="x", title="Name", description="A name field.")

        specs = self._derive(M)
        assert len(specs) == 1
        assert specs[0].key == "name"
        assert specs[0].field_type == "string"
        assert specs[0].display_name == "Name"

    def test_nested_model_field_is_skipped(self) -> None:
        from typing import Optional

        from pydantic import BaseModel, ConfigDict, Field

        class Inner(BaseModel):
            mode: str = "allow"

        class M(BaseModel):
            model_config = ConfigDict(extra="allow")
            flat: str = "x"
            nested: Optional[Inner] = Field(default=None)

        specs = self._derive(M)
        keys = [s.key for s in specs]
        assert "flat" in keys
        assert "nested" not in keys

    def test_array_field_is_skipped(self) -> None:
        from pydantic import BaseModel, ConfigDict, Field

        class M(BaseModel):
            model_config = ConfigDict(extra="allow")
            flat: str = "x"
            items: list[str] = Field(default_factory=list)

        specs = self._derive(M)
        keys = [s.key for s in specs]
        assert "flat" in keys
        assert "items" not in keys

    def test_e2b_config_env_vars_internet_access_dependencies_skipped(self) -> None:
        specs = self._derive(E2BConfig)
        keys = [s.key for s in specs]
        # Flat fields are present
        assert "template" in keys
        # Nested/array fields are absent
        assert "env_vars" not in keys
        assert "internet_access" not in keys
        assert "dependencies" not in keys

    def test_daytona_python_config_nested_fields_skipped(self) -> None:
        specs = self._derive(DaytonaPythonConfig)
        keys = [s.key for s in specs]
        assert "server_url" in keys
        assert "env_vars" not in keys
        assert "internet_access" not in keys
        assert "dependencies" not in keys

    def test_wasm_config_empty_produces_no_specs(self) -> None:
        specs = self._derive(WASMConfig)
        assert specs == []

    def test_modal_config_flat_fields_present_nested_absent(self) -> None:
        specs = self._derive(ModalConfig)
        keys = [s.key for s in specs]
        assert "app_name" in keys
        assert "timeout" in keys
        assert "idle_timeout" in keys
        assert "env_vars" not in keys
        assert "internet_access" not in keys
        assert "dependencies" not in keys

    def test_deno_config_env_vars_skipped(self) -> None:
        specs = self._derive(DenoConfig)
        keys = [s.key for s in specs]
        assert "env_vars" not in keys

    def test_vercel_python_config_nested_fields_skipped(self) -> None:
        specs = self._derive(VercelPythonConfig)
        keys = [s.key for s in specs]
        assert "env_vars" not in keys
        assert "dependencies" not in keys

    def test_vercel_typescript_config_nested_fields_skipped(self) -> None:
        specs = self._derive(VercelTypescriptConfig)
        keys = [s.key for s in specs]
        assert "env_vars" not in keys
        assert "dependencies" not in keys

    def test_optional_nested_model_via_anyof_ref_is_skipped(self) -> None:
        from typing import Optional

        from pydantic import BaseModel, ConfigDict, Field

        class Inner(BaseModel):
            x: int = 0

        class M(BaseModel):
            model_config = ConfigDict(extra="allow")
            flat: str = "v"
            opt_nested: Optional[Inner] = Field(default=None)

        specs = self._derive(M)
        keys = [s.key for s in specs]
        assert "flat" in keys
        assert "opt_nested" not in keys


# ---------------------------------------------------------------------------
# Equality helper regression tests (Phase 1 correctness fixes)
# ---------------------------------------------------------------------------


class TestEnvVarsEqual:
    def test_equal_lists_same_order(self) -> None:
        a = [{"kind": "literal", "name": "X", "value": "1", "secret_key": ""}]
        assert _env_vars_equal(a, a)

    def test_equal_lists_different_order(self) -> None:
        a = [
            {"kind": "literal", "name": "X", "value": "1", "secret_key": ""},
            {"kind": "literal", "name": "Y", "value": "2", "secret_key": ""},
        ]
        b = [
            {"kind": "literal", "name": "Y", "value": "2", "secret_key": ""},
            {"kind": "literal", "name": "X", "value": "1", "secret_key": ""},
        ]
        assert _env_vars_equal(a, b)

    def test_duplicate_multiplicity_not_collapsed(self) -> None:
        """frozenset collapses duplicates; Counter must not — [X, X] != [X]."""
        entry = {"kind": "literal", "name": "X", "value": "1", "secret_key": ""}
        assert not _env_vars_equal([entry, entry], [entry])

    def test_both_empty(self) -> None:
        assert _env_vars_equal([], [])

    def test_one_empty(self) -> None:
        entry = {"kind": "literal", "name": "X", "value": "1", "secret_key": ""}
        assert not _env_vars_equal([entry], [])


class TestInternetAccessEqual:
    def test_same_mode(self) -> None:
        assert _internet_access_equal({"mode": "allow"}, {"mode": "allow"})

    def test_different_mode(self) -> None:
        assert not _internet_access_equal({"mode": "allow"}, {"mode": "deny"})

    def test_both_none(self) -> None:
        assert _internet_access_equal(None, None)

    def test_one_none(self) -> None:
        assert not _internet_access_equal({"mode": "allow"}, None)

    def test_model_instance_vs_dict(self) -> None:
        model = InternetAccessConfig(mode="deny")
        assert _internet_access_equal(model, {"mode": "deny"})
        assert not _internet_access_equal(model, {"mode": "allow"})


class TestPackagesEqual:
    def test_same_packages_same_lockfile(self) -> None:
        a = {"packages": ["requests"], "lockfile": "req.txt"}
        assert _packages_equal(a, a)

    def test_lockfile_change_not_equal(self) -> None:
        """set(packages) alone was compared — lockfile change must now be detected."""
        a = {"packages": ["requests"], "lockfile": "req.txt"}
        b = {"packages": ["requests"], "lockfile": "req2.txt"}
        assert not _packages_equal(a, b)

    def test_lockfile_none_vs_value_not_equal(self) -> None:
        a = {"packages": ["requests"], "lockfile": None}
        b = {"packages": ["requests"], "lockfile": "req.txt"}
        assert not _packages_equal(a, b)

    def test_packages_set_order_independent(self) -> None:
        a = {"packages": ["boto3", "requests"], "lockfile": None}
        b = {"packages": ["requests", "boto3"], "lockfile": None}
        assert _packages_equal(a, b)

    def test_both_empty(self) -> None:
        assert _packages_equal({}, {})

    def test_one_empty(self) -> None:
        assert not _packages_equal({"packages": ["requests"]}, {})
