import pytest

from phoenix.client.client import PhoenixHTTPClient
from phoenix.client.constants.server_requirements import (
    ALL_REQUIREMENTS,
    ANNOTATE_SESSIONS,
    DELETE_SESSION,
    DELETE_SESSIONS,
    GET_SESSION,
    GET_SPANS_TRACE_IDS,
    LIST_PROJECT_SESSIONS,
)
from phoenix.client.types.server_requirements import (
    ParameterRequirement,
    RouteRequirement,
)
from phoenix.client.utils.server_version_utils import ensure_server_capability


class TestRouteRequirement:
    def test_kind(self) -> None:
        assert GET_SESSION.kind == "route"

    def test_capability_auto_derived(self) -> None:
        assert GET_SESSION.capability == "The GET /v1/sessions/{session_id} route"

    def test_capability_with_description(self) -> None:
        req = RouteRequirement(
            method="GET",
            path="/v1/foo",
            min_server_version=(1, 0, 0),
            description="Custom description",
        )
        assert req.capability == "Custom description"


class TestParameterRequirement:
    def test_kind(self) -> None:
        assert GET_SPANS_TRACE_IDS.kind == "parameter"

    def test_capability_auto_derived(self) -> None:
        assert (
            GET_SPANS_TRACE_IDS.capability
            == "The 'trace_id' query parameter on GET /v1/projects/{id}/spans"
        )

    def test_capability_with_description(self) -> None:
        req = ParameterRequirement(
            parameter_name="foo",
            parameter_location="query",
            route="GET /v1/bar",
            min_server_version=(1, 0, 0),
            description="Custom param description",
        )
        assert req.capability == "Custom param description"


class TestEnsureServerCapability:
    def test_no_error_when_version_satisfies(self) -> None:
        client = PhoenixHTTPClient(base_url="http://localhost:6006")
        client.server_version = (13, 5, 0)
        ensure_server_capability(client=client, requirement=GET_SESSION)

    def test_raises_when_version_too_old(self) -> None:
        client = PhoenixHTTPClient(base_url="http://localhost:6006")
        client.server_version = (13, 4, 0)
        with pytest.raises(Exception, match="requires Phoenix >= 13.5.0"):
            ensure_server_capability(client=client, requirement=GET_SESSION)

    def test_raises_with_capability_label(self) -> None:
        client = PhoenixHTTPClient(base_url="http://localhost:6006")
        client.server_version = (12, 0, 0)
        with pytest.raises(Exception, match="The DELETE /v1/sessions/"):
            ensure_server_capability(client=client, requirement=DELETE_SESSION)

    def test_raises_when_version_unknown(self) -> None:
        from unittest.mock import patch

        from phoenix.client.exceptions import PhoenixException

        client = PhoenixHTTPClient(base_url="http://localhost:6006")
        # fetch_server_version raises when the version can't be determined
        with patch.object(
            client,
            "fetch_server_version",
            side_effect=PhoenixException(
                "Phoenix server version could not be determined. "
                "Please ensure you are connecting to a supported Phoenix server."
            ),
        ):
            with pytest.raises(PhoenixException, match="version could not be determined"):
                ensure_server_capability(client=client, requirement=GET_SESSION)


class TestAllRequirements:
    def test_contains_all(self) -> None:
        assert GET_SESSION in ALL_REQUIREMENTS
        assert DELETE_SESSION in ALL_REQUIREMENTS
        assert DELETE_SESSIONS in ALL_REQUIREMENTS
        assert LIST_PROJECT_SESSIONS in ALL_REQUIREMENTS
        assert ANNOTATE_SESSIONS in ALL_REQUIREMENTS
        assert GET_SPANS_TRACE_IDS in ALL_REQUIREMENTS
        assert len(ALL_REQUIREMENTS) == 6
