"""Fail-closed Docker capability probe and declared-artifact handoff primitives.

These primitives are not a completed Harbor lifecycle integration. The runner must
supply container IDs and protected audit evidence, never agent-authored claims.
"""

from __future__ import annotations

import os
import stat
from pathlib import Path
from typing import Any, Callable


class InvalidEvidence(RuntimeError):
    pass


def read_regular(directory: Path, name: str, *, limit: int = 1_048_576) -> bytes:
    if name not in {"answer.txt", "trajectory.json"}:
        raise InvalidEvidence("Undeclared artifact")
    root = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        descriptor = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=root)
        try:
            info = os.fstat(descriptor)
            if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
                raise InvalidEvidence("Artifact must be a bounded regular file")
            with os.fdopen(os.dup(descriptor), "rb") as source:
                data = source.read(limit + 1)
            if len(data) > limit:
                raise InvalidEvidence("Artifact exceeded size limit")
            return data
        finally:
            os.close(descriptor)
    finally:
        os.close(root)


def require_stopped(container_ids: list[str], inspect: Callable[[str], dict[str, Any]]) -> None:
    if not container_ids:
        raise InvalidEvidence("Missing agent container inventory")
    for container_id in container_ids:
        state = inspect(container_id)
        # Missing containers are ambiguous: inspect before teardown, not after removal.
        if state.get("Running") is not False or state.get("Pid") != 0:
            raise InvalidEvidence("Agent shutdown was not independently confirmed")
