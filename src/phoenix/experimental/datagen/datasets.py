"""Load and seed cached development datasets with source-specific row adapters."""

from __future__ import annotations

import json
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Iterator,
    Literal,
    Mapping,
    NotRequired,
    Sequence,
    TypedDict,
)

from phoenix.experimental.datagen.fetcher import default_cache_dir, fetch_file

if TYPE_CHECKING:
    from phoenix.client import Client
    from phoenix.client.resources.datasets import Dataset


class DatasetError(ValueError):
    """A dataset record cannot be read or converted to a Phoenix example."""


class Example(TypedDict):
    id: str
    input: dict[str, Any]
    output: dict[str, Any]
    metadata: dict[str, Any]
    splits: NotRequired[list[str]]


Adapter = Callable[[Mapping[str, Any]], Mapping[str, Any]]
FileFormat = Literal["jsonl", "parquet"]


def _jevbench(row: Mapping[str, Any]) -> Mapping[str, Any]:
    question = row["question"]
    _validate_questions({"decision": question})
    kind = question["type"]
    expected = row["expected"]
    answer = {"type": kind, "label": expected}
    if kind == "noul":
        if expected not in ("yes", "no"):
            raise ValueError("expected noul answer must be 'yes' or 'no'")
        answer.update(label="true" if expected == "yes" else "false", noul=float(expected == "yes"))
    elif kind == "choice":
        if expected not in question["criteria"]:
            raise ValueError("expected choice is missing from criteria")
        answer["choice"] = expected
    else:
        if type(expected) is not int or not 0 <= expected < len(question["criteria"]):
            raise ValueError("expected score must be a rubric level")
        answer["score"] = expected
    return {
        "id": f"jevbench-hard:{row['id']}",
        "input": {"state": row["state"], "questions": {"decision": question}},
        "output": {"decision": answer},
        "metadata": {
            key: value
            for key, value in row.items()
            if key not in {"id", "state", "question", "expected"}
        },
    }


def _typed_decisions(row: Mapping[str, Any]) -> Mapping[str, Any]:
    questions = json.loads(row["questions"])
    gold = json.loads(row["gold"])
    _validate_questions(questions)
    if not isinstance(gold, dict) or gold.keys() != questions.keys():
        raise ValueError("gold must contain an answer for every question")
    return {
        "id": f"typed-decisions:{row['id']}",
        "input": {"state": json.loads(row["state"]), "questions": questions},
        "output": gold,
        "metadata": {
            key: json.loads(value) if key in {"factors", "label_agreement"} else value
            for key, value in row.items()
            if key not in {"id", "state", "questions", "gold"}
        },
    }


def _boolq(row: Mapping[str, Any]) -> Mapping[str, Any]:
    if not isinstance(row["answer"], bool):
        raise ValueError("answer must be a boolean")
    identity = sha256(
        json.dumps([row["question"], row["passage"]], ensure_ascii=False).encode()
    ).hexdigest()
    return {
        "id": f"boolq:{identity}",
        "input": {
            "state": row["passage"],
            "questions": {"decision": {"type": "noul", "instructions": row["question"]}},
        },
        "output": {
            "decision": {
                "type": "noul",
                "label": "true" if row["answer"] else "false",
                "noul": float(row["answer"]),
            }
        },
        "metadata": {"split": "validation"},
    }


def _validate_questions(questions: Any) -> None:
    if not isinstance(questions, dict) or not questions:
        raise ValueError("questions must be a nonempty object")
    for name, question in questions.items():
        if not name or not isinstance(question, dict):
            raise ValueError("each question must have a name and an object value")
        kind = question.get("type")
        criteria = question.get("criteria", {})
        if kind == "choice":
            valid = isinstance(criteria, dict) and len(criteria) >= 2
        elif kind == "noul":
            valid = isinstance(criteria, dict) and set(criteria) <= {"true", "false"}
        elif kind == "score":
            valid = isinstance(criteria, list) and len(criteria) >= 2
        else:
            valid = False
        if not valid:
            raise ValueError(f"invalid type or criteria for question {name!r}")


@dataclass(frozen=True)
class DatasetSource:
    name: str
    url: str
    revision: str
    checksum: str
    format: FileFormat
    adapter: Adapter
    license: str
    split_metadata_key: str | None = None


_JEVBENCH_REVISION = "609a664e81f46e03731600bd7bd9f1b7a61257c5"
_TYPED_DECISIONS_REVISION = "7189f46b02248bd2569df7325c9df8e3b24e90a7"
_BOOLQ_REVISION = "35b264d03638db9f4ce671b711558bf7ff0f80d5"

