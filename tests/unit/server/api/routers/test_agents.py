from __future__ import annotations

import logging
from xml.etree import ElementTree

from jinja2 import Template
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.agents.context import DatasetContext, ResolvedContexts
from phoenix.server.agents.prompts import AgentPrompts
from phoenix.server.agents.types import (
    DatasetExampleSamples,
    SandboxAvailability,
    SandboxConfigCapabilities,
)
from phoenix.server.api.routers.agents import (
    _load_dataset_example_samples,
    _load_sandbox_availability,
)
from phoenix.server.types import DbSessionFactory


class TestLoadSandboxAvailability:
    """``_load_sandbox_availability`` is the one-shot pre-flight the agents
    router runs to populate ``AgentDependencies.sandbox_availability``. The
    code-evaluator authoring prompts read ``has_usable`` from this, and the
    draft-edit prompt template enumerates ``configs`` — so
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

    async def test_filters_configs_for_unavailable_backends_when_backend_inventory_is_supplied(
        self,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            wasm_cfg = models.SandboxConfig(
                backend_type="WASM",
                language="PYTHON",
                name=Identifier("enabled-wasm"),
                description=None,
                config={},
                timeout=30,
                enabled=True,
            )
            e2b_cfg = models.SandboxConfig(
                backend_type="E2B",
                language="PYTHON",
                name=Identifier("enabled-e2b"),
                description=None,
                config={},
                timeout=30,
                enabled=True,
            )
            session.add_all([wasm_cfg, e2b_cfg])
            e2b = await session.get(models.SandboxProvider, "E2B")
            assert e2b is not None
            e2b.enabled = True
            await session.flush()

            availability = await _load_sandbox_availability(
                session,
                available_backend_types=frozenset({"WASM"}),
            )

        assert availability.has_usable is True
        assert {config.name for config in availability.configs} == {"enabled-wasm"}

    async def test_empty_available_backend_inventory_returns_no_sandbox_rows(
        self,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        async with db() as session:
            availability = await _load_sandbox_availability(
                session,
                available_backend_types=frozenset(),
            )

        assert availability.has_usable is False
        assert availability.configs == []

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


class TestLoadDatasetExampleSamples:
    async def test_returns_empty_without_dataset_context(self, db: DbSessionFactory) -> None:
        async with db() as session:
            samples = await _load_dataset_example_samples(session, ResolvedContexts())

        assert samples.has_samples is False
        assert samples.samples == []

    async def test_samples_latest_active_examples_when_version_is_absent(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            dataset = models.Dataset(
                name="sampled dataset",
                description=None,
                metadata_={},
            )
            session.add(dataset)
            await session.flush()

            old_version = models.DatasetVersion(
                dataset_id=dataset.id,
                description="old",
                metadata_={},
            )
            latest_version = models.DatasetVersion(
                dataset_id=dataset.id,
                description="latest",
                metadata_={},
            )
            session.add_all([old_version, latest_version])
            await session.flush()

            old_example = models.DatasetExample(dataset_id=dataset.id, external_id="old")
            session.add(old_example)
            await session.flush()
            session.add(
                models.DatasetExampleRevision(
                    dataset_example_id=old_example.id,
                    dataset_version_id=old_version.id,
                    input={"question": "old"},
                    output={"answer": "old"},
                    metadata_={},
                    revision_kind="CREATE",
                )
            )

            for index in range(4):
                example = models.DatasetExample(
                    dataset_id=dataset.id,
                    external_id=f"active-{index}",
                )
                session.add(example)
                await session.flush()
                session.add(
                    models.DatasetExampleRevision(
                        dataset_example_id=example.id,
                        dataset_version_id=latest_version.id,
                        input={"question": f"q{index}"},
                        output={"tool_calls": [{"name": f"tool_{index}"}]},
                        metadata_={"split": "eval"},
                        revision_kind="CREATE",
                    )
                )

            deleted_example = models.DatasetExample(dataset_id=dataset.id, external_id="deleted")
            session.add(deleted_example)
            await session.flush()
            session.add(
                models.DatasetExampleRevision(
                    dataset_example_id=deleted_example.id,
                    dataset_version_id=latest_version.id,
                    input={"question": "deleted"},
                    output={"answer": "deleted"},
                    metadata_={},
                    revision_kind="DELETE",
                )
            )
            await session.flush()

            contexts = ResolvedContexts(
                dataset=DatasetContext(
                    type="dataset",
                    dataset_node_id=str(
                        GlobalID(type_name=models.Dataset.__name__, node_id=str(dataset.id))
                    ),
                )
            )
            samples = await _load_dataset_example_samples(session, contexts)

        assert samples.has_samples is True
        assert len(samples.samples) == 3
        rendered = "\n".join(
            sample.input_json + sample.output_json + sample.metadata_json
            for sample in samples.samples
        )
        assert "tool_calls" in rendered
        assert "eval" in rendered
        assert "old" not in rendered
        assert "deleted" not in rendered

    async def test_uses_explicit_dataset_version_when_provided(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            dataset = models.Dataset(
                name="explicit version dataset",
                description=None,
                metadata_={},
            )
            session.add(dataset)
            await session.flush()
            old_version = models.DatasetVersion(
                dataset_id=dataset.id,
                description="old",
                metadata_={},
            )
            latest_version = models.DatasetVersion(
                dataset_id=dataset.id,
                description="latest",
                metadata_={},
            )
            session.add_all([old_version, latest_version])
            await session.flush()

            old_example = models.DatasetExample(dataset_id=dataset.id, external_id="old-version")
            latest_example = models.DatasetExample(
                dataset_id=dataset.id,
                external_id="latest-version",
            )
            session.add_all([old_example, latest_example])
            await session.flush()
            session.add_all(
                [
                    models.DatasetExampleRevision(
                        dataset_example_id=old_example.id,
                        dataset_version_id=old_version.id,
                        input={"question": "old-version"},
                        output={"answer": "old-reference"},
                        metadata_={},
                        revision_kind="CREATE",
                    ),
                    models.DatasetExampleRevision(
                        dataset_example_id=latest_example.id,
                        dataset_version_id=latest_version.id,
                        input={"question": "latest-version"},
                        output={"answer": "latest-reference"},
                        metadata_={},
                        revision_kind="CREATE",
                    ),
                ]
            )
            await session.flush()

            contexts = ResolvedContexts(
                dataset=DatasetContext(
                    type="dataset",
                    dataset_node_id=str(
                        GlobalID(type_name=models.Dataset.__name__, node_id=str(dataset.id))
                    ),
                    dataset_version_node_id=str(
                        GlobalID(
                            type_name=models.DatasetVersion.__name__,
                            node_id=str(old_version.id),
                        )
                    ),
                )
            )
            samples = await _load_dataset_example_samples(session, contexts)

        assert len(samples.samples) == 1
        assert "old-version" in samples.samples[0].input_json
        assert "old-reference" in samples.samples[0].output_json
        assert "latest-version" not in samples.samples[0].input_json


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
        )

        deps = AgentDependencies(contexts=ResolvedContexts())
        assert deps.is_viewer is False
        assert isinstance(deps.sandbox_availability, SandboxAvailability)
        assert isinstance(deps.dataset_example_samples, DatasetExampleSamples)
        assert deps.sandbox_availability.has_usable is False
        assert deps.sandbox_availability.configs == []
        assert deps.dataset_example_samples.has_samples is False
        assert deps.dataset_example_samples.samples == []

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
        assert deps_a.dataset_example_samples is not deps_b.dataset_example_samples
        assert deps_a.dataset_example_samples.samples is not deps_b.dataset_example_samples.samples

    def test_explicit_values_override_defaults(self) -> None:
        from phoenix.server.agents.context import ResolvedContexts
        from phoenix.server.agents.types import (
            AgentDependencies,
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


class TestEditCodeEvaluatorDraftCapabilityViewerGate:
    """``EditCodeEvaluatorDraftCapability.include_for_run`` is available to
    non-viewers when a mounted form has a valid draft-edit path."""

    @staticmethod
    def _sandbox_availability() -> SandboxAvailability:
        return SandboxAvailability(
            configs=[
                SandboxConfigCapabilities(
                    sandbox_config_id="U2FuZGJveENvbmZpZzox",
                    name="default-python",
                    language="PYTHON",
                    internet_access="unset",
                )
            ]
        )

    def test_advertised_for_non_viewer_create_form_with_sandbox(self) -> None:
        from unittest.mock import MagicMock

        from phoenix.server.agents.capabilities.tools.external.edit_code_evaluator_draft import (
            EditCodeEvaluatorDraftCapability,
        )
        from phoenix.server.agents.context import (
            CodeEvaluatorContext,
            ResolvedContexts,
        )
        from phoenix.server.agents.types import AgentDependencies

        capability = EditCodeEvaluatorDraftCapability(instructions=MagicMock())
        contexts = ResolvedContexts()
        contexts.code_evaluator = CodeEvaluatorContext(type="code_evaluator", evaluatorNodeId=None)
        deps = AgentDependencies(
            contexts=contexts,
            is_viewer=False,
            sandbox_availability=self._sandbox_availability(),
        )
        ctx = MagicMock()
        ctx.deps = deps
        assert capability.include_for_run(ctx) is True

    def test_hidden_for_non_viewer_create_form_without_sandbox(self) -> None:
        from unittest.mock import MagicMock

        from phoenix.server.agents.capabilities.tools.external.edit_code_evaluator_draft import (
            EditCodeEvaluatorDraftCapability,
        )
        from phoenix.server.agents.context import (
            CodeEvaluatorContext,
            ResolvedContexts,
        )
        from phoenix.server.agents.types import AgentDependencies

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
        assert capability.include_for_run(ctx) is False

    def test_advertised_for_non_viewer_edit_form_without_sandbox(self) -> None:
        from unittest.mock import MagicMock

        from phoenix.server.agents.capabilities.tools.external.edit_code_evaluator_draft import (
            EditCodeEvaluatorDraftCapability,
        )
        from phoenix.server.agents.context import (
            CodeEvaluatorContext,
            ResolvedContexts,
        )
        from phoenix.server.agents.types import AgentDependencies

        capability = EditCodeEvaluatorDraftCapability(instructions=MagicMock())
        contexts = ResolvedContexts()
        contexts.code_evaluator = CodeEvaluatorContext(
            type="code_evaluator",
            evaluatorNodeId="Q29kZUV2YWx1YXRvcjox",
        )
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
        from phoenix.server.agents.types import AgentDependencies

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
    """The code-evaluator draft-edit tool template renders an
    ``<available_sandbox_configs>`` inventory inside ``<sandbox_config>``. The
    block is empty (self-closing) when no configs are present, and dynamic
    values flow through both ``| sanitize`` and ``| e`` so XML-sensitive
    characters (e.g. ``<`` in ``httpx>=0.27,<1``) cannot corrupt the
    surrounding XML-like prompt."""

    def _edit_template(self) -> Template:
        return AgentPrompts().edit_code_evaluator_draft_tool

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

    def test_tool_prompts_prefer_direct_evaluator_arguments(self) -> None:
        edit_rendered = self._edit_template().render(available_sandbox_configs=[])
        assert "`output` is the new experiment run output" in edit_rendered
        assert "dataset example `output` as `reference`" in edit_rendered
        assert "add `reference` for relational checks" in edit_rendered.lower()
        assert "parse nested" in edit_rendered
        assert "sample" in edit_rendered
        assert "examples" in edit_rendered
        assert "message" in edit_rendered
        assert "tool_calls`/`toolCalls" in edit_rendered
        assert "top-level" in edit_rendered
        assert "Keep `inputMapping` at the safe default" in edit_rendered
        assert "leave the sandbox untouched" in edit_rendered
        assert "Do NOT emit `set_sandbox_config`" in edit_rendered

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
        rendered = self._edit_template().render(available_sandbox_configs=configs)
        # The escaped form must appear ...
        assert "httpx&gt;=0.27,&lt;1" in rendered
        # ... and the raw ``<1`` must not.
        assert "<1" not in rendered
        # The block must parse as well-formed XML. Skip past the prose
        # references (in backticks) to the actual block opening tag,
        # which is the only one followed by a newline.
        start = rendered.index("<available_sandbox_configs>\n")
        end = rendered.index("</available_sandbox_configs>") + len("</available_sandbox_configs>")
        ElementTree.fromstring(rendered[start:end])
