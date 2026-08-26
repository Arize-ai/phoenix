import json
import shutil
from pathlib import Path

import pytest

from phoenix.datagen import CorpusError, load_corpus


def test_load_corpus_parses_local_fixture() -> None:
    corpus_path = Path(__file__).parent / "fixtures" / "scenario"

    corpus = load_corpus(corpus_path)

    assert corpus.manifest["scenario_name"] == "synthetic-chat"
    assert len(corpus.requests) == 3
    assert (
        sum(
            len(scope_spans.spans)
            for request in corpus.requests
            for resource_spans in request.resource_spans
            for scope_spans in resource_spans.scope_spans
        )
        == 4
    )


def test_load_corpus_fetches_the_published_corpus(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    corpus_path = Path(__file__).parent / "fixtures" / "scenario"
    monkeypatch.setattr("phoenix.datagen.fetcher.fetch_corpus", lambda: corpus_path)

    corpus = load_corpus()

    assert corpus.manifest["scenario_name"] == "synthetic-chat"
    assert len(corpus.requests) == 3


def test_load_corpus_parses_v2_fragment_bank() -> None:
    corpus_path = Path(__file__).parent / "fixtures" / "fragment_bank"

    corpus = load_corpus(corpus_path)

    assert corpus.schema_version == 2
    assert [fragment.archetype for fragment in corpus.fragments] == ["plain_chat", "rag"]
    assert corpus.fragments[0].trace_ids == (
        "01010101010101010101010101010101",
        "03030303030303030303030303030303",
    )
    assert set(corpus.requests_by_trace_id) == {
        "01010101010101010101010101010101",
        "02020202020202020202020202020202",
        "03030303030303030303030303030303",
    }


def test_load_corpus_ignores_unconsumed_metadata(tmp_path: Path) -> None:
    corpus_path = _copy_fragment_bank(tmp_path)
    manifest_path = corpus_path / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest_path.write_text(
        json.dumps(
            {
                "schema_version": manifest["schema_version"],
                "scenario_name": manifest["scenario_name"],
                "future_metadata": {"format": "unconstrained"},
            }
        )
    )
    fragments_path = corpus_path / "fragments.jsonl"
    rows = [json.loads(line) for line in fragments_path.read_text().splitlines()]
    _write_fragments(
        corpus_path,
        [
            {
                "fragment_id": row["fragment_id"],
                "archetype": row["archetype"],
                "domain": row["domain"],
                "trace_ids": row["trace_ids"],
                "future_metadata": ["anything"],
            }
            for row in rows
        ],
    )

    corpus = load_corpus(corpus_path)

    assert corpus.manifest["future_metadata"] == {"format": "unconstrained"}
    assert len(corpus.fragments) == 2
    assert corpus.fragments[0].extra == {"future_metadata": ["anything"]}


def test_load_corpus_rejects_invalid_fragment_trace_membership(tmp_path: Path) -> None:
    corpus_path = _copy_fragment_bank(tmp_path)
    fragments_path = corpus_path / "fragments.jsonl"
    rows = [json.loads(line) for line in fragments_path.read_text().splitlines()]
    rows[0]["trace_ids"].append("ffffffffffffffffffffffffffffffff")
    _write_fragments(corpus_path, rows)

    with pytest.raises(CorpusError) as error:
        load_corpus(corpus_path)

    assert "fragment-bank" in str(error.value)
    assert "'trace_ids'" in str(error.value)


def _copy_fragment_bank(tmp_path: Path) -> Path:
    source = Path(__file__).parent / "fixtures" / "fragment_bank"
    destination = tmp_path / "fragment-bank"
    shutil.copytree(source, destination)
    return destination


def _write_fragments(corpus_path: Path, rows: list[dict[str, object]]) -> None:
    content = "".join(f"{json.dumps(row, separators=(',', ':'))}\n" for row in rows)
    (corpus_path / "fragments.jsonl").write_text(content)
