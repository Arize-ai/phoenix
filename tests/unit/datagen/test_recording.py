import json
from pathlib import Path

from scripts.datagen.recording import RecorderFixture, fixtures_for, load_fixtures, record_fixture


def test_fixed_fixture_records_trace_and_fragment_rows(tmp_path: Path) -> None:
    fixture = fixtures_for("plain_chat")[0]

    def adapter(selected: RecorderFixture, traces_path: Path) -> tuple[str, ...]:
        traces_path.write_text(
            json.dumps({"resourceSpans": [], "fixture": selected.fragment_id}) + "\n",
            encoding="utf-8",
        )
        return ("ABCDEF0123456789ABCDEF0123456789",)

    fragment = record_fixture(fixture, tmp_path, adapter)

    assert fragment == {
        "fragment_id": fixture.fragment_id,
        "archetype": "plain_chat",
        "domain": "customer_support",
        "trace_ids": ["abcdef0123456789abcdef0123456789"],
    }
    assert json.loads((tmp_path / "fragments.jsonl").read_text()) == fragment
    assert (tmp_path / "traces.jsonl").read_text().count("\n") == 1
    assert {item.archetype for item in load_fixtures()} == {
        "plain_chat",
        "rag",
        "tool_agent",
        "graph_multi_agent",
        "guardrailed",
        "structured_extraction",
    }
