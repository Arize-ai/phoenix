from __future__ import annotations

import json
from pathlib import Path

import pytest

from evals.skills.runner import affected as affected_module
from evals.skills.runner.cases import Case, RoutingFile, load_routing_file
from evals.skills.runner.claude_code import parse_stream
from evals.skills.runner.scoring import CaseResult, SuiteResult


def _event(**fields: object) -> str:
    return json.dumps(fields)


def _init() -> str:
    return _event(
        type="system",
        subtype="init",
        claude_code_version="2.1.287",
        model="claude-sonnet-5-5",
        plugins=[{"name": "arize-phoenix"}],
    )


def _tool_use(name: str, arguments: dict[str, object]) -> str:
    return _event(
        type="assistant",
        message={"content": [{"type": "tool_use", "name": name, "input": arguments}]},
    )


def _result(**fields: object) -> str:
    return _event(type="result", total_cost_usd=0.03, num_turns=2, **fields)


class TestParseStream:
    def test_reads_a_plugin_skill_load(self) -> None:
        result = parse_stream(
            [
                "Warning: no stdin data received",
                _init(),
                _tool_use("Skill", {"skill": "arize-phoenix:phoenix-tracing"}),
                _result(subtype="success", terminal_reason="hook_stopped", is_error=False),
            ]
        )
        assert result.loaded == ["phoenix-tracing"]
        assert result.error is None
        assert result.cost_usd == 0.03
        assert result.agent_version == "2.1.287"

    def test_counts_max_turns_as_a_valid_run(self) -> None:
        result = parse_stream(
            [
                _init(),
                _tool_use("Bash", {"command": "ls"}),
                _result(subtype="error_max_turns", terminal_reason="max_turns", is_error=True),
            ]
        )
        assert result.loaded == []
        assert result.error is None

    def test_reports_a_missing_plugin(self) -> None:
        init = json.loads(_init())
        init["plugins"] = []
        result = parse_stream([json.dumps(init), _result(subtype="success", is_error=False)])
        assert result.error == "the arize-phoenix plugin didn't load"

    def test_reports_a_missing_result(self) -> None:
        assert parse_stream([_init()]).error == "the agent ended without a result event"


def _case(expect: str = "load", kind: str = "explicit", **fields: object) -> Case:
    return Case.model_validate(
        {"query": f"q {expect} {kind}", "expect": expect, "kind": kind, **fields}
    )


def _runs(*loads: bool) -> list[dict[str, object]]:
    return [{"loaded": ["phoenix-evals"] if load else [], "cost_usd": 0.01} for load in loads]


class TestCase:
    def test_rejects_a_load_kind_on_a_no_load_case(self) -> None:
        with pytest.raises(ValueError, match="isn't valid"):
            _case(expect="no-load", kind="explicit")

    def test_requires_sibling_for_sibling_cases(self) -> None:
        with pytest.raises(ValueError, match="sibling"):
            _case(expect="no-load", kind="sibling")
        assert _case(expect="no-load", kind="sibling", sibling="phoenix-cli").sibling


class TestScoring:
    @pytest.mark.parametrize(
        ("loads", "decided", "loaded"),
        [
            ((True, True), True, True),
            ((False, False), True, False),
            ((True, False), False, None),
            ((True, False, True), True, True),
        ],
    )
    def test_majority_of_three(
        self, loads: tuple[bool, ...], decided: bool, loaded: object
    ) -> None:
        result = CaseResult(case=_case(), skill="phoenix-evals", runs=_runs(*loads))
        assert result.decided is decided
        assert result.loaded is loaded

    def test_ignores_failed_runs(self) -> None:
        runs = _runs(True) + [{"loaded": [], "error": "timed out"}]
        result = CaseResult(case=_case(), skill="phoenix-evals", runs=runs)
        assert result.loaded is None

    def test_suite_gates_on_both_thresholds(self) -> None:
        routing = RoutingFile(skill="phoenix-evals", cases=[_case()])
        load_cases = [
            CaseResult(case=_case(), skill="phoenix-evals", runs=_runs(True, True))
            for _ in range(4)
        ] + [CaseResult(case=_case(), skill="phoenix-evals", runs=_runs(False, False))]
        no_load = CaseResult(
            case=_case(expect="no-load", kind="near-miss"),
            skill="phoenix-evals",
            runs=_runs(False, False),
        )
        suite = SuiteResult(routing=routing, channel="claude-code", cases=[*load_cases, no_load])
        assert suite.recall == 0.8
        assert suite.false_load_rate == 0.0
        assert suite.passed is True
        no_load.runs = _runs(True, True)
        assert suite.passed is False


class TestRoutingFiles:
    def test_rejects_a_skill_that_doesnt_match_its_folder(self, tmp_path: Path) -> None:
        path = tmp_path / "phoenix-evals" / "routing.yaml"
        path.parent.mkdir()
        path.write_text(
            "skill: phoenix-cli\ncases:\n  - {query: q, expect: load, kind: explicit}\n"
        )
        with pytest.raises(ValueError, match="doesn't match its folder"):
            load_routing_file(path)

    def test_defaults_channels_from_targets(self) -> None:
        routing = RoutingFile(skill="phoenix-error-analysis", cases=[_case()])
        assert routing.resolved_channels() == ["claude-code", "mcp", "pxi"]


class TestAffected:
    @pytest.fixture
    def files(self) -> list[RoutingFile]:
        return [
            RoutingFile(skill="phoenix-cli", cases=[_case()]),
            RoutingFile(skill="phoenix-evals", cases=[_case()]),
        ]

    def test_description_change_reruns_siblings(
        self, files: list[RoutingFile], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            affected_module, "_description", lambda ref, path: "old" if ref else "new"
        )
        result = affected_module.affected("main", ["skills/phoenix-evals/SKILL.md"], files)
        assert result == {
            "skills": ["phoenix-cli", "phoenix-evals"],
            "channels": ["claude-code", "mcp"],
        }

    def test_body_change_runs_nothing(
        self, files: list[RoutingFile], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(affected_module, "_description", lambda ref, path: "same")
        result = affected_module.affected("main", ["skills/phoenix-evals/SKILL.md"], files)
        assert result == {"skills": [], "channels": []}

    def test_routing_file_change_runs_that_skill(self, files: list[RoutingFile]) -> None:
        result = affected_module.affected("main", ["evals/skills/phoenix-cli/routing.yaml"], files)
        assert result == {"skills": ["phoenix-cli"], "channels": ["claude-code"]}
