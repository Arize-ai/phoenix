"""
End-to-end coverage for the REST experiment-tag routes.

REST writes are verified through the GraphQL baseline views
(``Experiment.isBaseline`` and ``Dataset.baselineExperiment``) so that the two
surfaces are proven to agree on the same dataset-scoped pointer.
"""

from secrets import token_hex
from typing import Any, Optional

from strawberry.relay import GlobalID

from .._helpers import (
    _MEMBER,
    _VIEWER,
    _AppInfo,
    _GetUser,
    _gql,
    _httpx_client,
    _SecurityArtifact,
)


def _create_dataset_with_example(app: _AppInfo, auth: _SecurityArtifact) -> str:
    """Create a dataset with one example (and therefore one version) via GraphQL."""
    resp, _ = _gql(
        app,
        auth,
        query=(
            "mutation ($name: String!) {  createDataset(input: {name: $name}) { dataset { id } }}"
        ),
        variables={"name": f"experiment-tags-{token_hex(4)}"},
    )
    dataset_id = str(resp["data"]["createDataset"]["dataset"]["id"])
    _gql(
        app,
        auth,
        query=(
            "mutation ($input: AddExamplesToDatasetInput!) {"
            "  addExamplesToDataset(input: $input) { dataset { id } }"
            "}"
        ),
        variables={
            "input": {
                "datasetId": dataset_id,
                "examples": [{"input": {"q": "1+1"}, "output": {"a": "2"}, "metadata": {}}],
            }
        },
    )
    return dataset_id


def _create_experiment(app: _AppInfo, auth: _SecurityArtifact, dataset_id: str) -> str:
    resp = _httpx_client(app, auth).post(
        f"v1/datasets/{dataset_id}/experiments", json={"repetitions": 1}
    )
    assert resp.status_code == 200, resp.text
    return str(resp.json()["data"]["id"])


def _is_baseline(app: _AppInfo, auth: _SecurityArtifact, experiment_id: str) -> bool:
    resp, _ = _gql(
        app,
        auth,
        query="query ($id: ID!) { node(id: $id) { ... on Experiment { isBaseline } } }",
        variables={"id": experiment_id},
    )
    return bool(resp["data"]["node"]["isBaseline"])


def _baseline_experiment_id(
    app: _AppInfo, auth: _SecurityArtifact, dataset_id: str
) -> Optional[str]:
    resp, _ = _gql(
        app,
        auth,
        query=(
            "query ($id: ID!) {  node(id: $id) { ... on Dataset { baselineExperiment { id } } }}"
        ),
        variables={"id": dataset_id},
    )
    baseline: Optional[dict[str, Any]] = resp["data"]["node"]["baselineExperiment"]
    return str(baseline["id"]) if baseline else None


