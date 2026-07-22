from secrets import token_hex
from typing import Any

from sqlalchemy import func, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_PROJECT_EVALUATOR_FIELDS = """
id
name
filterCondition
samplingRate
evaluationTarget
enabled
inputMapping { literalMapping pathMapping }
evaluator {
  id
  kind
  name
  ... on CodeEvaluator { currentVersion { sourceCode } }
  ... on LLMEvaluator { promptVersion { id } }
}
"""

_CREATE_CODE = f"""
mutation($input: CreateProjectCodeEvaluatorInput!) {{
  createProjectCodeEvaluator(input: $input) {{
    evaluator {{ {_PROJECT_EVALUATOR_FIELDS} }}
  }}
}}
"""

_ADD_CODE = f"""
mutation($input: AddProjectCodeEvaluatorInput!) {{
  addProjectCodeEvaluator(input: $input) {{
    evaluator {{ {_PROJECT_EVALUATOR_FIELDS} }}
  }}
}}
"""

_UPDATE_CODE = f"""
mutation($input: UpdateProjectCodeEvaluatorInput!) {{
  updateProjectCodeEvaluator(input: $input) {{
    evaluator {{ {_PROJECT_EVALUATOR_FIELDS} }}
  }}
}}
"""

_CREATE_LLM = f"""
mutation($input: CreateProjectLLMEvaluatorInput!) {{
  createProjectLlmEvaluator(input: $input) {{
    evaluator {{ {_PROJECT_EVALUATOR_FIELDS} }}
  }}
}}
"""

_UPDATE_LLM = f"""
mutation($input: UpdateProjectLLMEvaluatorInput!) {{
  updateProjectLlmEvaluator(input: $input) {{
    evaluator {{ {_PROJECT_EVALUATOR_FIELDS} }}
  }}
}}
"""

_DELETE = """
mutation($input: DeleteProjectEvaluatorsInput!) {
  deleteProjectEvaluators(input: $input) {
    projectEvaluatorIds
  }
}
"""

_PROJECT_EVALUATORS = f"""
query($id: ID!) {{
  node(id: $id) {{
    ... on Project {{
      name
      evaluators {{ edges {{ node {{ {_PROJECT_EVALUATOR_FIELDS} }} }} }}
    }}
  }}
}}
"""

_PROJECT_EVALUATOR_NODE = f"""
query($id: ID!) {{
  node(id: $id) {{
    ... on ProjectEvaluator {{ {_PROJECT_EVALUATOR_FIELDS} }}
  }}
}}
"""


async def _add_project(db: DbSessionFactory) -> models.Project:
    async with db() as session:
        project = models.Project(name=f"project-{token_hex(4)}")
        session.add(project)
        await session.flush()
        project_id = project.id
    async with db() as session:
        loaded_project = await session.get(models.Project, project_id)
        assert loaded_project is not None
        return loaded_project


def _mapping(**literal_mapping: Any) -> dict[str, Any]:
    return {"literalMapping": literal_mapping, "pathMapping": {}}


def _code_create_input(
    project: models.Project,
    sandbox_config: models.SandboxConfig,
    *,
    filter_condition: str = "",
) -> dict[str, Any]:
    return {
        "projectId": str(GlobalID("Project", str(project.id))),
        "name": f"code-{token_hex(4)}",
        "sourceCode": "def evaluate(output):\n    return {'score': 1.0}",
        "language": "PYTHON",
        "sandboxConfigId": str(GlobalID("SandboxConfig", str(sandbox_config.id))),
        "evaluatorInputMapping": _mapping(output="value"),
        "samplingRate": 0.5,
        "evaluationTarget": "SPAN",
        "inputMapping": None,
        "filterCondition": filter_condition,
        "enabled": True,
    }


def _code_add_input(
    project: models.Project,
    evaluator_id: str,
    *,
    name: str = "attached-code",
) -> dict[str, Any]:
    return {
        "projectId": str(GlobalID("Project", str(project.id))),
        "evaluatorId": evaluator_id,
        "name": name,
        "samplingRate": 0.25,
        "evaluationTarget": "SESSION",
        "inputMapping": _mapping(context="override"),
        "filterCondition": "span_kind == 'LLM'",
        "enabled": False,
    }


