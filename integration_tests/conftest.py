import os
import sys
from contextlib import ExitStack, contextmanager
from subprocess import PIPE, STDOUT
from threading import Lock, Thread
from time import sleep, time
from typing import Any, Callable, ContextManager, Dict, Iterator, List, Optional, Protocol, cast
from unittest import mock
from urllib.parse import urljoin
from urllib.request import urlopen

import httpx
import pytest
from _pytest.fixtures import SubRequest
from _pytest.tmpdir import TempPathFactory
from faker import Faker
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter
from opentelemetry.trace import Span, Tracer
from phoenix.config import (
    ENV_PHOENIX_GRPC_PORT,
    ENV_PHOENIX_PORT,
    ENV_PHOENIX_SQL_DATABASE_SCHEMA,
    ENV_PHOENIX_SQL_DATABASE_URL,
    ENV_PHOENIX_WORKING_DIR,
    get_base_url,
    get_env_grpc_port,
    get_env_host,
)
from portpicker import pick_unused_port  # type: ignore[import-untyped]
from psutil import STATUS_ZOMBIE, Popen
from sqlalchemy import URL, create_engine, make_url, text
from sqlalchemy.exc import OperationalError
from typing_extensions import TypeAlias

_ProjectName: TypeAlias = str
_SpanName: TypeAlias = str
_Headers: TypeAlias = Dict[str, Any]


class _GetGqlSpans(Protocol):
    def __call__(self, *keys: str) -> Dict[_ProjectName, List[Dict[str, Any]]]: ...


class _SpanExporterFactory(Protocol):
    def __call__(
        self,
        *,
        headers: Optional[_Headers] = None,
    ) -> SpanExporter: ...


class _GetTracer(Protocol):
    def __call__(
        self,
        *,
        project_name: _ProjectName,
        exporter: SpanExporter,
    ) -> Tracer: ...


class _StartSpan(Protocol):
    def __call__(
        self,
        *,
        project_name: _ProjectName,
        span_name: _SpanName,
        exporter: SpanExporter,
    ) -> Span: ...


@pytest.fixture(scope="class")
def fake() -> Faker:
    return Faker()


@pytest.fixture(autouse=True, scope="class")
def env(tmp_path_factory: TempPathFactory) -> Iterator[None]:
    tmp = tmp_path_factory.getbasetemp()
    values = (
        (ENV_PHOENIX_PORT, str(pick_unused_port())),
        (ENV_PHOENIX_GRPC_PORT, str(pick_unused_port())),
        (ENV_PHOENIX_WORKING_DIR, str(tmp)),
    )
    with mock.patch.dict(os.environ, values):
        yield


@pytest.fixture(
    scope="class",
    params=[
        pytest.param("sqlite:///:memory:", id="sqlite"),
        pytest.param(
            "postgresql://127.0.0.1:5432/postgres?user=postgres&password=phoenix",
            id="postgresql",
        ),
    ],
)
def sql_database_url(request: SubRequest) -> URL:
    return make_url(request.param)


@pytest.fixture(autouse=True, scope="class")
def env_phoenix_sql_database_url(
    sql_database_url: URL,
    fake: Faker,
) -> Iterator[None]:
    values = [(ENV_PHOENIX_SQL_DATABASE_URL, sql_database_url.render_as_string())]
    with ExitStack() as stack:
        if sql_database_url.get_backend_name().startswith("postgresql"):
            schema = stack.enter_context(_random_schema(sql_database_url, fake))
            values.append((ENV_PHOENIX_SQL_DATABASE_SCHEMA, schema))
        stack.enter_context(mock.patch.dict(os.environ, values))
        yield


@pytest.fixture(autouse=True, scope="class")
def env_phoenix_sql_database_schema(
    fake: Faker,
) -> Iterator[None]:
    schema = fake.unique.pystr()
    values = ((ENV_PHOENIX_SQL_DATABASE_SCHEMA, schema),)
    with mock.patch.dict(os.environ, values):
        yield


@pytest.fixture
def get_gql_spans(
    httpx_client: httpx.Client,
) -> _GetGqlSpans:
    def _(*keys: str) -> Dict[_ProjectName, List[Dict[str, Any]]]:
        out = "name spans{edges{node{" + " ".join(keys) + "}}}"
        query = dict(query="query{projects{edges{node{" + out + "}}}}")
        resp = httpx_client.post(urljoin(get_base_url(), "graphql"), json=query)
        resp.raise_for_status()
        resp_dict = resp.json()
        assert not resp_dict.get("errors")
        return {
            project["node"]["name"]: [span["node"] for span in project["node"]["spans"]["edges"]]
            for project in resp_dict["data"]["projects"]["edges"]
        }

    return _


