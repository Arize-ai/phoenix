from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Literal, Optional

import httpx
import pytest

from .._helpers import _AppInfo, _get, _httpx_client


@dataclass
class _FilterProject:
    client: httpx.Client
    name: str
    trace_ids: list[str]
    session_ids: list[str]

    def list(self, resource: str, **params: Any) -> httpx.Response:
        return self.client.get(f"v1/projects/{self.name}/{resource}", params=params)


@pytest.fixture
async def _project(_app: _AppInfo) -> AsyncIterator[_FilterProject]:
    with _httpx_client(_app, _app.admin_secret) as client:
        project_names = [token_hex(8), token_hex(8)]
        try:
            for project_name in project_names:
                client.post("v1/projects", json={"name": project_name}).raise_for_status()
                trace_ids = [token_hex(16) for _ in range(4)]
                session_ids = [token_hex(8) for _ in trace_ids]
                spans = []
                for index, (trace_id, session_id) in enumerate(zip(trace_ids, session_ids)):
                    start = datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=index)
                    end = start + timedelta(milliseconds=100 * (index + 1))
                    root_id = token_hex(8)
                    for is_child in (False, True):
                        spans.append(
                            {
                                "name": "tool" if is_child else "root",
                                "context": {
                                    "trace_id": trace_id,
                                    "span_id": token_hex(8) if is_child else root_id,
                                },
                                "parent_id": root_id if is_child else None,
                                "span_kind": "TOOL" if is_child else "CHAIN",
                                "start_time": start.isoformat(),
                                "end_time": end.isoformat(),
                                "status_code": "ERROR" if is_child and index % 2 == 0 else "OK",
                                "attributes": {"session.id": session_id},
                            }
                        )
                client.post(
                    f"v1/projects/{project_name}/spans", json={"data": spans}
                ).raise_for_status()
                project = _FilterProject(client, project_name, trace_ids, session_ids)

                def ready() -> Optional[bool]:
                    response = project.list("spans")
                    response.raise_for_status()
                    return True if len(response.json()["data"]) == len(spans) else None

                await _get(ready)
                for resource, field, ids in (
                    ("trace_annotations", "trace_id", trace_ids),
                    ("session_annotations", "session_id", session_ids),
                ):
                    client.post(
                        f"v1/{resource}",
                        params={"sync": True},
                        json={
                            "data": [
                                {
                                    field: identifier,
                                    "name": "quality",
                                    "annotator_kind": "CODE",
                                    "identifier": annotation_identifier,
                                    "result": {"score": 0.2},
                                }
                                for identifier in ids[::2]
                                for annotation_identifier in ("first", "second")
                            ]
                        },
                    ).raise_for_status()
            yield project
        finally:
            for project_name in project_names:
                client.delete(f"v1/projects/{project_name}").raise_for_status()


@pytest.mark.parametrize("resource", ["traces", "sessions"])
@pytest.mark.parametrize("order", ["asc", "desc"])
@pytest.mark.parametrize("annotation", [False, True])
def test_filters_before_pagination_without_duplicates(
    _project: _FilterProject, resource: str, order: str, annotation: bool
) -> None:
    annotation_collection = "trace_annotations" if resource == "traces" else "session_annotations"
    condition = (
        f'{annotation_collection}["quality"].score < 0.5'
        if annotation
        else 'any(span.status_code == "ERROR" for span in spans)'
    )
    field = "trace_id" if resource == "traces" else "session_id"
    expected = (_project.trace_ids if resource == "traces" else _project.session_ids)[::2]
    returned: list[str] = []
    cursor = None
    for _ in range(len(expected) + 1):
        params = {"filter": condition, "order": order, "limit": 1}
        if cursor is not None:
            params["cursor"] = cursor
        response = _project.list(resource, **params)
        response.raise_for_status()
        body = response.json()
        returned.extend(row[field] for row in body["data"])
        cursor = body["next_cursor"]
        if cursor is None:
            break
    assert cursor is None
    assert len(returned) == len(expected)
    assert set(returned) == set(expected)
    if resource == "traces":
        assert returned == (expected if order == "asc" else expected[::-1])


@pytest.mark.parametrize(
    "resource,condition,indices",
    [
        ("traces", "error_count > 0 and latency_ms >= 200", [2]),
        ("traces", "error_count == 0 or latency_ms <= 100", [0, 1, 3]),
        ("sessions", "num_traces_with_error > 0 and duration_ms >= 200", [2]),
        ("sessions", "num_traces == 1 and duration_ms <= 200", [0, 1]),
        ("traces", "", [0, 1, 2, 3]),
        ("sessions", "", [0, 1, 2, 3]),
    ],
)
def test_filter_semantics(
    _project: _FilterProject, resource: str, condition: str, indices: list[int]
) -> None:
    response = _project.list(resource, filter=condition)
    response.raise_for_status()
    field = "trace_id" if resource == "traces" else "session_id"
    ids = _project.trace_ids if resource == "traces" else _project.session_ids
    assert {row[field] for row in response.json()["data"]} == {ids[index] for index in indices}


@pytest.mark.parametrize("has_error", [True, False])
def test_trace_filter_composes_with_legacy_filters(
    _project: _FilterProject, has_error: bool
) -> None:
    params = {
        "error": has_error,
        "min_latency_ms": 200,
        "max_latency_ms": 400,
        "start_time": "2026-01-01T00:00:01Z",
        "end_time": "2026-01-01T00:00:04Z",
        "sort": "latency_ms",
        "order": "desc",
        "include_spans": True,
    }
    legacy = _project.list("traces", **params)
    legacy.raise_for_status()
    response = _project.list("traces", filter="latency_ms <= 300", **params)
    response.raise_for_status()
    expected_index = 2 if has_error else 1
    assert [row["trace_id"] for row in response.json()["data"]] == [
        _project.trace_ids[expected_index]
    ]
    assert len(response.json()["data"][0]["spans"]) == 2
    assert {row["trace_id"] for row in legacy.json()["data"]} == {
        _project.trace_ids[index] for index in ([2] if has_error else [1, 3])
    }
    response = _project.list(
        "traces", filter="error_count > 0", session_identifier=_project.session_ids[1]
    )
    response.raise_for_status()
    assert response.json()["data"] == []


@pytest.mark.parametrize("resource", ["traces", "sessions"])
@pytest.mark.parametrize("condition", ["(", "unknown_field > 0", "duration_ms.lower() == 'x'"])
def test_invalid_filters_return_client_errors(
    _project: _FilterProject, resource: Literal["traces", "sessions"], condition: str
) -> None:
    response = _project.list(resource, filter=condition)
    assert response.status_code == 400
    assert response.text


def test_openapi_filter_contract(_project: _FilterProject) -> None:
    response = _project.client.get("openapi.json")
    response.raise_for_status()
    paths = response.json()["paths"]
    for resource in ("traces", "sessions"):
        operation = paths[f"/v1/projects/{{project_identifier}}/{resource}"]["get"]
        parameters = {parameter["name"]: parameter for parameter in operation["parameters"]}
        assert parameters["filter"]["required"] is False
        assert "400" in operation["responses"]
        if resource == "traces":
            for name in ("error", "min_latency_ms", "max_latency_ms"):
                assert parameters[name]["deprecated"] is True
