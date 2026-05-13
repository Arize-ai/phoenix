"""End-to-end coverage of the eight admin-gated sandbox / code-evaluator
GraphQL surfaces hardened by PR #13147.

Structural class-in-permission-list assertions live in
``tests/unit/server/api/mutations/test_code_evaluator_sandbox_mutations.py``
and remain authoritative. This module is intentionally complementary:
real HTTP, role-derived auth, and end-to-end fixture wiring against an
admin-authored CodeEvaluator + SandboxConfig + SandboxProvider triple.

Gated surfaces covered (PR #13147 intent anchor):

  Read fields (``IsAdminIfAuthEnabled``):
    1. ``SandboxConfig.config``
    2. ``SandboxProvider.config``
    3. ``Query.sandboxBackends``
    4. ``Query.sandboxProviders``

  Persisted-CodeEvaluator write mutations (``IsAdminIfAuthEnabled`` member
  of the shared permission list ``[IsNotReadOnly, IsNotViewer,
  IsAdminIfAuthEnabled, IsLocked]``):
    5. ``createCodeEvaluator``
    6. ``patchCodeEvaluator``
    7. ``createCodeEvaluatorVersion``

  Branch-level admin gate on the ``evaluatorPreviews`` mutation
  (``_require_admin_if_auth_enabled(info)`` early in resolver):
    8a. ``code_evaluator`` branch (admin-gated)
    8b. ``inline_code_evaluator`` branch (admin-gated)

Sanity coverage proves the gate is branch-scoped, not whole-mutation:
    9a. ``builtin`` branch — _MEMBER must NOT receive Unauthorized
    9b. ``inline_llm_evaluator`` branch — _MEMBER must NOT receive Unauthorized

For both sanity branches, _VIEWER is still blocked at the top-level
``IsNotViewer`` permission on ``evaluatorPreviews``; _MEMBER and above
must reach branch logic without an admin gate firing.
"""

from __future__ import annotations

from secrets import token_hex
from types import TracebackType
from typing import Any, Optional

import pytest

from phoenix.server.api.exceptions import Unauthorized

from .._helpers import (
    _ADMIN,
    _DEFAULT_ADMIN,
    _DENIED,
    _MEMBER,
    _OK,
    _OK_OR_DENIED,
    _VIEWER,
    _AppInfo,
    _GetUser,
    _GqlId,
    _RoleOrUser,
)

# ---------------------------------------------------------------------------
# Fixtures — module-scoped, admin-authored seed data
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def _sandbox_provider_gid(_app: _AppInfo) -> _GqlId:
    """Return the GlobalID of any sandbox provider auto-seeded at startup.

    `sync_sandbox_providers` (src/phoenix/server/sandbox/sync.py) seeds one
    row per (backend_type, language) pair from SANDBOX_ADAPTER_METADATA at
    server boot. We query for the first one via admin-authenticated GraphQL
    rather than touching the DB directly, mirroring the end-to-end discipline
    of every other integration test in this directory.
    """
    admin = _DEFAULT_ADMIN.log_in(_app)
    resp, _ = admin.gql(
        _app,
        "query{sandboxProviders{id backendType language}}",
    )
    providers = resp["data"]["sandboxProviders"]
    assert providers, (
        "Expected at least one sandbox provider auto-seeded at startup; "
        "got an empty list — check sync_sandbox_providers."
    )
    return _GqlId(providers[0]["id"])


@pytest.fixture(scope="module")
def _sandbox_config_gid(_app: _AppInfo, _sandbox_provider_gid: _GqlId) -> _GqlId:
    """Create an admin-authored SandboxConfig under the seeded provider."""
    admin = _DEFAULT_ADMIN.log_in(_app)
    name = f"sandbox-config-{token_hex(4)}"
    resp, _ = admin.gql(
        _app,
        query="""
          mutation CreateSandboxConfig($input: CreateSandboxConfigInput!) {
            createSandboxConfig(input: $input) {
              sandboxConfig { id }
            }
          }
        """,
        variables={
            "input": {
                "sandboxProviderId": str(_sandbox_provider_gid),
                "name": name,
                "description": "fixture-for-admin-gate-tests",
                "config": {},
                "enabled": True,
            }
        },
    )
    return _GqlId(resp["data"]["createSandboxConfig"]["sandboxConfig"]["id"])


