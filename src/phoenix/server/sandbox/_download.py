"""
Download helper for WASM binaries.

ensure_wasm_binary() returns the path to the CPython 3.12 WASM build,
honoring an operator-supplied ``PHOENIX_WASM_BINARY_PATH`` override.
When the env var is unset and the binary is not yet present, it is
downloaded from the vmware-labs/webassembly-language-runtimes GitHub
release and saved locally so WASMBackend can reference it without
bundling a large binary.

Every downloaded or cached copy is sha256-verified against the pinned
upstream hash before it is returned; a mismatching file is unlinked
so the next call re-downloads instead of serving a tampered binary.
An operator-supplied ``PHOENIX_WASM_BINARY_PATH`` is trusted as-is —
the operator owns staging in that case.

Three named caller-visible paths are exposed:

* ``ensure_wasm_binary()`` — execution path. Honors
  ``PHOENIX_WASM_BINARY_PATH`` as authoritative (returns when present,
  raises ``WASMBinaryUnavailable`` when set-but-missing). When the env
  var is unset, falls back to the working-directory WASM directory,
  then to a lazy download into the working-directory WASM directory.
* ``resolve_wasm_binary_if_present()`` — capability-probe path. Never
  downloads, never writes to disk. Returns the resolved path when a
  binary is already locally resolvable; returns ``None`` otherwise.
  Consumed by ``WASMAdapter.probe_binary()`` to populate sandbox-backend
  status without triggering side effects.
* ``prefetch_wasm_binary_if_needed()`` — server-startup pre-fetch.
  Wraps ``ensure_wasm_binary()`` in a fail-soft try/except so a
  download, hash-verification, or no-local-storage failure logs a
  warning instead of aborting Phoenix startup.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import urllib.request
from pathlib import Path
from typing import Optional

from phoenix.config import _no_local_storage, get_working_dir

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

# SHA-256 of the official upstream release binary. Every cached or freshly
# downloaded copy is verified against this value; a mismatch unlinks the
# file and raises so a tampered or truncated binary cannot be served. An
# operator-supplied ``PHOENIX_WASM_BINARY_PATH`` is trusted as-is and is
# NOT hash-checked — the operator owns staging in that case.
_WASM_SHA256 = "e5dc5a398b07b54ea8fdb503bf68fb583d533f10ec3f930963e02b9505f7a763"

# Operator-facing env var. When set, it is the authoritative path for
# the WASM binary on the execution path; the capability-probe path also
# consults it. The container Dockerfile pre-downloads the binary and
# sets this env var so the WASM backend works on first use without
# network egress or a writable home directory.
PHOENIX_WASM_BINARY_PATH_ENV = "PHOENIX_WASM_BINARY_PATH"


_NO_LOCAL_STORAGE_LONG_FORM = (
    "WASM sandbox binary unavailable: Phoenix is running in no-local-storage mode "
    "(postgres database configured, PHOENIX_WORKING_DIR not set), so the runtime "
    "cannot be saved locally. To enable the WASM provider, set "
    "PHOENIX_WORKING_DIR=/path/to/dir."
)

_NO_LOCAL_STORAGE_SHORT_FORM = "No-local-storage mode: set PHOENIX_WORKING_DIR to enable WASM."


def no_local_storage_message(*, short: bool = False) -> str:
    """Return the canonical user-facing wording for the no-local-storage state.

    All three surfaces (startup log, ``WASMBinaryUnavailable`` exception,
    and ``WASMAdapter.probe_binary()`` ``statusDetail``) read from this
    one helper so the wording stays aligned. The startup log prepends
    a ``⚠️`` emoji to the long form; the exception message does not
    (emoji renders poorly in tracebacks and JSON logs).
    """
    return _NO_LOCAL_STORAGE_SHORT_FORM if short else _NO_LOCAL_STORAGE_LONG_FORM


class WASMBinaryUnavailable(RuntimeError):
    """Raised by ``ensure_wasm_binary()`` when the WASM binary cannot be
    resolved or downloaded.

    Two cases reach this exception:

    * ``PHOENIX_WASM_BINARY_PATH`` is set but the file at that path does
      not exist. The execution path treats an operator-supplied path as
      authoritative; silently falling back to a download would mask
      misconfiguration.
    * Phoenix is running in no-local-storage mode (postgres configured,
      ``PHOENIX_WORKING_DIR`` unset) and no operator-supplied path is
      set, so there is nowhere to save the binary.

    Callers on the capability-probe path
    (``resolve_wasm_binary_if_present()``) get ``None`` instead, since
    probes must be side-effect-free and non-raising for status reporting.
    """


def _default_wasm_dir() -> Path:
    """Return the default WASM directory under the Phoenix working directory."""
    return get_working_dir() / "wasm"


def resolve_wasm_binary_if_present(
    wasm_dir: Optional[Path] = None,
    filename: str = _WASM_FILENAME,
) -> Optional[Path]:
    """Return the resolved WASM binary path WITHOUT any downloads.

    This is the *capability-probe path*: it is consumed by
    ``WASMAdapter.probe_binary()`` to populate sandbox-backend status
    in the GraphQL ``SandboxBackends`` resolver. It MUST be free of
    side effects — never invokes ``urllib.request.urlretrieve``, never
    creates or writes to ``wasm_dir``, and never raises on a missing
    operator-set path (the caller distinguishes the cases via
    ``PHOENIX_WASM_BINARY_PATH_ENV``).

    Resolution order:
      1. ``PHOENIX_WASM_BINARY_PATH`` env var, if set AND the file
         exists → return that path.
      2. If no-local-storage mode is active and the env var is not set
         → return ``None`` (no directory resolution, no filesystem
         lookup).
      3. ``wasm_dir / filename`` under the Phoenix working directory,
         if it exists → return that path.
      4. Otherwise → ``None``.

    A set-but-missing operator path returns ``None`` here (not the
    working-dir fallback): the operator's path is authoritative, so
    silently masking it with a local hit would be misleading. The
    probe caller re-reads the env var to format the precise
    statusDetail.
    """
    override = os.environ.get(PHOENIX_WASM_BINARY_PATH_ENV)
    if override:
        candidate = Path(override)
        if candidate.is_file():
            return candidate
        return None

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
    """
    Return the path to the CPython WASM binary, downloading it if absent.

    Resolution order:
      1. ``PHOENIX_WASM_BINARY_PATH`` env var (authoritative when set):
         returns the path when the file exists; raises
         ``WASMBinaryUnavailable`` when the env var is set but the file
         does not exist. Does NOT fall back to lazy download in this
         case — an operator-supplied path is treated as the source of
         truth. NOT sha256-verified (operator owns staging).
      2. If no-local-storage mode is active and the env var is not set,
         raises ``WASMBinaryUnavailable`` — Phoenix cannot save the
         runtime locally without a working directory.
      3. ``wasm_dir / filename`` under the Phoenix working directory if
         it already exists. The cached file is sha256-verified against
         ``expected_sha256``; a mismatch unlinks it and raises
         ``ValueError`` so the next call re-downloads instead of
         repeatedly failing on a corrupt or tampered cached copy.
      4. Otherwise lazy-downloads from ``url`` into ``wasm_dir`` and
         sha256-verifies before returning; a hash mismatch unlinks the
         freshly downloaded file and raises ``ValueError``.

    Raises:
      WASMBinaryUnavailable: ``PHOENIX_WASM_BINARY_PATH`` is set but the
        file does not exist, or Phoenix is in no-local-storage mode
        without an operator-supplied path.
      RuntimeError: the lazy download failed.
      ValueError: the cached or freshly downloaded file failed sha256
        verification (the offending file is unlinked before the raise).
    """
    override = os.environ.get(PHOENIX_WASM_BINARY_PATH_ENV)
    if override:
        candidate = Path(override)
        if candidate.is_file():
            return candidate
        raise WASMBinaryUnavailable(
            f"{PHOENIX_WASM_BINARY_PATH_ENV}={override} is set but the file "
            f"does not exist. Either pre-download the CPython WASM binary to "
            f"that path or unset the env var to fall back to the default "
            f"download location under PHOENIX_WORKING_DIR."
        )

    if _no_local_storage():
        raise WASMBinaryUnavailable(no_local_storage_message())

    # Resolve the expected sha256 at call time so monkeypatching the
    # module constant in tests (and any future runtime hook) takes effect.
    # Passing ``expected_sha256=""`` explicitly bypasses verification —
    # used by tests that exercise download mechanics without needing the
    # 26MB upstream binary on disk.
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

    logger.info(f"WASM binary saved at {dest}")
    return dest


async def prefetch_wasm_binary_if_needed() -> None:
    """Server-startup pre-fetch for the CPython WASM binary.

    Registered on ``startup_callbacks_list`` in ``phoenix.server.app``.
    Calls ``ensure_wasm_binary()`` in a worker thread so the blocking
    download does not stall the event loop, and swallows
    ``WASMBinaryUnavailable`` / ``RuntimeError`` / ``ValueError`` so a
    missing operator path, an unavailable network, no-local-storage
    mode, or a hash-verification failure never prevents Phoenix from
    booting. A WARNING is logged in each failure case so operators can
    diagnose without hunting through first-execute error reports.

    A hash-verification failure here means the upstream binary did not
    match the pinned ``_WASM_SHA256``; the offending file was already
    unlinked by ``ensure_wasm_binary`` before the raise reached us, so
    the next call retries cleanly.
    """
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
