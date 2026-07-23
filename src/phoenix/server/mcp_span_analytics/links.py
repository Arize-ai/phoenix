"""Phoenix UI link composition for the span analytics MCP tools.

Every result that names a span, a trace, or a cohort carries a deep link
into the Phoenix UI, so a finding made through the tools is one click away
from the human view of the same data. This module owns two concerns: how
the public origin of the deployment is determined, and how a group row's
identity becomes a filter-grammar condition the UI's span view accepts.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional, Sequence
from urllib.parse import urlencode

from phoenix.config import ENV_PHOENIX_ROOT_URL, get_env_root_url
from phoenix.server.mcp_span_analytics.compiler import TimeRange
from phoenix.server.mcp_span_analytics.envelope import iso
from phoenix.server.utils import prepend_root_path


def public_url(path: str, get_request: Callable[[], Any]) -> str:
    """Compose an absolute Phoenix UI link for ``path``.

    Behind a reverse proxy, only two parties can know the public origin:
    explicit configuration, or the incoming request itself — the server's
    own host/port settings describe where it listens, not where clients
    reach it. Precedence follows the OAuth machinery's ``public_origin``:
    ``PHOENIX_ROOT_URL`` when set; otherwise the current MCP request's
    origin with its ASGI ``root_path`` prepended; and the
    environment-composed URL only as the last resort when no request
    context exists. ``get_request`` is the transport's request accessor,
    injected so link composition stays independent of the serving stack.
    """
    if os.getenv(ENV_PHOENIX_ROOT_URL):
        return f"{str(get_env_root_url()).rstrip('/')}{path}"
    try:
        request = get_request()
    except RuntimeError:
        return f"{str(get_env_root_url()).rstrip('/')}{path}"
    origin = f"{request.base_url.scheme}://{request.base_url.netloc}"
    # The request is seen inside the mounted MCP app, so its ASGI root_path
    # is "<deployment prefix><MCP mount>". The deployment prefix (a reverse
    # proxy's) belongs in UI links; the app's own MCP mount does not — a UI
    # route lives at /projects/..., never /mcp/projects/....
    from phoenix.server.mcp_server import MCP_MOUNT_PATH

    root_path = str(request.scope.get("root_path", "")).rstrip("/")
    if root_path.endswith(MCP_MOUNT_PATH):
        root_path = root_path[: -len(MCP_MOUNT_PATH)]
    return f"{origin}{prepend_root_path({'root_path': root_path}, path)}"


def filter_literal(value: Any) -> str:
    """Render one group-key value as a filter-grammar literal.

    Strings are escaped for the grammar (which parses Python string
    literals): backslashes first, then single quotes — a value like
    ``o'brien-corp`` must survive both the grammar and URL encoding.
    """
    if isinstance(value, str):
        escaped = value.replace("\\", "\\\\").replace("'", "\\'")
        return f"'{escaped}'"
    return repr(value)


def bucket_start(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    return None


def cohort_url(
    base: str,
    breakdowns: Sequence[Any],
    raw_values: Sequence[Any],
    time_range: TimeRange,
) -> str:
    """Deep link to the group's cohort in the Phoenix UI span view.

    The link carries the group's condition as a ``filter`` in the filter
    grammar (breakdown-key equalities ANDed) plus ``start``/``end``. A
    time bucket contributes nothing to ``filter``; it narrows the time
    params to its hour instead. A **null group key is skipped**: the UI
    filter grammar cannot express "attribute is absent" today, so the
    null bucket links to the window without that conjunct — a wider
    cohort than the row, by declared necessity.
    """
    conjuncts: list[str] = []
    window_start, window_end = time_range.start, time_range.end
    for breakdown, value in zip(breakdowns, raw_values):
        if breakdown.is_time_bucket:
            bucket = bucket_start(value)
            if bucket is not None:
                window_start, window_end = bucket, bucket + timedelta(hours=1)
        elif value is not None:
            conjuncts.append(f"{breakdown.id} == {filter_literal(value)}")
    params: dict[str, str] = {}
    if conjuncts:
        params["filter"] = " and ".join(conjuncts)
    params["start"] = iso(window_start)
    params["end"] = iso(window_end)
    return f"{base}?{urlencode(params)}"
