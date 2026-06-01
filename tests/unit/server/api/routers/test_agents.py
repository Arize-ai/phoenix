from __future__ import annotations

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
)
from phoenix.server.types import DbSessionFactory


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
