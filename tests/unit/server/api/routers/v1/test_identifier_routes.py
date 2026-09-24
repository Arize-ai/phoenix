from typing import Any

import httpx
import pytest
from fastapi import APIRouter
from fastapi.routing import APIRoute
from starlette.types import ASGIApp, Receive, Scope, Send

import phoenix.server.api.routers.v1 as v1


def _leaf_routers() -> list[APIRouter]:
    return [
        router
        for name, router in vars(v1).items()
        if name.endswith("_router") and isinstance(router, APIRouter)
    ]


def _identifier_routes() -> list[tuple[str, str, APIRoute]]:
    """Every (method, path, route) whose path has a name-or-ID identifier."""
    return [
        (method, route.path, route)
        for router in _leaf_routers()
        for route in router.routes
        if isinstance(route, APIRoute) and ":identifier}" in route.path
        for method in sorted(route.methods or [])
    ]


@pytest.mark.parametrize(
    "method,path,route",
    _identifier_routes(),
    ids=[f"{method} {path}" for method, path, _ in _identifier_routes()],
)
async def test_identifier_route_is_not_shadowed(
    asgi_app: ASGIApp,
    method: str,
    path: str,
    route: APIRoute,
) -> None:
    """
    Identifiers match greedily across slashes, so a route ending in one can
    swallow the URLs of its sibling sub-routes. Each route must still win for
    its own URL shape, with the slash-containing identifiers intact.
    """
    routed: dict[str, Any] = {}

    async def capture(scope: Scope, receive: Receive, send: Send) -> None:
        await asgi_app(scope, receive, send)
        routed["endpoint"] = scope.get("endpoint")
        routed["path_params"] = scope.get("path_params")

    probes = {name: f"probe/{index}" for index, name in enumerate(route.param_convertors, start=1)}
    url = "/v1" + route.path
    for name in route.param_convertors:
        url = url.replace(f"{{{name}:identifier}}", probes[name]).replace(
            f"{{{name}}}", probes[name]
        )
    transport = httpx.ASGITransport(app=capture)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await client.request(method, url)
    assert routed["endpoint"] is route.endpoint
    assert routed["path_params"] == probes


async def _create_dataset(httpx_client: httpx.AsyncClient, name: str) -> str:
    response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json={"action": "create", "name": name, "inputs": [{"q": "Q"}]},
    )
    assert response.status_code == 200
    return str(response.json()["data"]["dataset_id"])


async def test_dataset_routes_accept_names_containing_slashes(
    httpx_client: httpx.AsyncClient,
) -> None:
    dataset_id = await _create_dataset(httpx_client, "team/alpha")

    response = await httpx_client.get("v1/datasets/team/alpha")
    assert response.status_code == 200
    assert response.json()["data"]["id"] == dataset_id

    response = await httpx_client.get("v1/datasets/team/alpha/examples")
    assert response.status_code == 200
    assert response.json()["data"]["dataset_id"] == dataset_id

    response = await httpx_client.get("v1/datasets/team/alpha/experiments")
    assert response.status_code == 200
    assert response.json()["data"] == []

    label = await httpx_client.post("v1/dataset_labels", json={"name": "a/b", "color": "#00cc88"})
    assert label.status_code == 201
    response = await httpx_client.put("v1/datasets/team/alpha/labels/a/b")
    assert response.status_code == 200
    assert response.json()["data"]["id"] == label.json()["data"]["id"]
    assert (await httpx_client.get("v1/dataset_labels/a/b")).status_code == 200

    split = await httpx_client.post("v1/datasets/team/alpha/splits", json={"name": "c/d"})
    assert split.status_code == 201
    response = await httpx_client.patch(
        "v1/datasets/team/alpha/splits/c/d", json={"description": "d"}
    )
    assert response.status_code == 200
    assert response.json()["data"]["id"] == split.json()["data"]["id"]
    assert (await httpx_client.delete("v1/datasets/team/alpha/splits/c/d")).status_code == 204

    assert (await httpx_client.delete("v1/datasets/team/alpha")).status_code == 204
    assert (await httpx_client.get(f"v1/datasets/{dataset_id}")).status_code == 404


async def test_project_routes_accept_names_containing_slashes(
    httpx_client: httpx.AsyncClient,
) -> None:
    created = await httpx_client.post("v1/projects", json={"name": "org/app"})
    assert created.status_code == 200
    project_id = created.json()["data"]["id"]

    for suffix in ("", "/sessions", "/traces", "/spans", "/spans/otlpv1", "/annotation_configs"):
        response = await httpx_client.get(f"v1/projects/org/app{suffix}")
        assert response.status_code == 200, suffix
    assert (await httpx_client.get("v1/projects/org/app")).json()["data"]["id"] == project_id

    assert (await httpx_client.delete("v1/projects/org/app")).status_code == 204
    assert (await httpx_client.get(f"v1/projects/{project_id}")).status_code == 404


async def test_annotation_config_routes_accept_names_containing_slashes(
    httpx_client: httpx.AsyncClient,
) -> None:
    config = {"name": "quality/tone", "type": "FREEFORM", "description": None}
    created = await httpx_client.post("v1/annotation_configs", json=config)
    assert created.status_code == 200

    response = await httpx_client.get("v1/annotation_configs/quality/tone")
    assert response.status_code == 200
    assert response.json()["data"] == created.json()["data"]

    response = await httpx_client.delete("v1/annotation_configs/quality/tone")
    assert response.status_code == 200
    assert (await httpx_client.get("v1/annotation_configs/quality/tone")).status_code == 404


async def test_trailing_slash_does_not_resolve_to_an_empty_name(
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.get("v1/datasets/", follow_redirects=False)
    assert response.status_code in (200, 307)
    assert "not found" not in response.text
