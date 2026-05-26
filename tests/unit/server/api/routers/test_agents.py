from __future__ import annotations

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.routers.agents import _has_usable_sandbox
from phoenix.server.types import DbSessionFactory


class TestHasUsableSandbox:
    """`_has_usable_sandbox` is the one-shot pre-flight the agents router
    runs to populate `AgentDependencies.sandbox_availability.has_usable`.
    The capability gate on `create_code_evaluator` reads from this, so the
    `enabled AND provider.enabled` AND semantics must hold."""

    async def test_returns_false_with_no_sandbox_rows(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            assert (await _has_usable_sandbox(session)) is False

    async def test_returns_true_when_enabled_config_under_enabled_provider(
        self,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        # `sandbox_config` fixture seeds providers (WASM enabled by default)
        # and creates a config (enabled defaults to True via server_default).
        async with db() as session:
            assert (await _has_usable_sandbox(session)) is True

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
            assert (await _has_usable_sandbox(session)) is False

    async def test_returns_false_when_provider_is_disabled(
        self,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        async with db() as session:
            provider = await session.get(models.SandboxProvider, sandbox_config.backend_type)
            assert provider is not None
            provider.enabled = False
            await session.flush()
            assert (await _has_usable_sandbox(session)) is False

    async def test_disabled_config_under_other_provider_does_not_mask_enabled_one(
        self,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        # Two providers, two configs: one disabled config under one provider,
        # one enabled config under a different enabled provider. The disabled
        # path must NOT mask the enabled one — `has_usable` is "any enabled
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
            assert (await _has_usable_sandbox(session)) is False
            other_cfg = models.SandboxConfig(
                backend_type="E2B",
                language="TYPESCRIPT",
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
            assert (await _has_usable_sandbox(session)) is True


class TestAgentDependenciesShape:
    """`AgentDependencies` grew `is_viewer: bool` + `sandbox_availability:
    SandboxAvailability`. Both default to safe-fail values so any constructor
    that omits them (auth-off mode, legacy call site) gets the conservative
    answer: viewer=False, has_usable=False (advertise nothing tool-side)."""

    def test_defaults_are_safe_fail(self) -> None:
        from phoenix.server.agents.context import ResolvedContexts
        from phoenix.server.agents.types import (
            AgentDependencies,
            SandboxAvailability,
        )

        deps = AgentDependencies(contexts=ResolvedContexts())
        assert deps.is_viewer is False
        assert isinstance(deps.sandbox_availability, SandboxAvailability)
        assert deps.sandbox_availability.has_usable is False

    def test_explicit_values_override_defaults(self) -> None:
        from phoenix.server.agents.context import ResolvedContexts
        from phoenix.server.agents.types import (
            AgentDependencies,
            SandboxAvailability,
        )

        deps = AgentDependencies(
            contexts=ResolvedContexts(),
            is_viewer=True,
            sandbox_availability=SandboxAvailability(has_usable=True),
        )
        assert deps.is_viewer is True
        assert deps.sandbox_availability.has_usable is True


class TestCreateCodeEvaluatorCapabilityGate:
    """`CreateCodeEvaluatorCapability.include_for_run` ANDs three predicates:
    code_evaluator context absent, not viewer, sandbox_availability.has_usable.
    The capability is hidden unless all three hold."""

    def test_advertised_when_all_conditions_met(self) -> None:
        from unittest.mock import MagicMock

        from phoenix.server.agents.capabilities.tools.external.create_code_evaluator import (
            CreateCodeEvaluatorCapability,
        )
        from phoenix.server.agents.context import ResolvedContexts
        from phoenix.server.agents.types import (
            AgentDependencies,
            SandboxAvailability,
        )

        capability = CreateCodeEvaluatorCapability(instructions=MagicMock())
        deps = AgentDependencies(
            contexts=ResolvedContexts(),
            is_viewer=False,
            sandbox_availability=SandboxAvailability(has_usable=True),
        )
        ctx = MagicMock()
        ctx.deps = deps
        assert capability.include_for_run(ctx) is True

    def test_hidden_when_viewer(self) -> None:
        from unittest.mock import MagicMock

        from phoenix.server.agents.capabilities.tools.external.create_code_evaluator import (
            CreateCodeEvaluatorCapability,
        )
        from phoenix.server.agents.context import ResolvedContexts
        from phoenix.server.agents.types import (
            AgentDependencies,
            SandboxAvailability,
        )

        capability = CreateCodeEvaluatorCapability(instructions=MagicMock())
        deps = AgentDependencies(
            contexts=ResolvedContexts(),
            is_viewer=True,
            sandbox_availability=SandboxAvailability(has_usable=True),
        )
        ctx = MagicMock()
        ctx.deps = deps
        assert capability.include_for_run(ctx) is False

    def test_hidden_when_no_sandbox(self) -> None:
        from unittest.mock import MagicMock

        from phoenix.server.agents.capabilities.tools.external.create_code_evaluator import (
            CreateCodeEvaluatorCapability,
        )
        from phoenix.server.agents.context import ResolvedContexts
        from phoenix.server.agents.types import (
            AgentDependencies,
            SandboxAvailability,
        )

        capability = CreateCodeEvaluatorCapability(instructions=MagicMock())
        deps = AgentDependencies(
            contexts=ResolvedContexts(),
            is_viewer=False,
            sandbox_availability=SandboxAvailability(has_usable=False),
        )
        ctx = MagicMock()
        ctx.deps = deps
        assert capability.include_for_run(ctx) is False

    def test_hidden_when_code_evaluator_context_active(self) -> None:
        from unittest.mock import MagicMock

        from phoenix.server.agents.capabilities.tools.external.create_code_evaluator import (
            CreateCodeEvaluatorCapability,
        )
        from phoenix.server.agents.context import (
            CodeEvaluatorContext,
            ResolvedContexts,
        )
        from phoenix.server.agents.types import (
            AgentDependencies,
            SandboxAvailability,
        )

        capability = CreateCodeEvaluatorCapability(instructions=MagicMock())
        contexts = ResolvedContexts()
        contexts.code_evaluator = CodeEvaluatorContext(type="code_evaluator", evaluatorNodeId=None)
        deps = AgentDependencies(
            contexts=contexts,
            is_viewer=False,
            sandbox_availability=SandboxAvailability(has_usable=True),
        )
        ctx = MagicMock()
        ctx.deps = deps
        assert capability.include_for_run(ctx) is False


class TestEditCodeEvaluatorDraftCapabilityViewerGate:
    """`EditCodeEvaluatorDraftCapability.include_for_run` ANDs
    code_evaluator-context-present + not-viewer. Viewers must not get the
    edit tool either, even when a form is mounted (D7 viewer half coherence)."""

    def test_advertised_for_non_viewer_with_form_mounted(self) -> None:
        from unittest.mock import MagicMock

        from phoenix.server.agents.capabilities.tools.external.edit_code_evaluator_draft import (
            EditCodeEvaluatorDraftCapability,
        )
        from phoenix.server.agents.context import (
            CodeEvaluatorContext,
            ResolvedContexts,
        )
        from phoenix.server.agents.types import (
            AgentDependencies,
            SandboxAvailability,
        )

        capability = EditCodeEvaluatorDraftCapability(instructions=MagicMock())
        contexts = ResolvedContexts()
        contexts.code_evaluator = CodeEvaluatorContext(type="code_evaluator", evaluatorNodeId=None)
        deps = AgentDependencies(
            contexts=contexts,
            is_viewer=False,
            sandbox_availability=SandboxAvailability(has_usable=False),
        )
        ctx = MagicMock()
        ctx.deps = deps
        assert capability.include_for_run(ctx) is True

    def test_hidden_for_viewer_even_with_form_mounted(self) -> None:
        from unittest.mock import MagicMock

        from phoenix.server.agents.capabilities.tools.external.edit_code_evaluator_draft import (
            EditCodeEvaluatorDraftCapability,
        )
        from phoenix.server.agents.context import (
            CodeEvaluatorContext,
            ResolvedContexts,
        )
        from phoenix.server.agents.types import (
            AgentDependencies,
            SandboxAvailability,
        )

        capability = EditCodeEvaluatorDraftCapability(instructions=MagicMock())
        contexts = ResolvedContexts()
        contexts.code_evaluator = CodeEvaluatorContext(type="code_evaluator", evaluatorNodeId=None)
        deps = AgentDependencies(
            contexts=contexts,
            is_viewer=True,
            sandbox_availability=SandboxAvailability(has_usable=False),
        )
        ctx = MagicMock()
        ctx.deps = deps
        assert capability.include_for_run(ctx) is False
