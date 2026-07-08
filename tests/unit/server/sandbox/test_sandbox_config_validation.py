from __future__ import annotations

from typing import Any, Mapping, Optional

import pytest
from pydantic import BaseModel

from phoenix.server.sandbox.types import (
    DependenciesConfig,
    E2BDeployment,
    InternetAccessConfig,
    NoCredentials,
    NoDeployment,
    SandboxAdapter,
    SandboxBackend,
    validate_npm_package_spec,
    validate_python_package_spec,
)


def _make_adapter(
    config_model_cls: Any,
) -> Any:
    class _ConcreteAdapter(SandboxAdapter):  # type: ignore[type-arg]
        backend_type = "TEST"  # type: ignore[assignment]
        display_name = "Test"
        config_model = config_model_cls
        credentials_model = NoCredentials
        deployment_config_model = NoDeployment

        def build_backend(
            self,
            config: BaseModel,
            *,
            credentials: NoCredentials,
            deployment: NoDeployment,
            user_env: Optional[Mapping[str, str]] = None,
        ) -> SandboxBackend:
            raise NotImplementedError

    return _ConcreteAdapter()


class TestConfigModelValidation:
    def test_pydantic_errors_name_the_offending_field(self) -> None:
        from pydantic import BaseModel, ConfigDict, ValidationError

        class RequiredFieldModel(BaseModel):
            model_config = ConfigDict(extra="allow")
            required_field: str

        adapter = _make_adapter(RequiredFieldModel)
        with pytest.raises(ValidationError, match="required_field"):
            adapter.config_model.model_validate({})


_NESTED_LEAF_EXTRA_FIELD_CASES: list[tuple[type[BaseModel], dict[str, Any]]] = [
    (InternetAccessConfig, {"mode": "allow", "extra": "bad"}),
    (DependenciesConfig, {"packages": [], "unknown": "x"}),
]


@pytest.mark.parametrize("model_cls,payload", _NESTED_LEAF_EXTRA_FIELD_CASES)
def test_nested_leaf_models_forbid_extra_fields(
    model_cls: type[BaseModel], payload: dict[str, Any]
) -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        model_cls.model_validate(payload)


def _validate_deps(packages: list[str], language: str) -> DependenciesConfig:
    # Daytona chosen because its Config accepts both PYTHON and TYPESCRIPT.
    from phoenix.server.sandbox.types import DaytonaConfig

    cfg = DaytonaConfig.model_validate(
        {"language": language, "dependencies": {"packages": packages}}
    )
    assert cfg.dependencies is not None
    return cfg.dependencies


class TestTypescriptDependenciesValidation:
    def test_strips_and_accepts_valid(self) -> None:
        cfg = _validate_deps(["  lodash  ", "lodash@^4.17", "@scope/pkg@1.2.3"], "TYPESCRIPT")
        assert cfg.packages == ["lodash", "lodash@^4.17", "@scope/pkg@1.2.3"]

    def test_rejects_invalid_with_index(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match=r"packages\[1\]"):
            _validate_deps(["lodash", "has spaces"], "TYPESCRIPT")

    def test_rejects_python_style_spec(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="invalid npm package spec"):
            _validate_deps(["openai>=6.37.0"], "TYPESCRIPT")


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
        cfg = _validate_deps(["  requests  ", "numpy==1.26.0"], "PYTHON")
        assert cfg.packages == ["requests", "numpy==1.26.0"]

    def test_rejects_invalid_with_index(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match=r"packages\[1\]"):
            _validate_deps(["requests", "bad name!"], "PYTHON")


class TestE2BDeploymentDomainApiUrlMutualExclusion:
    def test_either_alone_is_accepted(self) -> None:
        E2BDeployment(domain="example.e2b.dev")
        E2BDeployment(api_url="https://example.e2b.dev/api")
        E2BDeployment()  # both unset → hosted SaaS default

    def test_both_set_is_rejected(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="mutually exclusive"):
            E2BDeployment(
                domain="example.e2b.dev",
                api_url="https://example.e2b.dev/api",
            )
