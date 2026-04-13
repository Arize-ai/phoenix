"""
Sandbox backend registry and factory.

Two tiers:
- SANDBOX_ADAPTER_METADATA: static dict, always present. Maps backend_type key
  to AdapterMetadata (display_name, language). Used for DB seeding
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

from phoenix.server.sandbox.types import ConfigFieldSpec, SandboxAdapter, SandboxBackend

logger = logging.getLogger(__name__)

# JSON Schema "type" → ConfigFieldSpec.field_type mapping.
_JSON_SCHEMA_TYPE_MAP: dict[str, str] = {
    "string": "string",
    "integer": "integer",
    "number": "integer",
    "boolean": "boolean",
}


def _config_field_specs_from_model(
    model_cls: Any,
) -> list[ConfigFieldSpec]:
    """
    Derive ConfigFieldSpec list from a pydantic model's JSON schema.

    Skips fields not listed in the schema's `properties` (extra="allow" wildcard
    fields are not enumerated). Fields with `enum` become field_type="select".
    """
    schema = model_cls.model_json_schema()
    properties: dict[str, Any] = schema.get("properties", {})
    required_keys: set[str] = set(schema.get("required", []))
    specs: list[ConfigFieldSpec] = []
    for key, prop in properties.items():
        # Unwrap anyOf (e.g. Optional[str] → [{type: string}, {type: null}])
        effective_prop = prop
        if "anyOf" in prop:
            non_null = [p for p in prop["anyOf"] if p.get("type") != "null"]
            if non_null:
                effective_prop = non_null[0]

        if "enum" in effective_prop:
            ft: str = "select"
            choices: Optional[list[str]] = [str(c) for c in effective_prop["enum"]]
        else:
            raw_type = effective_prop.get("type", "string")
            ft = _JSON_SCHEMA_TYPE_MAP.get(raw_type, "string")
            choices = None

        display_name: str = prop.get("title") or key.replace("_", " ").title()
        description: str = prop.get("description") or effective_prop.get("description") or ""

        specs.append(
            ConfigFieldSpec(
                key=key,
                display_name=display_name,
                field_type=ft,  # type: ignore[arg-type]
                required=key in required_keys,
                description=description,
                choices=choices,
            )
        )
    return specs


@dataclass
class AdapterMetadata:
    """Static metadata for a sandbox adapter (no runtime deps)."""

    display_name: str
    language: str = ""
    dependency_hints: list[str] = field(default_factory=list)
    config_field_specs: list[ConfigFieldSpec] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Static metadata — always present regardless of installed extras.
# One entry per (backend_type, language) pair. language must match
# Language.name values seeded to the DB by sync_languages().
# ---------------------------------------------------------------------------
SANDBOX_ADAPTER_METADATA: dict[str, AdapterMetadata] = {
    "WASM": AdapterMetadata(
        display_name="WebAssembly (local)",
        language="PYTHON",
        dependency_hints=[
            "Install Phoenix with the `wasm` extra so `wasmtime` is available.",
            (
                "Allow Phoenix to download the CPython WASM binary on first use, "
                "or pre-populate the local WASM cache."
            ),
        ],
    ),
    "E2B": AdapterMetadata(
        display_name="E2B",
        language="PYTHON",
        dependency_hints=[
            "Install Phoenix with the `e2b` extra.",
            "Provide `PHOENIX_SANDBOX_E2B_API_KEY` or `PHOENIX_SANDBOX_API_KEY`.",
        ],
    ),
    "DAYTONA_PYTHON": AdapterMetadata(
        display_name="Daytona (Python)",
        language="PYTHON",
        dependency_hints=[
            "Install Phoenix with the `daytona` extra.",
            "Provide `PHOENIX_SANDBOX_DAYTONA_API_KEY` or `PHOENIX_SANDBOX_TOKEN`.",
        ],
    ),
    "VERCEL_PYTHON": AdapterMetadata(
        display_name="Vercel Sandbox (Python)",
        language="PYTHON",
        dependency_hints=[
            "Install Phoenix with the `vercel` extra.",
            "Set `VERCEL_OIDC_TOKEN`, or all of `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and "
            "`VERCEL_TEAM_ID`.",
        ],
    ),
    "VERCEL_TYPESCRIPT": AdapterMetadata(
        display_name="Vercel Sandbox (TypeScript)",
        language="TYPESCRIPT",
        dependency_hints=[
            "Install Phoenix with the `vercel` extra.",
            "Set `VERCEL_OIDC_TOKEN`, or all of `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and "
            "`VERCEL_TEAM_ID`.",
        ],
    ),
    "DENO": AdapterMetadata(
        display_name="Deno (local)",
        language="TYPESCRIPT",
        dependency_hints=[
            "Install the Deno runtime and ensure the `deno` binary is available on PATH.",
        ],
    ),
    "MODAL": AdapterMetadata(
        display_name="Modal",
        language="PYTHON",
        dependency_hints=[
            "Install Phoenix with the `modal` extra.",
            "Provide `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` environment variables.",
        ],
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
    """Register a SandboxAdapter in the runtime registry.

    Derives config_field_specs from the adapter's pydantic config_model and
    writes them into SANDBOX_ADAPTER_METADATA so the GQL layer has a single
    authoritative source (no dual-registration).
    """
    _SANDBOX_ADAPTERS[adapter.key] = adapter
    if adapter.key in SANDBOX_ADAPTER_METADATA:
        SANDBOX_ADAPTER_METADATA[adapter.key].config_field_specs = _config_field_specs_from_model(
            adapter.config_model
        )
    logger.debug(f"Registered sandbox adapter: {adapter.key!r}")
    return adapter


async def close_all_backends() -> None:
    """Close all cached SandboxBackend instances and clear the cache."""
    for key, backend in list(_BACKEND_CACHE.items()):
        try:
            await backend.close()
        except Exception:
            logger.warning(f"Error closing sandbox backend {key!r}", exc_info=True)
    _BACKEND_CACHE.clear()


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
    from phoenix.server.sandbox.daytona_backend import DaytonaPythonAdapter

    register_sandbox_adapter(DaytonaPythonAdapter())
except ImportError:
    pass

try:
    from phoenix.server.sandbox.vercel_backend import VercelPythonAdapter, VercelTypescriptAdapter

    register_sandbox_adapter(VercelPythonAdapter())
    register_sandbox_adapter(VercelTypescriptAdapter())
except ImportError:
    pass

try:
    from phoenix.server.sandbox.deno_backend import DenoAdapter

    register_sandbox_adapter(DenoAdapter())
except ImportError:
    pass

try:
    from phoenix.server.sandbox.modal_backend import ModalAdapter

    register_sandbox_adapter(ModalAdapter())
except ImportError:
    pass
