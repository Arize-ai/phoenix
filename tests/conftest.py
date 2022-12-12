"""
Global fixtures.
"""

import shutil
from functools import partial
from pathlib import Path
from typing import Callable

import pytest


@pytest.fixture(scope="module")
def local_fixture_tmp_path_factory(
    request: pytest.FixtureRequest, tmp_path_factory: pytest.TempPathFactory
) -> Callable[[str], Path]:
    """
    Returns a method that takes in a fixture file name, copies the file from the local "fixtures"
    directory to a temporary path, returns the temporary path and cleans up the temporary file at
    the end of the test.
    """
    original_fixtures_dir = Path(request.fspath.dirname) / "fixtures"
    return partial(
        _tmp_fixture_path_factory,
        original_fixtures_dir=original_fixtures_dir,
        tmp_path_factory_=tmp_path_factory,
    )


@pytest.fixture(scope="session")
def global_fixture_tmp_path_factory(
    pytestconfig: pytest.Config, tmp_path_factory: pytest.TempPathFactory
) -> Callable[[str], Path]:
    """
    Returns a method that takes in a fixture file name, copies the file from the global "fixtures"
    directory to a temporary path, returns the temporary path and cleans up the temporary file at
    the end of the test.
    """
    original_fixtures_dir = Path(pytestconfig.invocation_params.dir) / "fixtures"
    return partial(
        _tmp_fixture_path_factory,
        original_fixtures_dir=original_fixtures_dir,
        tmp_path_factory_=tmp_path_factory,
    )


def _tmp_fixture_path_factory(
    fixture_file_name: str, original_fixtures_dir: Path, tmp_path_factory_: pytest.TempPathFactory
) -> Path:
    original_fixture_path = original_fixtures_dir / fixture_file_name
    tmp_fixture_path = tmp_path_factory_.mktemp("fixtures") / fixture_file_name
    shutil.copyfile(original_fixture_path, str(tmp_fixture_path))
    return tmp_fixture_path
