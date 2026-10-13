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
def test_loaded_skills_reads_each_agent_format(
    tool_call: tuple[str, dict[str, Any]], expected: list[str]
) -> None:
    assert skills.loaded_skills(_trajectory(tool_call)) == expected


def test_loaded_skills_keeps_first_load_order_without_duplicates() -> None:
    trajectory = _trajectory(
        ("load_skill", {"skill_name": "b"}),
        ("load_skill", {"skill_name": "a"}),
        ("load_skill", {"skill_name": "b"}),
    )
    assert skills.loaded_skills(trajectory) == ["b", "a"]
    assert skills.loaded_skills(None) == []


def test_loaded_skills_ignores_copied_context() -> None:
    trajectory = _trajectory(("load_skill", {"skill_name": "a"}))
    trajectory["steps"][1]["is_copied_context"] = True
    assert skills.loaded_skills(trajectory) == []


@pytest.mark.parametrize(
    "loaded, expected, scores",
    [
        pytest.param(["a"], {}, {}, id="no-keys-no-scores"),
        pytest.param(
            ["a", "b"], {"skills_expected": ["a"]}, {"expected_skills_loaded": 1.0}, id="loaded"
        ),
        pytest.param([], {"skills_expected": ["a"]}, {"expected_skills_loaded": 0.0}, id="missed"),
        pytest.param(
            ["b"], {"skills_unexpected": ["a"]}, {"no_unexpected_skills": 1.0}, id="extras-allowed"
        ),
        pytest.param(
            ["a", "b"], {"skills_unexpected": ["a"]}, {"no_unexpected_skills": 0.0}, id="forbidden"
        ),
        pytest.param(
            [], {"skills_unexpected": "others"}, {"no_unexpected_skills": 1.0}, id="others-none"
        ),
        pytest.param(
            ["phoenix-cli", "phoenix-graphql"],
            {"skills_unexpected": "others"},
            {"no_unexpected_skills": 1.0},
            id="others-allows-interface-skills",
        ),
        pytest.param(
            ["phoenix-cli", "phoenix-error-analysis"],
            {"skills_unexpected": "others"},
            {"no_unexpected_skills": 0.0},
            id="others-forbids-workflow-skills",
        ),
        pytest.param(
            ["a"],
            {"skills_expected": ["a"], "skills_unexpected": "others"},
            {"expected_skills_loaded": 1.0, "no_unexpected_skills": 1.0},
            id="others-allows-the-required-skill",
        ),
        pytest.param(
            ["a", "b"],
            {"skills_expected": ["a"], "skills_unexpected": "others"},
            {"expected_skills_loaded": 1.0, "no_unexpected_skills": 0.0},
            id="others-forbids-a-sibling-skill",
        ),
    ],
)
def test_skill_scores(
    loaded: list[str], expected: dict[str, Any], scores: dict[str, float]
) -> None:
    assert skills.skill_scores(loaded, expected) == scores


def test_verify_writes_skill_scores_and_loaded_skills(tmp_path: Path) -> None:
    trajectory = _trajectory(("load_skill", {"skill_name": "phoenix-error-analysis"}))
    (tmp_path / "trajectory.json").write_text(json.dumps(trajectory))
    (tmp_path / "expected.json").write_text(
        json.dumps({"exact": "ok", "skills_unexpected": "others"})
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
    assert scores["no_unexpected_skills"] == 0.0
    assert "expected_skills_loaded" not in scores
    details = json.loads((tmp_path / "details.json").read_text())
    assert details == {"loaded_skills": ["phoenix-error-analysis"]}