def _prompt_version(text: str) -> dict[str, Any]:
    return {
        "description": "prompt version",
        "templateFormat": "MUSTACHE",
        "template": {"messages": [{"role": "USER", "content": [{"text": {"text": text}}]}]},
        "invocationParameters": {"openai": {"temperature": 0.0}},
        "tools": {
            "tools": [
                {
                    "function": {
                        "name": "correctness",
                        "description": "correctness",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "label": {
                                    "type": "string",
                                    "description": "correctness",
                                    "enum": ["correct", "incorrect"],
                                }
                            },
                            "required": ["label"],
                        },
                    }
                }
            ],
            "toolChoice": {"functionName": "correctness"},
        },
        "modelProvider": "OPENAI",
        "modelName": "gpt-4",
    }


def _llm_input(project: models.Project, *, name: str, text: str) -> dict[str, Any]:
    return {
        "projectId": str(GlobalID("Project", str(project.id))),
        "name": name,
        "promptVersion": _prompt_version(text),
        "outputConfigs": [
            {
                "categorical": {
                    "name": "correctness",
                    "optimizationDirection": "MAXIMIZE",
                    "values": [
                        {"label": "correct", "score": 1},
                        {"label": "incorrect", "score": 0},
                    ],
                }
            }
        ],
        "inputMapping": _mapping(input="value"),
        "samplingRate": 1.0,
        "evaluationTarget": "TRACE",
        "filterCondition": "",
        "enabled": True,
    }


