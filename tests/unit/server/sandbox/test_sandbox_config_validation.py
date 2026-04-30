"""Unit tests for the authored invariants in sandbox config validation.

Scope is limited to logic we own:
- `validate_config()`'s wrapping of pydantic ValidationError as ValueError.
- `EnvVarEntry` discriminated-union and `extra="forbid"` design contracts.
- `_config_field_specs_from_model` nested-field skip behaviour.
- Equality helpers `_env_vars_equal`, `_internet_access_equal`,
  `_packages_equal` (Phase 1 correctness fixes).

Per-adapter pydantic schema re-verification (round-tripping every adapter's
config model) is intentionally absent — the cross-adapter conformance suite
(`test_unified_config_contract.py`) iterates over
`SANDBOX_ADAPTER_METADATA.keys()` and one representative adapter is enough
to exercise pydantic's framework behaviour here.
"""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import BaseModel

from phoenix.server.sandbox.types import (
    ConfigFieldSpec,
    E2BConfig,
    EnvVarEntry,
    EnvVarLiteral,
    EnvVarSecretRef,
    InternetAccessConfig,
    PythonDependenciesConfig,
    SandboxAdapter,
    TypescriptDependenciesConfig,
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
# validate_config() error path: pydantic ValidationError → ValueError
# ---------------------------------------------------------------------------


class TestValidateConfigErrorPath:
    """validate_config wraps pydantic ValidationError as ValueError for mutation-layer callers."""

    def test_pydantic_errors_surface_as_value_error(self) -> None:
        from pydantic import BaseModel, ConfigDict

        class RequiredFieldModel(BaseModel):
            model_config = ConfigDict(extra="allow")
            required_field: str  # no default → required

        adapter = _make_adapter(RequiredFieldModel)
        with pytest.raises(ValueError, match="required_field"):
            adapter.validate_config({})


# ---------------------------------------------------------------------------
# EnvVarEntry discriminated union + extra="forbid" + secret_ref shape
# ---------------------------------------------------------------------------


_ENVVAR_ROUND_TRIP_CASES: list[tuple[dict[str, Any], type[BaseModel], dict[str, Any]]] = [
    (
        {"kind": "literal", "name": "FOO", "value": "bar"},
        EnvVarLiteral,
        {"name": "FOO", "value": "bar"},
    ),
    (
        {"kind": "secret_ref", "name": "BAR", "secret_key": "my-secret"},
        EnvVarSecretRef,
        {"name": "BAR", "secret_key": "my-secret"},
    ),
]


class TestEnvVarEntryDiscriminatedUnion:
    @pytest.mark.parametrize("raw,expected_cls,expected_attrs", _ENVVAR_ROUND_TRIP_CASES)
    def test_round_trip(
        self,
        raw: dict[str, Any],
        expected_cls: type[BaseModel],
        expected_attrs: dict[str, Any],
    ) -> None:
        from pydantic import TypeAdapter

        ta: TypeAdapter[EnvVarEntry] = TypeAdapter(EnvVarEntry)
        parsed = ta.validate_python(raw)
        assert isinstance(parsed, expected_cls)
        for attr, val in expected_attrs.items():
            assert getattr(parsed, attr) == val
        assert ta.dump_python(parsed) == raw

    def test_invalid_kind_raises(self) -> None:
        from pydantic import TypeAdapter, ValidationError

        ta: TypeAdapter[EnvVarEntry] = TypeAdapter(EnvVarEntry)
        with pytest.raises(ValidationError):
            ta.validate_python({"kind": "unknown", "name": "X"})

    @pytest.mark.parametrize(
        "cls,payload",
        [
            (EnvVarLiteral, {"kind": "literal", "name": "X", "value": "v", "extra": "bad"}),
            (
                EnvVarSecretRef,
                {"kind": "secret_ref", "name": "X", "secret_key": "k", "extra": "bad"},
            ),
        ],
    )
    def test_forbids_extra_fields(self, cls: type[BaseModel], payload: dict[str, Any]) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            cls.model_validate(payload)

    def test_secret_ref_dump_has_no_value_field(self) -> None:
        raw = {"kind": "secret_ref", "name": "SECRET_VAR", "secret_key": "prod-api-key"}
        assert "value" not in EnvVarSecretRef.model_validate(raw).model_dump()


# ---------------------------------------------------------------------------
# Nested leaf-model extra="forbid"
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "model_cls,payload",
    [
        (InternetAccessConfig, {"mode": "allow", "extra": "bad"}),
        (PythonDependenciesConfig, {"packages": [], "unknown": "x"}),
        (TypescriptDependenciesConfig, {"packages": [], "unknown": "x"}),
    ],
)
def test_nested_leaf_models_forbid_extra_fields(
    model_cls: type[BaseModel], payload: dict[str, Any]
) -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        model_cls.model_validate(payload)


