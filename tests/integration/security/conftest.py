"""Shared configuration for the security integration test suite.

Directories under ``tests/integration/security`` are organized by **surface**
(the protocol or entry point under test): ``oauth``, ``oidc``, ``mcp``,
``ingestion``, ``pxi``, ``session``. The orthogonal **control class** of each
test (authentication, authorization, input validation, ...) is expressed with
the markers registered below, so a single property can be exercised across every
surface at once::

    pytest tests/integration/security -m authz

Add a marker at module scope with ``pytestmark = [pytest.mark.<class>]``.
"""

from __future__ import annotations

import pytest

# The security suite reuses the OAuth/OIDC fixtures defined in the auth package's
# conftest (`_app`, `_oauth_public_client`, `_oidc_server`, ...). That module is a
# conftest, so it must NOT be pulled in via `pytest_plugins`: pytest would then
# register the same module twice — once as a conftest, once as a named plugin —
# and raise "Plugin already registered under a different name" whenever the full
# tests/integration tree is collected (as CI does). Importing the fixture
# callables here registers them for the security subtree without registering the
# source module as a plugin. Their transitive dependencies resolve because every
# auth fixture is re-exported below, and top-level fixtures stay visible via the
# normal conftest scope chain.
from tests.integration.auth import conftest as _auth_conftest

# A fixture callable is marked differently across pytest versions
# (`_fixture_function_marker` in pytest 9, `_pytestfixturefunction` earlier), so
# accept either. Re-exporting every auth fixture — not just the leaves the tests
# request — keeps their transitive dependency closure resolvable here.
_FIXTURE_MARKERS = ("_fixture_function_marker", "_pytestfixturefunction")

globals().update(
    {
        _name: _value
        for _name, _value in vars(_auth_conftest).items()
        if any(hasattr(_value, _marker) for _marker in _FIXTURE_MARKERS)
    }
)

_CONTROL_CLASS_MARKERS: dict[str, str] = {
    "authn": "authentication controls (credential/token/session establishment)",
    "authz": "authorization controls (role, scope, audience, ownership boundaries)",
    "input_validation": "input validation and canonicalization controls",
    "session_management": "session lifecycle controls (issuance, rotation, revocation)",
    "disclosure": "information-disclosure and protocol-exposure controls",
}


def pytest_configure(config: pytest.Config) -> None:
    for name, description in _CONTROL_CLASS_MARKERS.items():
        config.addinivalue_line("markers", f"{name}: {description}")
