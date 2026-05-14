"""Unit tests for the authored invariants in sandbox config validation.

Scope is limited to logic we own:
- `validate_config()`'s wrapping of pydantic ValidationError as ValueError.
- `EnvVarEntry` discriminated-union and `extra="forbid"` design contracts.

Per-adapter pydantic schema re-verification (round-tripping every adapter's
config model) is intentionally absent — the cross-adapter conformance suite
(`test_unified_config_contract.py`) iterates over
`SANDBOX_ADAPTER_METADATA.keys()` and one representative adapter is enough
to exercise pydantic's framework behaviour here.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional

import pytest
from pydantic import BaseModel

from phoenix.server.sandbox.types import (
    EnvVarEntry,
    EnvVarLiteral,
    EnvVarSecretRef,
    InternetAccessConfig,
    PythonDependenciesConfig,
    SandboxAdapter,
    TypescriptDependenciesConfig,
    validate_npm_package_spec,
    validate_python_package_spec,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_adapter(config_model_cls: type) -> SandboxAdapter:
    """Create a minimal SandboxAdapter with the given config_model."""

    class _ConcreteAdapter(SandboxAdapter):
        key = "TEST"
        family = "WASM"  # any canonical family — gate doesn't filter for these tests
        display_name = "Test"
        language = "PYTHON"
        config_model = config_model_cls

        def build_backend(
            self, config: Mapping[str, Any], user_env: Optional[Mapping[str, str]] = None
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
# Package-spec validators + dependency-config string normalization
# ---------------------------------------------------------------------------


class TestTypescriptDependenciesValidation:
    def test_strips_and_accepts_valid(self) -> None:
        cfg = TypescriptDependenciesConfig(
            packages=["  lodash  ", "lodash@^4.17", "@scope/pkg@1.2.3"],
        )
        assert cfg.packages == ["lodash", "lodash@^4.17", "@scope/pkg@1.2.3"]

    def test_rejects_invalid_with_index(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match=r"packages\[1\]"):
            TypescriptDependenciesConfig(packages=["lodash", "has spaces"])

    def test_rejects_python_style_spec(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="invalid npm package spec"):
            TypescriptDependenciesConfig(packages=["openai>=6.37.0"])


class TestValidateNpmPackageSpec:
    @pytest.mark.parametrize(
        "spec, expected",
        [
            ("lodash", "lodash"),
            ("lodash@^4.17", "lodash@^4.17"),
            ("@scope/pkg@1.2.3", "@scope/pkg@1.2.3"),
            ("@scope/pkg", "@scope/pkg"),
            ("  react  ", "react"),
        ],
    )
    def test_valid(self, spec: str, expected: str) -> None:
        assert validate_npm_package_spec(spec) == expected

    @pytest.mark.parametrize(
        "spec",
        [
            "",
            "   ",
            "has spaces",
            "bad name!!",
            "@scope/",
            "/x",
            "openai>=6.37.0",  # pip-style, not npm
        ],
    )
    def test_invalid(self, spec: str) -> None:
        with pytest.raises(ValueError, match="invalid npm package spec"):
            validate_npm_package_spec(spec)


class TestValidatePythonPackageSpec:
    @pytest.mark.parametrize(
        "req, expected",
        [
            ("requests", "requests"),
            ("numpy==1.26.0", "numpy==1.26.0"),
            ("httpx[http2]>=0.27,<1", "httpx[http2]>=0.27,<1"),
            ("scikit-learn", "scikit-learn"),
            ("  pandas>=1.0  ", "pandas>=1.0"),
            ("pkg==1.*", "pkg==1.*"),
        ],
    )
    def test_valid(self, req: str, expected: str) -> None:
        assert validate_python_package_spec(req) == expected

    @pytest.mark.parametrize(
        "req",
        [
            "",
            "   ",
            "not a package!",
            "openai@>=6.37.0",  # npm-style, not pip
            "requests==",
            "package; python_version<'3.8'",  # markers out of scope
        ],
    )
    def test_invalid(self, req: str) -> None:
        with pytest.raises(ValueError, match="invalid Python package spec"):
            validate_python_package_spec(req)


class TestPythonDependenciesValidation:
    def test_strips_and_accepts_valid(self) -> None:
        cfg = PythonDependenciesConfig(packages=["  requests  ", "numpy==1.26.0"])
        assert cfg.packages == ["requests", "numpy==1.26.0"]

    def test_rejects_invalid_with_index(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match=r"packages\[1\]"):
            PythonDependenciesConfig(packages=["requests", "bad name!"])
