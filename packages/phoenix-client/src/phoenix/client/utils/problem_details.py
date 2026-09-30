from __future__ import annotations

from typing import Any, Optional

import httpx

from phoenix.client.exceptions import PhoenixAPIError

_DETAIL_LIMIT = 2000


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
        if isinstance(body, dict):
            problem = body
    request = response.request
    message = f"{response.status_code} {response.reason_phrase} for {request.method} {request.url}"
    if problem is not None:
        message += f": [{problem.get('code')}] {problem.get('detail')}"
        for error in problem.get("errors") or ():
            message += f"\n  {error.get('field')}: {error.get('message')}"
        if problem.get("existing_id"):
            message += f"\n  existing_id: {problem['existing_id']}"
    elif response.text:
        message += f": {response.text[:_DETAIL_LIMIT]}"
    raise PhoenixAPIError(message, request=response.request, response=response, problem=problem)
