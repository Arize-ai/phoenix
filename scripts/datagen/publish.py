"""Prepare and validate datagen assets for manual publication."""

from __future__ import annotations

import argparse
import json
import re
import shlex
import shutil
import sys
import tempfile
from dataclasses import asdict, dataclass
from hashlib import sha256
from pathlib import Path
from typing import Any, Mapping, Sequence, TextIO
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import urlopen

from phoenix.datagen.fetcher import ScenarioFetchError, fetch_scenario, load_scenario_index
from phoenix.datagen.loader import ScenarioError, load_scenario
from scripts.datagen.scenario import (
    ScenarioArchiveError,
    package_generation_run,
    read_scenario_archive,
)

_ARCHIVE_NAME = re.compile(r"[a-z0-9][a-z0-9_-]*\.tar\.gz")
_BUCKET = "arize-phoenix-assets"
_PREFIX = "datagen"
_PUBLIC_BASE_URL = f"https://storage.googleapis.com/{_BUCKET}/{_PREFIX}"
_DEFAULT_INDEX_URL = f"{_PUBLIC_BASE_URL}/index.json"
_DEFAULT_OUTPUT_DIR = Path("dist/datagen-publication")


@dataclass(frozen=True)
class ValidatedAsset:
    archive: Path
    scenario: str
    sha256: str
    size_bytes: int
    asset_schema_version: int
    fragment_count: int
    archetypes: tuple[str, ...]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate = subparsers.add_parser("validate", help="validate one canonical scenario archive")
    _add_archive_arguments(validate)

    prepare_archive = subparsers.add_parser(
        "prepare-archive", help="stage an existing archive and the next public index"
    )
    _add_archive_arguments(prepare_archive)
    _add_prepare_arguments(prepare_archive)

    prepare_run = subparsers.add_parser(
        "prepare-run", help="package a generation run and stage it for publication"
    )
    prepare_run.add_argument("run_dir", type=Path)
    prepare_run.add_argument("--scenario-name", required=True)
    prepare_run.add_argument("--generated-at", required=True)
    prepare_run.add_argument("--generation-revision", required=True)
    prepare_run.add_argument(
        "--instrumenter-package",
        action="append",
        required=True,
        metavar="NAME=VERSION",
        help=("record an instrumenter distribution version; repeat for every recorder dependency"),
    )
    _add_prepare_arguments(prepare_run)
    return parser


def _add_archive_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--asset-schema-version", type=int, choices=(1, 2), required=True)


def _add_prepare_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--index", default=_DEFAULT_INDEX_URL, help="current index path or HTTPS URL"
    )
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
    except (ScenarioFetchError, ScenarioArchiveError, OSError, ScenarioError, ValueError) as error:
        print(
            json.dumps({"error": type(error).__name__, "message": str(error)}),
            file=stderr,
        )
        return 2
    print(json.dumps(result, indent=2, sort_keys=True), file=stdout)
    return 0


def _dispatch(args: argparse.Namespace) -> Mapping[str, Any]:
    if args.command == "validate":
        return _validated_asset_document(
            validate_archive(args.archive, asset_schema_version=args.asset_schema_version)
        )
    if args.command == "prepare-archive":
        asset = validate_archive(args.archive, asset_schema_version=args.asset_schema_version)
        return prepare_publication(asset, index=args.index, output_dir=args.output_dir)
    if args.command == "prepare-run":
        instrumenter_versions = _parse_instrumenter_versions(args.instrumenter_package)
        archive = args.output_dir / f"{args.scenario_name}.tar.gz"
        package_generation_run(
            args.run_dir,
            archive,
            scenario_name=args.scenario_name,
            generated_at=args.generated_at,
            generation_revision=args.generation_revision,
            instrumenter_package_versions=instrumenter_versions,
        )
        asset = validate_archive(archive, asset_schema_version=2)
        return prepare_publication(asset, index=args.index, output_dir=args.output_dir)
    raise AssertionError(args.command)


