import os
import sys
from contextlib import contextmanager
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
    ENV_PHOENIX_WORKING_DIR,
    get_base_url,
    get_env_grpc_port,
    get_env_host,
)
from portpicker import pick_unused_port  # type: ignore[import-untyped]
from psutil import STATUS_ZOMBIE, Popen
from typing_extensions import TypeAlias

ProjectName: TypeAlias = str
SpanName: TypeAlias = str


@pytest.fixture(autouse=True, scope="module")
def set_env_var(tmp_path_factory: TempPathFactory) -> Iterator[None]:
    tmp = tmp_path_factory.getbasetemp()
    values = (
        (ENV_PHOENIX_PORT, str(pick_unused_port())),
        (ENV_PHOENIX_GRPC_PORT, str(pick_unused_port())),
        (ENV_PHOENIX_WORKING_DIR, str(tmp)),
    )
    with mock.patch.dict(os.environ, values):
        yield


class _GetGqlSpans(Protocol):
    def __call__(self, *keys: str) -> Dict[ProjectName, List[Dict[str, Any]]]: ...


@pytest.fixture
def get_gql_spans() -> _GetGqlSpans:
    def _(*keys: str) -> Dict[ProjectName, List[Dict[str, Any]]]:
        query = dict(
            query="query{projects{edges{node{name spans{edges{node{" + " ".join(keys) + "}}}}}}}"
        )
        resp = httpx.post(urljoin(get_base_url(), "graphql"), json=query)
        resp.raise_for_status()
        resp_dict = resp.json()
        assert not resp_dict.get("errors")
        return {
            project["node"]["name"]: [span["node"] for span in project["node"]["spans"]["edges"]]
            for project in resp_dict["data"]["projects"]["edges"]
        }

    return _


_ExporterFactory: TypeAlias = Callable[[Optional[Dict[str, str]]], SpanExporter]


@pytest.fixture(scope="session")
def http_span_exporter() -> _ExporterFactory:
    def _(
        headers: Optional[Dict[str, str]] = None,
    ) -> SpanExporter:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

        endpoint = urljoin(get_base_url(), "v1/traces")
        return OTLPSpanExporter(endpoint, headers=headers)

    return _


@pytest.fixture(scope="session")
def grpc_span_exporter() -> _ExporterFactory:
    def _(
        headers: Optional[Dict[str, str]] = None,
    ) -> SpanExporter:
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

        host = get_env_host()
        if host == "0.0.0.0":
            host = "127.0.0.1"
        endpoint = f"http://{host}:{get_env_grpc_port()}"
        return OTLPSpanExporter(endpoint, headers=headers)

    return _


@pytest.fixture(scope="session", params=["http", "grpc"])
def span_exporter(request: SubRequest) -> _ExporterFactory:
    if request.param == "http":
        return cast(_ExporterFactory, request.getfixturevalue("http_span_exporter"))
    if request.param == "grpc":
        return cast(_ExporterFactory, request.getfixturevalue("grpc_span_exporter"))
    raise ValueError(f"Unknown exporter: {request.param}")


@pytest.fixture(scope="session")
def get_tracer() -> Callable[[ProjectName, SpanExporter], Tracer]:
    def _(
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
    get_tracer: Callable[[ProjectName, SpanExporter], Tracer],
) -> Callable[[ProjectName, SpanName, SpanExporter], Span]:
    def _(
        project_name: str,
        span_name: str,
        exporter: SpanExporter,
    ) -> Span:
        return get_tracer(project_name, exporter).start_span(span_name)

    return _


@pytest.fixture(scope="session")
def fake() -> Faker:
    return Faker()


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
