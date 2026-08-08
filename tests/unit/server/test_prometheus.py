from fastapi import APIRouter, FastAPI

from phoenix.server.prometheus import _resolve_route_path


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