def validate_archive(archive: Path, *, asset_schema_version: int) -> ValidatedAsset:
    archive = archive.resolve()
    if not archive.is_file():
        raise ValueError(f"scenario archive does not exist: {archive}")
    if _ARCHIVE_NAME.fullmatch(archive.name) is None:
        raise ValueError("scenario archive name must match <scenario>.tar.gz")
    scenario = archive.name.removesuffix(".tar.gz")
    archive_bytes = archive.read_bytes()
    archive_digest = sha256(archive_bytes).hexdigest()

    if asset_schema_version == 2:
        scenario_archive = read_scenario_archive(archive)
        fragment_count = scenario_archive.manifest["fragment_count"]
        archetypes = tuple(sorted({fragment.archetype for fragment in scenario_archive.fragments}))
    else:
        fragment_count = 0
        archetypes = ()

    with tempfile.TemporaryDirectory(prefix="phoenix-datagen-validation-") as directory:
        validation_root = Path(directory)
        validation_index = validation_root / "validation-index.json"
        validation_index.write_text(
            json.dumps(
                {
                    "schema_version": 2,
                    "scenarios": {
                        scenario: {
                            "url": f"https://assets.invalid/{archive.name}",
                            "sha256": archive_digest,
                            "size_bytes": len(archive_bytes),
                            "asset_schema_version": asset_schema_version,
                            "fragment_count": fragment_count,
                            "archetypes": list(archetypes),
                        }
                    },
                }
            ),
            encoding="utf-8",
        )
        extracted = fetch_scenario(
            scenario,
            cache_dir=validation_root / "cache",
            index_path=validation_index,
            downloader=lambda _url, destination: shutil.copyfile(archive, destination),
        )
        loaded = load_scenario(extracted)

    if loaded.schema_version != asset_schema_version:
        raise ValueError("loaded scenario schema version differs from the requested version")
    manifest_name = loaded.manifest.get("scenario_name") or loaded.manifest.get("scenario")
    if manifest_name != scenario:
        raise ValueError(
            f"archive name {archive.name!r} does not match manifest scenario {manifest_name!r}"
        )
    return ValidatedAsset(
        archive=archive,
        scenario=scenario,
        sha256=archive_digest,
        size_bytes=len(archive_bytes),
        asset_schema_version=asset_schema_version,
        fragment_count=fragment_count,
        archetypes=archetypes,
    )


def prepare_publication(
    asset: ValidatedAsset,
    *,
    index: str,
    output_dir: Path,
) -> Mapping[str, Any]:
    index_document = _read_index(index)
    object_name = f"{_PREFIX}/scenarios/{asset.scenario}/{asset.sha256}/{asset.archive.name}"
    public_url = f"https://storage.googleapis.com/{_BUCKET}/{object_name}"
    index_document["scenarios"][asset.scenario] = {
        "url": public_url,
        "sha256": asset.sha256,
        "size_bytes": asset.size_bytes,
        "asset_schema_version": asset.asset_schema_version,
        "fragment_count": asset.fragment_count,
        "archetypes": list(asset.archetypes),
    }

    output_dir = output_dir.resolve()
    staged_archive = output_dir / "scenarios" / asset.scenario / asset.sha256 / asset.archive.name
    staged_archive.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(asset.archive, staged_archive)
    staged_index = output_dir / "index.json"
    staged_index.write_text(
        json.dumps(index_document, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    entry = load_scenario_index(staged_index)[asset.scenario]
    if (
        entry.url != public_url
        or entry.sha256 != asset.sha256
        or entry.size_bytes != asset.size_bytes
        or entry.asset_schema_version != asset.asset_schema_version
        or entry.fragment_count != asset.fragment_count
        or entry.archetypes != asset.archetypes
    ):
        raise ValueError("staged asset index does not describe the validated archive")

    archive_uri = f"gs://{_BUCKET}/{object_name}"
    index_uri = f"gs://{_BUCKET}/{_PREFIX}/index.json"
    upload_commands = [
        shlex.join(
            (
                "gcloud",
                "storage",
                "cp",
                "--no-clobber",
                "--cache-control=public,max-age=31536000,immutable",
                str(staged_archive),
                archive_uri,
            )
        ),
        shlex.join(
            (
                "gcloud",
                "storage",
                "cp",
                "--cache-control=no-cache,max-age=0",
                str(staged_index),
                index_uri,
            )
        ),
    ]
    return {
        **_validated_asset_document(asset),
        "staged_archive": str(staged_archive),
        "staged_index": str(staged_index),
        "upload_commands": upload_commands,
    }


def _read_index(source: str) -> dict[str, Any]:
    parsed = urlparse(source)
    if parsed.scheme:
        if parsed.scheme != "https":
            raise ValueError("the current asset index URL must use HTTPS")
        try:
            with urlopen(source, timeout=30) as response:  # noqa: S310
                content = response.read()
        except HTTPError as error:
            if error.code == 404:
                return {"schema_version": 2, "scenarios": {}}
            raise ValueError(f"unable to download the current asset index: {error}") from error
        except URLError as error:
            raise ValueError(f"unable to download the current asset index: {error}") from error
    else:
        content = Path(source).read_bytes()
    try:
        value = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"invalid datagen asset index {source}: {error}") from error
    if not isinstance(value, dict) or value.get("schema_version") != 2:
        raise ValueError(f"datagen asset index {source} must have schema_version 2")
    scenarios = value.get("scenarios")
    if not isinstance(scenarios, dict):
        raise ValueError(f"datagen asset index {source} field 'scenarios' must be an object")
    return value


def _parse_instrumenter_versions(values: Sequence[str]) -> Mapping[str, str]:
    versions: dict[str, str] = {}
    for value in values:
        name, separator, version = value.partition("=")
        if not separator or not name or not version:
            raise ValueError("--instrumenter-package must use NAME=VERSION")
        if name in versions:
            raise ValueError(f"duplicate instrumenter package {name!r}")
        versions[name] = version
    return versions


def _validated_asset_document(asset: ValidatedAsset) -> dict[str, Any]:
    value = asdict(asset)
    value["archive"] = str(asset.archive)
    value["archetypes"] = list(asset.archetypes)
    return value


if __name__ == "__main__":
    raise SystemExit(command())
