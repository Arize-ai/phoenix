"""Canonical JSON encoding and journal I/O shared by the datagen scripts.

Imports the standard library only: the PEP 723 recorders in this directory run
under ``uv run --script`` with no ``phoenix`` package on the path.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Mapping


def canonical_bytes(value: Any) -> bytes:
    """Encode ``value`` as canonical UTF-8 JSON: sorted keys, no spaces, no escapes."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def plain_json(value: Any) -> Any:
    """Copy ``value`` into plain dicts and lists that ``json.dumps`` accepts."""
    if isinstance(value, Mapping):
        return {str(key): plain_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain_json(item) for item in value]
    return value


def json_copy(value: Any) -> Any:
    """Return a mutable deep copy of ``value`` as plain JSON types."""
    return json.loads(canonical_bytes(plain_json(value)))


def write_immutable_bytes(path: Path, content: bytes, *, error: type[Exception]) -> None:
    """Write ``content`` once, raising ``error`` if ``path`` already holds other bytes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != content:
            raise error(f"immutable file differs: {path}")
        return
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    except FileExistsError:
        if path.read_bytes() != content:
            raise error(f"immutable file differs: {path}")
        return
    with os.fdopen(descriptor, "wb") as output:
        output.write(content)
        output.flush()
        os.fsync(output.fileno())


def write_immutable_json(path: Path, value: Mapping[str, Any], *, error: type[Exception]) -> None:
    """Write ``value`` as a canonical JSON line, raising ``error`` if ``path`` differs."""
    write_immutable_bytes(path, canonical_bytes(value) + b"\n", error=error)


def append_json(path: Path, value: Mapping[str, Any]) -> None:
    """Append ``value`` to a JSONL journal and fsync it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as output:
        output.write(canonical_bytes(value).decode() + "\n")
        output.flush()
        os.fsync(output.fileno())


def read_jsonl(path: Path, *, error: type[Exception]) -> tuple[Mapping[str, Any], ...]:
    """Read a JSONL journal of objects, raising ``error`` on malformed content."""
    if not path.exists():
        return ()
    records: list[Mapping[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as decode_error:
            raise error(f"invalid JSON in {path} at line {line_number}") from decode_error
        if not isinstance(record, dict):
            raise error(f"expected object in {path} at line {line_number}")
        records.append(record)
    return tuple(records)
