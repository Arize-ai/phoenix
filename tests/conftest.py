"""
Global fixtures.
"""

import os
import shutil

import pytest


@pytest.fixture
def fixtures_dir(request, tmp_path):
    original_fixtures_dir = os.path.join(request.fspath.dirname, "fixtures")
    tmp_data_path = tmp_path / "fixtures"
    shutil.copytree(original_fixtures_dir, str(tmp_data_path))
    return tmp_data_path
