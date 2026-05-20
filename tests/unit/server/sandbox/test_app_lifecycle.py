"""Lifecycle smoke tests for the post-refactor sandbox module.

After the cross-replica-deterministic refactor, ``phoenix.server.sandbox``
no longer exposes any of:

- ``_BACKEND_CACHE``
- ``get_or_create_backend``
- ``invalidate_backend_cache`` / ``invalidate_backend_cache_for_key``
- ``close_all_backends``
- ``register_session_manager`` / ``unregister_session_manager``
- ``_session_manager`` (module-level global)

``SandboxSessionManager.stop()`` is the sole shutdown path; ``app.py``
wires it into the lifespan via ``stack.enter_async_context(manager)``.
These tests pin the public-surface invariants so a regression in any of
the source files that recently dropped these symbols (sandbox/__init__.py,
app.py, secret_mutations.py, sandbox_config_mutations.py) is caught at
import time rather than at runtime.
"""

from __future__ import annotations


def test_sandbox_module_no_longer_exports_cache_or_session_manager_surfaces() -> None:
    """The deleted cache + global-session-manager surfaces must not reappear."""
    import phoenix.server.sandbox as sandbox_module

    deleted_names = [
        "_BACKEND_CACHE",
        "get_or_create_backend",
        "invalidate_backend_cache",
        "invalidate_backend_cache_for_key",
        "close_all_backends",
        "register_session_manager",
        "unregister_session_manager",
        "_session_manager",
        "_config_hash",
    ]
    for name in deleted_names:
        assert not hasattr(sandbox_module, name), (
            f"{name!r} must not be exported from phoenix.server.sandbox; "
            "the cross-replica-deterministic refactor deleted this surface"
        )


def test_build_sandbox_backend_is_the_sole_factory() -> None:
    """``build_sandbox_backend`` remains the public factory."""
    from phoenix.server.sandbox import build_sandbox_backend  # noqa: F401


def test_session_manager_import_path_is_stable() -> None:
    """The lifespan imports ``SandboxSessionManager`` from
    ``phoenix.server.sandbox.session_manager``; the symbol must remain there.
    """
    from phoenix.server.sandbox.session_manager import (  # noqa: F401
        SandboxSessionManager,
        SessionInvalidated,
        SessionLimitExceeded,
    )


def test_app_module_imports_without_referencing_deleted_symbols() -> None:
    """Importing ``phoenix.server.app`` must succeed without pulling in any
    of the deleted shutdown-callback surfaces. A regression that re-adds
    ``register_session_manager`` / ``close_all_backends`` calls inside
    ``create_app`` / ``_lifespan`` would either fail this import or surface
    via the attribute check below.
    """
    import phoenix.server.app as app_module

    # Defense-in-depth: app.py must not have re-grown an import of the
    # deleted symbols.
    src = app_module.__file__
    assert src is not None
    with open(src, encoding="utf-8") as f:
        contents = f.read()
    deleted_imports = [
        "close_all_backends",
        "register_session_manager",
        "unregister_session_manager",
        "invalidate_backend_cache",
        "_BACKEND_CACHE",
        "get_or_create_backend",
    ]
    for sym in deleted_imports:
        assert sym not in contents, (
            f"app.py must not reference {sym!r} after the refactor; found in {src}"
        )
