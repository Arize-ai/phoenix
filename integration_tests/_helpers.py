from __future__ import annotations

import os
import sys
from contextlib import contextmanager
from subprocess import PIPE, STDOUT
from threading import Lock, Thread
from time import sleep, time
from typing import Any, Dict, Iterator, List, Optional, Protocol
from urllib.parse import urljoin
from urllib.request import urlopen

import httpx
import pytest
from faker import Faker
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter
from opentelemetry.trace import Span, Tracer
from phoenix.config import (
    get_base_url,
    get_env_database_connection_str,
    get_env_database_schema,
    get_env_grpc_port,
    get_env_host,
)
from psutil import STATUS_ZOMBIE, Popen
from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import OperationalError
from typing_extensions import TypeAlias

_ProjectName: TypeAlias = str
_SpanName: TypeAlias = str
_Headers: TypeAlias = Dict[str, Any]


class _SpanExporterConstructor(Protocol):
    def __call__(
        self,
        *,
        headers: Optional[_Headers] = None,
    ) -> SpanExporter: ...


def _get_gql_spans(*keys: str) -> Dict[_ProjectName, List[Dict[str, Any]]]:
    out = "name spans{edges{node{" + " ".join(keys) + "}}}"
    query = dict(query="query{projects{edges{node{" + out + "}}}}")
    resp = _httpx_client().post(urljoin(get_base_url(), "graphql"), json=query)
    resp.raise_for_status()
    resp_dict = resp.json()
    assert not resp_dict.get("errors")
    return {
        project["node"]["name"]: [span["node"] for span in project["node"]["spans"]["edges"]]
        for project in resp_dict["data"]["projects"]["edges"]
    }


def _http_span_exporter(
    *,
    headers: Optional[_Headers] = None,
) -> SpanExporter:
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

    endpoint = urljoin(get_base_url(), "v1/traces")
    exporter = OTLPSpanExporter(endpoint=endpoint, headers=headers, timeout=1)
    exporter._MAX_RETRY_TIMEOUT = 2
    return exporter


def _grpc_span_exporter(
    *,
    headers: Optional[_Headers] = None,
) -> SpanExporter:
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

    host = get_env_host()
    if host == "0.0.0.0":
        host = "127.0.0.1"
    endpoint = f"http://{host}:{get_env_grpc_port()}"
    return OTLPSpanExporter(endpoint=endpoint, headers=headers, timeout=1)


def _get_tracer(
    *,
    project_name: str,
    exporter: SpanExporter,
) -> Tracer:
    resource = Resource({ResourceAttributes.PROJECT_NAME: project_name})
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    return tracer_provider.get_tracer(__name__)


def _start_span(
    *,
    project_name: str,
    span_name: str,
    exporter: SpanExporter,
) -> Span:
    return _get_tracer(project_name=project_name, exporter=exporter).start_span(span_name)


def _httpx_client() -> httpx.Client:
    # Having no timeout is useful when stepping through the debugger on the server side.
    return httpx.Client(timeout=None)


@contextmanager
def _server() -> Iterator[None]:
    if get_env_database_connection_str().startswith("postgresql"):
        # double-check for safety
        assert get_env_database_schema()
    command = f"{sys.executable} -m phoenix.server.main serve"
    process = Popen(command.split(), stdout=PIPE, stderr=STDOUT, text=True, env=os.environ)
    log: List[str] = []
    lock: Lock = Lock()
    Thread(target=_capture_stdout, args=(process, log, lock), daemon=True).start()
    t = 60
    time_limit = time() + t
    timed_out = False
    url = urljoin(get_base_url(), "healthz")
    while not timed_out and _is_alive(process):
        sleep(0.1)
        try:
            urlopen(url)
            break
        except BaseException:
            timed_out = time() > time_limit
    try:
        if timed_out:
            raise TimeoutError(f"Server did not start within {t} seconds.")
        assert _is_alive(process)
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


def _is_alive(process: Popen) -> bool:
    return process.is_running() and process.status() != STATUS_ZOMBIE


def _capture_stdout(process: Popen, log: List[str], lock: Lock) -> None:
    while _is_alive(process):
        line = process.stdout.readline()
        if line or (log and log[-1] != line):
            with lock:
                log.append(line)


@contextmanager
def _random_schema(url: URL, _fake: Faker) -> Iterator[str]:
    engine = create_engine(url.set(drivername="postgresql+psycopg"))
    try:
        engine.connect()
    except OperationalError as ex:
        pytest.skip(f"PostgreSQL unavailable: {ex}")
    schema = _fake.unique.pystr().lower()
    yield schema
    with engine.connect() as conn:
        conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE;"))
        conn.commit()
    engine.dispose()
