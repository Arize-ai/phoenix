from typing import NamedTuple

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import select
from starlette.types import ASGIApp, Receive, Scope, Send
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.types import DbSessionFactory, UserClaimSet, UserId, UserTokenAttributes


class _Experiments(NamedTuple):
    """Experiment GlobalIDs: three on one dataset, one on a second dataset."""

    experiment: str
    sibling: str
    ephemeral: str
    other_dataset: str


def _experiment_gid(rowid: int) -> str:
    return str(GlobalID("Experiment", str(rowid)))


def _experiment_tag_gid(rowid: int) -> str:
    return str(GlobalID("ExperimentTag", str(rowid)))


@pytest.fixture
async def _experiments(db: DbSessionFactory) -> _Experiments:
    async with db() as session:
        datasets = [
            models.Dataset(name=name, description=None, metadata_={})
            for name in ("experiment-tags-dataset", "experiment-tags-other")
        ]
        session.add_all(datasets)
        await session.flush()
        versions = [
            models.DatasetVersion(dataset_id=dataset.id, description=None, metadata_={})
            for dataset in datasets
        ]
        session.add_all(versions)
        await session.flush()
        experiments = [
            models.Experiment(
                dataset_id=versions[index].dataset_id,
                dataset_version_id=versions[index].id,
                name=name,
                repetitions=1,
                metadata_={},
                project_name=None,
                is_ephemeral=is_ephemeral,
            )
            for index, name, is_ephemeral in (
                (0, "first", False),
                (0, "second", False),
                (0, "ephemeral", True),
                (1, "other", False),
            )
        ]
        session.add_all(experiments)
        await session.flush()
        rowids = [experiment.id for experiment in experiments]
    return _Experiments(*(_experiment_gid(rowid) for rowid in rowids))


