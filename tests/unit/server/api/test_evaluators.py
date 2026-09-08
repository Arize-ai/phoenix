from typing import Any

import pytest

from phoenix.server.api.evaluators import BuiltInEvaluator, register_builtin_evaluator


class _ConcreteBuiltInEvaluator(BuiltInEvaluator):
    @property
    def input_schema(self) -> dict[str, Any]:
        return {}

    @property
    def output_configs(self) -> list[Any]:
        return []

    async def _evaluate(self, **_: Any) -> Any:
        raise AssertionError("not used by registration tests")


def test_builtin_registration_requires_implementation_version() -> None:
    class MissingImplementationVersion(_ConcreteBuiltInEvaluator):
        _key = "missing_implementation_version"
        name = "missing implementation version"

    with pytest.raises(
        ValueError,
        match="MissingImplementationVersion.implementation_version must be a non-empty string",
    ):
        register_builtin_evaluator(MissingImplementationVersion)


def test_builtin_registration_rejects_blank_implementation_version() -> None:
    class BlankImplementationVersion(_ConcreteBuiltInEvaluator):
        _key = "blank_implementation_version"
        implementation_version = " "
        name = "blank implementation version"

    with pytest.raises(
        ValueError,
        match="BlankImplementationVersion.implementation_version must be a non-empty string",
    ):
        register_builtin_evaluator(BlankImplementationVersion)
