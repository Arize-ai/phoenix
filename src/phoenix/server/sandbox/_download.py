"""
Download helper for WASM binaries.

ensure_wasm_binary() returns the path to the CPython 3.12 WASM build,
honoring an operator-supplied ``PHOENIX_WASM_BINARY_PATH`` override.
When the env var is unset and the binary is not yet cached, it is
downloaded from the vmware-labs/webassembly-language-runtimes GitHub
release and cached locally so WASMBackend can reference it without
bundling a large binary.

Two named caller-visible paths are exposed:

* ``ensure_wasm_binary()`` — execution path. Honors
  ``PHOENIX_WASM_BINARY_PATH`` as authoritative (returns when present,
  raises ``WASMBinaryUnavailable`` when set-but-missing). When the env
  var is unset, falls back to the legacy lazy-download/cache/sha256
  pipeline.
* ``resolve_wasm_binary_if_present()`` — capability-probe path. Never
  downloads, never writes to disk. Returns the resolved path when a
  binary is already locally resolvable; returns ``None`` otherwise.
  Consumed by ``WASMAdapter.probe_binary()`` to populate sandbox-backend
  status without triggering side effects.
"""

from __future__ import annotations

import hashlib
import logging
import os
import urllib.request
from pathlib import Path
from typing import Optional

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
_WASM_SHA256 = "e5dc5a398b07b54ea8fdb503bf68fb583d533f10ec3f930963e02b9505f7a763"

_DEFAULT_CACHE_DIR = Path.home() / ".cache" / "phoenix" / "wasm"

# Operator-facing env var. When set, it is the authoritative path for the
# WASM binary on the execution path; the capability-probe path also
# consults it. The container Dockerfile pre-downloads the binary and sets
# this env var so the WASM backend works on first use without network
# egress or a writable home cache.
PHOENIX_WASM_BINARY_PATH_ENV = "PHOENIX_WASM_BINARY_PATH"


class WASMBinaryUnavailable(RuntimeError):
    """Raised by ``ensure_wasm_binary()`` when an operator has set
    ``PHOENIX_WASM_BINARY_PATH`` but the file at that path does not
    exist.

    The execution path treats an operator-supplied path as authoritative;
    silently falling back to the lazy-download pipeline would mask
    misconfiguration. Callers on the capability-probe path
    (``resolve_wasm_binary_if_present()``) get ``None`` instead, since
    probes must be side-effect-free and non-raising for status reporting.
    """


def resolve_wasm_binary_if_present(
    cache_dir: Path = _DEFAULT_CACHE_DIR,
    filename: str = _WASM_FILENAME,
) -> Optional[Path]:
    """Return the resolved WASM binary path WITHOUT any downloads.

    This is the *capability-probe path*: it is consumed by
    ``WASMAdapter.probe_binary()`` to populate sandbox-backend status
    in the GraphQL ``SandboxBackends`` resolver. It MUST be free of
    side effects — never invokes ``urllib.request.urlretrieve``, never
    creates or writes to ``cache_dir``, and never raises on a missing
    operator-set path (the caller distinguishes the cases via
    ``PHOENIX_WASM_BINARY_PATH_ENV``).

    Resolution order:
      1. ``PHOENIX_WASM_BINARY_PATH`` env var, if set AND the file
         exists → return that path.
      2. ``cache_dir / filename``, if it exists → return that path.
      3. Otherwise → ``None``.

    A set-but-missing operator path returns ``None`` here (not the
    cache fallback): the operator's path is authoritative, so silently
    masking it with a cache hit would be misleading. The probe caller
    re-reads the env var to format the precise statusDetail.
    """
    override = os.environ.get(PHOENIX_WASM_BINARY_PATH_ENV)
    if override:
        candidate = Path(override)
        if candidate.is_file():
            return candidate
        # Operator-set but missing → do NOT fall back to cache; the
        # caller will emit the env-var-specific statusDetail.
        return None

    cache_candidate = cache_dir / filename
    if cache_candidate.is_file():
        return cache_candidate
    return None


def ensure_wasm_binary(
    cache_dir: Path = _DEFAULT_CACHE_DIR,
    url: str = _WASM_URL,
    filename: str = _WASM_FILENAME,
    expected_sha256: str = _WASM_SHA256,
) -> Path:
    """
    Return the path to the CPython WASM binary, downloading it if absent.

    Resolution order:
      1. ``PHOENIX_WASM_BINARY_PATH`` env var (authoritative when set):
         returns the path when the file exists; raises
         ``WASMBinaryUnavailable`` when the env var is set but the file
         does not exist. Does NOT fall back to lazy download in this
         case — an operator-supplied path is treated as the source of
         truth.
      2. ``cache_dir / filename`` if it already exists (sha256-verified
         when ``expected_sha256`` is non-empty).
      3. Otherwise lazy-downloads from ``url`` into ``cache_dir`` and
         sha256-verifies before returning.

    Raises:
      WASMBinaryUnavailable: ``PHOENIX_WASM_BINARY_PATH`` is set but the
        file does not exist.
      RuntimeError: the lazy download failed.
      ValueError: the downloaded file failed sha256 verification.
    """
    override = os.environ.get(PHOENIX_WASM_BINARY_PATH_ENV)
    if override:
        candidate = Path(override)
        if candidate.is_file():
            return candidate
        raise WASMBinaryUnavailable(
            f"{PHOENIX_WASM_BINARY_PATH_ENV}={override} is set but the file "
            f"does not exist. Either pre-download the CPython WASM binary to "
            f"that path or unset the env var to fall back to the lazy "
            f"download cache at {cache_dir}."
        )

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