class TestSetExperimentTag:
    async def test_assign_list_and_remove(
        self,
        httpx_client: httpx.AsyncClient,
        _experiments: _Experiments,
    ) -> None:
        experiment_id = _experiments.experiment

        listed = await httpx_client.get(f"v1/experiments/{experiment_id}/tags")
        assert listed.status_code == 200, listed.text
        assert listed.json()["data"] == []

        assigned = await httpx_client.post(
            f"v1/experiments/{experiment_id}/tags",
            json={"name": "baseline", "description": "promoted from CI"},
        )
        assert assigned.status_code == 200, assigned.text
        assigned_tag = assigned.json()["data"]
        assert assigned_tag["name"] == "baseline"
        assert assigned_tag["description"] == "promoted from CI"
        tag_global_id = GlobalID.from_id(assigned_tag["id"])
        assert tag_global_id.type_name == "ExperimentTag"

        listed = await httpx_client.get(f"v1/experiments/{experiment_id}/tags")
        assert listed.json()["data"] == [assigned_tag]

        # Re-assigning is idempotent and replaces the description.
        reassigned = await httpx_client.post(
            f"v1/experiments/{experiment_id}/tags",
            json={"name": "baseline"},
        )
        assert reassigned.status_code == 200, reassigned.text
        reassigned_tag = reassigned.json()["data"]
        assert reassigned_tag == {**assigned_tag, "description": None}
        listed = await httpx_client.get(f"v1/experiments/{experiment_id}/tags")
        assert listed.json()["data"] == [reassigned_tag]

        removed = await httpx_client.delete(f"v1/experiments/{experiment_id}/tags/baseline")
        assert removed.status_code == 204, removed.text
        listed = await httpx_client.get(f"v1/experiments/{experiment_id}/tags")
        assert listed.json()["data"] == []

    async def test_assign_moves_the_tag_within_the_dataset(
        self,
        httpx_client: httpx.AsyncClient,
        _experiments: _Experiments,
        db: DbSessionFactory,
    ) -> None:
        first, second = _experiments.experiment, _experiments.sibling
        assigned_tags = []
        for experiment_id in (first, second):
            resp = await httpx_client.post(
                f"v1/experiments/{experiment_id}/tags", json={"name": "baseline"}
            )
            assert resp.status_code == 200, resp.text
            assigned_tags.append(resp.json()["data"])

        # The tag is a dataset-scoped pointer, so exactly one experiment owns it.
        assert assigned_tags[0]["id"] == assigned_tags[1]["id"]
        assert (await httpx_client.get(f"v1/experiments/{first}/tags")).json()["data"] == []
        assert (await httpx_client.get(f"v1/experiments/{second}/tags")).json()["data"] == [
            assigned_tags[1]
        ]
        async with db() as session:
            tags = (
                await session.scalars(
                    select(models.ExperimentTag).where(models.ExperimentTag.name == "baseline")
                )
            ).all()
        assert len(tags) == 1

    async def test_tags_are_isolated_per_dataset(
        self,
        httpx_client: httpx.AsyncClient,
        _experiments: _Experiments,
    ) -> None:
        assigned_tags = []
        for experiment_id in (_experiments.experiment, _experiments.other_dataset):
            resp = await httpx_client.post(
                f"v1/experiments/{experiment_id}/tags", json={"name": "baseline"}
            )
            assert resp.status_code == 200, resp.text
            assigned_tags.append(resp.json()["data"])
        assert assigned_tags[0]["id"] != assigned_tags[1]["id"]
        for experiment_id, assigned_tag in zip(
            (_experiments.experiment, _experiments.other_dataset), assigned_tags
        ):
            listed = await httpx_client.get(f"v1/experiments/{experiment_id}/tags")
            assert listed.json()["data"] == [assigned_tag]

    async def test_baseline_is_rejected_for_ephemeral_experiments(
        self,
        httpx_client: httpx.AsyncClient,
        _experiments: _Experiments,
    ) -> None:
        experiment_id = _experiments.ephemeral
        rejected = await httpx_client.post(
            f"v1/experiments/{experiment_id}/tags", json={"name": "baseline"}
        )
        assert rejected.status_code == 422, rejected.text
        assert "ephemeral" in rejected.text.lower()

        # Only the reserved baseline tag is restricted.
        allowed = await httpx_client.post(
            f"v1/experiments/{experiment_id}/tags", json={"name": "candidate"}
        )
        assert allowed.status_code == 200, allowed.text

    async def test_invalid_inputs(
        self,
        httpx_client: httpx.AsyncClient,
        _experiments: _Experiments,
    ) -> None:
        experiment_id = _experiments.experiment
        unknown_id = _experiment_gid(999_999)
        tags = f"v1/experiments/{experiment_id}/tags"

        assert (await httpx_client.get("v1/experiments/not-a-global-id/tags")).status_code == 422
        assert (await httpx_client.get(f"v1/experiments/{unknown_id}/tags")).status_code == 404

        unknown = await httpx_client.post(
            f"v1/experiments/{unknown_id}/tags", json={"name": "baseline"}
        )
        assert unknown.status_code == 404, unknown.text

        # Tag names must be identifiers, on the request body and in the path alike.
        assert (await httpx_client.post(tags, json={"name": "Not Ok"})).status_code == 422
        assert (await httpx_client.delete(f"{tags}/Not Ok")).status_code == 422
        assert (await httpx_client.delete(f"{tags}/{_experiment_gid(1)}")).status_code == 422


