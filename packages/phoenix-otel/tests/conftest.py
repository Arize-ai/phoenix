from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def isolated_cwd(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """
    Run every test from an empty temporary directory so that a developer's real
    ``.env.phoenix`` file (anywhere above the repo) cannot leak into assertions
    through the settings getters' file discovery.
    """
    monkeypatch.chdir(tmp_path)
    return tmp_path
