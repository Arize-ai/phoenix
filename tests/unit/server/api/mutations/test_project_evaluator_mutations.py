from secrets import token_hex
from typing import Any

from sqlalchemy import func, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_PROJECT_EVALUATOR_FIELDS = """
id
annotationName
filterCondition
samplingRate
evaluationTarget
enabled
inputMapping { literalMapping pathMapping }
evaluator {
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
        "annotationName": f"code-annotation-{token_hex(4)}",
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
        "annotationName": f"annotation-{name}",
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
                "annotationName": "updated-code-annotation",
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
    assert updated["annotationName"] == "updated-code-annotation"
    assert updated["evaluationTarget"] == "SESSION"
    assert updated["inputMapping"] == _mapping(context="override")
    assert updated["evaluator"]["name"] == "updated-code"

    delete_result = await gql_client.execute(
        _DELETE,
        {"input": {"projectEvaluatorIds": [created["id"]]}},
    )
    assert delete_result.data and not delete_result.errors
    assert delete_result.data["deleteProjectEvaluators"]["projectEvaluatorIds"] == [created["id"]]
    async with db() as session:
        assert await session.get(models.Project, project.id) is not None


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


async def _row_counts(db: DbSessionFactory) -> tuple[int, int]:
    async with db() as session:
        evaluator_count = await session.scalar(select(func.count()).select_from(models.Evaluator))
        criteria_count = await session.scalar(
            select(func.count()).select_from(models.ProjectEvaluatorCriteria)
        )
        return evaluator_count or 0, criteria_count or 0
