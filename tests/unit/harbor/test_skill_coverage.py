import json
from pathlib import Path

import yaml

from evals.harbor.pxi.compile_tasks import load_dataset
from evals.harbor.pxi.evaluators import EVALUATORS_BY_NAME
from evals.skill_regression import PLUGIN_CASES, ROOT, coverage, plugin_cases


def test_every_builtin_has_trigger_boundary_and_artifact_coverage() -> None:
    roots = [
        ROOT / "src/phoenix/server/mcp/skills",
        ROOT / "src/phoenix/server/agents/prompts/skills",
    ]
    discovered = {p.parent.name for root in roots for p in root.glob("*/SKILL.md")}
    inventory = coverage()["builtins"]
    assert discovered == set(inventory)
    for skill, spec in inventory.items():
        for polarity in ("positive", "negative"):
            dataset_name, case_id = spec[polarity].split("/", 1)
            dataset = load_dataset(dataset_name)
            example = next(e for e in dataset.examples if e["id"] == case_id)
            assert example["metadata"]["skill"] == skill
            assert example["metadata"]["polarity"] == polarity
            assert example["splits"] == ["regression"]
            assert set(dataset.evaluators) <= EVALUATORS_BY_NAME.keys()
            assert any(
                name in dataset.evaluators
                for name in ("assistant_json_match", "graphql_query_valid")
            )
            if polarity == "positive":
                assert spec["outcome"] in dataset.evaluators
                assert example["expected"]["tool_call_args"]["load_skill"]["skill_name"] == skill
                assert "load_skill" in example["expected"]["tools"]["required"]
            else:
                assert (
                    example["expected"]["forbidden_tool_call_args"]["load_skill"]["skill_name"]
                    == skill
                )
            # Automatic activation must not be seeded by a previous skill load.
            assert all(m["role"] == "user" for m in example["input"]["messages"])


def _frontmatter(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8").split("---", 2)[1])


def test_plugin_suites_cover_shipped_skills_and_have_repeated_outcome_checks() -> None:
    inventory = coverage()
    shipped = {p.name for p in (ROOT / "plugins/claude/arize-phoenix/skills").iterdir()}
    assert shipped <= {s["skill"] for s in inventory["plugin_suites"].values()}
    for suite, spec in inventory["plugin_suites"].items():
        names = plugin_cases(suite)
        assert sum("-neg-" in n for n in names) >= spec["minimum_negative"]
        assert sum("-neg-" not in n for n in names) >= spec["minimum_positive"]
        for name in names:
            path = PLUGIN_CASES / name
            if (path / "case.yaml").exists():
                case = yaml.safe_load((path / "case.yaml").read_text(encoding="utf-8"))
                graders = case["graders"]
                assert case["name"] == name
            else:
                case = _frontmatter(path / "prompt.md")
                graders = [_frontmatter(p) for p in (path / "graders").glob("*.md")]
            assert case.get("runs", 3) >= inventory["policy"]["minimum_runs"]
            assert any(g["type"] in {"regex", "llm", "file_exists"} for g in graders)
            assert any(g["type"] in {"tool_used", "tool_order"} for g in graders)


def test_mcp_tools_all_have_fixed_mocks() -> None:
    mocks = PLUGIN_CASES / "mocks/phoenix"
    tools = json.loads((mocks / "_tools.json").read_text(encoding="utf-8"))["tools"]
    for tool in tools:
        mock = mocks / f"{tool['name']}.md"
        header = _frontmatter(mock)
        assert header.get("type", "fixed") == "fixed"
        assert "expect" in header
    assert "Tools not found" not in (mocks / "get_schema.md").read_text(encoding="utf-8")
    actual_skill = (
        ROOT / "src/phoenix/server/mcp/skills/phoenix-error-analysis/SKILL.md"
    ).read_text(encoding="utf-8")
    assert (mocks / "load_skill.md").read_text(encoding="utf-8").split("---", 2)[
        2
    ].strip() == actual_skill.strip()