@pytest.fixture(scope="module")
def _code_evaluator_gid(_app: _AppInfo, _sandbox_config_gid: _GqlId) -> _GqlId:
    """Create an admin-authored CodeEvaluator bound to the fixture SandboxConfig."""
    admin = _DEFAULT_ADMIN.log_in(_app)
    name = f"code-eval-{token_hex(4)}"
    resp, _ = admin.gql(
        _app,
        query="""
          mutation CreateCodeEvaluator($input: CreateCodeEvaluatorInput!) {
            createCodeEvaluator(input: $input) {
              evaluator { id }
            }
          }
        """,
        variables={
            "input": {
                "name": name,
                "language": "PYTHON",
                "sourceCode": "def evaluate(output):\n    return {'label': 'ok'}\n",
                "sandboxConfigId": str(_sandbox_config_gid),
                "inputMapping": {
                    "literalMapping": {},
                    "pathMapping": {"output": "$.output"},
                },
                "outputConfigs": [
                    {
                        "categorical": {
                            "name": "label",
                            "optimizationDirection": "MAXIMIZE",
                            "values": [
                                {"label": "ok", "score": 1.0},
                                {"label": "bad", "score": 0.0},
                            ],
                        }
                    }
                ],
            }
        },
    )
    return _GqlId(resp["data"]["createCodeEvaluator"]["evaluator"]["id"])


