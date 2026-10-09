"""Shared server and resource fixtures for evaluator integration tests."""

from secrets import token_hex
from typing import Any, Iterator, Mapping

import httpx
import pytest

from .._helpers import _AppInfo, _gql, _httpx_client, _server
from ._helpers import _graphql


@pytest.fixture(scope="package")
def _app(
    _env: dict[str, str],
) -> Iterator[_AppInfo]:
    with _server(_AppInfo(_env)) as app:
        yield app


@pytest.fixture(scope="package")
def _env(
    _env_ports: Mapping[str, str],
    _env_database: Mapping[str, str],
    _env_auth: Mapping[str, str],
    _env_smtp: Mapping[str, str],
) -> dict[str, str]:
    """Combine all environment variable configurations for testing."""
    return {
        **_env_ports,
        **_env_database,
        **_env_auth,
        **_env_smtp,
    }


@pytest.fixture
def client(_app: _AppInfo) -> Iterator[httpx.Client]:
    with _httpx_client(_app, _app.admin_secret) as client:
        yield client


@pytest.fixture
def sandbox_id(_app: _AppInfo) -> Iterator[str]:
    result, _ = _gql(
        _app,
        _app.admin_secret,
        query="""
        mutation($input: CreateSandboxConfigInput!) {
            createSandboxConfig(input: $input) { sandboxConfig { id } }
        }
    """,
        variables={
            "input": {"name": f"rest-{token_hex(8)}", "config": {"wasm": {"language": "PYTHON"}}}
        },
    )
    sandbox_id = result["data"]["createSandboxConfig"]["sandboxConfig"]["id"]
    try:
        yield sandbox_id
    finally:
        _gql(
            _app,
            _app.admin_secret,
            query="""
            mutation($input: DeleteSandboxConfigInput!) { deleteSandboxConfig(input: $input) { query { __typename } } }
        """,
            variables={"input": {"id": sandbox_id}},
            raise_on_errors=False,
        )


@pytest.fixture
def dataset_id(client: httpx.Client, _app: _AppInfo) -> Iterator[str]:
    dataset = _graphql(
        _app,
        """
        mutation($input: CreateDatasetInput!) { createDataset(input: $input) { dataset { id } } }
    """,
        {"input": {"name": f"eval-definitions-{token_hex(8)}"}},
    )["createDataset"]["dataset"]
    try:
        yield dataset["id"]
    finally:
        client.delete(f"v1/datasets/{dataset['id']}")


@pytest.fixture
def project(client: httpx.Client) -> Iterator[dict[str, Any]]:
    response = client.post("v1/projects", json={"name": f"eval-{token_hex(8)}"})
    response.raise_for_status()
    project = response.json()["data"]
    try:
        yield project
    finally:
        client.delete(f"v1/projects/{project['id']}")
