from __future__ import annotations

from collections.abc import Iterator
from typing import Any, Optional, cast

import httpx

from phoenix.client.exceptions import PhoenixAPIError

_DETAIL_LIMIT = 2000


def _iter_field_errors(errors: Any) -> Iterator[tuple[str, str]]:
    """Yield renderable field errors, ignoring malformed optional error details."""
    if not isinstance(errors, list):
        return
    field_errors: list[Any] = errors
    for candidate in field_errors:
        if not isinstance(candidate, dict):
            continue
        error = cast(dict[str, Any], candidate)
        field = error.get("field")
        message = error.get("message")
        if isinstance(field, str) and isinstance(message, str):
            yield field, message


def _is_problem_detail(body: Any) -> bool:
    """A problem body is a JSON object with, at minimum, an int `status` and string `code`
    and `detail`; anything else (a proxy's HTML page, a truncated body, a body some other
    layer wrote under this content type) is not one, even under the right content type."""
    if not isinstance(body, dict):
        return False
    # isinstance(dict) does not supply key and value types, so name them before reading fields.
    payload = cast(dict[str, Any], body)
    return (
        isinstance(payload.get("status"), int)
        and isinstance(payload.get("code"), str)
        and isinstance(payload.get("detail"), str)
    )


def raise_for_problem(response: httpx.Response) -> None:
    """Raise :class:`PhoenixAPIError` for an error response, carrying its problem details."""
    if response.is_success:
        return
    problem: Optional[dict[str, Any]] = None
    if response.headers.get("content-type", "").startswith("application/problem+json"):
        try:
            body = response.json()
        except ValueError:
            body = None
        if _is_problem_detail(body):
            problem = body
    request = response.request
    message = f"{response.status_code} {response.reason_phrase} for {request.method} {request.url}"
    if problem is not None:
        message += f": [{problem.get('code')}] {problem.get('detail')}"
        for field, error_message in _iter_field_errors(problem.get("errors")):
            message += f"\n  {field}: {error_message}"
        reason = problem.get("reason")
        if isinstance(reason, str) and reason:
            message += f"\n  reason: {reason}"
        existing_id = problem.get("existing_id")
        if isinstance(existing_id, str) and existing_id:
            message += f"\n  existing_id: {existing_id}"
    elif response.text:
        message += f": {response.text[:_DETAIL_LIMIT]}"
    raise PhoenixAPIError(message, request=response.request, response=response, problem=problem)
