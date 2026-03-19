from __future__ import annotations

from phoenix.client.utils.server_requirements import (
    ParameterRequirement,
    RouteRequirement,
    Version,
)

GET_SESSION = RouteRequirement(
    method="GET",
    path="/v1/sessions/{session_id}",
    min_server_version=Version(13, 5, 0),
)

DELETE_SESSION = RouteRequirement(
    method="DELETE",
    path="/v1/sessions/{session_id}",
    min_server_version=Version(13, 13, 0),
)

DELETE_SESSIONS = RouteRequirement(
    method="POST",
    path="/v1/sessions/delete",
    min_server_version=Version(13, 13, 0),
)

LIST_PROJECT_SESSIONS = RouteRequirement(
    method="GET",
    path="/v1/projects/{project_id}/sessions",
    min_server_version=Version(13, 5, 0),
)

ANNOTATE_SESSIONS = RouteRequirement(
    method="POST",
    path="/v1/session_annotations",
    min_server_version=Version(12, 0, 0),
)

GET_SPANS_TRACE_IDS = ParameterRequirement(
    parameter_name="trace_id",
    parameter_location="query",
    route="GET /v1/projects/{id}/spans",
    min_server_version=Version(13, 9, 0),
)

GET_SPANS_FILTERS = ParameterRequirement(
    parameter_name="span_kind",
    parameter_location="query",
    route="GET /v1/projects/{id}/spans",
    min_server_version=Version(13, 15, 0),
)

LIST_PROJECT_TRACES = RouteRequirement(
    method="GET",
    path="/v1/projects/{project_identifier}/traces",
    min_server_version=Version(13, 15, 0),
)
