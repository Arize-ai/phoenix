from __future__ import annotations

from collections.abc import Iterator
from secrets import token_hex
from typing import Any
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server import sandbox as sandbox_module
from phoenix.server.sandbox.e2b_backend import E2BAdapter
from phoenix.server.sandbox.wasm_backend import WASMAdapter
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_e2b_adapter = E2BAdapter()
_wasm_adapter = WASMAdapter()
_patched_adapters = {**sandbox_module._SANDBOX_ADAPTERS, "E2B": _e2b_adapter}


@pytest.fixture(autouse=True)
def _ensure_wasm_sandbox_adapter() -> Iterator[None]:
    # WASM is omitted from _SANDBOX_ADAPTERS when wasmtime is not installed.
    if "WASM" in sandbox_module._SANDBOX_ADAPTERS:
        yield
        return
    with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"WASM": _wasm_adapter}):
        yield


_CREATE = """
mutation CreateSandboxConfig($input: CreateSandboxConfigInput!) {
    createSandboxConfig(input: $input) {
        sandboxConfig {
            id
            name
            description
            timeout
            enabled
        }
    }
}
"""

_UPDATE = """
mutation UpdateSandboxConfig($input: UpdateSandboxConfigInput!) {
    updateSandboxConfig(input: $input) {
        sandboxConfig {
            id
            name
            description
            timeout
            enabled
        }
    }
}
"""

_DELETE = """
mutation DeleteSandboxConfig($input: DeleteSandboxConfigInput!) {
    deleteSandboxConfig(input: $input) {
        deletedId
    }
}
"""

_UPDATE_PROVIDER = """
mutation UpdateSandboxProvider($input: UpdateSandboxProviderInput!) {
    updateSandboxProvider(input: $input) {
        sandboxProvider {
            id
            enabled
        }
    }
}
"""

_SANDBOX_PROVIDERS = """
query SandboxProviders {
    sandboxProviders {
        id
        backendType
        configs {
            id
            name
        }
    }
}
"""


def _config_global_id(config_id: int) -> str:
    return str(GlobalID("SandboxConfig", str(config_id)))


def _provider_global_id(kind: str) -> str:
    return str(GlobalID("SandboxProvider", kind))


def _create_code_evaluator_input(
    *,
    sandbox_config_id: int,
    name: str | None = None,
    language: str = "PYTHON",
    source_code: str = "def evaluate(output):\n    return {'score': 1.0}",
) -> dict[str, object]:
    return {
        "name": name or f"test_code_evaluator_{token_hex(4)}",
        "description": "uses relay id",
        "language": language,
        "sourceCode": source_code,
        "sandboxConfigId": _config_global_id(sandbox_config_id),
        "inputMapping": {"literalMapping": {}, "pathMapping": {}},
        "outputConfigs": [
            {
                "continuous": {
                    "name": "score",
                    "optimizationDirection": "NONE",
                    "lowerBound": 0,
                    "upperBound": 1,
                }
            }
        ],
    }


_KIND_TO_VARIANT: dict[str, str] = {
    "E2B": "e2b",
    "DAYTONA": "daytona",
    "DENO": "deno",
    "VERCEL": "vercel",
    "WASM": "wasm",
    "MODAL": "modal",
    "MONTY": "monty",
}


def _variant(
    kind: str,
    payload: dict[str, object] | None = None,
    *,
    language: str = "PYTHON",
) -> dict[str, dict[str, object]]:
    base: dict[str, object] = dict(payload) if payload else {}
    base.setdefault("language", language)
    return {_KIND_TO_VARIANT[kind]: base}


