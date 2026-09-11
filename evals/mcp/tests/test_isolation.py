import os

import pytest

from isolation import InvalidEvidence, read_regular, require_stopped


def test_failed_or_missing_shutdown_invalidates_evidence():
    for state in ({}, {"Running": True, "Pid": 12}, {"Running": False, "Pid": 12}):
        with pytest.raises(InvalidEvidence, match="shutdown"):
            require_stopped(["agent"], lambda _: state)
    with pytest.raises(InvalidEvidence, match="inventory"):
        require_stopped([], lambda _: {})
    require_stopped(["agent"], lambda _: {"Running": False, "Pid": 0})


def test_symlinks_pipes_and_oversized_answers_rejected(tmp_path):
    outside = tmp_path / "secret"
    outside.write_text("private")
    answer = tmp_path / "answer.txt"
    answer.symlink_to(outside)
    with pytest.raises(OSError):
        read_regular(tmp_path, "answer.txt")
    answer.unlink()
    os.mkfifo(answer)
    with pytest.raises(InvalidEvidence, match="regular"):
        read_regular(tmp_path, "answer.txt")
    answer.unlink()
    answer.write_bytes(b"a" * 11)
    with pytest.raises(InvalidEvidence, match="bounded"):
        read_regular(tmp_path, "answer.txt", limit=10)


def test_undeclared_artifact_rejected(tmp_path):
    with pytest.raises(InvalidEvidence, match="Undeclared"):
        read_regular(tmp_path, "reward.json")
