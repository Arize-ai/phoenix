from pathlib import Path

import pytest

from phoenix.client.utils.config import clear_env_file_cache


@pytest.fixture(autouse=True)
def isolated_cwd(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """
    Run every test from an empty temporary directory and reset cached file
    discovery and one-time warning latches so that neither a developer's real
    ``.env.phoenix`` file (anywhere above the repo) nor state from an earlier
    test can leak into assertions.
    """
    monkeypatch.chdir(tmp_path)
    clear_env_file_cache()
    return tmp_path
