"""
Global fixtures.
"""

import shutil
from pathlib import Path
from typing import Callable

import pytest


@pytest.fixture(scope="module")
def tmp_fixture_path_factory(request, tmp_path_factory) -> Callable[[str], Path]:
    original_fixtures_dir = Path(request.fspath.dirname) / "fixtures"

    def _tmp_fixture_path_factory(fixture_file_name: str) -> Path:
        original_fixture_path = original_fixtures_dir / fixture_file_name
        tmp_fixture_path = tmp_path_factory.mktemp("fixtures") / fixture_file_name
        shutil.copyfile(original_fixture_path, str(tmp_fixture_path))
        return tmp_fixture_path

    return _tmp_fixture_path_factory