@pytest.fixture(scope="session")
def http_span_exporter() -> _SpanExporterFactory:
    def _(
        *,
        headers: Optional[_Headers] = None,
    ) -> SpanExporter:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

        endpoint = urljoin(get_base_url(), "v1/traces")
        exporter = OTLPSpanExporter(endpoint=endpoint, headers=headers, timeout=1)
        exporter._MAX_RETRY_TIMEOUT = 2
        return exporter

    return _


@pytest.fixture(scope="session")
def grpc_span_exporter() -> _SpanExporterFactory:
    def _(
        *,
        headers: Optional[_Headers] = None,
    ) -> SpanExporter:
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

        host = get_env_host()
        if host == "0.0.0.0":
            host = "127.0.0.1"
        endpoint = f"http://{host}:{get_env_grpc_port()}"
        return OTLPSpanExporter(endpoint=endpoint, headers=headers, timeout=1)

    return _


@pytest.fixture(scope="session", params=["http", "grpc"])
def span_exporter(request: SubRequest) -> _SpanExporterFactory:
    if request.param == "http":
        return cast(_SpanExporterFactory, request.getfixturevalue("http_span_exporter"))
    if request.param == "grpc":
        return cast(_SpanExporterFactory, request.getfixturevalue("grpc_span_exporter"))
    raise ValueError(f"Unknown exporter: {request.param}")


@pytest.fixture(scope="session")
def get_tracer() -> _GetTracer:
    def _(
        *,
        project_name: str,
        exporter: SpanExporter,
    ) -> Tracer:
        resource = Resource({ResourceAttributes.PROJECT_NAME: project_name})
        tracer_provider = TracerProvider(resource=resource)
        tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
        return tracer_provider.get_tracer(__name__)

    return _


@pytest.fixture(scope="session")
def start_span(
    get_tracer: _GetTracer,
) -> _StartSpan:
    def _(
        *,
        project_name: str,
        span_name: str,
        exporter: SpanExporter,
    ) -> Span:
        return get_tracer(project_name=project_name, exporter=exporter).start_span(span_name)

    return _


@pytest.fixture(scope="session")
def httpx_client() -> httpx.Client:
    # Having no timeout is useful when stepping through the debugger.
    return httpx.Client(timeout=None)


@pytest.fixture(scope="session")
def server() -> Callable[[], ContextManager[None]]:
    @contextmanager
    def _() -> Iterator[None]:
        command = f"{sys.executable} -m phoenix.server.main serve"
        process = Popen(command.split(), stdout=PIPE, stderr=STDOUT, text=True, env=os.environ)
        log: List[str] = []
        lock: Lock = Lock()
        Thread(target=capture_stdout, args=(process, log, lock), daemon=True).start()
        t = 60
        time_limit = time() + t
        timed_out = False
        url = urljoin(get_base_url(), "healthz")
        while not timed_out and is_alive(process):
            sleep(0.1)
            try:
                urlopen(url)
                break
            except BaseException:
                timed_out = time() > time_limit
        try:
            if timed_out:
                raise TimeoutError(f"Server did not start within {t} seconds.")
            assert is_alive(process)
            with lock:
                for line in log:
                    print(line, end="")
                log.clear()
            yield
            process.terminate()
            process.wait(10)
        finally:
            for line in log:
                print(line, end="")

    return _


def is_alive(process: Popen) -> bool:
    return process.is_running() and process.status() != STATUS_ZOMBIE


def capture_stdout(process: Popen, log: List[str], lock: Lock) -> None:
    while is_alive(process):
        line = process.stdout.readline()
        if line or (log and log[-1] != line):
            with lock:
                log.append(line)


@contextmanager
def _random_schema(url: URL, fake: Faker) -> Iterator[str]:
    engine = create_engine(url.set(drivername="postgresql+psycopg"))
    try:
        engine.connect()
    except OperationalError as ex:
        pytest.skip(f"PostgreSQL unavailable: {ex}")
    schema = fake.unique.pystr().lower()
    yield schema
    with engine.connect() as conn:
        conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE;"))
        conn.commit()
    engine.dispose()
