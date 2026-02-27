from __future__ import annotations

import asyncio
import logging
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

_WASM_BINARY_URL = (
    "https://github.com/vmware-labs/webassembly-language-runtimes"
    "/releases/download/python%2F3.12.0%2B20231211-040d5a6"
    "/python-3.12.0.wasm"
)
_WASM_BINARY_FILENAME = "python-3.12.0.wasm"


async def ensure_wasm_binary(directory: Path) -> Path:
    """Ensure the CPython 3.12 WASM binary exists in the given directory.

    Downloads the binary (~25 MB) from the vmware-labs/webassembly-language-runtimes
    GitHub release if not already present. Called at server startup before
    WASMBackend is instantiated.

    Returns the path to the binary.
    """
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / _WASM_BINARY_FILENAME
    if not path.exists():
        logger.info(f"Downloading WASM binary to {path} (~25 MB) ...")
        await asyncio.to_thread(urllib.request.urlretrieve, _WASM_BINARY_URL, path)
        logger.info("WASM binary download complete.")
    return path
