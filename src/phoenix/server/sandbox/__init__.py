"""
Sandbox backend registry and factory.

Two tiers:
- SANDBOX_ADAPTER_METADATA: static dict, always present. Maps backend_type key
  to AdapterMetadata (display_name, supported_languages). Used for DB seeding
  and UI display regardless of installed optional extras.
- _SANDBOX_ADAPTERS: populated only for installed backends. Maps backend_type
  key to a SandboxAdapter instance. Used for get_or_create_backend().

Importing WASMBackend requires wasmtime — guarded by try/except ImportError.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from phoenix.server.sandbox.types import SandboxAdapter, SandboxBackend

logger = logging.getLogger(__name__)


@dataclass
class AdapterMetadata:
    """Static metadata for a sandbox adapter (no runtime deps)."""

    display_name: str
    supported_languages: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Static metadata — always present regardless of installed extras.
# One entry per backend type. supported_languages must match Language.name
# values seeded to the DB by sync_languages().
# ---------------------------------------------------------------------------
SANDBOX_ADAPTER_METADATA: dict[str, AdapterMetadata] = {
    "WASM": AdapterMetadata(
        display_name="WebAssembly (local)",
        supported_languages=["PYTHON"],
    ),
    "E2B": AdapterMetadata(
        display_name="E2B",
        supported_languages=["PYTHON"],
    ),
    "DAYTONA": AdapterMetadata(
        display_name="Daytona",
        supported_languages=["PYTHON", "TYPESCRIPT"],
    ),
    "VERCEL": AdapterMetadata(
        display_name="Vercel Sandbox",
        supported_languages=["TYPESCRIPT"],
    ),
    "DENO": AdapterMetadata(
        display_name="Deno Deploy",
        supported_languages=["TYPESCRIPT"],
    ),
}

# ---------------------------------------------------------------------------
# Runtime registry — populated only when the backend's optional deps are
# installed. Modified via register_sandbox_adapter().
# ---------------------------------------------------------------------------
_SANDBOX_ADAPTERS: dict[str, SandboxAdapter] = {}

# ---------------------------------------------------------------------------
# Session cache — (backend_type, config_hash) → SandboxBackend instance.
# ---------------------------------------------------------------------------
_BACKEND_CACHE: dict[tuple[str, str], SandboxBackend] = {}


def _config_hash(config: dict[str, Any] | None) -> str:
    """Return a stable hex digest for a config dict (or empty dict)."""
    canonical = json.dumps(config or {}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def register_sandbox_adapter(adapter: SandboxAdapter) -> SandboxAdapter:
    """Register a SandboxAdapter in the runtime registry."""
    _SANDBOX_ADAPTERS[adapter.key] = adapter
    logger.debug(f"Registered sandbox adapter: {adapter.key!r}")
    return adapter


def get_or_create_backend(
    backend_type: str,
    config: dict[str, Any] | None = None,
) -> Optional[SandboxBackend]:
    """
    Return a cached SandboxBackend for backend_type, creating it if needed.

    config is merged into the backend constructor; different configs produce
    distinct cache entries via (backend_type, config_hash).

    Returns None if:
    - No adapter is registered for backend_type (optional dep not installed)
    - Backend construction fails
    """
    cache_key = (backend_type, _config_hash(config))
    if cache_key in _BACKEND_CACHE:
        return _BACKEND_CACHE[cache_key]

    adapter = _SANDBOX_ADAPTERS.get(backend_type)
    if adapter is None:
        logger.debug(
            f"No adapter registered for backend_type={backend_type!r}; "
            "optional dependency may not be installed"
        )
        return None

    try:
        backend = adapter.build_backend(config or {})
        _BACKEND_CACHE[cache_key] = backend
        return backend
    except Exception as exc:
        logger.warning(
            f"Failed to create sandbox backend for {backend_type!r}: {exc}",
            exc_info=True,
        )
        return None


# ---------------------------------------------------------------------------
# Register built-in adapters (guarded by try/except for optional deps).
# ---------------------------------------------------------------------------

try:
    from phoenix.server.sandbox.wasm_backend import WASMAdapter

    register_sandbox_adapter(WASMAdapter())
except ImportError:
    pass

try:
    from phoenix.server.sandbox.e2b_backend import E2BAdapter

    register_sandbox_adapter(E2BAdapter())
except ImportError:
    pass

try:
    from phoenix.server.sandbox.daytona_backend import DaytonaAdapter

    register_sandbox_adapter(DaytonaAdapter())
except ImportError:
    pass

try:
    from phoenix.server.sandbox.vercel_backend import VercelAdapter

    register_sandbox_adapter(VercelAdapter())
except ImportError:
    pass

try:
    from phoenix.server.sandbox.deno_backend import DenoAdapter

    register_sandbox_adapter(DenoAdapter())
except ImportError:
    pass
