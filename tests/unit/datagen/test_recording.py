from pathlib import Path

from phoenix.datagen.loader import load_corpus
from scripts.datagen.corpus import package_corpus
from scripts.datagen.graph_multi_agent import record as record_graph
from scripts.datagen.openai_chat_sessions import record as record_chat
from scripts.datagen.recording import fixtures_for, live_model_options, resolve_live_model


def test_live_model_alias() -> None:
    assert resolve_live_model("luna") == "gpt-5.6-luna"
    assert resolve_live_model("gpt-5.4") == "gpt-5.4"
    assert live_model_options("gpt-5.6-luna") == {"reasoning_effort": "none"}
    assert live_model_options("gpt-5.4") == {}


def test_recording_resets_then_appends_into_a_multi_archetype_corpus(tmp_path: Path) -> None:
    recording_dir = tmp_path / "recording"
    recording_dir.mkdir()
    for name in ("fragments.jsonl", "traces.jsonl"):
        (recording_dir / name).write_text("stale row\n", encoding="utf-8")

    record_chat(recording_dir, fixtures=(fixtures_for("plain_chat")[0],))
    record_graph(recording_dir, fixtures=(fixtures_for("graph_multi_agent")[0],), append=True)
    archive = tmp_path / "corpus.tar.gz"
    package = package_corpus(recording_dir, archive)
    corpus = load_corpus(archive)

    assert "stale row" not in (recording_dir / "fragments.jsonl").read_text()
    assert package.fragment_count == 2
    assert {fragment.archetype for fragment in corpus.fragments} == {
        "plain_chat",
        "graph_multi_agent",
    }
