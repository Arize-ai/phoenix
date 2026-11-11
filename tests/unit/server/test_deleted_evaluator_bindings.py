"""Readers of evaluator bindings skip deleted ones.

A deleted binding gives up its name, so a live binding can share its name and evaluator
until the purger removes the deleted one. Every reader must return only the live binding.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, cast
from unittest.mock import MagicMock

import httpx
import pytest
import sqlalchemy as sa
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.dataloaders.dataset_evaluators import DatasetEvaluatorsDataLoader
from phoenix.server.api.dataloaders.dataset_evaluators_by_evaluator import (
    DatasetEvaluatorsByEvaluatorDataLoader,
)
from phoenix.server.api.dataloaders.datasets_by_evaluator import DatasetsByEvaluatorDataLoader
from phoenix.server.api.dataloaders.project_evaluator_by_id import (
    ProjectEvaluatorByIdDataLoader,
)
from phoenix.server.api.dataloaders.projects_by_evaluator import ProjectsByEvaluatorDataLoader
from phoenix.server.api.exceptions import NotFound
from phoenix.server.daemons.experiment_runner import ExperimentRunner
from phoenix.server.evaluators.resolution import get_evaluators
from phoenix.server.online_eval.current_queue import load_project_evaluator_targets
from phoenix.server.online_eval.evaluation_activity import load_added_and_completed
from phoenix.server.online_eval.evaluator_load import load_evaluation_loads
from phoenix.server.online_eval.tracing import persist_evaluator_traces
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _add_span, _add_trace
from tests.unit.graphql import AsyncGraphQLClient

_NAME = "judge"
_PHANTOM = f"phantom-{token_hex(4)}"


@dataclass(frozen=True)
class _Bindings:
    dataset_id: int
    project_id: int
    experiment_id: int
    evaluator_id: int
    """Bound by a live and a deleted binding of the same name in the dataset and the project."""
    deleted_only_evaluator_id: int
    """A built-in bound only by deleted bindings, in the dataset and the project."""
    project_deleted_evaluator_id: int
    """A built-in with a live dataset binding, a deleted dataset binding named ``_PHANTOM``, and
    only a deleted binding in the project."""
    live_dataset_binding_id: int
    deleted_dataset_binding_id: int
    live_project_binding_id: int
    deleted_project_binding_id: int


def _dataset_binding(
    dataset_id: int, evaluator_id: int, name: str, *, deleted: bool
) -> models.DatasetEvaluators:
    return models.DatasetEvaluators(
        dataset_id=dataset_id,
        evaluator_id=evaluator_id,
        name=Identifier(root=name),
        input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
        project=models.Project(name=f"dataset-trace-{token_hex(8)}"),
        deleted_at=datetime.now(timezone.utc) if deleted else None,
    )


def _project_binding(
    project_id: int, evaluator_id: int, name: str, *, deleted: bool
) -> models.ProjectEvaluator:
    return models.ProjectEvaluator(
        trace_project=models.Project(name=f"project-trace-{token_hex(8)}"),
        project_id=project_id,
        evaluator_id=evaluator_id,
        name=Identifier(root=name),
        filter_condition="",
        sampling_rate=1.0,
        evaluation_target="SPAN",
        deleted_at=datetime.now(timezone.utc) if deleted else None,
    )


@pytest.fixture
async def bindings(db: DbSessionFactory, synced_builtin_evaluators: None) -> _Bindings:
    async with db() as session:
        evaluator_id, deleted_only_evaluator_id, project_deleted_evaluator_id = (
            await session.scalars(
                sa.select(models.BuiltinEvaluator.id).order_by(models.BuiltinEvaluator.id).limit(3)
            )
        ).all()
        dataset = models.Dataset(name=f"dataset-{token_hex(4)}", metadata_={})
        project = models.Project(name=f"project-{token_hex(4)}")
        session.add_all([dataset, project])
        await session.flush()
        version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        session.add(version)
        await session.flush()
        experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=version.id,
            name=f"experiment-{token_hex(4)}",
            repetitions=1,
            metadata_={},
        )
        live_dataset = _dataset_binding(dataset.id, evaluator_id, _NAME, deleted=False)
        deleted_dataset = _dataset_binding(dataset.id, evaluator_id, _NAME, deleted=True)
        live_project = _project_binding(project.id, evaluator_id, _NAME, deleted=False)
        deleted_project = _project_binding(project.id, evaluator_id, _NAME, deleted=True)
        session.add_all(
            [
                experiment,
                live_dataset,
                deleted_dataset,
                live_project,
                deleted_project,
                _dataset_binding(dataset.id, deleted_only_evaluator_id, "gone", deleted=True),
                _project_binding(project.id, deleted_only_evaluator_id, "gone", deleted=True),
                _dataset_binding(dataset.id, project_deleted_evaluator_id, "kept", deleted=False),
                _dataset_binding(dataset.id, project_deleted_evaluator_id, _PHANTOM, deleted=True),
                _project_binding(project.id, project_deleted_evaluator_id, "gone", deleted=True),
            ]
        )
        await session.flush()
        session.add_all(
            [
                models.ExperimentEvalOnlyConfig(id=experiment.id),
                models.ExperimentDatasetEvaluator(
                    experiment_id=experiment.id, dataset_evaluator_id=live_dataset.id
                ),
                models.ExperimentDatasetEvaluator(
                    experiment_id=experiment.id, dataset_evaluator_id=deleted_dataset.id
                ),
            ]
        )
        await session.flush()
        return _Bindings(
            dataset_id=dataset.id,
            project_id=project.id,
            experiment_id=experiment.id,
            evaluator_id=evaluator_id,
            deleted_only_evaluator_id=deleted_only_evaluator_id,
            project_deleted_evaluator_id=project_deleted_evaluator_id,
            live_dataset_binding_id=live_dataset.id,
            deleted_dataset_binding_id=deleted_dataset.id,
            live_project_binding_id=live_project.id,
            deleted_project_binding_id=deleted_project.id,
        )


async def test_dataloaders(db: DbSessionFactory, bindings: _Bindings) -> None:
    by_key = await DatasetEvaluatorsDataLoader(db).load(
        (bindings.dataset_id, bindings.evaluator_id, _NAME)
    )
    assert by_key is not None and by_key.id == bindings.live_dataset_binding_id
    by_evaluator = await DatasetEvaluatorsByEvaluatorDataLoader(db).load(bindings.evaluator_id)
    assert [binding.id for binding in by_evaluator] == [bindings.live_dataset_binding_id]
    assert await DatasetsByEvaluatorDataLoader(db).load(bindings.deleted_only_evaluator_id) == []
    assert await ProjectsByEvaluatorDataLoader(db).load(bindings.deleted_only_evaluator_id) == []
    by_id = ProjectEvaluatorByIdDataLoader(db)
    assert await by_id.load(bindings.deleted_project_binding_id) is None
    live = await by_id.load(bindings.live_project_binding_id)
    assert live is not None and live.id == bindings.live_project_binding_id


async def _evaluator_ids(gql_client: AsyncGraphQLClient, **variables: Any) -> set[int]:
    result = await gql_client.execute(
        "query($excludeProjectId: ID, $filter: EvaluatorFilter) {"
        " evaluators(first: 1000, excludeProjectId: $excludeProjectId, filter: $filter)"
        " { edges { node { id } } } }",
        variables=variables,
    )
    assert result.data and not result.errors, result.errors
    return {
        int(GlobalID.from_id(edge["node"]["id"]).node_id)
        for edge in result.data["evaluators"]["edges"]
    }


async def test_evaluator_queries(gql_client: AsyncGraphQLClient, bindings: _Bindings) -> None:
    listed = await _evaluator_ids(gql_client)
    assert bindings.evaluator_id in listed
    assert bindings.deleted_only_evaluator_id not in listed
    excluding_project = await _evaluator_ids(
        gql_client, excludeProjectId=str(GlobalID("Project", str(bindings.project_id)))
    )
    assert bindings.project_deleted_evaluator_id in excluding_project
    assert bindings.evaluator_id not in excluding_project
    by_name = await _evaluator_ids(gql_client, filter={"col": "name", "value": _PHANTOM})
    assert bindings.project_deleted_evaluator_id not in by_name

    result = await gql_client.execute(
        "query { evaluatorCount projectEvaluatorCount datasetEvaluatorCount }"
    )
    assert result.data and not result.errors, result.errors
    assert result.data["evaluatorCount"] == len(listed)
    # Live: the shared evaluator's binding in the project, and its binding plus the "kept"
    # binding in the dataset.
    assert result.data["projectEvaluatorCount"] == 1
    assert result.data["datasetEvaluatorCount"] == 2


async def test_experiment_job_dataset_evaluators(
    gql_client: AsyncGraphQLClient, bindings: _Bindings
) -> None:
    result = await gql_client.execute(
        "query($id: ID!) { node(id: $id) { ... on ExperimentJob"
        " { datasetEvaluators { edges { node { id } } } } } }",
        variables={"id": str(GlobalID("ExperimentJob", str(bindings.experiment_id)))},
    )
    assert result.data and not result.errors, result.errors
    assert [edge["node"]["id"] for edge in result.data["node"]["datasetEvaluators"]["edges"]] == [
        str(GlobalID("DatasetEvaluator", str(bindings.live_dataset_binding_id)))
    ]


async def test_rest_handlers(httpx_client: httpx.AsyncClient, bindings: _Bindings) -> None:
    for kind, owner, owner_id, live_id, deleted_id, item_route in (
        (
            "DatasetEvaluator",
            "datasets",
            GlobalID("Dataset", str(bindings.dataset_id)),
            bindings.live_dataset_binding_id,
            bindings.deleted_dataset_binding_id,
            "dataset_evaluators",
        ),
        (
            "ProjectEvaluator",
            "projects",
            GlobalID("Project", str(bindings.project_id)),
            bindings.live_project_binding_id,
            bindings.deleted_project_binding_id,
            "project_evaluators",
        ),
    ):
        listing = await httpx_client.get(f"v1/{owner}/{owner_id}/evaluators")
        assert listing.status_code == 200, listing.text
        listed = {item["id"] for item in listing.json()["data"]}
        assert str(GlobalID(kind, str(live_id))) in listed
        assert str(GlobalID(kind, str(deleted_id))) not in listed
        live = await httpx_client.get(f"v1/{item_route}/{GlobalID(kind, str(live_id))}")
        assert live.status_code == 200, live.text
        deleted = await httpx_client.get(f"v1/{item_route}/{GlobalID(kind, str(deleted_id))}")
        assert deleted.status_code == 404, deleted.text


def _runner(db: DbSessionFactory) -> ExperimentRunner:
    return ExperimentRunner(
        db,
        decrypt=lambda b: b,
        tracer_factory=MagicMock(),
        sandbox_session_manager=cast(Any, MagicMock(replica_id="replica-1")),
        sandbox_runtime=cast(Any, MagicMock()),
    )


async def test_experiment_evaluator_resolution(db: DbSessionFactory, bindings: _Bindings) -> None:
    async with db() as session:
        _, _, specs, _, _ = await _runner(db)._load_experiment_config(
            session, bindings.experiment_id, credentials=None
        )
    assert [spec.dataset_evaluator_id for spec in specs] == [bindings.live_dataset_binding_id]
    async with db() as session:
        with pytest.raises(NotFound):
            await get_evaluators(
                dataset_evaluator_ids=[bindings.deleted_dataset_binding_id],
                session=session,
                decrypt=lambda b: b,
                experiment_id=bindings.experiment_id,
                sandbox_session_manager=cast(Any, MagicMock(replica_id="replica-1")),
            )


async def test_online_eval_readers(db: DbSessionFactory, bindings: _Bindings) -> None:
    tracer = MagicMock()
    await persist_evaluator_traces(
        db=db, tracer=tracer, project_evaluator_id=bindings.deleted_project_binding_id
    )
    tracer.get_db_traces.assert_not_called()

    targets = await load_project_evaluator_targets(db, [bindings.project_id])
    assert [target.id for target in targets] == [bindings.live_project_binding_id]

    started = datetime.now(timezone.utc) - timedelta(minutes=1)
    async with db() as session:
        deleted = await session.get(models.ProjectEvaluator, bindings.deleted_project_binding_id)
        project = await session.get(models.Project, bindings.project_id)
        assert deleted is not None and project is not None
        trace_project = await session.get(models.Project, deleted.trace_project_id)
        assert trace_project is not None
        await _add_trace(session, trace_project, start_time=started)
        span = await _add_span(session, await _add_trace(session, project))
        session.add(
            models.EvalWorkUnit(
                span_rowid=span.id, project_evaluator_id=bindings.deleted_project_binding_id
            )
        )

    loads = await load_evaluation_loads(
        db, [bindings.live_project_binding_id, bindings.deleted_project_binding_id]
    )
    assert loads[bindings.deleted_project_binding_id].evaluation_count == 0
    assert loads[bindings.live_project_binding_id].server_evaluation_seconds == 0

    added, _ = await load_added_and_completed(
        db,
        project_id=bindings.project_id,
        start=started - timedelta(minutes=1),
        end=datetime.now(timezone.utc) + timedelta(minutes=1),
    )
    assert added == 0
