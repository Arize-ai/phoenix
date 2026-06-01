"""Download helper for the CPython WASM binary."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import urllib.request
from pathlib import Path
from typing import Optional

from phoenix.config import (
    ENV_PHOENIX_WASM_BINARY_PATH,
    _no_local_storage,
    get_env_wasm_binary_path,
    get_working_dir,
)

logger = logging.getLogger(__name__)

_WASM_RELEASE_BASE = (
    "https://github.com/vmware-labs/webassembly-language-runtimes"
    "/releases/download/python%2F3.12.0%2B20231211-040d5a6"
)
_WASM_FILENAME = "python-3.12.0.wasm"
_WASM_URL = f"{_WASM_RELEASE_BASE}/{_WASM_FILENAME}"

# Operator-supplied paths are trusted as-is and NOT hash-checked.
_WASM_SHA256 = "e5dc5a398b07b54ea8fdb503bf68fb583d533f10ec3f930963e02b9505f7a763"

# Per-operation socket timeout (connect + each read) for the binary download, so a
# stalled connection fails fast instead of hanging startup. Not a total-transfer cap.
_WASM_DOWNLOAD_TIMEOUT_SECONDS = 30.0

_NO_LOCAL_STORAGE_LONG_FORM = (
    "WASM sandbox binary unavailable: Phoenix is running in no-local-storage mode "
    "(postgres database configured, PHOENIX_WORKING_DIR not set), so the runtime "
    "cannot be saved locally. To enable the WASM provider, set "
    "PHOENIX_WORKING_DIR=/path/to/dir."
)

_NO_LOCAL_STORAGE_SHORT_FORM = "No-local-storage mode: set PHOENIX_WORKING_DIR to enable WASM."


def no_local_storage_message(*, short: bool = False) -> str:
    """Canonical user-facing wording for the no-local-storage state."""
    return _NO_LOCAL_STORAGE_SHORT_FORM if short else _NO_LOCAL_STORAGE_LONG_FORM


class WASMBinaryUnavailable(RuntimeError):
    """Raised when the WASM binary cannot be resolved or downloaded."""


def _default_wasm_dir() -> Path:
    return get_working_dir() / "wasm"


def resolve_wasm_binary_if_present(
    wasm_dir: Optional[Path] = None,
    filename: str = _WASM_FILENAME,
) -> Optional[Path]:
    """Return the resolved WASM binary path WITHOUT any downloads or writes."""
    override = get_env_wasm_binary_path()
    if override is not None:
        return override if override.is_file() else None

    if _no_local_storage():
        return None

    resolved_wasm_dir = wasm_dir if wasm_dir is not None else _default_wasm_dir()
    working_dir_candidate = resolved_wasm_dir / filename
    if working_dir_candidate.is_file():
        return working_dir_candidate

    return None


def ensure_wasm_binary(
    wasm_dir: Optional[Path] = None,
    url: str = _WASM_URL,
    filename: str = _WASM_FILENAME,
    expected_sha256: Optional[str] = None,
) -> Path:
    """Return the path to the CPython WASM binary, downloading it if absent."""
    override = get_env_wasm_binary_path()
    if override is not None:
        if override.is_file():
            return override
        raise WASMBinaryUnavailable(
            f"{ENV_PHOENIX_WASM_BINARY_PATH}={override} is set but the file "
            f"does not exist. Either pre-download the CPython WASM binary to "
            f"that path or unset the env var to fall back to the default "
            f"download location under PHOENIX_WORKING_DIR."
        )

    if _no_local_storage():
        raise WASMBinaryUnavailable(no_local_storage_message())

    # Resolved at call time so tests monkeypatching the constant take effect.
    # Passing expected_sha256="" bypasses verification.
    if expected_sha256 is None:
        expected_sha256 = _WASM_SHA256

    resolved_wasm_dir = wasm_dir if wasm_dir is not None else _default_wasm_dir()
    dest = resolved_wasm_dir / filename

    if dest.exists():
        if expected_sha256:
            try:
                _verify_sha256(dest, expected_sha256)
            except ValueError:
                dest.unlink(missing_ok=True)
                raise
        return dest

    resolved_wasm_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Downloading WASM binary from {url} → {dest}")
    try:
        with urllib.request.urlopen(  # noqa: S310
            url, timeout=_WASM_DOWNLOAD_TIMEOUT_SECONDS
        ) as response:
            dest.write_bytes(response.read())
    except Exception as exc:
        dest.unlink(missing_ok=True)
        raise RuntimeError(f"Failed to download WASM binary: {exc}") from exc

    if expected_sha256:
        try:
            _verify_sha256(dest, expected_sha256)
        except ValueError:
            dest.unlink(missing_ok=True)
            raise

    logger.info(f"WASM binary saved at {dest}")
    return dest


async def prefetch_wasm_binary_if_needed() -> None:
    """Fail-soft server-startup pre-fetch for the CPython WASM binary."""
    try:
        await asyncio.to_thread(ensure_wasm_binary)
    except WASMBinaryUnavailable as exc:
        message = str(exc)
        if message == no_local_storage_message():
            logger.warning(f"⚠️  {message}")
        else:
            logger.warning(f"WASM sandbox binary unavailable: {message}")
    except ValueError as exc:
        logger.warning(f"WASM sandbox binary failed integrity check: {exc}")
    except RuntimeError as exc:
        logger.warning(f"WASM sandbox binary pre-fetch failed: {exc}")


def _verify_sha256(path: Path, expected: str) -> None:
    """Raise ValueError if SHA-256 of *path* does not match *expected*."""
    sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    if sha256 != expected.lower():
        raise ValueError(f"SHA-256 mismatch for {path.name}: expected {expected!r}, got {sha256!r}")
