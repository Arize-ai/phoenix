import json
from dataclasses import replace
from hashlib import sha256
from pathlib import Path
from unittest.mock import MagicMock

import pyarrow as pa
import pyarrow.parquet as parquet
import pytest

from phoenix.experimental.datagen.datasets import (
    DATASET_SOURCES,
    DatasetError,
    load_dataset,
    load_source,
    seed_datasets,
)
from phoenix.experimental.datagen.fetcher import CorpusFetchError, fetch_file


def test_cache_reuses_verified_files_and_repairs_corrupt_entries(tmp_path: Path) -> None:
    content = b'{"id":"one","input":{},"output":{}}\n'
    checksum = sha256(content).hexdigest()
    calls = []

    def download(url: str, destination: Path) -> None:
        calls.append(url)
        destination.write_bytes(content)

    arguments = dict(cache_dir=tmp_path, downloader=download)
    first = fetch_file("https://example.com/data", checksum, **arguments)
    assert fetch_file("https://example.com/data", checksum, **arguments) == first
    assert len(calls) == 1
    first.write_bytes(b"corrupt")
    assert fetch_file("https://example.com/data", checksum, **arguments).read_bytes() == content
    assert len(calls) == 2
    assert list(tmp_path.iterdir()) == [first]


def test_bad_download_is_not_published(tmp_path: Path) -> None:
    def download(url: str, destination: Path) -> None:
        destination.write_bytes(b"wrong")

    with pytest.raises(CorpusFetchError, match="checksum mismatch"):
        fetch_file("https://example.com/data", "0" * 64, cache_dir=tmp_path, downloader=download)
    assert not list(tmp_path.iterdir())


def test_generic_loader_accepts_non_decision_examples(tmp_path: Path) -> None:
    path = tmp_path / "examples.jsonl"
    path.write_text('\n{"id":"one","input":{"query":"hello"},"output":{"answer":"hi"}}\n')
    assert load_dataset(path) == [
        {"id": "one", "input": {"query": "hello"}, "output": {"answer": "hi"}, "metadata": {}}
    ]


@pytest.mark.parametrize(
    "content, message",
    [
        ("", "contains no examples"),
        ("{}\nnot-json", "row 1"),
        ('{"id":"one","input":{},"output":{}}\nnot-json', "line 2"),
        ('{"id":"one","input":[],"output":{}}', "input must be an object"),
        ('{"id":"","input":{},"output":{}}', "nonempty string"),
        ('{"id":"one","input":{},"output":{}}\n' * 2, "duplicate id"),
        ("[]", "record must be an object"),
    ],
)
def test_invalid_file_reports_context(tmp_path: Path, content: str, message: str) -> None:
    path = tmp_path / "examples.jsonl"
    path.write_text(content)
    with pytest.raises(DatasetError, match=message):
        load_dataset(path)


@pytest.mark.parametrize("expected, probability", [("yes", 1.0), ("no", 0.0)])
def test_jevbench_boolean_labels_are_normalized_without_leaking_rationale(
    tmp_path: Path, expected: str, probability: float
) -> None:
    row = {
        "id": "case-1",
        "state": "The user requested a refund.",
        "question": {"type": "noul", "instructions": "Did the user request a refund?"},
        "expected": expected,
        "provenance": {"rationale": "secret reference explanation"},
    }
    path = tmp_path / "hard.jsonl"
    path.write_text(json.dumps(row))
    example = load_dataset(path, adapter=DATASET_SOURCES["jevbench-hard"].adapter)[0]
    assert example["output"]["decision"]["noul"] == probability
    assert example["metadata"]["provenance"] == row["provenance"]
    assert set(example["input"]) == {"state", "questions"}
    assert "secret reference" not in json.dumps(example["input"])


