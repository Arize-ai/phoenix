"""Readers never return projects or bindings that are tombstoned and awaiting cleanup."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from secrets import token_hex
from typing import Any

import httpx2
import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.cleanup.lifecycle import tombstone_dataset_evaluators, tombstone_project
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _add_project
from tests.unit.graphql import AsyncGraphQLClient


@dataclass(frozen=True)
class _Rows:
    """One live and one tombstoned row of each kind; the tombstoned project owns a binding."""

    live_project: models.Project
    tombstoned_project: models.Project
    live_project_evaluator_id: str
    tombstoned_project_evaluator_id: str
    live_dataset_evaluator_id: str
    tombstoned_dataset_evaluator_id: str

    @staticmethod
    def global_id(type_name: str, rowid: int) -> str:
        return str(GlobalID(type_name, str(rowid)))


@pytest.fixture
async def rows(db: DbSessionFactory, correctness_llm_evaluator: models.LLMEvaluator) -> _Rows:
    async with db() as session:
        live_project = await _add_project(session, name=f"live-{token_hex(4)}")
        tombstoned_project = await _add_project(session, name=f"tombstoned-{token_hex(4)}")
        live_sink = models.Project(name=f"live-sink-{token_hex(4)}")
        tombstoned_sink = models.Project(name=f"tombstoned-sink-{token_hex(4)}")
        dataset_sinks = [models.Project(name=f"dataset-sink-{token_hex(4)}") for _ in range(2)]
        dataset = models.Dataset(name=f"ds-{token_hex(4)}", metadata_={})
        session.add_all([live_sink, tombstoned_sink, dataset, *dataset_sinks])
        await session.flush()
        project_evaluators = [
            models.ProjectEvaluator(
                project_id=host.id,
                evaluator_id=correctness_llm_evaluator.id,
                trace_project_id=sink.id,
                name=Identifier(root=f"project-binding-{index}"),
                evaluation_target="SPAN",
                filter_condition="",
                sampling_rate=1.0,
            )
            for index, (host, sink) in enumerate(
                [(live_project, live_sink), (tombstoned_project, tombstoned_sink)]
            )
        ]
        session.add_all(project_evaluators)
        await session.flush()
        live_project_evaluator, tombstoned_project_evaluator = project_evaluators
        dataset_evaluators = [
            models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=correctness_llm_evaluator.id,
                project_id=sink.id,
                name=Identifier(root=f"dataset-binding-{index}"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            )
            for index, sink in enumerate(dataset_sinks)
        ]
        session.add_all(dataset_evaluators)
        await session.flush()
        live_dataset_evaluator, tombstoned_dataset_evaluator = dataset_evaluators
        await tombstone_project(session, project_id=tombstoned_project.id)
        await tombstone_dataset_evaluators(
            session,
            binding_ids=[tombstoned_dataset_evaluator.id],
            collect_unused_evaluator=False,
            delete_associated_prompt=False,
        )
        return _Rows(
            live_project=live_project,
            tombstoned_project=tombstoned_project,
            live_project_evaluator_id=_Rows.global_id(
                "ProjectEvaluator", live_project_evaluator.id
            ),
            tombstoned_project_evaluator_id=_Rows.global_id(
                "ProjectEvaluator", tombstoned_project_evaluator.id
            ),
            live_dataset_evaluator_id=_Rows.global_id(
                "DatasetEvaluator", live_dataset_evaluator.id
            ),
            tombstoned_dataset_evaluator_id=_Rows.global_id(
                "DatasetEvaluator", tombstoned_dataset_evaluator.id
            ),
        )


_Check = Callable[[_Rows, AsyncGraphQLClient, httpx2.AsyncClient], Awaitable[None]]


async def _query(gql_client: AsyncGraphQLClient, query: str, **variables: Any) -> Any:
    response = await gql_client.execute(query, variables=variables)
    assert response.data and not response.errors, response.errors
    return response.data


async def _node_is_hidden(
    gql_client: AsyncGraphQLClient, *, live_id: str, tombstoned_id: str
) -> None:
    query = "query($id: ID!) { node(id: $id) { id } }"
    assert (await _query(gql_client, query, id=live_id))["node"]["id"] == live_id
    response = await gql_client.execute(query, variables={"id": tombstoned_id})
    assert response.errors


async def _project_list_hides_tombstone(
    rows: _Rows, gql_client: AsyncGraphQLClient, _: httpx2.AsyncClient
) -> None:
    data = await _query(gql_client, "{ projects { edges { node { name } } } projectCount }")
    names = {edge["node"]["name"] for edge in data["projects"]["edges"]}
    assert rows.live_project.name in names
    assert rows.tombstoned_project.name not in names
    assert data["projectCount"] == len(names)


async def _project_lookup_hides_tombstone(
    rows: _Rows, gql_client: AsyncGraphQLClient, _: httpx2.AsyncClient
) -> None:
    query = "query($name: String!) { getProjectByName(name: $name) { name } }"
    live = await _query(gql_client, query, name=rows.live_project.name)
    assert live["getProjectByName"] == {"name": rows.live_project.name}
    dead = await _query(gql_client, query, name=rows.tombstoned_project.name)
    assert dead["getProjectByName"] is None
    await _node_is_hidden(
        gql_client,
        live_id=_Rows.global_id("Project", rows.live_project.id),
        tombstoned_id=_Rows.global_id("Project", rows.tombstoned_project.id),
    )


async def _binding_nodes_hide_tombstones(
    rows: _Rows, gql_client: AsyncGraphQLClient, _: httpx2.AsyncClient
) -> None:
    await _node_is_hidden(
        gql_client,
        live_id=rows.live_project_evaluator_id,
        tombstoned_id=rows.tombstoned_project_evaluator_id,
    )
    await _node_is_hidden(
        gql_client,
        live_id=rows.live_dataset_evaluator_id,
        tombstoned_id=rows.tombstoned_dataset_evaluator_id,
    )


async def _binding_lists_and_counts_hide_tombstones(
    rows: _Rows, gql_client: AsyncGraphQLClient, _: httpx2.AsyncClient
) -> None:
    data = await _query(
        gql_client,
        """{
            projectEvaluators { edges { node { id } } }
            datasetEvaluators { edges { node { id } } }
            projectEvaluatorCount
            datasetEvaluatorCount
        }""",
    )
    project_evaluator_ids = [edge["node"]["id"] for edge in data["projectEvaluators"]["edges"]]
    dataset_evaluator_ids = [edge["node"]["id"] for edge in data["datasetEvaluators"]["edges"]]
    assert project_evaluator_ids == [rows.live_project_evaluator_id]
    assert dataset_evaluator_ids == [rows.live_dataset_evaluator_id]
    assert data["projectEvaluatorCount"] == 1
    assert data["datasetEvaluatorCount"] == 1


async def _rest_project_list_hides_tombstone(
    rows: _Rows, _: AsyncGraphQLClient, httpx_client: httpx2.AsyncClient
) -> None:
    response = await httpx_client.get("v1/projects")
    assert response.status_code == 200
    names = {project["name"] for project in response.json()["data"]}
    assert rows.live_project.name in names
    assert rows.tombstoned_project.name not in names


async def _rest_bindings_hide_tombstones(
    rows: _Rows, _: AsyncGraphQLClient, httpx_client: httpx2.AsyncClient
) -> None:
    live_project_path = f"v1/projects/{_Rows.global_id('Project', rows.live_project.id)}"
    listed = await httpx_client.get(f"{live_project_path}/evaluators")
    assert [binding["id"] for binding in listed.json()["data"]] == [rows.live_project_evaluator_id]
    assert (
        await httpx_client.get(f"v1/project_evaluators/{rows.live_project_evaluator_id}")
    ).status_code == 200
    assert (
        await httpx_client.get(f"v1/project_evaluators/{rows.tombstoned_project_evaluator_id}")
    ).status_code == 404
    assert (
        await httpx_client.get(f"v1/dataset_evaluators/{rows.live_dataset_evaluator_id}")
    ).status_code == 200
    assert (
        await httpx_client.get(f"v1/dataset_evaluators/{rows.tombstoned_dataset_evaluator_id}")
    ).status_code == 404
    tombstoned_project_path = (
        f"v1/projects/{_Rows.global_id('Project', rows.tombstoned_project.id)}"
    )
    assert (await httpx_client.get(f"{tombstoned_project_path}/evaluators")).status_code == 404


@pytest.mark.parametrize(
    "check",
    [
        _project_list_hides_tombstone,
        _project_lookup_hides_tombstone,
        _binding_nodes_hide_tombstones,
        _binding_lists_and_counts_hide_tombstones,
        _rest_project_list_hides_tombstone,
        _rest_bindings_hide_tombstones,
    ],
    ids=lambda check: check.__name__.removeprefix("_"),
)
async def test_readers_hide_tombstoned_rows(
    check: _Check,
    rows: _Rows,
    gql_client: AsyncGraphQLClient,
    httpx_client: httpx2.AsyncClient,
) -> None:
    await check(rows, gql_client, httpx_client)
