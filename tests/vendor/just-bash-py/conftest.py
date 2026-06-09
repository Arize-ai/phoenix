"""Pytest configuration for just-bash tests."""

import pytest


@pytest.fixture
def sample_files() -> dict[str, str]:
    """Sample files for testing."""
    return {
        "/test.txt": "hello\nworld\n",
        "/data.csv": "a,b,c\n1,2,3\n",
        "/script.sh": "#!/bin/bash\necho hello",
    }
