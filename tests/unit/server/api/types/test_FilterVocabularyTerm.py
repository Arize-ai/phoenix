"""Exercises scripts/generate_session_filter_ai_query_vocabulary.py, whose --check mode
guards the checked-in sessionFilterCoreVocabulary.generated.ts against drift."""

import subprocess
import sys
from pathlib import Path


def test_session_filter_ai_query_vocabulary_check_detects_drift(tmp_path: Path) -> None:
    repo_root = Path(__file__).parents[5]
    generator = repo_root / "scripts/generate_session_filter_ai_query_vocabulary.py"
    output = tmp_path / "sessionFilterCoreVocabulary.generated.ts"

    subprocess.run(
        [sys.executable, generator, "--output", output],
        check=True,
        cwd=repo_root,
    )
    subprocess.run(
        [sys.executable, generator, "--check", "--output", output],
        check=True,
        cwd=repo_root,
    )

    output.write_text(f"{output.read_text()}// drift\n")
    result = subprocess.run(
        [sys.executable, generator, "--check", "--output", output],
        check=False,
        capture_output=True,
        cwd=repo_root,
        text=True,
    )

    assert result.returncode == 1
    assert "is stale" in result.stdout
