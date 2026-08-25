import json
import shutil
from pathlib import Path

import pytest

from phoenix.datagen import ScenarioError, load_scenario


def test_load_scenario_parses_local_fixture() -> None:
    scenario_path = Path(__file__).parent / "fixtures" / "scenario"

    scenario = load_scenario(scenario_path)

    assert scenario.manifest["scenario_name"] == "synthetic-chat"
    assert len(scenario.requests) == 3
    assert (
        sum(
            len(scope_spans.spans)
            for request in scenario.requests
            for resource_spans in request.resource_spans
            for scope_spans in resource_spans.scope_spans
        )
        == 4
    )


def test_load_scenario_resolves_a_published_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    scenario_path = Path(__file__).parent / "fixtures" / "scenario"
    monkeypatch.setattr("phoenix.datagen.fetcher.fetch_scenario", lambda _source: scenario_path)

    scenario = load_scenario("openai_chat_sessions")

    assert scenario.manifest["scenario_name"] == "synthetic-chat"
    assert len(scenario.requests) == 3


def test_load_scenario_parses_v2_fragment_bank() -> None:
    scenario_path = Path(__file__).parent / "fixtures" / "fragment_bank"

    scenario = load_scenario(scenario_path)

    assert scenario.schema_version == 2
    assert [fragment.archetype for fragment in scenario.fragments] == ["plain_chat", "rag"]
    assert scenario.fragments[0].trace_ids == (
        "01010101010101010101010101010101",
        "03030303030303030303030303030303",
    )
    assert set(scenario.requests_by_trace_id) == {
        "01010101010101010101010101010101",
        "02020202020202020202020202020202",
        "03030303030303030303030303030303",
    }


def test_load_scenario_preserves_additive_merge_lineage(tmp_path: Path) -> None:
    scenario_path = _copy_fragment_bank(tmp_path)
    manifest_path = scenario_path / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["quality_gate_summary"]["merge_lineage"] = {
        "base": {"archive_sha256": "a" * 64, "matrix_sha256": "b" * 64},
        "supplement": {"archive_sha256": "c" * 64, "matrix_sha256": "d" * 64},
    }
    manifest_path.write_text(json.dumps(manifest))

    scenario = load_scenario(scenario_path)

    assert scenario.manifest["quality_gate_summary"]["merge_lineage"] == {
        "base": {"archive_sha256": "a" * 64, "matrix_sha256": "b" * 64},
        "supplement": {"archive_sha256": "c" * 64, "matrix_sha256": "d" * 64},
    }


def test_load_scenario_rejects_invalid_fragment_trace_membership(tmp_path: Path) -> None:
    scenario_path = _copy_fragment_bank(tmp_path)
    fragments_path = scenario_path / "fragments.jsonl"
    rows = [json.loads(line) for line in fragments_path.read_text().splitlines()]
    rows[0]["trace_ids"].append("ffffffffffffffffffffffffffffffff")
    _write_fragments(scenario_path, rows)

    with pytest.raises(ScenarioError) as error:
        load_scenario(scenario_path)

    assert "fragment-bank" in str(error.value)
    assert "'trace_ids'" in str(error.value)


def test_load_scenario_rejects_invalid_v2_manifest_field(tmp_path: Path) -> None:
    scenario_path = _copy_fragment_bank(tmp_path)
    manifest_path = scenario_path / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    del manifest["generated_at"]
    manifest_path.write_text(json.dumps(manifest))

    with pytest.raises(ScenarioError, match=r"field 'generated_at'"):
        load_scenario(scenario_path)


def _copy_fragment_bank(tmp_path: Path) -> Path:
    source = Path(__file__).parent / "fixtures" / "fragment_bank"
    destination = tmp_path / "fragment-bank"
    shutil.copytree(source, destination)
    return destination


def _write_fragments(scenario_path: Path, rows: list[dict[str, object]]) -> None:
    content = "".join(f"{json.dumps(row, separators=(',', ':'))}\n" for row in rows)
    (scenario_path / "fragments.jsonl").write_text(content)