def test_parquet_adapter_preserves_multiple_questions_and_soft_references(tmp_path: Path) -> None:
    questions = {
        "route": {"type": "choice", "criteria": {"b": "Billing", "a": "Accounts"}},
        "review": {"type": "noul"},
        "risk": {"type": "score", "criteria": ["Low", "High"]},
    }
    gold = {
        "route": {"label": "b", "probabilities": {"b": 0.7, "a": 0.3}},
        "review": {"noul": 0.25},
        "risk": {"score": 0.4, "probabilities": {"0": 0.6, "1": 0.4}},
    }
    row = {
        "id": "workflow_001",
        "state": json.dumps({"ticket": "Refund please"}),
        "questions": json.dumps(questions),
        "gold": json.dumps(gold),
        "factors": json.dumps({"severity": "low"}),
        "workflow": "customer_service",
    }
    path = tmp_path / "source.parquet"
    parquet.write_table(pa.Table.from_pylist([row]), path)
    example = load_dataset(
        path, format="parquet", adapter=DATASET_SOURCES["typed-decisions"].adapter
    )[0]
    assert example["input"] == {"state": {"ticket": "Refund please"}, "questions": questions}
    assert list(example["input"]["questions"]["route"]["criteria"]) == ["b", "a"]
    assert example["output"] == gold
    assert example["metadata"]["factors"] == {"severity": "low"}


def test_boolq_identity_does_not_depend_on_row_order_or_label(tmp_path: Path) -> None:
    rows = [
        {"question": "Is it blue?", "passage": "The sky is blue.", "answer": True},
        {"question": "Is it red?", "passage": "The sky is blue.", "answer": False},
    ]
    path = tmp_path / "boolq.jsonl"
    path.write_text("\n".join(map(json.dumps, rows)))
    adapter = DATASET_SOURCES["boolq"].adapter
    first = load_dataset(path, adapter=adapter)
    rows.reverse()
    rows[1]["answer"] = False
    path.write_text("\n".join(map(json.dumps, rows)))
    repeated = load_dataset(path, adapter=adapter)
    assert first[0]["id"] == repeated[1]["id"]
    assert first[1]["id"] == repeated[0]["id"]
    assert repeated[1]["output"]["decision"]["noul"] == 0.0


def test_seed_loads_cached_sources_with_stable_metadata_and_timeout(tmp_path: Path) -> None:
    content = b'{"id":"one","input":{},"output":{}}\n'
    checksum = sha256(content).hexdigest()
    (tmp_path / checksum).write_bytes(content)
    source = replace(DATASET_SOURCES["jevbench-hard"], checksum=checksum, adapter=lambda row: row)
    client = MagicMock()
    seed_datasets(client, sources=[source], cache_dir=tmp_path)
    first = client.datasets.create_dataset.call_args
    seed_datasets(client, sources=[source], cache_dir=tmp_path)
    assert first == client.datasets.create_dataset.call_args
    assert first.kwargs["timeout"] == 120
    assert first.kwargs["examples"][0]["metadata"]["source_revision"] == source.revision
    assert first.kwargs["name"] == "phoenix-datagen-jevbench-hard"


def test_invalid_source_prevents_partial_upload(tmp_path: Path) -> None:
    valid = b'{"id":"one","input":{},"output":{}}\n'
    invalid = b"{}\n"
    sources = []
    for content in (valid, invalid):
        checksum = sha256(content).hexdigest()
        (tmp_path / checksum).write_bytes(content)
        sources.append(
            replace(DATASET_SOURCES["jevbench-hard"], checksum=checksum, adapter=lambda row: row)
        )
    client = MagicMock()
    with pytest.raises(DatasetError, match="row 1"):
        seed_datasets(client, sources=sources, cache_dir=tmp_path)
    client.datasets.create_dataset.assert_not_called()


def test_xdg_cache_location(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("XDG_CACHE_HOME", str(tmp_path))
    source = DATASET_SOURCES["boolq"]
    cache = tmp_path / "phoenix" / "datagen" / "datasets"
    cache.mkdir(parents=True)
    # A small local source lets this check run entirely offline.
    content = b'{"question":"Is it blue?","passage":"Blue sky.","answer":true}\n'
    checksum = sha256(content).hexdigest()
    (cache / checksum).write_bytes(content)
    examples = load_source(replace(source, format="jsonl", checksum=checksum))
    assert len(examples) == 1