@pytest.fixture(scope="module")
def _builtin_evaluator_gid(_app: _AppInfo) -> _GqlId:
    """Pick any seeded builtin evaluator GID for the `builtin` preview branch."""
    admin = _DEFAULT_ADMIN.log_in(_app)
    resp, _ = admin.gql(
        _app,
        "query{builtInEvaluators{id}}",
    )
    builtins = resp["data"]["builtInEvaluators"]
    assert builtins, (
        "Expected at least one builtin evaluator seeded at startup; "
        "the preview-branch sanity tests require one."
    )
    return _GqlId(builtins[0]["id"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _NoAdminGate:
    """Reusable context manager: assert the call did NOT trip an admin-only
    gate. Non-auth failures (BadRequest, RuntimeError) are swallowed because
    the fixture inputs are intentionally minimal — the gate is what we are
    falsifying, not downstream execution success.
    """

    def __enter__(self) -> "_NoAdminGate":
        return self

    def __exit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> bool:
        if exc_type is None:
            return False
        if issubclass(exc_type, Unauthorized):
            return False
        return True


_NO_ADMIN_GATE: _OK_OR_DENIED = _NoAdminGate()  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestSandboxAndCodeEvaluatorAdminGate:
    """End-to-end role × surface coverage for the eight admin-gated GraphQL
    surfaces enumerated in PR #13147."""

    # ---- Reads -----------------------------------------------------------

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    def test_only_admin_can_read_sandbox_providers(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
        _sandbox_provider_gid: _GqlId,
    ) -> None:
        """Query.sandboxProviders is admin-gated; non-admin → Unauthorized."""
        u = _get_user(_app, role_or_user)
        logged_in = u.log_in(_app)
        with expectation:
            logged_in.gql(_app, "query{sandboxProviders{id}}")

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    def test_only_admin_can_read_sandbox_backends(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Query.sandboxBackends is admin-gated; non-admin → Unauthorized."""
        u = _get_user(_app, role_or_user)
        logged_in = u.log_in(_app)
        with expectation:
            logged_in.gql(_app, "query{sandboxBackends{backendType}}")

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    def test_only_admin_can_read_sandbox_provider_config(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
        _sandbox_provider_gid: _GqlId,
    ) -> None:
        """SandboxProvider.config (field-level admin gate) → Unauthorized for non-admin."""
        u = _get_user(_app, role_or_user)
        logged_in = u.log_in(_app)
        query = (
            'query{node(id:"' + str(_sandbox_provider_gid) + '"){... on SandboxProvider{config}}}'
        )
        with expectation:
            logged_in.gql(_app, query)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    def test_only_admin_can_read_sandbox_config_config(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
        _sandbox_config_gid: _GqlId,
    ) -> None:
        """SandboxConfig.config (field-level admin gate) → Unauthorized for non-admin."""
        u = _get_user(_app, role_or_user)
        logged_in = u.log_in(_app)
        query = 'query{node(id:"' + str(_sandbox_config_gid) + '"){... on SandboxConfig{config}}}'
        with expectation:
            logged_in.gql(_app, query)

    # ---- Persisted-CodeEvaluator write mutations -------------------------

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    def test_only_admin_can_create_code_evaluator(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
        _sandbox_config_gid: _GqlId,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in = u.log_in(_app)
        query = """
          mutation CreateCodeEvaluator($input: CreateCodeEvaluatorInput!) {
            createCodeEvaluator(input: $input) { evaluator { id } }
          }
        """
        variables = {
            "input": {
                "name": f"ce-{token_hex(4)}",
                "language": "PYTHON",
                "sourceCode": "def evaluate(output):\n    return {'label': 'ok'}\n",
                "sandboxConfigId": str(_sandbox_config_gid),
                "inputMapping": {
                    "literalMapping": {},
                    "pathMapping": {"output": "$.output"},
                },
                "outputConfigs": [
                    {
                        "categorical": {
                            "name": "label",
                            "optimizationDirection": "MAXIMIZE",
                            "values": [
                                {"label": "ok", "score": 1.0},
                                {"label": "bad", "score": 0.0},
                            ],
                        }
                    }
                ],
            }
        }
        with expectation:
            logged_in.gql(_app, query, variables=variables)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    def test_only_admin_can_patch_code_evaluator(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
        _code_evaluator_gid: _GqlId,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in = u.log_in(_app)
        query = """
          mutation PatchCodeEvaluator($input: PatchCodeEvaluatorInput!) {
            patchCodeEvaluator(input: $input) { evaluator { id } }
          }
        """
        variables = {
            "input": {
                "id": str(_code_evaluator_gid),
                "description": f"patched-{token_hex(4)}",
            }
        }
        with expectation:
            logged_in.gql(_app, query, variables=variables)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    def test_only_admin_can_create_code_evaluator_version(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
        _code_evaluator_gid: _GqlId,
    ) -> None:
        u = _get_user(_app, role_or_user)
        logged_in = u.log_in(_app)
        query = """
          mutation CreateCodeEvaluatorVersion($input: CreateCodeEvaluatorVersionInput!) {
            createCodeEvaluatorVersion(input: $input) {
              evaluator { id }
              wasCreated
            }
          }
        """
        # Unique source ensures wasCreated=true on the first admin pass and
        # subsequent admin reruns just dedup; the gate fires before this matters.
        variables = {
            "input": {
                "codeEvaluatorId": str(_code_evaluator_gid),
                "sourceCode": f"def evaluate(output):\n    return {{'label': 'ok-{token_hex(4)}'}}\n",
            }
        }
        with expectation:
            logged_in.gql(_app, query, variables=variables)

    # ---- evaluatorPreviews branch-level admin gate -----------------------

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _NO_ADMIN_GATE),
            (_DEFAULT_ADMIN, _NO_ADMIN_GATE),
        ],
    )
    def test_only_admin_can_preview_code_evaluator_branch(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
        _code_evaluator_gid: _GqlId,
    ) -> None:
        """evaluatorPreviews `code_evaluator` branch is admin-gated at the
        branch via `_require_admin_if_auth_enabled(info)`.

        - _VIEWER / _MEMBER must receive `Unauthorized` (either from the
          top-level `IsNotViewer` for _VIEWER or from the branch gate for
          _MEMBER).
        - _ADMIN must NOT receive `Unauthorized`. Sandbox execution may still
          fail downstream (no real backend wired in tests) — that's a non-auth
          error and is acceptable here; the gate is what we are falsifying.
        """
        u = _get_user(_app, role_or_user)
        logged_in = u.log_in(_app)
        query = """
          mutation Previews($input: EvaluatorPreviewsInput!) {
            evaluatorPreviews(input: $input) {
              results { evaluatorName }
            }
          }
        """
        variables = {
            "input": {
                "previews": [
                    {
                        "evaluator": {
                            "codeEvaluatorId": str(_code_evaluator_gid),
                        },
                        "context": {"output": "hello"},
                        "inputMapping": {
                            "literalMapping": {},
                            "pathMapping": {"output": "$.output"},
                        },
                    }
                ],
            }
        }
        with expectation:
            logged_in.gql(_app, query, variables=variables)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _NO_ADMIN_GATE),
            (_DEFAULT_ADMIN, _NO_ADMIN_GATE),
        ],
    )
    def test_only_admin_can_preview_inline_code_evaluator_branch(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
        _sandbox_config_gid: _GqlId,
    ) -> None:
        """evaluatorPreviews `inline_code_evaluator` branch is admin-gated at
        the branch via `_require_admin_if_auth_enabled(info)` because the
        inline-code helper dereferences admin-authored sandbox state.
        """
        u = _get_user(_app, role_or_user)
        logged_in = u.log_in(_app)
        query = """
          mutation Previews($input: EvaluatorPreviewsInput!) {
            evaluatorPreviews(input: $input) {
              results { evaluatorName }
            }
          }
        """
        variables = {
            "input": {
                "previews": [
                    {
                        "evaluator": {
                            "inlineCodeEvaluator": {
                                "name": f"inline-{token_hex(4)}",
                                "language": "PYTHON",
                                "sourceCode": (
                                    "def evaluate(output):\n    return {'label': 'ok'}\n"
                                ),
                                "sandboxConfigId": str(_sandbox_config_gid),
                                "outputConfigs": [
                                    {
                                        "categorical": {
                                            "name": "label",
                                            "optimizationDirection": "MAXIMIZE",
                                            "values": [
                                                {"label": "ok", "score": 1.0},
                                                {"label": "bad", "score": 0.0},
                                            ],
                                        }
                                    }
                                ],
                            }
                        },
                        "context": {"output": "hello"},
                        "inputMapping": {
                            "literalMapping": {},
                            "pathMapping": {"output": "$.output"},
                        },
                    }
                ],
            }
        }
        with expectation:
            logged_in.gql(_app, query, variables=variables)

    # ---- Sanity branches: member-accessible (no admin gate) --------------

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            # _VIEWER blocked by top-level IsNotViewer regardless of branch.
            (_VIEWER, _DENIED),
            # _MEMBER must reach the branch without an admin gate firing —
            # this is the sanity assertion proving the gate is branch-scoped.
            (_MEMBER, _NO_ADMIN_GATE),
            (_ADMIN, _NO_ADMIN_GATE),
            (_DEFAULT_ADMIN, _NO_ADMIN_GATE),
        ],
    )
    def test_preview_builtin_branch_remains_member_accessible(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
        _builtin_evaluator_gid: _GqlId,
    ) -> None:
        """evaluatorPreviews `builtin` branch must NOT raise `Unauthorized`
        for members — proves the admin gate is branch-scoped, not whole-
        mutation."""
        u = _get_user(_app, role_or_user)
        logged_in = u.log_in(_app)
        query = """
          mutation Previews($input: EvaluatorPreviewsInput!) {
            evaluatorPreviews(input: $input) {
              results { evaluatorName }
            }
          }
        """
        variables = {
            "input": {
                "previews": [
                    {
                        "evaluator": {
                            "builtInEvaluatorId": str(_builtin_evaluator_gid),
                        },
                        "context": {"output": "hello"},
                        "inputMapping": {
                            "literalMapping": {},
                            "pathMapping": {"output": "$.output"},
                        },
                    }
                ],
            }
        }
        with expectation:
            logged_in.gql(_app, query, variables=variables)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _NO_ADMIN_GATE),
            (_ADMIN, _NO_ADMIN_GATE),
            (_DEFAULT_ADMIN, _NO_ADMIN_GATE),
        ],
    )
    def test_preview_inline_llm_evaluator_branch_remains_member_accessible(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """evaluatorPreviews `inline_llm_evaluator` branch must NOT raise
        `Unauthorized` for members — the branch has no admin gate.

        The minimal inline-LLM input here is incomplete by design (no model
        credentials wired in tests); the branch is expected to error with a
        non-auth BadRequest like "missing credentials" or model-validation
        failure. We assert only that the failure is not `Unauthorized`.
        """
        u = _get_user(_app, role_or_user)
        logged_in = u.log_in(_app)
        query = """
          mutation Previews($input: EvaluatorPreviewsInput!) {
            evaluatorPreviews(input: $input) {
              results { evaluatorName }
            }
          }
        """
        variables: dict[str, Any] = {
            "input": {
                "previews": [
                    {
                        "evaluator": {
                            "inlineLlmEvaluator": {
                                "name": f"inline-llm-{token_hex(4)}",
                                "promptVersion": {
                                    "description": "fixture",
                                    "templateFormat": "MUSTACHE",
                                    "template": {
                                        "messages": [
                                            {
                                                "role": "USER",
                                                "content": [{"text": {"text": "hello"}}],
                                            }
                                        ]
                                    },
                                    "invocationParameters": {"openai": {}},
                                    "modelProvider": "OPENAI",
                                    "modelName": "gpt-4o-mini",
                                },
                                "outputConfigs": [
                                    {
                                        "categorical": {
                                            "name": "label",
                                            "optimizationDirection": "MAXIMIZE",
                                            "values": [
                                                {"label": "ok", "score": 1.0},
                                                {"label": "bad", "score": 0.0},
                                            ],
                                        }
                                    }
                                ],
                            }
                        },
                        "context": {"output": "hello"},
                        "inputMapping": {
                            "literalMapping": {},
                            "pathMapping": {"output": "$.output"},
                        },
                    }
                ],
            }
        }
        with expectation:
            logged_in.gql(_app, query, variables=variables)
