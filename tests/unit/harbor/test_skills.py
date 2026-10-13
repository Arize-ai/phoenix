import json
from pathlib import Path
from typing import Any

import pytest

from harbor_verifiers import skills, verify


def _trajectory(*tool_calls: tuple[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        "steps": [
            {"source": "user", "message": "question"},
            {
                "source": "agent",
                "tool_calls": [
                    {"function_name": name, "arguments": arguments}
                    for name, arguments in tool_calls
                ],
            },
            {"source": "agent", "message": "ok"},
        ]
    }


@pytest.mark.parametrize(
    "tool_call, expected",
    [
        pytest.param(("Skill", {"skill": "phoenix-cli"}), ["phoenix-cli"], id="claude-code"),
        pytest.param(
            ("Skill", {"skill": "arize-phoenix:phoenix-cli"}),
            ["phoenix-cli"],
            id="claude-code-plugin",
        ),
        pytest.param(
            ("mcp__phoenix__load_skill", {"skill_name": "phoenix-error-analysis"}),
            ["phoenix-error-analysis"],
            id="claude-code-mcp",
        ),
        pytest.param(
            ("load_skill", {"skill_name": "phoenix-graphql"}), ["phoenix-graphql"], id="pxi"
        ),
        pytest.param(
            ("load_skill", {"skill_name": "phoenix-error-analysis"}),
            ["phoenix-error-analysis"],
            id="codex-mcp",
        ),
        pytest.param(
            ("exec_command", {"cmd": "cat /home/agent/.agents/skills/phoenix-cli/SKILL.md"}),
            ["phoenix-cli"],
            id="codex-cli",
        ),
        pytest.param(
            (
                "load_skill_reference",
                {"skill_name": "phoenix-graphql", "reference_name": "references/sessions.md"},
            ),
            [],
            id="reference-is-not-a-load",
        ),
        pytest.param(("exec_command", {"cmd": "find / -name SKILL.md"}), [], id="search"),
        pytest.param(("execute", {"code": "print('skill')"}), [], id="other-tool"),
    ],
)
def test_skills_loaded_reads_each_agent_format(
    tool_call: tuple[str, dict[str, Any]], expected: list[str]
) -> None:
    assert skills.skills_loaded(_trajectory(tool_call)) == expected


def test_skills_loaded_keeps_first_load_order_without_duplicates() -> None:
    trajectory = _trajectory(
        ("load_skill", {"skill_name": "b"}),
        ("load_skill", {"skill_name": "a"}),
        ("load_skill", {"skill_name": "b"}),
    )
    assert skills.skills_loaded(trajectory) == ["b", "a"]
    assert skills.skills_loaded(None) == []


def test_skills_loaded_ignores_copied_context() -> None:
    trajectory = _trajectory(("load_skill", {"skill_name": "a"}))
    trajectory["steps"][1]["is_copied_context"] = True
    assert skills.skills_loaded(trajectory) == []


@pytest.mark.parametrize(
    "loaded, expected, score",
    [
        (["a"], {}, None),
        (["a", "b"], {"skills_expected": ["a"]}, 1.0),
        ([], {"skills_expected": ["a"]}, 0.0),
        ([], {"skills_unexpected": ["a"]}, 1.0),
        (["b"], {"skills_unexpected": ["a"]}, 1.0),
        (["a"], {"skills_unexpected": ["a"]}, 0.0),
        (["a", "b"], {"skills_expected": ["a"], "skills_unexpected": ["b"]}, 0.0),
    ],
)
def test_skill_match(loaded: list[str], expected: dict[str, Any], score: float | None) -> None:
    assert skills.skill_match(loaded, expected) == score


def test_verify_writes_skill_match_and_loaded_skills(tmp_path: Path) -> None:
    trajectory = _trajectory(("load_skill", {"skill_name": "phoenix-error-analysis"}))
    (tmp_path / "trajectory.json").write_text(json.dumps(trajectory))
    (tmp_path / "expected.json").write_text(
        json.dumps({"exact": "ok", "skills_unexpected": ["phoenix-error-analysis"]})
    )
    verify.main(
        [
            "--expected",
            str(tmp_path / "expected.json"),
            "--trajectory",
            str(tmp_path / "trajectory.json"),
            "--reward-file",
            str(tmp_path / "reward.json"),
        ]
    )
    scores = json.loads((tmp_path / "reward.json").read_text())
    assert scores["reward"] == 1.0
    assert scores["skill_match"] == 0.0
    details = json.loads((tmp_path / "details.json").read_text())
    assert details == {"skills_loaded": ["phoenix-error-analysis"]}
