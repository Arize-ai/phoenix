from __future__ import annotations

from unittest.mock import patch

import pytest
from jinja2 import Template

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.agents.context import ResolvedContexts
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.types import (
    SandboxAvailability,
)
from phoenix.server.api.routers.agents import (
    _load_sandbox_availability,
    _maybe_using_user,
)
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.types import DbSessionFactory, UserId


class TestLoadSandboxAvailability:
    """``_load_sandbox_availability`` is the one-shot pre-flight the agents
    router runs to populate ``AgentDependencies.sandbox_availability``. It
    computes only the pre-turn ``has_usable`` gate (any enabled config under an
    enabled provider on an available backend); the selectable inventory is
    fetched on-demand by the agent via ``phoenix-gql``. The ``enabled AND
    provider.enabled`` AND semantics and the available-backend-types filter must
    hold."""

    async def test_returns_false_with_no_sandbox_rows(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            availability = await _load_sandbox_availability(session)
            assert availability.has_usable is False

    async def test_returns_true_when_enabled_config_under_enabled_provider(
        self,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        # ``sandbox_config`` fixture seeds providers (WASM enabled by default)
        # and creates a config (enabled defaults to True via server_default).
        async with db() as session:
            availability = await _load_sandbox_availability(session)
            assert availability.has_usable is True

    async def test_returns_false_when_config_is_disabled(
        self,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        async with db() as session:
            row = await session.get(models.SandboxConfig, sandbox_config.id)
            assert row is not None
            row.enabled = False
            await session.flush()
            availability = await _load_sandbox_availability(session)
            assert availability.has_usable is False

    async def test_disabled_config_under_other_provider_does_not_mask_enabled_one(
        self,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        # Two providers, two configs: one disabled config under one provider,
        # one enabled config under a different enabled provider. The disabled
        # path must NOT mask the enabled one — ``has_usable`` is "any enabled
        # row anywhere," not "every row is enabled."
        async with db() as session:
            wasm_cfg = models.SandboxConfig(
                backend_type="WASM",
                language="PYTHON",
                name=Identifier("disabled-wasm"),
                description=None,
                config={},
                timeout=30,
                enabled=False,
            )
            session.add(wasm_cfg)
            availability = await _load_sandbox_availability(session)
            assert availability.has_usable is False
            other_cfg = models.SandboxConfig(
                backend_type="E2B",
                language="PYTHON",
                name=Identifier("enabled-e2b"),
                description=None,
                config={},
                timeout=30,
                enabled=True,
            )
            session.add(other_cfg)
            await session.flush()
            # E2B provider defaults to enabled=False in sync_sandbox_providers;
            # flip it so the test exercises the positive branch.
            e2b = await session.get(models.SandboxProvider, "E2B")
            assert e2b is not None
            e2b.enabled = True
            await session.flush()
            availability = await _load_sandbox_availability(session)
            assert availability.has_usable is True

    async def test_available_backend_types_filter_excludes_unavailable_backends(
        self,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        # Only an E2B config is enabled, but E2B is not in the available-backend
        # set, so the gate must be False under the form's backend-status filter.
        async with db() as session:
            e2b_cfg = models.SandboxConfig(
                backend_type="E2B",
                language="PYTHON",
                name=Identifier("enabled-e2b"),
                description=None,
                config={},
                timeout=30,
                enabled=True,
            )
            session.add(e2b_cfg)
            e2b = await session.get(models.SandboxProvider, "E2B")
            assert e2b is not None
            e2b.enabled = True
            await session.flush()

            availability = await _load_sandbox_availability(
                session,
                available_backend_types=frozenset({"WASM"}),
            )

        assert availability.has_usable is False


class TestAgentDependenciesShape:
    """``AgentDependencies`` carries an ``is_viewer`` flag and a
    ``SandboxAvailability`` snapshot. Both default to safe-fail values so any
    constructor that omits them (auth-off mode, legacy call site) gets the
    conservative answer: viewer=False, no usable sandbox (advertise nothing
    tool-side)."""

    def test_defaults_are_safe_fail(self) -> None:
        from phoenix.server.agents.types import (
            AgentDependencies,
        )

        deps = AgentDependencies(contexts=ResolvedContexts())
        assert deps.is_viewer is False
        assert isinstance(deps.sandbox_availability, SandboxAvailability)
        assert deps.sandbox_availability.has_usable is False


class TestEditCodeEvaluatorDraftToolRendering:
    """The code-evaluator draft-edit tool template no longer inlines a sandbox
    inventory. It renders without any ``available_sandbox_configs`` variable and
    directs the agent to fetch the selectable set on-demand via ``phoenix-gql``,
    requesting env-var names but never ``secretKey``."""

    def _edit_template(self) -> Template:
        return AgentPrompts().edit_code_evaluator_draft_tool

    def test_directs_on_demand_sandbox_inventory_fetch(self) -> None:
        rendered = self._edit_template().render()
        assert "phoenix-gql" in rendered
        assert "sandboxProviders" in rendered
        assert "envVars { name }" in rendered
        # The projection requests env-var names only; the prompt explicitly
        # forbids requesting the secret-bearing field.
        assert "never `secretKey`" in rendered


class TestObservabilityMixinAttachUserId:
    """``_ObservabilityMixin.attach_user_id`` defaults to ``False`` and accepts
    both the camelCase ``attachUserId`` alias and the snake_case field name."""

    def test_defaults_to_false(self) -> None:
        from phoenix.server.api.routers.agents import _ObservabilityMixin

        mixin = _ObservabilityMixin()
        assert mixin.attach_user_id is False

    def test_camel_alias_accepted(self) -> None:
        from phoenix.server.api.routers.agents import _ObservabilityMixin

        mixin = _ObservabilityMixin.model_validate({"attachUserId": True})
        assert mixin.attach_user_id is True

    def test_snake_case_accepted(self) -> None:
        from phoenix.server.api.routers.agents import _ObservabilityMixin

        mixin = _ObservabilityMixin.model_validate({"attach_user_id": True})
        assert mixin.attach_user_id is True


class TestMaybeUsingUser:
    """``_maybe_using_user`` gates the ``using_user`` context manager behind
    the per-request opt-in flag and an authenticated ``PhoenixUser`` check.

    Three cases:
    1. Flag off → no-op, regardless of auth state.
    2. Flag on, unauthenticated (``phoenix_user is None``) → no-op.
    3. Flag on, authenticated ``PhoenixUser`` → ``using_user`` called with the
       user's string identity.
    """

    def _make_phoenix_user(self, user_id: int = 1) -> PhoenixUser:
        from phoenix.server.types import UserClaimSet, UserTokenAttributes

        uid = UserId(user_id)
        attrs = UserTokenAttributes(user_role="MEMBER")
        return PhoenixUser(uid, UserClaimSet(subject=uid, attributes=attrs))

    @pytest.mark.parametrize(
        "phoenix_user_arg",
        [None, "has_user"],
        ids=["no_user", "with_user"],
    )
    def test_returns_nullcontext_when_flag_is_false(self, phoenix_user_arg: str | None) -> None:
        import contextlib

        phoenix_user = self._make_phoenix_user() if phoenix_user_arg == "has_user" else None
        ctx = _maybe_using_user(attach_user_id=False, phoenix_user=phoenix_user)
        assert isinstance(ctx, contextlib.nullcontext)

    def test_returns_nullcontext_when_flag_is_true_but_no_user(self) -> None:
        import contextlib

        ctx = _maybe_using_user(attach_user_id=True, phoenix_user=None)
        assert isinstance(ctx, contextlib.nullcontext)

    def test_returns_using_user_context_when_authenticated(self) -> None:
        from openinference.instrumentation import using_user as using_user_cls

        user = self._make_phoenix_user(7)
        ctx = _maybe_using_user(attach_user_id=True, phoenix_user=user)
        assert isinstance(ctx, using_user_cls)

    def test_passes_user_identity_string_to_using_user(self) -> None:
        """The identity is str(UserId) — i.e. ``"User:<n>"`` — and that exact
        string must be forwarded to ``using_user`` so the span attribute is
        stable and matches what Phoenix stores."""
        user = self._make_phoenix_user(42)
        expected_identity = str(user.identity)  # e.g. "User:42"
        with patch("openinference.instrumentation.using_user") as mock_cm:
            _maybe_using_user(attach_user_id=True, phoenix_user=user)
        mock_cm.assert_called_once_with(expected_identity)

    def test_context_manager_enters_without_error(self) -> None:
        """Sanity check: the returned context manager can be entered."""
        user = self._make_phoenix_user(5)
        ctx = _maybe_using_user(attach_user_id=True, phoenix_user=user)
        with ctx:
            pass  # must not raise
