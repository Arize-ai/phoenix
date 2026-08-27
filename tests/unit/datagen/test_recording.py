import json
from pathlib import Path

from phoenix.datagen.loader import load_corpus
from scripts.datagen.corpus import package_corpus
from scripts.datagen.graph_multi_agent import record as record_graph
from scripts.datagen.openai_chat_sessions import record as record_chat
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


def test_append_builds_a_multi_archetype_corpus(tmp_path: Path) -> None:
    recording_dir = tmp_path / "recording"
    plain_chat = fixtures_for("plain_chat")[0]
    graph = fixtures_for("graph_multi_agent")[0]

    record_chat(recording_dir, fixtures=(plain_chat,))
    record_graph(recording_dir, fixtures=(graph,), append=True)
    archive = tmp_path / "corpus.tar.gz"
    package = package_corpus(recording_dir, archive)
    corpus = load_corpus(archive)

    assert package.fragment_count == 2
    assert {fragment.archetype for fragment in corpus.fragments} == {
        "plain_chat",
        "graph_multi_agent",
    }
