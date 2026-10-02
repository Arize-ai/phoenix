from typing import Optional

import pytest
from fastapi import APIRouter, FastAPI

from phoenix.server.prometheus import _resolve_route_path, start_prometheus


def _scope(path: str) -> dict[str, object]:
    return {
        "type": "http",
        "method": "GET",
        "path": path,
        "headers": [],
        "path_params": {},
    }


def test_resolve_route_path_for_included_router() -> None:
    """Regression test for FastAPI 0.137, which keeps included routers as lazy
    ``_IncludedRouter`` wrappers in ``app.routes`` that expose no ``path``
    attribute. The middleware must descend into them to resolve the templated
    path instead of raising ``AttributeError: '_IncludedRouter' object has no
    attribute 'path'``.
    """
    inner = APIRouter()

    @inner.get("/spans/{span_id}")
    def get_span(span_id: str) -> str:
        return span_id

    nested = APIRouter()
    nested.include_router(inner, prefix="/projects")

    app = FastAPI()
    app.include_router(inner, prefix="/v1")  # prefix supplied at include time
    app.include_router(nested, prefix="/api")  # nested include

    assert _resolve_route_path(app.routes, _scope("/v1/spans/abc")) == "/v1/spans/{span_id}"
    assert (
        _resolve_route_path(app.routes, _scope("/api/projects/spans/xyz"))
        == "/api/projects/spans/{span_id}"
    )


def test_resolve_route_path_returns_none_for_unmatched() -> None:
    app = FastAPI()

    @app.get("/health")
    def health() -> str:
        return "ok"

    assert _resolve_route_path(app.routes, _scope("/health")) == "/health"
    assert _resolve_route_path(app.routes, _scope("/does-not-exist")) is None


class _IdleThread:
    def __init__(self, *args: object, **kwargs: object) -> None:
        pass

    def start(self) -> None:
        return None


@pytest.mark.parametrize(
    "host, expected",
    [
        pytest.param("127.0.0.1", "127.0.0.1", id="ipv4_loopback"),
        pytest.param("::1", "::1", id="ipv6_loopback"),
        pytest.param("localhost", "localhost", id="localhost"),
        pytest.param("0.0.0.0", "0.0.0.0", id="all_ipv4"),
        pytest.param(None, "::", id="all_interfaces"),
        pytest.param("127.1", "127.1", id="unparsed_spelling"),
    ],
)
def test_start_prometheus_binds_host(
    monkeypatch: pytest.MonkeyPatch, host: Optional[str], expected: str
) -> None:
    bound: dict[str, object] = {}

    def fake_start(port: int, addr: str = "", registry: object = None) -> None:
        bound["port"] = port
        bound["addr"] = addr

    monkeypatch.setattr("phoenix.server.prometheus.start_http_server", fake_start)
    monkeypatch.setattr("phoenix.server.prometheus.Thread", _IdleThread)
    start_prometheus(host)
    assert bound == {"port": 9090, "addr": expected}
