from __future__ import annotations

import logging
from xml.etree import ElementTree

from jinja2 import Template

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.agents.prompts import AgentInstructions
from phoenix.server.agents.types import SandboxAvailability, SandboxConfigCapabilities
from phoenix.server.api.routers.agents import _load_sandbox_availability
from phoenix.server.types import DbSessionFactory


class TestLoadSandboxAvailability:
    """``_load_sandbox_availability`` is the one-shot pre-flight the agents
    router runs to populate ``AgentDependencies.sandbox_availability``. The
    capability gate on ``create_code_evaluator`` reads ``has_usable`` from
    this, and the create/edit prompt templates enumerate ``configs`` — so
    both the ``enabled AND provider.enabled`` AND semantics and the per-row
    inventory shape must hold."""

    async def test_returns_empty_with_no_sandbox_rows(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            availability = await _load_sandbox_availability(session)
            assert availability.has_usable is False
            assert availability.configs == []

    async def test_returns_one_when_enabled_config_under_enabled_provider(
        self,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        # ``sandbox_config`` fixture seeds providers (WASM enabled by default)
        # and creates a config (enabled defaults to True via server_default).
        async with db() as session:
            availability = await _load_sandbox_availability(session)
            assert availability.has_usable is True
            assert len(availability.configs) == 1
            cfg = availability.configs[0]
            assert cfg.language == sandbox_config.language
            assert cfg.name == str(sandbox_config.name)
            assert (
                cfg.sandbox_config_id.startswith("U2FuZGJveENvbmZpZzo")
                or "SandboxConfig" in cfg.sandbox_config_id
            )  # GlobalID is base64-encoded "SandboxConfig:<id>"

    async def test_returns_empty_when_config_is_disabled(
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
            assert availability.configs == []

    async def test_returns_empty_when_provider_is_disabled(
        self,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        async with db() as session:
            provider = await session.get(models.SandboxProvider, sandbox_config.backend_type)
            assert provider is not None
            provider.enabled = False
            await session.flush()
            availability = await _load_sandbox_availability(session)
            assert availability.has_usable is False
            assert availability.configs == []

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
            assert len(availability.configs) == 1
            assert availability.configs[0].name == "enabled-e2b"

    async def test_malformed_row_is_logged_and_skipped(
        self,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
        caplog: object,  # pytest's caplog fixture
    ) -> None:
        # One enabled row with a structurally invalid ``config`` blob and one
        # well-formed row under the same provider. The loader must skip the
        # bad row with a warning instead of 500ing the agent request, and
        # the surviving row must appear in the returned snapshot.
        async with db() as session:
            bad_row = models.SandboxConfig(
                backend_type="WASM",
                language="PYTHON",
                name=Identifier("malformed"),
                description=None,
                config={"backend_type": "WASM", "language": "PYTHON", "env_vars": "not-a-dict"},
                timeout=30,
                enabled=True,
            )
            good_row = models.SandboxConfig(
                backend_type="WASM",
                language="PYTHON",
                name=Identifier("well-formed"),
                description=None,
                config={},
                timeout=30,
                enabled=True,
            )
            session.add(bad_row)
            session.add(good_row)
            await session.flush()

            with caplog.at_level(logging.WARNING, logger="phoenix.server.api.routers.agents"):  # type: ignore[attr-defined]
                availability = await _load_sandbox_availability(session)

            surviving_names = {cfg.name for cfg in availability.configs}
            assert "well-formed" in surviving_names
            assert "malformed" not in surviving_names
            assert any(
                "malformed" in record.getMessage()
                or "Skipping sandbox config" in record.getMessage()
                for record in caplog.records  # type: ignore[attr-defined]
            )


class TestAgentDependenciesShape:
    """``AgentDependencies`` carries an ``is_viewer`` flag and a
    ``SandboxAvailability`` snapshot. Both default to safe-fail values so any
    constructor that omits them (auth-off mode, legacy call site) gets the
    conservative answer: viewer=False, no usable configs (advertise nothing
    tool-side)."""

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
        assert deps.sandbox_availability.configs == []

    def test_default_factory_does_not_share_mutable_list(self) -> None:
        # ``sandbox_availability`` uses ``field(default_factory=...)``; two
        # default-constructed instances must not share the same ``configs``
        # list, or appending to one would leak to the other.
        from phoenix.server.agents.context import ResolvedContexts
        from phoenix.server.agents.types import AgentDependencies

        deps_a = AgentDependencies(contexts=ResolvedContexts())
        deps_b = AgentDependencies(contexts=ResolvedContexts())
        assert deps_a.sandbox_availability is not deps_b.sandbox_availability
        assert deps_a.sandbox_availability.configs is not deps_b.sandbox_availability.configs

    def test_explicit_values_override_defaults(self) -> None:
        from phoenix.server.agents.context import ResolvedContexts
        from phoenix.server.agents.types import (
            AgentDependencies,
            SandboxAvailability,
        )

        deps = AgentDependencies(
            contexts=ResolvedContexts(),
            is_viewer=True,
            sandbox_availability=SandboxAvailability(
                configs=[
                    SandboxConfigCapabilities(
                        sandbox_config_id="U2FuZGJveENvbmZpZzox",
                        name="example",
                        language="PYTHON",
                        internet_access="allow",
                    )
                ]
            ),
        )
        assert deps.is_viewer is True
        assert deps.sandbox_availability.has_usable is True
        assert len(deps.sandbox_availability.configs) == 1


class TestCreateCodeEvaluatorCapabilityGate:
    """``CreateCodeEvaluatorCapability.include_for_run`` ANDs the page,
    permission, and sandbox predicates. The capability is hidden unless the
    dataset evaluators surface is active, no code-evaluator form is mounted,
    the user can write, and at least one sandbox config is usable."""

    def _make_availability(self, *, has_usable: bool) -> SandboxAvailability:
        if not has_usable:
            return SandboxAvailability()
        return SandboxAvailability(
            configs=[
                SandboxConfigCapabilities(
                    sandbox_config_id="U2FuZGJveENvbmZpZzox",
                    name="example",
                    language="PYTHON",
                    internet_access="allow",
                )
            ]
        )

    def _dataset_evaluators_contexts(self):
        from phoenix.server.agents.context import (
            DatasetContext,
            DatasetEvaluatorsContext,
            ResolvedContexts,
        )

        return ResolvedContexts(
            dataset=DatasetContext(type="dataset", dataset_node_id="RGF0YXNldDox"),
            dataset_evaluators=DatasetEvaluatorsContext(
                type="dataset_evaluators",
                dataset_node_id="RGF0YXNldDox",
            ),
        )

    def test_advertised_when_all_conditions_met(self) -> None:
        from unittest.mock import MagicMock

        from phoenix.server.agents.capabilities.tools.external.create_code_evaluator import (
            CreateCodeEvaluatorCapability,
        )
        from phoenix.server.agents.types import AgentDependencies

        capability = CreateCodeEvaluatorCapability(instructions=MagicMock())
        deps = AgentDependencies(
            contexts=self._dataset_evaluators_contexts(),
            is_viewer=False,
            sandbox_availability=self._make_availability(has_usable=True),
        )
        ctx = MagicMock()
        ctx.deps = deps
        assert capability.include_for_run(ctx) is True

    def test_hidden_when_viewer(self) -> None:
        from unittest.mock import MagicMock

        from phoenix.server.agents.capabilities.tools.external.create_code_evaluator import (
            CreateCodeEvaluatorCapability,
        )
        from phoenix.server.agents.types import AgentDependencies

        capability = CreateCodeEvaluatorCapability(instructions=MagicMock())
        deps = AgentDependencies(
            contexts=self._dataset_evaluators_contexts(),
            is_viewer=True,
            sandbox_availability=self._make_availability(has_usable=True),
        )
        ctx = MagicMock()
        ctx.deps = deps
        assert capability.include_for_run(ctx) is False

    def test_hidden_when_no_sandbox(self) -> None:
        from unittest.mock import MagicMock

        from phoenix.server.agents.capabilities.tools.external.create_code_evaluator import (
            CreateCodeEvaluatorCapability,
        )
        from phoenix.server.agents.types import AgentDependencies

        capability = CreateCodeEvaluatorCapability(instructions=MagicMock())
        deps = AgentDependencies(
            contexts=self._dataset_evaluators_contexts(),
            is_viewer=False,
            sandbox_availability=self._make_availability(has_usable=False),
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
        )
        from phoenix.server.agents.types import AgentDependencies

        capability = CreateCodeEvaluatorCapability(instructions=MagicMock())
        contexts = self._dataset_evaluators_contexts()
        contexts.code_evaluator = CodeEvaluatorContext(type="code_evaluator", evaluatorNodeId=None)
        deps = AgentDependencies(
            contexts=contexts,
            is_viewer=False,
            sandbox_availability=self._make_availability(has_usable=True),
        )
        ctx = MagicMock()
        ctx.deps = deps
        assert capability.include_for_run(ctx) is False


class TestEditCodeEvaluatorDraftCapabilityViewerGate:
    """``EditCodeEvaluatorDraftCapability.include_for_run`` ANDs
    code_evaluator-context-present + not-viewer. Viewers must not get the
    edit tool either, even when a form is mounted."""

    def test_advertised_for_non_viewer_with_form_mounted(self) -> None:
        from unittest.mock import MagicMock

        from phoenix.server.agents.capabilities.tools.external.edit_code_evaluator_draft import (
            EditCodeEvaluatorDraftCapability,
        )
        from phoenix.server.agents.context import (
            CodeEvaluatorContext,
            ResolvedContexts,
        )
        from phoenix.server.agents.types import AgentDependencies, SandboxAvailability

        capability = EditCodeEvaluatorDraftCapability(instructions=MagicMock())
        contexts = ResolvedContexts()
        contexts.code_evaluator = CodeEvaluatorContext(type="code_evaluator", evaluatorNodeId=None)
        deps = AgentDependencies(
            contexts=contexts,
            is_viewer=False,
            sandbox_availability=SandboxAvailability(),
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
        from phoenix.server.agents.types import AgentDependencies, SandboxAvailability

        capability = EditCodeEvaluatorDraftCapability(instructions=MagicMock())
        contexts = ResolvedContexts()
        contexts.code_evaluator = CodeEvaluatorContext(type="code_evaluator", evaluatorNodeId=None)
        deps = AgentDependencies(
            contexts=contexts,
            is_viewer=True,
            sandbox_availability=SandboxAvailability(),
        )
        ctx = MagicMock()
        ctx.deps = deps
        assert capability.include_for_run(ctx) is False


class TestAvailableSandboxConfigsRendering:
    """The create/edit code-evaluator tool templates render an
    ``<available_sandbox_configs>`` inventory inside ``<sandbox_config>``. The
    block is empty (self-closing) when no configs are present, and dynamic
    values flow through both ``| sanitize`` and ``| e`` so XML-sensitive
    characters (e.g. ``<`` in ``httpx>=0.27,<1``) cannot corrupt the
    surrounding XML-like prompt."""

    def _create_template(self) -> Template:
        return AgentInstructions().create_code_evaluator_tool

    def _edit_template(self) -> Template:
        return AgentInstructions().edit_code_evaluator_draft_tool

    def test_create_template_renders_block_when_configs_present(self) -> None:
        configs = [
            SandboxConfigCapabilities(
                sandbox_config_id="U2FuZGJveENvbmZpZzox",
                name="python-default",
                language="PYTHON",
                internet_access="allow",
                dependencies=["requests"],
                env_var_names=["OPENAI_API_KEY"],
                internet_access_mode="boolean",
                supports_env_vars=True,
                supports_dependencies=True,
            )
        ]
        rendered = self._create_template().render(available_sandbox_configs=configs)
        assert "<available_sandbox_configs>" in rendered
        assert "U2FuZGJveENvbmZpZzox" in rendered
        assert "python-default" in rendered
        assert "OPENAI_API_KEY" in rendered
        assert "requests" in rendered

    def test_create_template_renders_empty_block_when_no_configs(self) -> None:
        rendered = self._create_template().render(available_sandbox_configs=[])
        # The block should be present but empty (self-closing) so the model
        # sees an explicit "nothing available" signal rather than an opening tag.
        assert "<available_sandbox_configs/>" in rendered
        # No opening/closing pair was rendered (only the self-closing variant
        # plus inline guidance references in code spans).
        assert "</available_sandbox_configs>" not in rendered

    def test_edit_template_renders_block_when_configs_present(self) -> None:
        configs = [
            SandboxConfigCapabilities(
                sandbox_config_id="U2FuZGJveENvbmZpZzoy",
                name="ts-default",
                language="TYPESCRIPT",
                internet_access="deny",
                dependencies=[],
                env_var_names=[],
                internet_access_mode="boolean",
                supports_env_vars=True,
                supports_dependencies=True,
            )
        ]
        rendered = self._edit_template().render(available_sandbox_configs=configs)
        assert "<available_sandbox_configs>" in rendered
        assert "U2FuZGJveENvbmZpZzoy" in rendered
        assert "ts-default" in rendered

    def test_edit_template_renders_empty_block_when_no_configs(self) -> None:
        rendered = self._edit_template().render(available_sandbox_configs=[])
        assert "<available_sandbox_configs/>" in rendered

    def test_dependency_with_xml_sensitive_characters_is_escaped(self) -> None:
        # PEP 440 version specifiers use ``<`` (e.g. ``httpx>=0.27,<1``).
        # ``autoescape=False`` is set on the Jinja env, so the template must
        # explicitly pipe dependency strings through both ``| sanitize`` and
        # ``| e`` — otherwise the raw ``<1`` would be parsed as the start of a
        # new tag and the surrounding ``<available_sandbox_configs>`` block
        # would no longer be well-formed XML.
        configs = [
            SandboxConfigCapabilities(
                sandbox_config_id="U2FuZGJveENvbmZpZzox",
                name="python-default",
                language="PYTHON",
                internet_access="allow",
                dependencies=["httpx>=0.27,<1"],
                env_var_names=[],
                internet_access_mode="boolean",
                supports_env_vars=True,
                supports_dependencies=True,
            )
        ]
        for template in (self._create_template(), self._edit_template()):
            rendered = template.render(available_sandbox_configs=configs)
            # The escaped form must appear ...
            assert "httpx&gt;=0.27,&lt;1" in rendered
            # ... and the raw ``<1`` must not.
            assert "<1" not in rendered
            # The block must parse as well-formed XML. Skip past the prose
            # references (in backticks) to the actual block opening tag,
            # which is the only one followed by a newline.
            start = rendered.index("<available_sandbox_configs>\n")
            end = rendered.index("</available_sandbox_configs>") + len(
                "</available_sandbox_configs>"
            )
            ElementTree.fromstring(rendered[start:end])