DATASET_SOURCES = {
    source.name: source
    for source in (
        DatasetSource(
            name="jevbench-hard",
            url=f"https://raw.githubusercontent.com/fstandhartinger/jevbench/{_JEVBENCH_REVISION}/datasets/public/hard.jsonl",
            revision=_JEVBENCH_REVISION,
            checksum="89e9e6becb33ed88c1de7d42dcc87531b2fb64cfaef4e1986faf7c37b3f80ebb",
            format="jsonl",
            adapter=_jevbench,
            license="MIT",
        ),
        DatasetSource(
            name="typed-decisions",
            url=f"https://huggingface.co/datasets/LocalLLaMA/typed-decisions/resolve/{_TYPED_DECISIONS_REVISION}/all/test-00000-of-00001.parquet",
            revision=_TYPED_DECISIONS_REVISION,
            checksum="4f294f218ea1da27f3efef936359389c62ea4d3973a41457732990f1d31b647c",
            format="parquet",
            adapter=_typed_decisions,
            license="Apache-2.0",
            split_metadata_key="workflow",
        ),
        DatasetSource(
            name="boolq",
            url=f"https://huggingface.co/datasets/google/boolq/resolve/{_BOOLQ_REVISION}/data/validation-00000-of-00001.parquet",
            revision=_BOOLQ_REVISION,
            checksum="52355d11524b4b874a9b9dcc278feb10f672d52c4f4eff9872e695ede59820f8",
            format="parquet",
            adapter=_boolq,
            license="CC-BY-SA-3.0",
        ),
    )
}


def _read_rows(path: Path, format: FileFormat) -> Iterator[tuple[int, Any]]:
    if format == "parquet":
        import pyarrow.parquet as parquet

        for index, row in enumerate(parquet.read_table(path).to_pylist(), start=1):
            yield index, row
    else:
        with path.open(encoding="utf-8") as stream:
            for index, line in enumerate(stream, start=1):
                if line.strip():
                    try:
                        yield index, json.loads(line)
                    except json.JSONDecodeError as error:
                        raise DatasetError(f"{path}: line {index}: {error}") from error


def load_dataset(
    path: Path,
    *,
    format: FileFormat = "jsonl",
    adapter: Adapter | None = None,
) -> list[Example]:
    """Read canonical Phoenix examples, optionally adapting a source-specific schema.

    Each example requires a stable string ``id`` and object-valued ``input`` and
    ``output``. ``metadata`` is optional. Malformed or duplicate rows reject the
    entire import before anything is uploaded.
    """
    examples: list[Example] = []
    identities: set[str] = set()
    try:
        for index, row in _read_rows(path, format):
            try:
                if not isinstance(row, dict):
                    raise ValueError("record must be an object")
                value = adapter(row) if adapter else row
                identity = value["id"]
                if not isinstance(identity, str) or not identity.strip():
                    raise ValueError("id must be a nonempty string")
                if identity in identities:
                    raise ValueError(f"duplicate id {identity!r}")
                example: Example = {
                    "id": identity,
                    "input": value["input"],
                    "output": value["output"],
                    "metadata": value.get("metadata", {}),
                }
                for field, field_value in example.items():
                    if field != "id" and not isinstance(field_value, dict):
                        raise ValueError(f"{field} must be an object")
                json.dumps(example, allow_nan=False)
            except (KeyError, TypeError, ValueError) as error:
                raise DatasetError(f"{path}: row {index}: {error}") from error
            identities.add(identity)
            examples.append(example)
    except (OSError, UnicodeError) as error:
        raise DatasetError(f"Unable to read dataset {path}: {error}") from error
    if not examples:
        raise DatasetError(f"Dataset {path} contains no examples")
    return examples


def load_source(source: DatasetSource, *, cache_dir: Path | None = None) -> list[Example]:
    """Fetch a pinned source once and convert its rows to reproducible examples."""
    path = fetch_file(
        source.url,
        source.checksum,
        cache_dir=cache_dir if cache_dir is not None else default_cache_dir().parent / "datasets",
    )
    examples = load_dataset(path, format=source.format, adapter=source.adapter)
    for example in examples:
        if source.split_metadata_key is not None:
            split = example["metadata"].get(source.split_metadata_key)
            if not isinstance(split, str) or not split.strip():
                raise DatasetError(
                    f"{source.name}: example {example['id']!r}: metadata."
                    f"{source.split_metadata_key} must be a nonempty string"
                )
            example["splits"] = [split]
        example["metadata"].update(
            source_url=source.url,
            source_revision=source.revision,
            source_sha256=source.checksum,
            source_license=source.license,
        )
    return examples


def seed_datasets(
    client: Client,
    *,
    sources: Sequence[DatasetSource] | None = None,
    cache_dir: Path | None = None,
) -> list[Dataset]:
    """Replace datagen-owned datasets with pinned examples; identical uploads are no-ops.

    All sources are validated before the first upload. Uploads use stable example
    IDs and a 120-second timeout to accommodate the full BoolQ validation split.
    Sources with a split metadata key seed both the combined dataset and one
    dataset per split, with the split name appended to the combined name.
    """
    loaded = [
        (source, load_source(source, cache_dir=cache_dir))
        for source in (sources if sources is not None else list(DATASET_SOURCES.values()))
    ]
    datasets = []
    for source, examples in loaded:
        groups = {"": examples}
        if source.split_metadata_key is not None:
            for example in examples:
                split = example["metadata"][source.split_metadata_key]
                groups.setdefault(f"-{split}", []).append(example)
        for suffix, subset in sorted(groups.items()):
            datasets.append(
                client.datasets.create_dataset(
                    name=f"phoenix-datagen-{source.name}{suffix}",
                    examples=subset,
                    dataset_description=(
                        f"Datagen-owned development fixture. Source: {source.url} "
                        f"License: {source.license}. Re-seeding replaces the dataset contents."
                    ),
                    timeout=120,
                )
            )
    return datasets
