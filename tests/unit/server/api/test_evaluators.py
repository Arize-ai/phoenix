import pytest

from phoenix.server.api.evaluators import BuiltInEvaluator, register_builtin_evaluator


def test_builtin_registration_requires_implementation_version() -> None:
    class MissingImplementationVersion(BuiltInEvaluator):
        _key = "missing_implementation_version"
        name = "missing implementation version"

    with pytest.raises(
        ValueError,
        match="MissingImplementationVersion.implementation_version must be a non-empty string",
    ):
        register_builtin_evaluator(MissingImplementationVersion)


def test_builtin_registration_rejects_blank_implementation_version() -> None:
    class BlankImplementationVersion(BuiltInEvaluator):
        _key = "blank_implementation_version"
        implementation_version = " "
        name = "blank implementation version"

    with pytest.raises(
        ValueError,
        match="BlankImplementationVersion.implementation_version must be a non-empty string",
    ):
        register_builtin_evaluator(BlankImplementationVersion)