class TestCreateSandboxConfig:
    async def test_creates_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "WASM")
            )
        assert provider is not None

        result = await gql_client.execute(
            _CREATE,
            variables={
                "input": {
                    "config": _variant(provider.backend_type),
                    "name": "my-wasm-config",
                    "timeout": 15,
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["createSandboxConfig"]["sandboxConfig"]
        assert cfg["name"] == "my-wasm-config"
        assert cfg["timeout"] == 15
        assert cfg["enabled"] is True


class TestUpdateSandboxConfig:
    async def test_updates_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE,
            variables={
                "input": {
                    "id": _config_global_id(sandbox_config.id),
                    "timeout": 60,
                    "description": "updated description",
                    "enabled": False,
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["updateSandboxConfig"]["sandboxConfig"]
        assert cfg["timeout"] == 60
        assert cfg["description"] == "updated description"
        assert cfg["enabled"] is False

    async def test_update_only_description_leaves_others_unchanged(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE,
            variables={
                "input": {
                    "id": _config_global_id(sandbox_config.id),
                    "description": "new desc",
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["updateSandboxConfig"]["sandboxConfig"]
        assert cfg["description"] == "new desc"
        assert cfg["timeout"] == sandbox_config.timeout
        assert cfg["enabled"] is True

    async def test_update_only_timeout_leaves_others_unchanged(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE,
            variables={
                "input": {
                    "id": _config_global_id(sandbox_config.id),
                    "timeout": 120,
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["updateSandboxConfig"]["sandboxConfig"]
        assert cfg["timeout"] == 120
        assert cfg["description"] == sandbox_config.description

    async def test_update_only_enabled_leaves_others_unchanged(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE,
            variables={
                "input": {
                    "id": _config_global_id(sandbox_config.id),
                    "enabled": False,
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["updateSandboxConfig"]["sandboxConfig"]
        assert cfg["enabled"] is False
        assert cfg["timeout"] == sandbox_config.timeout
        assert cfg["description"] == sandbox_config.description

    async def test_update_no_fields_is_noop(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE,
            variables={
                "input": {
                    "id": _config_global_id(sandbox_config.id),
                }
            },
        )
        assert result.data and not result.errors
        cfg = result.data["updateSandboxConfig"]["sandboxConfig"]
        assert cfg["timeout"] == sandbox_config.timeout
        assert cfg["description"] == sandbox_config.description
        assert cfg["enabled"] is True

    async def test_update_not_found_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE,
            variables={"input": {"id": _config_global_id(99999), "timeout": 5}},
        )
        assert result.errors


class TestDeleteSandboxConfig:
    async def test_deletes_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        config_id = sandbox_config.id
        config_gid = _config_global_id(config_id)

        result = await gql_client.execute(_DELETE, variables={"input": {"id": config_gid}})
        assert result.data and not result.errors
        assert result.data["deleteSandboxConfig"]["deletedId"] == config_gid

        async with db() as session:
            row = await session.get(models.SandboxConfig, config_id)
        assert row is None

    async def test_delete_missing_is_idempotent(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _DELETE, variables={"input": {"id": _config_global_id(99999)}}
        )
        assert not result.errors

    async def test_delete_seeded_default_is_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        # Seed real defaults, then confirm one cannot be deleted via the API: the
        # seeder owns it and would recreate it, so deletion is refused.
        from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA
        from phoenix.server.sandbox.sync import sync_sandbox_default_configs

        async with db() as session:
            await sync_sandbox_default_configs(session, SANDBOX_ADAPTER_METADATA)

        async with db() as session:
            row = await session.scalar(select(models.SandboxConfig))
        if row is None:
            pytest.skip("No auto-seedable adapter is present in the live registry")
        row_id = row.id

        result = await gql_client.execute(
            _DELETE, variables={"input": {"id": _config_global_id(row_id)}}
        )
        assert result.errors, "deleting a built-in default should be rejected"
        assert "cannot" in str(result.errors).lower()

        async with db() as session:
            assert await session.get(models.SandboxConfig, row_id) is not None


class TestUpdateSandboxProvider:
    async def test_updates_provider_enabled(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={
                "input": {
                    "id": _provider_global_id(provider.backend_type),
                    "enabled": False,
                }
            },
        )
        assert result.data and not result.errors
        sandbox_provider = result.data["updateSandboxProvider"]["sandboxProvider"]
        assert sandbox_provider["enabled"] is False

    async def test_update_provider_no_fields_is_noop(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "WASM")
            )
        assert provider is not None
        original_enabled = provider.enabled

        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={
                "input": {
                    "id": _provider_global_id(provider.backend_type),
                }
            },
        )
        assert result.data and not result.errors
        sp = result.data["updateSandboxProvider"]["sandboxProvider"]
        assert sp["enabled"] is original_enabled

    async def test_update_provider_not_found_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={"input": {"id": _provider_global_id("__no_such__"), "enabled": True}},
        )
        assert result.errors


_EVALUATOR_PREVIEWS = """
mutation EvaluatorPreviews($input: EvaluatorPreviewsInput!) {
    evaluatorPreviews(input: $input) {
        results {
            evaluatorName
            error
        }
    }
}
"""

_CREATE_CODE_EVALUATOR = """
mutation CreateCodeEvaluator($input: CreateCodeEvaluatorInput!) {
    createCodeEvaluator(input: $input) {
        evaluator {
            id
            ... on CodeEvaluator {
                currentVersion {
                    id
                }
            }
        }
    }
}
"""

_PATCH_CODE_EVALUATOR = """
mutation PatchCodeEvaluator($input: PatchCodeEvaluatorInput!) {
    patchCodeEvaluator(input: $input) {
        evaluator {
            id
            ... on CodeEvaluator {
                name
                description
                sandboxConfig {
                    id
                }
            }
        }
    }
}
"""

_CREATE_CODE_EVALUATOR_VERSION = """
mutation CreateCodeEvaluatorVersion($input: CreateCodeEvaluatorVersionInput!) {
    createCodeEvaluatorVersion(input: $input) {
        wasCreated
        evaluator {
            id
            ... on CodeEvaluator {
                currentVersion {
                    id
                    sourceCode
                }
            }
        }
    }
}
"""


async def _create_code_evaluator_with_config(
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> int:
    async with db() as session:
        provider = await session.get(models.SandboxProvider, sandbox_config.backend_type)
        assert provider is not None
        code_eval = models.CodeEvaluator(
            name=Identifier(root="test-disabled-guard-eval"),
            description=None,
            metadata_={},
            language=sandbox_config.language,
            sandbox_config_id=sandbox_config.id,
        )
        session.add(code_eval)
        await session.flush()
        version = models.CodeEvaluatorVersion(
            code_evaluator_id=code_eval.id,
            source_code="def evaluate(input): return {'score': 1.0}",
        )
        session.add(version)
        await session.flush()
        return code_eval.id


async def _create_monty_config(db: DbSessionFactory) -> models.SandboxConfig:
    async with db() as session:
        provider = await session.get(models.SandboxProvider, "MONTY")
        assert provider is not None
        config = models.SandboxConfig(
            backend_type="MONTY",
            language="PYTHON",
            name=Identifier(f"monty-{token_hex(4)}"),
            description=None,
            config={"backend_type": "MONTY", "language": "PYTHON"},
            timeout=45,
        )
        session.add(config)
        await session.flush()
        return config


async def _create_code_evaluator_with_two_versions(
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> tuple[int, int, int]:
    async with db() as session:
        provider = await session.get(models.SandboxProvider, sandbox_config.backend_type)
        assert provider is not None
        code_eval = models.CodeEvaluator(
            name=Identifier(root=f"test-history-eval-{token_hex(4)}"),
            description=None,
            metadata_={},
            language=sandbox_config.language,
            sandbox_config_id=sandbox_config.id,
        )
        session.add(code_eval)
        await session.flush()
        common_kwargs: dict[str, Any] = dict(
            code_evaluator_id=code_eval.id,
        )
        first_version = models.CodeEvaluatorVersion(
            source_code="def evaluate(input): return {'score': 0.0}",
            **common_kwargs,
        )
        second_version = models.CodeEvaluatorVersion(
            source_code="def evaluate(input): return {'score': 1.0}",
            **common_kwargs,
        )
        session.add_all([first_version, second_version])
        await session.flush()
        return code_eval.id, first_version.id, second_version.id


class TestDisabledProviderAndConfigGuards:
    async def test_disabled_provider_blocks_execution(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        evaluator_db_id = await _create_code_evaluator_with_config(db, sandbox_config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))

        async with db() as session:
            provider = await session.get(models.SandboxProvider, sandbox_config.backend_type)
        assert provider is not None
        result = await gql_client.execute(
            _UPDATE_PROVIDER,
            variables={
                "input": {
                    "id": _provider_global_id(provider.backend_type),
                    "enabled": False,
                }
            },
        )
        assert result.data and not result.errors

        result = await gql_client.execute(
            _EVALUATOR_PREVIEWS,
            variables={
                "input": {
                    "previews": [
                        {
                            "evaluator": {"codeEvaluatorId": evaluator_gid},
                            "context": {"output": "test"},
                            "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                        }
                    ]
                }
            },
        )
        assert result.errors
        assert (
            "Sandbox provider 'WASM' is disabled. Enable it before testing this evaluator."
            in str(result.errors)
        )


class TestCodeEvaluatorSandboxMutationIds:
    async def test_create_rejects_code_unsupported_by_selected_sandbox_before_write(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        config = await _create_monty_config(db)
        evaluator_name = f"invalid-monty-{token_hex(4)}"

        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR,
            variables={
                "input": _create_code_evaluator_input(
                    sandbox_config_id=config.id,
                    name=evaluator_name,
                    source_code=(
                        "import definitely_missing\n"
                        "def evaluate(output):\n"
                        "    return {'score': 1.0}"
                    ),
                )
            },
        )

        assert result.errors
        assert "not supported by the Monty runtime" in str(result.errors)
        async with db() as session:
            assert (
                await session.scalar(
                    select(models.CodeEvaluator).where(
                        models.CodeEvaluator.name == Identifier(evaluator_name)
                    )
                )
                is None
            )

    async def test_version_rejects_code_unsupported_by_bound_sandbox_before_write(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        config = await _create_monty_config(db)
        evaluator_id = await _create_code_evaluator_with_config(db, config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_id)))

        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR_VERSION,
            variables={
                "input": {
                    "codeEvaluatorId": evaluator_gid,
                    "sourceCode": (
                        "import definitely_missing\n"
                        "def evaluate(output):\n"
                        "    return {'score': 1.0}"
                    ),
                }
            },
        )

        assert result.errors
        assert "not supported by the Monty runtime" in str(result.errors)
        async with db() as session:
            version_count = await session.scalar(
                select(sa.func.count(models.CodeEvaluatorVersion.id)).where(
                    models.CodeEvaluatorVersion.code_evaluator_id == evaluator_id
                )
            )
        assert version_count == 1

    async def test_rebinding_rejects_existing_code_unsupported_by_target_sandbox(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
        seed_sandbox_providers: None,
    ) -> None:
        monty_config = await _create_monty_config(db)
        evaluator_id = await _create_code_evaluator_with_config(db, sandbox_config)
        async with db() as session:
            version = await session.scalar(
                select(models.CodeEvaluatorVersion)
                .where(models.CodeEvaluatorVersion.code_evaluator_id == evaluator_id)
                .order_by(models.CodeEvaluatorVersion.id.desc())
            )
            assert version is not None
            version.source_code = (
                "import definitely_missing\ndef evaluate(input):\n    return {'score': 1.0}"
            )

        result = await gql_client.execute(
            _PATCH_CODE_EVALUATOR,
            variables={
                "input": {
                    "id": str(GlobalID("CodeEvaluator", str(evaluator_id))),
                    "sandboxConfigId": _config_global_id(monty_config.id),
                }
            },
        )

        assert result.errors
        assert "not supported by the Monty runtime" in str(result.errors)
        async with db() as session:
            evaluator = await session.get(models.CodeEvaluator, evaluator_id)
        assert evaluator is not None
        assert evaluator.sandbox_config_id == sandbox_config.id

    async def test_create_code_evaluator_accepts_sandbox_global_id(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR,
            variables={
                "input": _create_code_evaluator_input(
                    sandbox_config_id=sandbox_config.id,
                    name="test_code_evaluator",
                )
            },
        )
        assert result.data and not result.errors
        evaluator = result.data["createCodeEvaluator"]["evaluator"]
        assert evaluator["currentVersion"]["id"]

        evaluator_id = GlobalID.from_id(evaluator["id"])
        async with db() as session:
            row = await session.get(models.CodeEvaluator, int(evaluator_id.node_id))
        assert row is not None
        assert row.sandbox_config_id == sandbox_config.id

    async def test_create_code_evaluator_rejects_disabled_sandbox_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        async with db() as session:
            row = await session.get(models.SandboxConfig, sandbox_config.id)
            assert row is not None
            row.enabled = False
            await session.commit()

        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR,
            variables={"input": _create_code_evaluator_input(sandbox_config_id=sandbox_config.id)},
        )

        assert result.errors
        assert "Sandbox configuration" in str(result.errors)
        assert "is disabled" in str(result.errors)

    async def test_create_code_evaluator_rejects_disabled_sandbox_provider(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        async with db() as session:
            provider = await session.get(models.SandboxProvider, sandbox_config.backend_type)
            assert provider is not None
            provider.enabled = False
            await session.commit()

        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR,
            variables={"input": _create_code_evaluator_input(sandbox_config_id=sandbox_config.id)},
        )

        assert result.errors
        assert "Sandbox provider" in str(result.errors)
        assert "is disabled" in str(result.errors)

    async def test_create_code_evaluator_version_appends_when_code_changes(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        async with db() as session:
            code_eval = models.CodeEvaluator(
                name=Identifier(root="test_update_code_evaluator"),
                description=None,
                metadata_={},
                language="PYTHON",
                sandbox_config_id=sandbox_config.id,
            )
            session.add(code_eval)
            await session.flush()
            seed = models.CodeEvaluatorVersion(
                code_evaluator_id=code_eval.id,
                source_code="def evaluate(output): return {'score': 0.0}",
            )
            session.add(seed)
            await session.flush()
            evaluator_gid = str(GlobalID("CodeEvaluator", str(code_eval.id)))

        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR_VERSION,
            variables={
                "input": {
                    "codeEvaluatorId": evaluator_gid,
                    "sourceCode": "def evaluate(output): return {'score': 1.0}",
                }
            },
        )
        assert result.data and not result.errors
        payload = result.data["createCodeEvaluatorVersion"]
        assert payload["wasCreated"] is True
        assert (
            payload["evaluator"]["currentVersion"]["sourceCode"]
            == "def evaluate(output): return {'score': 1.0}"
        )

        async with db() as session:
            row = await session.get(models.CodeEvaluator, code_eval.id)
        assert row is not None
        assert row.sandbox_config_id == sandbox_config.id

    async def test_create_code_evaluator_version_dedups_identical_content(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        evaluator_db_id, _, current_version_id = await _create_code_evaluator_with_two_versions(
            db, sandbox_config
        )
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))

        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR_VERSION,
            variables={
                "input": {
                    "codeEvaluatorId": evaluator_gid,
                    "sourceCode": "def evaluate(input): return {'score': 1.0}",
                }
            },
        )

        assert result.data and not result.errors
        payload = result.data["createCodeEvaluatorVersion"]
        assert payload["wasCreated"] is False
        current_version = payload["evaluator"]["currentVersion"]
        assert current_version["id"] == str(
            GlobalID("CodeEvaluatorVersion", str(current_version_id))
        )
        async with db() as session:
            version_count = await session.scalar(
                select(sa.func.count(models.CodeEvaluatorVersion.id)).where(
                    models.CodeEvaluatorVersion.code_evaluator_id == evaluator_db_id
                )
            )
        assert version_count == 2

    async def test_create_code_evaluator_version_rejects_uninferable_source(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        evaluator_db_id, _, _ = await _create_code_evaluator_with_two_versions(db, sandbox_config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))

        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR_VERSION,
            variables={
                "input": {
                    "codeEvaluatorId": evaluator_gid,
                    "sourceCode": "def not_evaluate(input): return {'score': 1.0}",
                }
            },
        )

        assert result.errors
        assert "evaluate" in str(result.errors)

    async def test_patch_code_evaluator_rejects_disallowed_input_fields(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        evaluator_db_id = await _create_code_evaluator_with_config(db, sandbox_config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))

        result = await gql_client.execute(
            _PATCH_CODE_EVALUATOR,
            variables={
                "input": {
                    "id": evaluator_gid,
                    "sourceCode": "def evaluate(input): return {'score': 0.0}",
                    "language": "PYTHON",
                }
            },
        )

        assert result.errors
        assert result.data is None

    async def test_patch_code_evaluator_updates_sandbox_binding(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            python_provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "WASM")
            )
            assert python_provider is not None
            sandbox_config_b = models.SandboxConfig(
                backend_type=python_provider.backend_type,
                language="PYTHON",
                name=Identifier(f"sandbox-b-{token_hex(4)}"),
                description=None,
                config={},
                timeout=45,
            )
            session.add(sandbox_config_b)
            await session.flush()
            sandbox_config_b_id = sandbox_config_b.id

        evaluator_db_id = await _create_code_evaluator_with_config(db, sandbox_config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))
        sandbox_b_gid = str(GlobalID("SandboxConfig", str(sandbox_config_b_id)))

        patch_result = await gql_client.execute(
            _PATCH_CODE_EVALUATOR,
            variables={
                "input": {
                    "id": evaluator_gid,
                    "sandboxConfigId": sandbox_b_gid,
                }
            },
        )
        assert patch_result.data and not patch_result.errors, patch_result.errors
        patched = patch_result.data["patchCodeEvaluator"]["evaluator"]
        assert patched["sandboxConfig"]["id"] == sandbox_b_gid

        async with db() as session:
            row = await session.get(models.CodeEvaluator, evaluator_db_id)
        assert row is not None
        assert row.sandbox_config_id == sandbox_config_b_id

    async def test_patch_code_evaluator_rejects_disabled_sandbox_binding(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.get(models.SandboxProvider, "WASM")
            assert provider is not None
            disabled_config = models.SandboxConfig(
                backend_type=provider.backend_type,
                language="PYTHON",
                name=Identifier(f"disabled-sandbox-{token_hex(4)}"),
                description=None,
                config={},
                timeout=45,
                enabled=False,
            )
            session.add(disabled_config)
            await session.flush()
            disabled_config_id = disabled_config.id

        evaluator_db_id = await _create_code_evaluator_with_config(db, sandbox_config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))
        disabled_config_gid = str(GlobalID("SandboxConfig", str(disabled_config_id)))

        patch_result = await gql_client.execute(
            _PATCH_CODE_EVALUATOR,
            variables={
                "input": {
                    "id": evaluator_gid,
                    "sandboxConfigId": disabled_config_gid,
                }
            },
        )
        assert patch_result.errors
        assert "Sandbox configuration" in str(patch_result.errors)
        assert "is disabled" in str(patch_result.errors)

        async with db() as session:
            row = await session.get(models.CodeEvaluator, evaluator_db_id)
        assert row is not None
        assert row.sandbox_config_id == sandbox_config.id

    async def test_disabled_config_blocks_execution(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        evaluator_db_id = await _create_code_evaluator_with_config(db, sandbox_config)
        evaluator_gid = str(GlobalID("CodeEvaluator", str(evaluator_db_id)))

        result = await gql_client.execute(
            _UPDATE,
            variables={"input": {"id": _config_global_id(sandbox_config.id), "enabled": False}},
        )
        assert result.data and not result.errors
        assert result.data["updateSandboxConfig"]["sandboxConfig"]["enabled"] is False

        result = await gql_client.execute(
            _EVALUATOR_PREVIEWS,
            variables={
                "input": {
                    "previews": [
                        {
                            "evaluator": {"codeEvaluatorId": evaluator_gid},
                            "context": {"output": "test"},
                            "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                        }
                    ]
                }
            },
        )
        assert result.errors
        assert (
            f"Sandbox configuration '{sandbox_config.name}' is disabled. "
            "Enable it before testing this evaluator."
        ) in str(result.errors)


class TestCrossProviderIsolation:
    async def test_configs_isolated_per_provider(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            wasm = await session.get(models.SandboxProvider, "WASM")
            e2b = await session.get(models.SandboxProvider, "E2B")
        assert wasm is not None
        assert e2b is not None

        wasm_names = ["wasm-cfg-1", "wasm-cfg-2"]
        e2b_names = ["e2b-cfg-1"]
        for name in wasm_names:
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "config": _variant(wasm.backend_type),
                        "name": name,
                    }
                },
            )
            assert result.data and not result.errors
        for name in e2b_names:
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "config": _variant(e2b.backend_type),
                        "name": name,
                    }
                },
            )
            assert result.data and not result.errors

        result = await gql_client.execute(_SANDBOX_PROVIDERS)
        assert result.data and not result.errors
        providers = {p["id"]: p for p in result.data["sandboxProviders"]}

        wasm_config_names = [
            c["name"] for c in providers[_provider_global_id(wasm.backend_type)]["configs"]
        ]
        e2b_config_names = [
            c["name"] for c in providers[_provider_global_id(e2b.backend_type)]["configs"]
        ]

        # Each provider exposes the configs created against it (alongside any
        # auto-seeded default configs), and config names never leak across providers.
        assert set(wasm_names) <= set(wasm_config_names)
        assert set(e2b_names) <= set(e2b_config_names)
        assert not set(wasm_config_names) & set(e2b_config_names)


class TestConfigValidationPath:
    async def test_create_valid_e2b_config_succeeds(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "config": _variant(
                            provider.backend_type,
                            {"envVars": [{"name": "FOO", "secretKey": "foo-secret"}]},
                        ),
                        "name": "e2b-valid",
                    }
                },
            )
        assert result.data and not result.errors

    async def test_create_rejects_unknown_keys(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "config": _variant(provider.backend_type, {"custom_key": "preserved"}),
                        "name": "e2b-extra-keys",
                    }
                },
            )
        assert result.errors

    async def test_update_valid_config_succeeds(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None
        async with db() as session:
            config = models.SandboxConfig(
                backend_type=provider.backend_type,
                language="PYTHON",
                name=Identifier("e2b-update-test"),
                config={},
                timeout=30,
            )
            session.add(config)
            await session.flush()
            config_id = config.id

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config_id),
                        "config": _variant(
                            "E2B",
                            {"envVars": [{"name": "FOO", "secretKey": "foo-secret"}]},
                        ),
                    }
                },
            )
        assert result.data and not result.errors

    async def test_update_config_persists_validated_dict(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None
        async with db() as session:
            config = models.SandboxConfig(
                backend_type=provider.backend_type,
                language="PYTHON",
                name=Identifier("e2b-persist-test"),
                config={},
                timeout=30,
            )
            session.add(config)
            await session.flush()
            config_id = config.id

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _UPDATE,
                variables={
                    "input": {
                        "id": _config_global_id(config_id),
                        "config": _variant(
                            "E2B",
                            {"envVars": [{"name": "FOO", "secretKey": "foo-secret"}]},
                        ),
                    }
                },
            )
        assert result.data and not result.errors

        async with db() as session:
            row = await session.get(models.SandboxConfig, config_id)
        assert row is not None
        assert row.config.get("env_vars") == {"FOO": {"secret_key": "foo-secret"}}

    async def test_create_env_var_round_trip(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_sandbox_providers: None,
    ) -> None:
        async with db() as session:
            provider = await session.scalar(
                select(models.SandboxProvider).where(models.SandboxProvider.backend_type == "E2B")
            )
        assert provider is not None

        with patch.dict(sandbox_module._SANDBOX_ADAPTERS, {"E2B": _e2b_adapter}):
            result = await gql_client.execute(
                _CREATE,
                variables={
                    "input": {
                        "config": _variant(
                            provider.backend_type,
                            {"envVars": [{"name": "FOO", "secretKey": "foo-secret"}]},
                        ),
                        "name": "e2b-env-vars",
                    }
                },
            )
        assert result.data and not result.errors
        cfg_id = result.data["createSandboxConfig"]["sandboxConfig"]["id"]

        async with db() as session:
            from strawberry.relay import GlobalID as GID

            row_id = int(GID.from_id(cfg_id).node_id)
            row = await session.get(models.SandboxConfig, row_id)
        assert row is not None
        env_vars = row.config.get("env_vars")
        assert env_vars == {"FOO": {"secret_key": "foo-secret"}}


