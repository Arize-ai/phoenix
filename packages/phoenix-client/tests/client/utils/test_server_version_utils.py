import pytest

from phoenix.client.client import PhoenixHTTPClient
from phoenix.client.utils.server_version_utils import (
    ALL_REQUIREMENTS,
    ANNOTATE_SESSIONS,
    DELETE_SESSION,
    DELETE_SESSIONS,
    GET_SESSION,
    GET_SPANS_TRACE_IDS,
    LIST_PROJECT_SESSIONS,
    ParameterRequirement,
    RouteRequirement,
    ensure_server_feature,
)


class TestRouteRequirement:
    def test_kind(self) -> None:
        assert GET_SESSION.kind == "route"

    def test_feature_auto_derived(self) -> None:
        assert GET_SESSION.feature == "The GET /v1/sessions/{session_id} route"

    def test_feature_with_description(self) -> None:
        req = RouteRequirement(
            method="GET",
            path="/v1/foo",
            min_version=(1, 0, 0),
            description="Custom description",
        )
        assert req.feature == "Custom description"


class TestParameterRequirement:
    def test_kind(self) -> None:
        assert GET_SPANS_TRACE_IDS.kind == "parameter"

    def test_feature_auto_derived(self) -> None:
        assert (
            GET_SPANS_TRACE_IDS.feature
            == "The 'trace_ids' query parameter on GET /v1/projects/{id}/spans"
        )

    def test_feature_with_description(self) -> None:
        req = ParameterRequirement(
            parameter_name="foo",
            parameter_location="query",
            route="GET /v1/bar",
            min_version=(1, 0, 0),
            description="Custom param description",
        )
        assert req.feature == "Custom param description"


class TestEnsureServerFeature:
    def test_no_error_when_version_satisfies(self) -> None:
        client = PhoenixHTTPClient(base_url="http://localhost:6006")
        client.server_version = (13, 14, 0)
        ensure_server_feature(client, GET_SESSION)

    def test_raises_when_version_too_old(self) -> None:
        client = PhoenixHTTPClient(base_url="http://localhost:6006")
        client.server_version = (13, 13, 0)
        with pytest.raises(Exception, match="requires Phoenix >= 13.14.0"):
            ensure_server_feature(client, GET_SESSION)

    def test_raises_with_feature_label(self) -> None:
        client = PhoenixHTTPClient(base_url="http://localhost:6006")
        client.server_version = (12, 0, 0)
        with pytest.raises(Exception, match="The DELETE /v1/sessions/"):
            ensure_server_feature(client, DELETE_SESSION)

    def test_no_error_when_version_unknown(self) -> None:
        client = PhoenixHTTPClient(base_url="http://localhost:6006")
        client.server_version = None
        ensure_server_feature(client, GET_SESSION)


class TestAllRequirements:
    def test_contains_all(self) -> None:
        assert GET_SESSION in ALL_REQUIREMENTS
        assert DELETE_SESSION in ALL_REQUIREMENTS
        assert DELETE_SESSIONS in ALL_REQUIREMENTS
        assert LIST_PROJECT_SESSIONS in ALL_REQUIREMENTS
        assert ANNOTATE_SESSIONS in ALL_REQUIREMENTS
        assert GET_SPANS_TRACE_IDS in ALL_REQUIREMENTS
        assert len(ALL_REQUIREMENTS) == 6
