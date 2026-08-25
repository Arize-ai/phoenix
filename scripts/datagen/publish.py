"""Prepare and validate the datagen corpus for manual publication."""

from __future__ import annotations

import argparse
import json
import shlex
import shutil
import sys
import tempfile
from dataclasses import asdict, dataclass
from hashlib import sha256
from pathlib import Path
from typing import Any, Mapping, Sequence, TextIO

from phoenix.datagen.fetcher import CorpusFetchError, fetch_corpus
from phoenix.datagen.loader import CorpusError, load_corpus
from scripts.datagen.scenario import (
    CorpusArchiveError,
    _parse_instrumenter_versions,
    package_generation_run,
    read_corpus_archive,
)

_ARCHIVE_NAME = "corpus.tar.gz"
_BUCKET = "arize-phoenix-assets"
_PREFIX = "datagen"
_DEFAULT_OUTPUT_DIR = Path("dist/datagen-publication")


@dataclass(frozen=True)
class ValidatedCorpus:
    archive: Path
    sha256: str
    size_bytes: int
    fragment_count: int
    archetypes: tuple[str, ...]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate = subparsers.add_parser("validate", help="validate the canonical corpus archive")
    _add_archive_argument(validate)

    prepare_archive = subparsers.add_parser(
        "prepare-archive", help="stage an existing corpus archive and the latest pointer"
    )
    _add_archive_argument(prepare_archive)
    _add_output_argument(prepare_archive)

    prepare_run = subparsers.add_parser(
        "prepare-run", help="package a generation run and stage it for publication"
    )
    prepare_run.add_argument("run_dir", type=Path)
    prepare_run.add_argument("--generated-at", required=True)
    prepare_run.add_argument("--generation-revision", required=True)
    prepare_run.add_argument(
        "--instrumenter-package",
        action="append",
        required=True,
        metavar="NAME=VERSION",
        help="record an instrumenter distribution version; repeat for every recorder dependency",
    )
    _add_output_argument(prepare_run)
    return parser


def _add_archive_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--archive", type=Path, required=True)


def _add_output_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--output-dir", type=Path, default=_DEFAULT_OUTPUT_DIR)


def command(
    argv: Sequence[str] | None = None,
    *,
    stdout: TextIO = sys.stdout,
    stderr: TextIO = sys.stderr,
) -> int:
    args = build_parser().parse_args(argv)
    try:
        result = _dispatch(args)
    except (CorpusFetchError, CorpusArchiveError, OSError, CorpusError, ValueError) as error:
        print(
            json.dumps({"error": type(error).__name__, "message": str(error)}),
            file=stderr,
        )
        return 2
    print(json.dumps(result, indent=2, sort_keys=True), file=stdout)
    return 0


def _dispatch(args: argparse.Namespace) -> Mapping[str, Any]:
    if args.command == "validate":
        return _validated_corpus_document(validate_archive(args.archive))
    if args.command == "prepare-archive":
        return prepare_publication(validate_archive(args.archive), output_dir=args.output_dir)
    if args.command == "prepare-run":
        archive = args.output_dir / _ARCHIVE_NAME
        package_generation_run(
            args.run_dir,
            archive,
            generated_at=args.generated_at,
            generation_revision=args.generation_revision,
            instrumenter_package_versions=_parse_instrumenter_versions(args.instrumenter_package),
        )
        return prepare_publication(validate_archive(archive), output_dir=args.output_dir)
    raise AssertionError(args.command)


def validate_archive(archive: Path) -> ValidatedCorpus:
    archive = archive.resolve()
    if not archive.is_file():
        raise ValueError(f"corpus archive does not exist: {archive}")
    if archive.name != _ARCHIVE_NAME:
        raise ValueError(f"corpus archive must be named {_ARCHIVE_NAME}")
    archive_bytes = archive.read_bytes()
    archive_digest = sha256(archive_bytes).hexdigest()

    corpus_archive = read_corpus_archive(archive)
    fragment_count = corpus_archive.manifest["fragment_count"]
    archetypes = tuple(sorted({fragment.archetype for fragment in corpus_archive.fragments}))

    with tempfile.TemporaryDirectory(prefix="phoenix-datagen-validation-") as directory:
        validation_root = Path(directory)
        validation_pointer = validation_root / "corpus.json"
        validation_pointer.write_text(
            json.dumps(
                {
                    "schema_version": 2,
                    "url": "https://assets.invalid/corpus.tar.gz",
                    "sha256": archive_digest,
                }
            ),
            encoding="utf-8",
        )
        extracted = fetch_corpus(
            cache_dir=validation_root / "cache",
            pointer_path=validation_pointer,
            downloader=lambda _url, destination: shutil.copyfile(archive, destination),
        )
        load_corpus(extracted)

    return ValidatedCorpus(
        archive=archive,
        sha256=archive_digest,
        size_bytes=len(archive_bytes),
        fragment_count=fragment_count,
        archetypes=archetypes,
    )


def prepare_publication(
    validated: ValidatedCorpus,
    *,
    output_dir: Path,
) -> Mapping[str, Any]:
    object_name = f"{_PREFIX}/corpus/{validated.sha256}/{_ARCHIVE_NAME}"
    public_url = f"https://storage.googleapis.com/{_BUCKET}/{object_name}"
    pointer_document = {
        "schema_version": 2,
        "url": public_url,
        "sha256": validated.sha256,
    }

    output_dir = output_dir.resolve()
    staged_archive = output_dir / "corpus" / validated.sha256 / _ARCHIVE_NAME
    staged_archive.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(validated.archive, staged_archive)
    staged_pointer = output_dir / "corpus.json"
    staged_pointer.write_text(
        json.dumps(pointer_document, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    upload_commands = [
        shlex.join(
            (
                "gcloud",
                "storage",
                "cp",
                "--no-clobber",
                "--cache-control=public,max-age=31536000,immutable",
                str(staged_archive),
                f"gs://{_BUCKET}/{object_name}",
            )
        ),
        shlex.join(
            (
                "gcloud",
                "storage",
                "cp",
                "--cache-control=no-cache,max-age=0",
                str(staged_pointer),
                f"gs://{_BUCKET}/{_PREFIX}/corpus.json",
            )
        ),
    ]
    return {
        **_validated_corpus_document(validated),
        "staged_archive": str(staged_archive),
        "staged_pointer": str(staged_pointer),
        "upload_commands": upload_commands,
    }


def _validated_corpus_document(validated: ValidatedCorpus) -> dict[str, Any]:
    value = asdict(validated)
    value["archive"] = str(validated.archive)
    value["archetypes"] = list(validated.archetypes)
    return value


if __name__ == "__main__":
    raise SystemExit(command())
