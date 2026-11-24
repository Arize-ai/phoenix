import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql, sqlite

from phoenix.db import models
from phoenix.server.experiment_filters import (
    ExperimentFilterConditionError,
    apply_experiment_filter,
)
from phoenix.server.experiments.filter import compile_experiment_filter


@pytest.mark.parametrize(
    "condition",
    [
        'metadata["model"] == "gpt-5"',
        'metadata["value"] in [0.7, 2]',
        'metadata["value"] not in [-1, 2]',
        'metadata["flag"] in [True, False]',
        '"REFUND_%" in description',
        '"x" not in metadata["label"]',
        'not (name == "x" or repetitions < 3)',
        "0 < repetitions < 3",
        'float(metadata["value"]) / repetitions > 0.2',
        'str(metadata["value"]) == "3"',
        "repetitions / 0 > 1",
        "repetitions % 2 == 1",
        'created_at > "2026-01-01T00:00:00Z"',
        '"2026-01-01T00:00:00+01:00" > updated_at',
        'metadata["value"] is None',
        "None is not description",
        "name in []",
        "name not in []",
        'metadata["x"] > metadata["y"]',
        "repetitions < 3000000000",
    ],
)
def test_compiles_for_both_databases(condition: str) -> None:
    statement = apply_experiment_filter(condition=condition, stmt=select(models.Experiment))
    for dialect in (sqlite.dialect(), postgresql.dialect()):  # type: ignore[no-untyped-call]
        assert "WHERE" in str(statement.compile(dialect=dialect))


@pytest.mark.parametrize(
    "condition",
    [
        "name",
        "True",
        "repetitions + 1",
        "name and repetitions > 1",
        'not metadata["flag"]',
        "name == 1",
        "repetitions == True",
        'name > "x"',
        'created_at > "2026-01-01"',
        'created_at > "0001-01-01T00:00:00+01:00"',
        'metadata["a"][0] == "x"',
        'metadata[name] == "x"',
        'metadata["a"][1:2] == "x"',
        'metadata.model == "x"',
        'name.startswith("x")',
        '__import__("os").system("false") == 0',
        "(lambda: True)()",
        "[value for value in name] == []",
        '{"key": "value"} == name',
        'name == f"{repetitions}"',
        'name == b"x"',
        "repetitions == 1j",
        "repetitions == 1e999",
        "repetitions == 9223372036854775808",
        'name == "x\\x00y"',
        'ｎａｍｅ == "name"',
        'ｎａｍｅ == "x" or name == "y"',
        "repetitions ** 2 > 1",
        "repetitions // 2 > 1",
        "~repetitions > 1",
        "repetitions is 1",
        'metadata["x"] == [1, 2]',
        'name in ["x", 1]',
        'name in ["x", None]',
        "name in [description]",
        'name in "other"',
        'int(metadata["n"]) == 1',
        "float(name) == 1",
        'str(repetitions) == "1"',
        'float(metadata["n"], fallback=0) == 1',
        '"x" in repetitions',
    ],
)
def test_rejects_unsupported_expressions(condition: str) -> None:
    with pytest.raises(ExperimentFilterConditionError):
        apply_experiment_filter(condition=condition, stmt=select(models.Experiment))


def test_binds_untrusted_text_as_a_parameter() -> None:
    value = "x' OR 1=1 --"
    statement = apply_experiment_filter(
        condition=f"name == {value!r}", stmt=select(models.Experiment)
    )
    compiled = statement.compile(dialect=postgresql.dialect())  # type: ignore[no-untyped-call]
    assert value not in str(compiled)
    assert value in compiled.params.values()


@pytest.mark.parametrize(
    "condition", ["-" * 300 + "repetitions > 1", " or ".join(["name == 'x'"] * 300)]
)
def test_rejects_excessive_expression_complexity(condition: str) -> None:
    with pytest.raises(ExperimentFilterConditionError, match="nested too deeply"):
        apply_experiment_filter(condition=condition, stmt=select(models.Experiment))


def test_empty_condition_does_not_add_a_predicate() -> None:
    statement = select(models.Experiment)
    assert compile_experiment_filter("") is None
    assert apply_experiment_filter(condition="", stmt=statement) is statement


def test_syntax_error_does_not_report_a_python_filename() -> None:
    with pytest.raises(ExperimentFilterConditionError) as error:
        apply_experiment_filter(condition="repetitions >", stmt=select(models.Experiment))
    assert str(error.value) == "invalid syntax"
