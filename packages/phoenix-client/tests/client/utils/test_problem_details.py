import json

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


@pytest.mark.parametrize(
    "errors",
    [
        "broken",
        {"field": "body.name", "message": "bad"},
        [None],
        [42],
        [{"field": 42, "message": "bad"}],
        [{"field": "body.name"}],
    ],
)
def test_malformed_optional_fields_do_not_mask_problem(errors: object) -> None:
    body = {
        "status": 422,
        "code": "validation_error",
        "detail": "invalid input",
        "errors": errors,
        "reason": {"unexpected": "shape"},
        "existing_id": ["unexpected", "shape"],
        "current_version_id": "RXZhbHVhdG9yVmVyc2lvbjox",
    }
    response = _response(
        status_code=422,
        content=json.dumps(body).encode(),
        content_type="application/problem+json",
    )

    with pytest.raises(PhoenixAPIError) as excinfo:
        raise_for_problem(response)

    error = excinfo.value
    assert error.request is response.request
    assert error.response is response
    assert error.response.status_code == 422
    assert error.problem == body
    assert error.problem is not None
    assert error.reason == body["reason"]
    assert error.existing_id == body["existing_id"]
    assert error.problem["current_version_id"] == body["current_version_id"]
    assert "invalid input" in str(error)
    assert "body.name" not in str(error)
    assert "reason:" not in str(error)
    assert "existing_id:" not in str(error)


def test_well_formed_field_errors_keep_their_format() -> None:
    body = {
        "status": 422,
        "code": "validation_error",
        "detail": "invalid input",
        "errors": [
            None,
            {"field": "body.email", "message": 42},
            {"field": "body.name", "code": "missing", "message": "Field required"},
            {"field": "query.limit", "code": "wrong_type", "message": "Expected integer"},
        ],
    }
    response = _response(
        status_code=422,
        content=json.dumps(body).encode(),
        content_type="application/problem+json",
    )

    with pytest.raises(PhoenixAPIError) as excinfo:
        raise_for_problem(response)

    assert "\n  body.name: Field required" in str(excinfo.value)
    assert "\n  query.limit: Expected integer" in str(excinfo.value)


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
