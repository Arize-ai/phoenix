import runpy
import sys
from collections.abc import Callable
from pathlib import Path
from types import FunctionType
from typing import Any, cast

import pytest

_VALIDATOR_PATH = Path(__file__).with_name("validate_schema_assets.py")


@pytest.mark.parametrize(
    ("postgresql_args", "sqlite_args", "expected_dialects"),
    [
        ("", "", ["postgresql", "sqlite"]),
        ("--external", "", ["sqlite"]),
        ("", "--external", ["postgresql"]),
        ("--external", "--external", []),
    ],
)
def test_validator_checks_each_canonical_generator_output(
    monkeypatch: pytest.MonkeyPatch,
    postgresql_args: str,
    sqlite_args: str,
    expected_dialects: list[str],
) -> None:
    namespace = runpy.run_path(str(_VALIDATOR_PATH))
    main = cast(FunctionType, namespace["main"])
    run_main = cast(Callable[[], int], main)
    parsed_dialects: list[str] = []

    def parse_schema_asset(_: str, dialect: str) -> dict[str, Any]:
        parsed_dialects.append(dialect)
        return {}

    monkeypatch.setitem(main.__globals__, "parse_schema_asset", parse_schema_asset)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            str(_VALIDATOR_PATH),
            f"--postgresql-args={postgresql_args}",
            f"--sqlite-args={sqlite_args}",
        ],
    )

    assert run_main() == 0
    assert parsed_dialects == expected_dialects