_CREATE_CODE_EVALUATOR_WITH_OUTPUT_CONFIGS = """
mutation CreateCodeEvaluator($input: CreateCodeEvaluatorInput!) {
    createCodeEvaluator(input: $input) {
        evaluator {
            id
            ... on CodeEvaluator {
                outputConfigs {
                    __typename
                    ... on FreeformAnnotationConfig {
                        name
                        optimizationDirection
                        threshold
                    }
                }
            }
        }
    }
}
"""


class TestFreeformOutputConfigRoundTrip:
    async def test_create_with_freeform_threshold_round_trips(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR_WITH_OUTPUT_CONFIGS,
            variables={
                "input": {
                    "name": "freeform-with-threshold",
                    "language": "PYTHON",
                    "sourceCode": "def evaluate(output):\n    return {'score': 0.8}",
                    "sandboxConfigId": _config_global_id(sandbox_config.id),
                    "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                    "outputConfigs": [
                        {
                            "freeform": {
                                "name": "result",
                                "optimizationDirection": "MAXIMIZE",
                                "threshold": 0.7,
                            }
                        }
                    ],
                }
            },
        )
        assert result.data and not result.errors, result.errors
        cfg = result.data["createCodeEvaluator"]["evaluator"]["outputConfigs"][0]
        assert cfg["__typename"] == "FreeformAnnotationConfig"
        assert cfg["name"] == "result"
        assert cfg["optimizationDirection"] == "MAXIMIZE"
        assert cfg["threshold"] == 0.7

    async def test_create_with_freeform_no_threshold_round_trips_null(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR_WITH_OUTPUT_CONFIGS,
            variables={
                "input": {
                    "name": "freeform-no-threshold",
                    "language": "PYTHON",
                    "sourceCode": "def evaluate(output):\n    return {'score': 0.5}",
                    "sandboxConfigId": _config_global_id(sandbox_config.id),
                    "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                    "outputConfigs": [
                        {
                            "freeform": {
                                "name": "result",
                                "optimizationDirection": "MAXIMIZE",
                            }
                        }
                    ],
                }
            },
        )
        assert result.data and not result.errors, result.errors
        cfg = result.data["createCodeEvaluator"]["evaluator"]["outputConfigs"][0]
        assert cfg["__typename"] == "FreeformAnnotationConfig"
        assert cfg["threshold"] is None