class TestDeleteExperimentTag:
    async def test_tag_id_is_scoped_to_the_experiment_dataset(
        self,
        httpx_client: httpx.AsyncClient,
        _experiments: _Experiments,
    ) -> None:
        owner_tag = (
            await httpx_client.post(
                f"v1/experiments/{_experiments.experiment}/tags", json={"name": "baseline"}
            )
        ).json()["data"]
        other_dataset_tag = (
            await httpx_client.post(
                f"v1/experiments/{_experiments.other_dataset}/tags", json={"name": "baseline"}
            )
        ).json()["data"]

        response = await httpx_client.delete(
            f"v1/experiments/{_experiments.experiment}/tags/{other_dataset_tag['id']}"
        )

        assert response.status_code == 204, response.text
        owner_tags = await httpx_client.get(f"v1/experiments/{_experiments.experiment}/tags")
        other_dataset_tags = await httpx_client.get(
            f"v1/experiments/{_experiments.other_dataset}/tags"
        )
        assert owner_tags.json()["data"] == [owner_tag]
        assert other_dataset_tags.json()["data"] == [other_dataset_tag]

    async def test_removal_is_idempotent_and_never_steals_the_tag(
        self,
        httpx_client: httpx.AsyncClient,
        _experiments: _Experiments,
    ) -> None:
        owner, non_owner = _experiments.experiment, _experiments.sibling
        assigned = await httpx_client.post(
            f"v1/experiments/{owner}/tags", json={"name": "baseline"}
        )
        tag = assigned.json()["data"]

        # Removing by node ID from an experiment that does not own the tag is a no-op.
        no_op = await httpx_client.delete(f"v1/experiments/{non_owner}/tags/{tag['id']}")
        assert no_op.status_code == 204, no_op.text
        assert (await httpx_client.get(f"v1/experiments/{owner}/tags")).json()["data"] == [tag]

        for _ in range(2):
            removed = await httpx_client.delete(f"v1/experiments/{owner}/tags/{tag['id']}")
            assert removed.status_code == 204, removed.text
            assert (await httpx_client.get(f"v1/experiments/{owner}/tags")).json()["data"] == []

        unknown_tag = await httpx_client.delete(
            f"v1/experiments/{owner}/tags/{_experiment_tag_gid(999_999)}"
        )
        assert unknown_tag.status_code == 204, unknown_tag.text

    async def test_unknown_experiment_is_404(
        self,
        httpx_client: httpx.AsyncClient,
        _experiments: _Experiments,
    ) -> None:
        resp = await httpx_client.delete(f"v1/experiments/{_experiment_gid(999_999)}/tags/baseline")
        assert resp.status_code == 404, resp.text


class TestExperimentTagUserAttribution:
    async def test_unauthenticated_writes_record_no_user(
        self,
        httpx_client: httpx.AsyncClient,
        _experiments: _Experiments,
        db: DbSessionFactory,
    ) -> None:
        resp = await httpx_client.post(
            f"v1/experiments/{_experiments.experiment}/tags", json={"name": "baseline"}
        )
        assert resp.status_code == 200, resp.text
        async with db() as session:
            user_id = await session.scalar(select(models.ExperimentTag.user_id))
        assert user_id is None

    async def test_authenticated_user_is_recorded_on_the_tag(
        self,
        app: FastAPI,
        asgi_app: ASGIApp,
        _experiments: _Experiments,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            # The app's startup facilitator seeds the standard roles.
            role_id = await session.scalar(
                select(models.UserRole.id).where(models.UserRole.name == "MEMBER")
            )
            assert role_id is not None
            user = models.User(
                user_role_id=role_id,
                username="experiment-tagger",
                email="experiment-tagger@example.com",
                password_hash=b"hash",
                password_salt=b"salt",
                reset_password=False,
                auth_method="LOCAL",
            )
            session.add(user)
            await session.flush()
            user_rowid = user.id

        user_id = UserId(user_rowid)
        phoenix_user = PhoenixUser(
            user_id,
            UserClaimSet(subject=user_id, attributes=UserTokenAttributes(user_role="MEMBER")),
        )

        async def _authenticated_app(scope: Scope, receive: Receive, send: Send) -> None:
            if scope["type"] == "http":
                scope["user"] = phoenix_user
            await asgi_app(scope, receive, send)

        # The route reads the caller from `request.user` exactly like the other v1 write
        # routes, so seeding the scope and flipping the flag exercises the authenticated
        # branch without standing up the full auth stack.
        app.state.authentication_enabled = True
        client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=_authenticated_app),
            base_url="http://test",
        )
        try:
            resp = await client.post(
                f"v1/experiments/{_experiments.experiment}/tags",
                json={"name": "baseline"},
            )
            assert resp.status_code == 200, resp.text
        finally:
            app.state.authentication_enabled = False
            await client.aclose()

        async with db() as session:
            tag_user_id = await session.scalar(select(models.ExperimentTag.user_id))
        assert tag_user_id == user_rowid
