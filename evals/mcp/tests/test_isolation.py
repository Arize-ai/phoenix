import json
import os

import pytest

from isolation import InvalidEvidence, read_regular, require_stopped, snapshot_answer


def test_failed_or_missing_shutdown_invalidates_evidence():
    for state in ({}, {"Running": True, "Pid": 12}, {"Running": False, "Pid": 12}):
        with pytest.raises(InvalidEvidence, match="shutdown"):
            require_stopped(["agent"], lambda _: state)
    with pytest.raises(InvalidEvidence, match="inventory"):
        require_stopped([], lambda _: {})
    require_stopped(["agent"], lambda _: {"Running": False, "Pid": 0})


def test_fake_reward_is_not_transferred(tmp_path):
    agent = tmp_path / "agent"
    agent.mkdir()
    (agent / "answer.json").write_text('{"trace_count": 2}')
    (agent / "reward.json").write_text('{"reward": 1}')
    calls = []
    verifier = tmp_path / "protected"
    snapshot_answer(agent, verifier, confirm_stopped=lambda: calls.append("stopped"))
    assert calls == ["stopped"]
    assert list(verifier.iterdir()) == [verifier / "answer.json"]
    assert json.loads((verifier / "answer.json").read_text()) == {"trace_count": 2}
    with pytest.raises(InvalidEvidence, match="Undeclared"):
        read_regular(agent, "reward.json")


def test_symlinks_pipes_and_oversized_answers_rejected(tmp_path):
    outside = tmp_path / "secret"
    outside.write_text("private")
    answer = tmp_path / "answer.json"
    answer.symlink_to(outside)
    with pytest.raises(OSError):
        read_regular(tmp_path, "answer.json")
    answer.unlink()
    os.mkfifo(answer)
    with pytest.raises(InvalidEvidence, match="regular"):
        read_regular(tmp_path, "answer.json")
    answer.unlink()
    answer.write_bytes(b"a" * 11)
    with pytest.raises(InvalidEvidence, match="bounded"):
        read_regular(tmp_path, "answer.json", limit=10)


def test_failed_shutdown_cannot_create_authoritative_snapshot(tmp_path):
    def failed():
        raise InvalidEvidence("still running")

    with pytest.raises(InvalidEvidence):
        snapshot_answer(tmp_path, tmp_path / "protected", confirm_stopped=failed)
    assert not (tmp_path / "protected").exists()
