"""
Download helper for WASM binaries.

ensure_wasm_binary() downloads the CPython 3.12 WASM build from the
vmware-labs/webassembly-language-runtimes GitHub release and caches it
locally so WASMBackend can reference it without bundling a large binary.
"""

from __future__ import annotations

import hashlib
import logging
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Release coordinates for vmware-labs/webassembly-language-runtimes
# ---------------------------------------------------------------------------
_WASM_RELEASE_BASE = (
    "https://github.com/vmware-labs/webassembly-language-runtimes"
    "/releases/download/python%2F3.12.0%2B20231211-040d5a6"
)
_WASM_FILENAME = "python-3.12.0.wasm"
_WASM_URL = f"{_WASM_RELEASE_BASE}/{_WASM_FILENAME}"

# SHA-256 of the official release binary (for integrity check).
# Set to empty string to skip verification (e.g. during development).
_WASM_SHA256 = ""

_DEFAULT_CACHE_DIR = Path.home() / ".cache" / "phoenix" / "wasm"


def ensure_wasm_binary(
    cache_dir: Path = _DEFAULT_CACHE_DIR,
    url: str = _WASM_URL,
    filename: str = _WASM_FILENAME,
    expected_sha256: str = _WASM_SHA256,
) -> Path:
    """
    Return the path to the CPython WASM binary, downloading it if absent.

    The binary is cached at ``cache_dir / filename``. Raises RuntimeError if
    the download fails or the integrity check does not pass.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    dest = cache_dir / filename

    if dest.exists():
        if expected_sha256:
            _verify_sha256(dest, expected_sha256)
        return dest

    logger.info(f"Downloading WASM binary from {url} → {dest}")
    try:
        urllib.request.urlretrieve(url, dest)  # noqa: S310
    except Exception as exc:
        dest.unlink(missing_ok=True)
        raise RuntimeError(f"Failed to download WASM binary: {exc}") from exc

    if expected_sha256:
        try:
            _verify_sha256(dest, expected_sha256)
        except ValueError:
            dest.unlink(missing_ok=True)
            raise

    logger.info(f"WASM binary cached at {dest}")
    return dest


def _verify_sha256(path: Path, expected: str) -> None:
    """Raise ValueError if SHA-256 of *path* does not match *expected*."""
    sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    if sha256 != expected.lower():
        raise ValueError(f"SHA-256 mismatch for {path.name}: expected {expected!r}, got {sha256!r}")
