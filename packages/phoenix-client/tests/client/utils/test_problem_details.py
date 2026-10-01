import httpx
import pytest

from phoenix.client.exceptions import PhoenixAPIError
from phoenix.client.utils.problem_details import raise_for_problem


def _response(
    *, status_code: int, content: bytes, content_type: str, method: str = "GET"
) -> httpx.Response:
    request = httpx.Request(method, "https://example.com/v1/evaluators")
    return httpx.Response(
        status_code,
        content=content,
        headers={"content-type": content_type},
        request=request,
    )


def test_success_does_not_raise() -> None:
    raise_for_problem(_response(status_code=200, content=b"{}", content_type="application/json"))


def test_well_formed_problem_is_parsed() -> None:
    body = (
        b'{"type": "urn:phoenix:problem:already_exists", "title": "Already exists", '
        b'"status": 409, "detail": "taken", "code": "already_exists", '
        b'"existing_id": "RXZhbHVhdG9yOjE="}'
    )
    with pytest.raises(PhoenixAPIError) as excinfo:
        raise_for_problem(
            _response(status_code=409, content=body, content_type="application/problem+json")
        )
    error = excinfo.value
    assert error.problem is not None
    assert error.code == "already_exists"
    assert error.existing_id == "RXZhbHVhdG9yOjE="
    assert error.reason is None
    assert error.response.status_code == 409


def test_unknown_reason_and_extension_members_pass_through() -> None:
    body = (
        b'{"type": "urn:phoenix:problem:conflict", "title": "Conflict", "status": 409, '
        b'"detail": "changed", "code": "conflict", "reason": "some_future_reason", '
        b'"a_future_field": {"nested": true}}'
    )
    with pytest.raises(PhoenixAPIError) as excinfo:
        raise_for_problem(
            _response(status_code=409, content=body, content_type="application/problem+json")
        )
    error = excinfo.value
    assert error.reason == "some_future_reason"
    assert error.problem is not None
    assert error.problem["a_future_field"] == {"nested": True}


def test_malformed_body_is_not_a_problem() -> None:
    """Right content type, but missing the fields a problem detail always has."""
    body = b'{"error": "something broke"}'
    with pytest.raises(PhoenixAPIError) as excinfo:
        raise_for_problem(
            _response(status_code=500, content=body, content_type="application/problem+json")
        )
    error = excinfo.value
    assert error.problem is None
    assert error.code is None
    assert error.reason is None
    assert error.response.status_code == 500


def test_non_json_proxy_page_is_not_a_problem() -> None:
    """A proxy in front of Phoenix can return its own HTML error page under any status."""
    body = b"<html><body>502 Bad Gateway</body></html>"
    with pytest.raises(PhoenixAPIError) as excinfo:
        raise_for_problem(_response(status_code=502, content=body, content_type="text/html"))
    error = excinfo.value
    assert error.problem is None
    assert error.response.status_code == 502
    assert "502 Bad Gateway" in str(error)