class TestCreateCodeEvaluatorSandboxStrictness:
    """`CreateCodeEvaluatorInput.sandbox_config_id` is required (no Optional)
    at the schema layer, and the resolver mirrors `patch_code_evaluator`'s
    language-match check + raises BadRequest when the target row is missing.
    """

    async def test_missing_sandbox_config_id_fails_at_schema_layer(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        # Omitting `sandboxConfigId` is now a schema-level violation; GraphQL
        # rejects before the resolver runs. No language seeding needed because
        # validation fails before any row lookup.
        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR,
            variables={
                "input": {
                    "name": "missing-sandbox",
                    "language": "PYTHON",
                    "sourceCode": "def evaluate(output):\n    return {'score': 1.0}",
                    "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                }
            },
        )
        # Schema-level rejection: Strawberry raises
        # `Field 'sandboxConfigId' of required type 'ID!' was not provided.`
        # before the resolver runs. The test client sanitizes the surface
        # message to "an unexpected error occurred" but the presence of
        # errors with data=None proves the schema-layer gate fired.
        assert result.errors, "Expected schema-level error when sandboxConfigId is omitted"
        assert result.data is None

    async def test_language_mismatch_returns_bad_request_verbatim(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        # The fixture sandbox_config is language=PYTHON; pass TYPESCRIPT to
        # trigger the new mirror of patch's language-match check.
        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR,
            variables={
                "input": {
                    "name": "lang-mismatch",
                    "language": "TYPESCRIPT",
                    "sourceCode": ("function evaluate({ output }) { return { score: 1.0 }; }"),
                    "sandboxConfigId": _config_global_id(sandbox_config.id),
                    "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                }
            },
        )
        assert result.errors, "Expected BadRequest on language mismatch"
        joined = "\n".join(err.message for err in result.errors)
        assert "Evaluator language does not match sandbox config language" in joined

    async def test_missing_sandbox_config_row_returns_bad_request_with_id(
        self,
        gql_client: AsyncGraphQLClient,
        seed_sandbox_providers: None,
    ) -> None:
        # Reference an id that no row exists for; the resolver raises
        # BadRequest("Sandbox config not found: <id>") — stricter than patch's
        # silent no-op, matching evaluators.py:853 runtime semantics.
        absent_id = str(GlobalID("SandboxConfig", "999999"))
        result = await gql_client.execute(
            _CREATE_CODE_EVALUATOR,
            variables={
                "input": {
                    "name": "missing-sandbox-row",
                    "language": "PYTHON",
                    "sourceCode": "def evaluate(output):\n    return {'score': 1.0}",
                    "sandboxConfigId": absent_id,
                    "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                }
            },
        )
        assert result.errors, "Expected BadRequest when sandbox config row is missing"
        joined = "\n".join(err.message for err in result.errors)
        assert "Sandbox config not found" in joined