# ---------------------------------------------------------------------------
# _config_field_specs_from_model — nested-field skip behaviour
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

    def test_non_scalar_fields_are_skipped(self) -> None:
        """Nested models, arrays, and Optional[Model] (anyOf+$ref) are all skipped;
        only flat scalars get emitted."""
        from typing import Optional

        from pydantic import BaseModel, ConfigDict, Field

        class Inner(BaseModel):
            mode: str = "allow"

        class M(BaseModel):
            model_config = ConfigDict(extra="allow")
            flat: str = "x"
            nested: Inner = Field(default_factory=Inner)
            opt_nested: Optional[Inner] = Field(default=None)
            items: list[str] = Field(default_factory=list)

        keys = [s.key for s in self._derive(M)]
        assert keys == ["flat"]

    def test_real_adapter_produces_zero_specs_post_strip(self) -> None:
        """E2BConfig and WASMConfig declare only nested capability fields (or nothing)
        after the D7 strip, so both emit zero ConfigFieldSpecs."""
        assert self._derive(E2BConfig) == []
        assert self._derive(WASMConfig) == []


# ---------------------------------------------------------------------------
# Equality helper regression tests (Phase 1 correctness fixes)
# ---------------------------------------------------------------------------


class TestEnvVarsEqual:
    """Non-obvious invariants in _env_vars_equal — see Phase 1 fixes."""

    def test_order_independent(self) -> None:
        a = [
            {"kind": "literal", "name": "X", "value": "1", "secret_key": ""},
            {"kind": "literal", "name": "Y", "value": "2", "secret_key": ""},
        ]
        assert _env_vars_equal(a, list(reversed(a)))

    def test_duplicate_multiplicity_not_collapsed(self) -> None:
        """Counter, not frozenset: [X, X] must not equal [X]."""
        entry = {"kind": "literal", "name": "X", "value": "1", "secret_key": ""}
        assert not _env_vars_equal([entry, entry], [entry])


class TestInternetAccessEqual:
    def test_mode_sensitivity_and_none_handling(self) -> None:
        assert _internet_access_equal({"mode": "allow"}, {"mode": "allow"})
        assert not _internet_access_equal({"mode": "allow"}, {"mode": "deny"})
        assert _internet_access_equal(None, None)
        assert not _internet_access_equal({"mode": "allow"}, None)

    def test_model_instance_equals_dict(self) -> None:
        """Comparison must unwrap pydantic model to dict — see Phase 1 fix."""
        model = InternetAccessConfig(mode="deny")
        assert _internet_access_equal(model, {"mode": "deny"})
        assert not _internet_access_equal(model, {"mode": "allow"})


class TestPackagesEqual:
    def test_packages_are_set_compared(self) -> None:
        """Order-independent set comparison — not list equality."""
        a = {"packages": ["boto3", "requests"], "lockfile": None}
        b = {"packages": ["requests", "boto3"], "lockfile": None}
        assert _packages_equal(a, b)

    def test_lockfile_is_part_of_equality(self) -> None:
        """Phase 1 fix: lockfile must be compared, not just packages."""
        same_pkgs = ["requests"]
        assert not _packages_equal(
            {"packages": same_pkgs, "lockfile": "req.txt"},
            {"packages": same_pkgs, "lockfile": "req2.txt"},
        )
        assert not _packages_equal(
            {"packages": same_pkgs, "lockfile": None},
            {"packages": same_pkgs, "lockfile": "req.txt"},
        )
