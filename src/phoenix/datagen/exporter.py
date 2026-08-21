"""Export replayed trace requests over OTLP/HTTP protobuf."""

from __future__ import annotations

import logging
import random
import time
from types import TracebackType
from typing import Mapping
from urllib.parse import urlsplit, urlunsplit

import httpx
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)

logger = logging.getLogger(__name__)

_MAX_ATTEMPTS = 5
_MAX_BACKOFF_SECONDS = 60.0


class OTLPHTTPExporter:
    """Send encoded trace requests to an OTLP/HTTP collector."""

    def __init__(
        self,
        endpoint: str,
        *,
        api_key: str | None = None,
        headers: Mapping[str, str] | None = None,
        timeout: float = 30.0,
    ) -> None:
        request_headers = dict(headers or {})
        request_headers["Content-Type"] = "application/x-protobuf"
        if api_key and not any(key.lower() == "authorization" for key in request_headers):
            request_headers["Authorization"] = f"Bearer {api_key}"
        self._endpoint = _trace_endpoint(endpoint)
        self._client = httpx.Client(headers=request_headers, timeout=timeout)

    def export(self, request: ExportTraceServiceRequest) -> bool:
        """Export one protobuf trace request, returning whether it was delivered."""
        content = request.SerializeToString()
        for attempt in range(1, _MAX_ATTEMPTS + 1):
            try:
                response = self._client.post(self._endpoint, content=content)
                response.raise_for_status()
            except httpx.HTTPError as error:
                message = str(error).replace("\n", " ")
                if attempt == _MAX_ATTEMPTS:
                    logger.warning(
                        "OTLP export failed (attempt %d/%d): %s; dropping batch",
                        attempt,
                        _MAX_ATTEMPTS,
                        message,
                    )
                    return False
                maximum_delay = min(_MAX_BACKOFF_SECONDS, 2.0 ** (attempt - 1))
                delay = random.uniform(maximum_delay / 2, maximum_delay)
                logger.warning(
                    "OTLP export failed (attempt %d/%d): %s; retrying in %.1fs",
                    attempt,
                    _MAX_ATTEMPTS,
                    message,
                    delay,
                )
                time.sleep(delay)
            else:
                return True
        return False

    def close(self) -> None:
        """Close the persistent HTTP connection pool."""
        self._client.close()

    def __enter__(self) -> OTLPHTTPExporter:
        return self

    def __exit__(
        self,
        exception_type: type[BaseException] | None,
        exception: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.close()


def _trace_endpoint(endpoint: str) -> str:
    if "://" not in endpoint:
        endpoint = f"http://{endpoint}"
    split = urlsplit(endpoint)
    path = split.path.rstrip("/")
    if not path.endswith("/v1/traces"):
        path = f"{path}/v1/traces"
    return urlunsplit((split.scheme, split.netloc, path, split.query, split.fragment))