class TestExperimentTagsThroughGraphQL:
    def test_assigning_baseline_is_visible_to_graphql(
        self, _app: _AppInfo, _get_user: _GetUser
    ) -> None:
        user = _get_user(_app, _MEMBER)
        dataset_id = _create_dataset_with_example(_app, user)
        experiment_id = _create_experiment(_app, user, dataset_id)
        client = _httpx_client(_app, user)

        assert not _is_baseline(_app, user, experiment_id)
        assert _baseline_experiment_id(_app, user, dataset_id) is None

        assigned = client.post(
            f"v1/experiments/{experiment_id}/tags",
            json={"name": "baseline", "description": "passed the quality gate"},
        )
        assert assigned.status_code == 200, assigned.text

        assert _is_baseline(_app, user, experiment_id)
        assert _baseline_experiment_id(_app, user, dataset_id) == experiment_id
        assert client.get(f"v1/experiments/{experiment_id}/tags").json()["data"] == [
            {"name": "baseline", "description": "passed the quality gate"}
        ]

    def test_assigning_baseline_moves_it_off_the_previous_experiment(
        self, _app: _AppInfo, _get_user: _GetUser
    ) -> None:
        user = _get_user(_app, _MEMBER)
        dataset_id = _create_dataset_with_example(_app, user)
        first = _create_experiment(_app, user, dataset_id)
        second = _create_experiment(_app, user, dataset_id)
        client = _httpx_client(_app, user)

        for experiment_id in (first, second):
            resp = client.post(f"v1/experiments/{experiment_id}/tags", json={"name": "baseline"})
            assert resp.status_code == 200, resp.text

        assert not _is_baseline(_app, user, first)
        assert _is_baseline(_app, user, second)
        assert _baseline_experiment_id(_app, user, dataset_id) == second
        assert client.get(f"v1/experiments/{first}/tags").json()["data"] == []

    def test_removal_is_idempotent_and_never_steals_the_baseline(
        self, _app: _AppInfo, _get_user: _GetUser
    ) -> None:
        user = _get_user(_app, _MEMBER)
        dataset_id = _create_dataset_with_example(_app, user)
        owner = _create_experiment(_app, user, dataset_id)
        non_owner = _create_experiment(_app, user, dataset_id)
        client = _httpx_client(_app, user)

        client.post(f"v1/experiments/{owner}/tags", json={"name": "baseline"})

        # Clearing from a non-owner leaves the baseline where it is.
        assert client.delete(f"v1/experiments/{non_owner}/tags/baseline").status_code == 204
        assert _baseline_experiment_id(_app, user, dataset_id) == owner

        # Clearing from the owner is idempotent.
        for _ in range(2):
            assert client.delete(f"v1/experiments/{owner}/tags/baseline").status_code == 204
            assert not _is_baseline(_app, user, owner)
            assert _baseline_experiment_id(_app, user, dataset_id) is None

    def test_baselines_are_isolated_per_dataset(self, _app: _AppInfo, _get_user: _GetUser) -> None:
        user = _get_user(_app, _MEMBER)
        first_dataset = _create_dataset_with_example(_app, user)
        second_dataset = _create_dataset_with_example(_app, user)
        first_experiment = _create_experiment(_app, user, first_dataset)
        second_experiment = _create_experiment(_app, user, second_dataset)
        client = _httpx_client(_app, user)

        for experiment_id in (first_experiment, second_experiment):
            resp = client.post(f"v1/experiments/{experiment_id}/tags", json={"name": "baseline"})
            assert resp.status_code == 200, resp.text

        assert _baseline_experiment_id(_app, user, first_dataset) == first_experiment
        assert _baseline_experiment_id(_app, user, second_dataset) == second_experiment

        assert client.delete(f"v1/experiments/{first_experiment}/tags/baseline").status_code == 204
        assert _baseline_experiment_id(_app, user, first_dataset) is None
        assert _baseline_experiment_id(_app, user, second_dataset) == second_experiment

    def test_ephemeral_experiments_cannot_become_the_baseline(
        self, _app: _AppInfo, _get_user: _GetUser
    ) -> None:
        user = _get_user(_app, _MEMBER)
        dataset_id = _create_dataset_with_example(_app, user)
        experiment_id = _create_experiment(_app, user, dataset_id)
        client = _httpx_client(_app, user)

        _gql(
            _app,
            user,
            query=(
                "mutation ($id: ID!) {  dismissExperiment(experimentId: $id) { experiment { id } }}"
            ),
            variables={"id": experiment_id},
        )

        rejected = client.post(f"v1/experiments/{experiment_id}/tags", json={"name": "baseline"})
        assert rejected.status_code == 422, rejected.text
        assert "ephemeral" in rejected.text.lower()
        assert _baseline_experiment_id(_app, user, dataset_id) is None

        # A non-reserved tag is still allowed on an ephemeral experiment.
        allowed = client.post(f"v1/experiments/{experiment_id}/tags", json={"name": "candidate"})
        assert allowed.status_code == 200, allowed.text


class TestExperimentTagAuthorization:
    def test_viewers_cannot_write_but_can_read(self, _app: _AppInfo, _get_user: _GetUser) -> None:
        member = _get_user(_app, _MEMBER)
        dataset_id = _create_dataset_with_example(_app, member)
        experiment_id = _create_experiment(_app, member, dataset_id)
        _httpx_client(_app, member).post(
            f"v1/experiments/{experiment_id}/tags", json={"name": "baseline"}
        )

        viewer = _httpx_client(_app, _get_user(_app, _VIEWER))
        listed = viewer.get(f"v1/experiments/{experiment_id}/tags")
        assert listed.status_code == 200, listed.text
        assert listed.json()["data"] == [{"name": "baseline", "description": None}]
        assigned = viewer.post(f"v1/experiments/{experiment_id}/tags", json={"name": "candidate"})
        assert assigned.status_code == 403, assigned.text
        removed = viewer.delete(f"v1/experiments/{experiment_id}/tags/baseline")
        assert removed.status_code == 403, removed.text

    def test_unauthenticated_requests_are_rejected(self, _app: _AppInfo) -> None:
        # Authentication is rejected before the route resolves the experiment, so a
        # synthetic ID is enough here.
        experiment_id = str(GlobalID("Experiment", "1"))
        client = _httpx_client(_app)
        assert client.get(f"v1/experiments/{experiment_id}/tags").status_code == 401
        assigned = client.post(f"v1/experiments/{experiment_id}/tags", json={"name": "baseline"})
        assert assigned.status_code == 401, assigned.text
        assert client.delete(f"v1/experiments/{experiment_id}/tags/baseline").status_code == 401