async def test_project_code_evaluator_crud_and_connection(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    project = await _add_project(db)
    create_result = await gql_client.execute(
        _CREATE_CODE,
        {"input": _code_create_input(project, sandbox_config)},
    )
    assert create_result.data and not create_result.errors
    created = create_result.data["createProjectCodeEvaluator"]["evaluator"]
    assert created["evaluationTarget"] == "SPAN"
    assert created["inputMapping"] == _mapping(output="value")
    assert created["evaluator"]["kind"] == "CODE"

    project_result = await gql_client.execute(
        _PROJECT_EVALUATORS,
        {"id": str(GlobalID("Project", str(project.id)))},
    )
    assert project_result.data and not project_result.errors
    nodes = [edge["node"] for edge in project_result.data["node"]["evaluators"]["edges"]]
    assert [node["id"] for node in nodes] == [created["id"]]

    update_result = await gql_client.execute(
        _UPDATE_CODE,
        {
            "input": {
                "projectEvaluatorId": created["id"],
                "name": "updated-code",
                "description": "updated",
                "sourceCode": "def evaluate(output):\n    return {'score': 0.5}",
                "evaluatorInputMapping": _mapping(output="updated"),
                "inputMapping": _mapping(context="override"),
                "samplingRate": 0.25,
                "evaluationTarget": "SESSION",
                "filterCondition": "span_kind == 'LLM'",
                "enabled": False,
            }
        },
    )
    assert update_result.data and not update_result.errors
    updated = update_result.data["updateProjectCodeEvaluator"]["evaluator"]
    assert updated["name"] == "updated-code"
    assert updated["evaluationTarget"] == "SESSION"
    assert updated["inputMapping"] == _mapping(context="override")
    assert updated["evaluator"]["name"] == "updated-code"

    criteria_id = int(GlobalID.from_id(created["id"]).node_id)
    async with db() as session:
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        assert criteria.input_mapping is not None
        assert criteria.input_mapping.literal_mapping == {"context": "override"}

    omitted_result = await gql_client.execute(
        _UPDATE_CODE,
        {
            "input": {
                "projectEvaluatorId": created["id"],
                "name": "updated-code",
                "description": "updated again",
                "evaluatorInputMapping": _mapping(output="changed-while-omitted"),
                "samplingRate": 0.75,
                "evaluationTarget": "TRACE",
                "filterCondition": "",
                "enabled": True,
            }
        },
    )
    assert omitted_result.data and not omitted_result.errors
    omitted = omitted_result.data["updateProjectCodeEvaluator"]["evaluator"]
    assert omitted["inputMapping"] == _mapping(context="override")
    async with db() as session:
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        assert criteria.input_mapping is not None
        assert criteria.input_mapping.literal_mapping == {"context": "override"}

    inherited_result = await gql_client.execute(
        _UPDATE_CODE,
        {
            "input": {
                "projectEvaluatorId": created["id"],
                "name": "updated-code",
                "description": "updated with inheritance",
                "evaluatorInputMapping": _mapping(output="inherited"),
                "inputMapping": None,
                "samplingRate": 1.0,
                "evaluationTarget": "SPAN",
                "filterCondition": "",
                "enabled": True,
            }
        },
    )
    assert inherited_result.data and not inherited_result.errors
    inherited = inherited_result.data["updateProjectCodeEvaluator"]["evaluator"]
    assert inherited["inputMapping"] == _mapping(output="inherited")
    async with db() as session:
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        assert criteria.input_mapping is None

    delete_result = await gql_client.execute(
        _DELETE,
        {"input": {"projectEvaluatorIds": [created["id"]]}},
    )
    assert delete_result.data and not delete_result.errors
    assert delete_result.data["deleteProjectEvaluators"]["projectEvaluatorIds"] == [created["id"]]
    async with db() as session:
        assert await session.get(models.Project, project.id) is not None


async def test_add_project_code_evaluator_binds_existing_core(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    source_project = await _add_project(db)
    create_result = await gql_client.execute(
        _CREATE_CODE,
        {"input": _code_create_input(source_project, sandbox_config)},
    )
    assert create_result.data and not create_result.errors
    created = create_result.data["createProjectCodeEvaluator"]["evaluator"]
    core_id = created["evaluator"]["id"]

    async with db() as session:
        evaluator_count_before = await session.scalar(
            select(func.count()).select_from(models.Evaluator)
        )
        version_count_before = await session.scalar(
            select(func.count()).select_from(models.CodeEvaluatorVersion)
        )

    add_result = await gql_client.execute(
        _ADD_CODE,
        {"input": _code_add_input(source_project, core_id)},
    )
    assert add_result.data and not add_result.errors
    attached = add_result.data["addProjectCodeEvaluator"]["evaluator"]
    assert attached["evaluator"]["id"] == core_id
    assert attached["name"] == "attached-code"
    assert attached["samplingRate"] == 0.25
    assert attached["evaluationTarget"] == "SESSION"
    assert attached["inputMapping"] == _mapping(context="override")
    assert attached["filterCondition"] == "span_kind == 'LLM'"
    assert attached["enabled"] is False

    project_result = await gql_client.execute(
        _PROJECT_EVALUATORS,
        {"id": str(GlobalID("Project", str(source_project.id)))},
    )
    assert project_result.data and not project_result.errors
    nodes = [edge["node"] for edge in project_result.data["node"]["evaluators"]["edges"]]
    assert {node["id"] for node in nodes} == {created["id"], attached["id"]}

    async with db() as session:
        criteria_id = int(GlobalID.from_id(attached["id"]).node_id)
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        assert criteria.evaluator_id == int(GlobalID.from_id(core_id).node_id)
        assert await session.scalar(select(func.count()).select_from(models.Evaluator)) == (
            evaluator_count_before
        )
        assert (
            await session.scalar(select(func.count()).select_from(models.CodeEvaluatorVersion))
            == version_count_before
        )


async def test_add_project_code_evaluator_rejects_non_code_evaluator(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    source_project = await _add_project(db)
    target_project = await _add_project(db)
    create_result = await gql_client.execute(
        _CREATE_LLM,
        {"input": _llm_input(source_project, name="shared-llm", text="Evaluate {{input}}")},
    )
    assert create_result.data and not create_result.errors
    evaluator_id = create_result.data["createProjectLlmEvaluator"]["evaluator"]["evaluator"]["id"]
    criteria_count_before = await _project_evaluator_criteria_count(db)

    result = await gql_client.execute(
        _ADD_CODE,
        {"input": _code_add_input(target_project, evaluator_id)},
    )

    assert result.errors
    assert result.errors[0].message == "Evaluator must be a CODE evaluator"
    assert await _project_evaluator_criteria_count(db) == criteria_count_before


async def test_add_project_code_evaluator_rejects_missing_evaluator(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    project = await _add_project(db)
    criteria_count_before = await _project_evaluator_criteria_count(db)

    result = await gql_client.execute(
        _ADD_CODE,
        {
            "input": _code_add_input(
                project,
                str(GlobalID("CodeEvaluator", "999999999")),
            )
        },
    )

    assert result.errors
    assert result.errors[0].message == "CODE evaluator not found"
    assert await _project_evaluator_criteria_count(db) == criteria_count_before


async def test_delete_project_binding_preserves_core_attached_to_another_project(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    source_project = await _add_project(db)
    target_project = await _add_project(db)
    create_result = await gql_client.execute(
        _CREATE_CODE,
        {"input": _code_create_input(source_project, sandbox_config)},
    )
    assert create_result.data and not create_result.errors
    created = create_result.data["createProjectCodeEvaluator"]["evaluator"]
    core_id = created["evaluator"]["id"]

    add_result = await gql_client.execute(
        _ADD_CODE,
        {"input": _code_add_input(target_project, core_id)},
    )
    assert add_result.data and not add_result.errors
    attached = add_result.data["addProjectCodeEvaluator"]["evaluator"]

    delete_result = await gql_client.execute(
        _DELETE,
        {"input": {"projectEvaluatorIds": [created["id"]]}},
    )
    assert delete_result.data and not delete_result.errors

    async with db() as session:
        core_rowid = int(GlobalID.from_id(core_id).node_id)
        created_criteria_id = int(GlobalID.from_id(created["id"]).node_id)
        attached_criteria_id = int(GlobalID.from_id(attached["id"]).node_id)
        assert await session.get(models.ProjectEvaluatorCriteria, created_criteria_id) is None
        attached_criteria = await session.get(models.ProjectEvaluatorCriteria, attached_criteria_id)
        assert attached_criteria is not None
        assert attached_criteria.evaluator_id == core_rowid
        assert await session.get(models.CodeEvaluator, core_rowid) is not None


async def test_project_llm_evaluator_create_update_delete(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    project = await _add_project(db)
    create_input = _llm_input(project, name="llm-evaluator", text="Evaluate {{input}}")
    create_result = await gql_client.execute(_CREATE_LLM, {"input": create_input})
    assert create_result.data and not create_result.errors
    created = create_result.data["createProjectLlmEvaluator"]["evaluator"]
    assert created["evaluationTarget"] == "TRACE"
    assert created["evaluator"]["kind"] == "LLM"

    update_input = _llm_input(project, name="updated-llm", text="Updated {{input}}")
    update_input.pop("projectId")
    update_input["projectEvaluatorId"] = created["id"]
    update_input["evaluationTarget"] = "SPAN"
    update_result = await gql_client.execute(_UPDATE_LLM, {"input": update_input})
    assert update_result.data and not update_result.errors
    updated = update_result.data["updateProjectLlmEvaluator"]["evaluator"]
    assert updated["evaluator"]["name"] == "updated-llm"
    assert updated["evaluationTarget"] == "SPAN"

    delete_result = await gql_client.execute(
        _DELETE,
        {"input": {"projectEvaluatorIds": [created["id"]]}},
    )
    assert delete_result.data and not delete_result.errors


async def test_project_evaluator_node_resolves_by_global_id(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    project = await _add_project(db)
    create_input = _llm_input(project, name="llm-node", text="Evaluate {{input}}")
    create_result = await gql_client.execute(_CREATE_LLM, {"input": create_input})
    assert create_result.data and not create_result.errors
    created = create_result.data["createProjectLlmEvaluator"]["evaluator"]

    node_result = await gql_client.execute(
        _PROJECT_EVALUATOR_NODE,
        {"id": created["id"]},
    )
    assert node_result.data and not node_result.errors
    node = node_result.data["node"]
    assert node["id"] == created["id"]
    assert node["evaluationTarget"] == "TRACE"
    assert node["evaluator"]["kind"] == "LLM"


async def test_invalid_filter_rejects_before_project_evaluator_writes(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    project = await _add_project(db)
    before = await _row_counts(db)
    result = await gql_client.execute(
        _CREATE_CODE,
        {
            "input": _code_create_input(
                project,
                sandbox_config,
                filter_condition="span_kind === 'LLM'",
            )
        },
    )
    assert result.errors
    assert "Invalid filter condition:" in str(result.errors)
    assert await _row_counts(db) == before


async def test_sampling_rate_rejected_at_project_evaluator_input_boundary(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    project = await _add_project(db)
    error_message = "samplingRate must be between 0.0 and 1.0"

    create_code_input = _code_create_input(project, sandbox_config)
    create_code_input["samplingRate"] = 1.5
    before = await _row_counts(db)
    create_code_result = await gql_client.execute(_CREATE_CODE, {"input": create_code_input})
    assert create_code_result.errors
    assert create_code_result.errors[0].message == error_message
    assert await _row_counts(db) == before

    create_llm_input = _llm_input(project, name="invalid-rate-llm", text="Evaluate {{input}}")
    create_llm_input["samplingRate"] = -0.1
    create_llm_result = await gql_client.execute(_CREATE_LLM, {"input": create_llm_input})
    assert create_llm_result.errors
    assert create_llm_result.errors[0].message == error_message
    assert await _row_counts(db) == before

    valid_code_result = await gql_client.execute(
        _CREATE_CODE,
        {"input": _code_create_input(project, sandbox_config)},
    )
    assert valid_code_result.data and not valid_code_result.errors
    code_evaluator_id = valid_code_result.data["createProjectCodeEvaluator"]["evaluator"]["id"]
    update_code_input = {
        "projectEvaluatorId": code_evaluator_id,
        "name": f"invalid-rate-code-{token_hex(4)}",
        "evaluatorInputMapping": _mapping(output="value"),
        "samplingRate": -0.1,
        "evaluationTarget": "SPAN",
        "filterCondition": "",
        "enabled": True,
    }
    before = await _row_counts(db)
    update_code_result = await gql_client.execute(_UPDATE_CODE, {"input": update_code_input})
    assert update_code_result.errors
    assert update_code_result.errors[0].message == error_message
    assert await _row_counts(db) == before

    valid_llm_input = _llm_input(project, name="valid-rate-llm", text="Evaluate {{input}}")
    valid_llm_result = await gql_client.execute(_CREATE_LLM, {"input": valid_llm_input})
    assert valid_llm_result.data and not valid_llm_result.errors
    llm_evaluator_id = valid_llm_result.data["createProjectLlmEvaluator"]["evaluator"]["id"]
    update_llm_input = _llm_input(project, name="updated-rate-llm", text="Update {{input}}")
    update_llm_input.pop("projectId")
    update_llm_input["projectEvaluatorId"] = llm_evaluator_id
    update_llm_input["samplingRate"] = 1.1
    before = await _row_counts(db)
    update_llm_result = await gql_client.execute(_UPDATE_LLM, {"input": update_llm_input})
    assert update_llm_result.errors
    assert update_llm_result.errors[0].message == error_message
    assert await _row_counts(db) == before


async def test_update_code_evaluator_rejects_explicit_null_source_code(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    project = await _add_project(db)
    create_result = await gql_client.execute(
        _CREATE_CODE,
        {"input": _code_create_input(project, sandbox_config)},
    )
    assert create_result.data and not create_result.errors
    evaluator_id = create_result.data["createProjectCodeEvaluator"]["evaluator"]["id"]

    result = await gql_client.execute(
        _UPDATE_CODE,
        {
            "input": {
                "projectEvaluatorId": evaluator_id,
                "name": f"null-source-{token_hex(4)}",
                "sourceCode": None,
                "evaluatorInputMapping": _mapping(output="value"),
                "samplingRate": 0.5,
                "evaluationTarget": "SPAN",
                "filterCondition": "",
                "enabled": True,
            }
        },
    )
    assert result.errors
    assert result.errors[0].message == "source_code cannot be set to null"


async def test_create_rolls_back_all_llm_resources_on_late_name_conflict(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    project = await _add_project(db)
    existing_input = _code_create_input(project, sandbox_config)
    existing_input["name"] = "duplicate-project-evaluator"
    existing_result = await gql_client.execute(_CREATE_CODE, {"input": existing_input})
    assert existing_result.data and not existing_result.errors

    before = await _row_counts(db)
    create_input = _llm_input(project, name="rolled-back-llm", text="Evaluate {{input}}")
    create_input["name"] = "duplicate-project-evaluator"
    result = await gql_client.execute(_CREATE_LLM, {"input": create_input})

    assert result.errors
    assert result.errors[0].message == (
        "A project evaluator with this name already exists for this project"
    )
    assert await _row_counts(db) == before


async def test_update_rolls_back_code_version_and_state_on_late_name_conflict(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    project = await _add_project(db)
    first_input = _code_create_input(project, sandbox_config)
    first_input["name"] = "first-project-evaluator"
    first_result = await gql_client.execute(_CREATE_CODE, {"input": first_input})
    assert first_result.data and not first_result.errors
    first = first_result.data["createProjectCodeEvaluator"]["evaluator"]

    second_input = _code_create_input(project, sandbox_config)
    second_input["name"] = "second-project-evaluator"
    second_result = await gql_client.execute(_CREATE_CODE, {"input": second_input})
    assert second_result.data and not second_result.errors

    criteria_id = int(GlobalID.from_id(first["id"]).node_id)
    async with db() as session:
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        evaluator = await session.get(models.CodeEvaluator, criteria.evaluator_id)
        assert evaluator is not None
        evaluator_id = evaluator.id
        state_before = (
            str(evaluator.name),
            evaluator.description,
            evaluator.input_mapping.model_dump(mode="json"),
            str(criteria.name),
            criteria.filter_condition,
            criteria.sampling_rate,
            criteria.evaluation_target,
            criteria.input_mapping,
            criteria.enabled,
        )
        versions_before = tuple(
            await session.scalars(
                select(models.CodeEvaluatorVersion.source_code)
                .where(models.CodeEvaluatorVersion.code_evaluator_id == evaluator_id)
                .order_by(models.CodeEvaluatorVersion.id)
            )
        )
    counts_before = await _row_counts(db)

    result = await gql_client.execute(
        _UPDATE_CODE,
        {
            "input": {
                "projectEvaluatorId": first["id"],
                "name": "second-project-evaluator",
                "description": "must roll back",
                "sourceCode": "def evaluate(output):\n    return {'score': 0.0}",
                "evaluatorInputMapping": _mapping(changed="value"),
                "inputMapping": _mapping(override="value"),
                "samplingRate": 0.9,
                "evaluationTarget": "TRACE",
                "filterCondition": "span_kind == 'LLM'",
                "enabled": False,
            }
        },
    )
    assert result.errors
    assert result.errors[0].message == (
        "A project evaluator with this name already exists for this project"
    )
    assert await _row_counts(db) == counts_before

    async with db() as session:
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        evaluator = await session.get(models.CodeEvaluator, evaluator_id)
        assert criteria is not None and evaluator is not None
        state_after = (
            str(evaluator.name),
            evaluator.description,
            evaluator.input_mapping.model_dump(mode="json"),
            str(criteria.name),
            criteria.filter_condition,
            criteria.sampling_rate,
            criteria.evaluation_target,
            criteria.input_mapping,
            criteria.enabled,
        )
        versions_after = tuple(
            await session.scalars(
                select(models.CodeEvaluatorVersion.source_code)
                .where(models.CodeEvaluatorVersion.code_evaluator_id == evaluator_id)
                .order_by(models.CodeEvaluatorVersion.id)
            )
        )
    assert state_after == state_before
    assert versions_after == versions_before


async def _row_counts(db: DbSessionFactory) -> dict[str, int]:
    async with db() as session:
        model_types = (
            models.Evaluator,
            models.Prompt,
            models.PromptVersion,
            models.PromptVersionTag,
            models.PromptLabel,
            models.PromptPromptLabel,
            models.CodeEvaluatorVersion,
            models.ProjectEvaluatorCriteria,
        )
        return {
            model_type.__name__: await session.scalar(select(func.count()).select_from(model_type))
            or 0
            for model_type in model_types
        }


async def _project_evaluator_criteria_count(db: DbSessionFactory) -> int:
    async with db() as session:
        return (
            await session.scalar(select(func.count()).select_from(models.ProjectEvaluatorCriteria))
            or 0
        )
